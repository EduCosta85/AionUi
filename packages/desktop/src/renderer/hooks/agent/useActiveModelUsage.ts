/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import type { TokenUsageBreakdown, TokenUsageCost, TokenUsageData } from '@/common/config/storage';
import { useConversationHistoryContext } from '@/renderer/hooks/context/ConversationHistoryContext';
import { useCurrentConversation } from '@/renderer/pages/conversation/explorer/currentConversationStore';
import { tokenUsageFromAcpUsage } from '@/renderer/pages/conversation/platforms/acp/useAcpMessage';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

type ConversationUsageExtra = {
  current_model_id?: string;
  agent_name?: string;
  backend?: string;
  last_token_usage?: TokenUsageData;
  last_context_limit?: number;
  codexModel?: string;
};

export type ActiveModelUsage = {
  modelName: string;
  agentName: string | null;
  totalTokens: number;
  contextLimit: number;
  percentage: number;
  hasLimit: boolean;
  isWarning: boolean;
  isDanger: boolean;
  cost?: TokenUsageCost;
  breakdown?: TokenUsageBreakdown;
};

export function useActiveModelUsage(): ActiveModelUsage {
  const currentConversationId = useCurrentConversation();
  const location = useLocation();
  const routeConversationId = location.pathname.startsWith('/conversation/') ? location.pathname.split('/')[2] : null;

  const conversationId = currentConversationId || routeConversationId;

  const { conversations } = useConversationHistoryContext();

  const conversation = useMemo(() => {
    if (conversationId) {
      const match = conversations.find((c) => c.id === conversationId);
      if (match) return match;
    }
    return conversations.length > 0 ? conversations[0] : null;
  }, [conversationId, conversations]);

  const [liveUsage, setLiveUsage] = useState<TokenUsageData | null>(null);
  const [liveContextLimit, setLiveContextLimit] = useState<number>(0);
  const [liveModelId, setLiveModelId] = useState<string | null>(null);

  // Sync with conversation data when conversation changes
  useEffect(() => {
    const extra = conversation?.extra as ConversationUsageExtra | undefined;
    setLiveModelId(extra?.current_model_id || extra?.codexModel || null);
    setLiveUsage(extra?.last_token_usage ?? null);
    setLiveContextLimit(extra?.last_context_limit ?? 0);

    const activeId = conversation?.id;
    if (!activeId) return;

    let cancelled = false;

    // Fetch latest usage snapshot from backend
    void ipcBridge.conversation.getUsage
      .invoke({ conversation_id: activeId })
      .then((usage) => {
        if (cancelled || !usage || typeof usage.used !== 'number' || usage.used < 0) return;
        setLiveUsage(tokenUsageFromAcpUsage(usage));
        if (usage.size > 0) {
          setLiveContextLimit(usage.size);
        }
      })
      .catch(() => {});

    // Listen to live stream events for context usage and model info
    const unsubscribe = ipcBridge.conversation.responseStream.on((message: IResponseMessage) => {
      if (message.conversation_id !== activeId) return;

      if (message.type === 'acp_context_usage' && message.data) {
        const usageData = message.data as {
          used: number;
          size: number;
          cost?: { amount: number; currency: string };
          _meta?: Record<string, unknown>;
        };
        if (typeof usageData.used === 'number') {
          setLiveUsage(tokenUsageFromAcpUsage(usageData));
          if (usageData.size > 0) {
            setLiveContextLimit(usageData.size);
          }
        }
      } else if (message.type === 'acp_model_info' && message.data) {
        const data = message.data as { model?: string };
        if (typeof data.model === 'string' && data.model) {
          setLiveModelId(data.model);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [conversation?.id]);

  const modelName = useMemo(() => {
    if (liveModelId) return liveModelId;
    const extra = conversation?.extra as ConversationUsageExtra | undefined;
    if (extra?.current_model_id) return extra.current_model_id;
    if (extra?.codexModel) return extra.codexModel;
    if (extra?.agent_name) return extra.agent_name;
    if (extra?.backend) return extra.backend;
    return '';
  }, [conversation?.extra, liveModelId]);

  const extra = conversation?.extra as ConversationUsageExtra | undefined;
  const agentName = extra?.agent_name || extra?.backend || null;

  const totalTokens = liveUsage?.total_tokens ?? 0;
  const contextLimit = resolveModelContextLimit(modelName, liveContextLimit);
  const hasLimit = contextLimit > 0;
  const percentage = hasLimit ? (totalTokens / contextLimit) * 100 : 0;
  const isWarning = percentage > 70;
  const isDanger = percentage > 90;

  return {
    modelName,
    agentName,
    totalTokens,
    contextLimit,
    percentage,
    hasLimit,
    isWarning,
    isDanger,
    cost: liveUsage?.cost,
    breakdown: liveUsage?.breakdown,
  };
}

/**
 * Resolves a model's context quota limit in tokens.
 * Uses the reported limit if positive, or falls back to known defaults based on the model family.
 */
export function resolveModelContextLimit(modelName?: string, reportedLimit?: number): number {
  if (reportedLimit && reportedLimit > 0) return reportedLimit;
  if (!modelName) return 128_000;

  const lower = modelName.toLowerCase();
  if (lower.includes('gemini')) {
    return 1_000_000;
  }
  if (lower.includes('claude')) {
    return 200_000;
  }
  if (lower.includes('gpt-4') || lower.includes('o1') || lower.includes('o3') || lower.includes('o4')) {
    return 128_000;
  }
  if (lower.includes('deepseek')) {
    return 64_000;
  }
  if (lower.includes('qwen')) {
    return 128_000;
  }
  return 128_000;
}
