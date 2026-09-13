/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import type { ConversationRecord } from '@/common/config/storage';
import SiderModelUsage from '@/renderer/components/layout/Sider/SiderNav/SiderModelUsage';
import { resolveModelContextLimit, useActiveModelUsage } from '@/renderer/hooks/agent/useActiveModelUsage';

const navigateMock = vi.fn();
let currentPathname = '/conversation/conv-1';

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ pathname: currentPathname }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      if (typeof fallbackOrOptions === 'string') {
        let res = fallbackOrOptions;
        const opts = (typeof options === 'object' ? options : {}) as Record<string, unknown>;
        for (const [k, v] of Object.entries(opts)) {
          res = res.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        }
        return res;
      }
      return key;
    },
    i18n: { language: 'en-US' },
  }),
}));

let activeConversationId: string | null = 'conv-1';
vi.mock('@/renderer/pages/conversation/explorer/currentConversationStore', () => ({
  useCurrentConversation: () => activeConversationId,
}));

let mockConversations: ConversationRecord[] = [];
vi.mock('@/renderer/hooks/context/ConversationHistoryContext', () => ({
  useConversationHistoryContext: () => ({ conversations: mockConversations }),
}));

let streamCallback: ((msg: IResponseMessage) => void) | null = null;
const unsubscribeMock = vi.fn();
const getUsageInvokeMock = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      getUsage: {
        invoke: (...args: unknown[]) => getUsageInvokeMock(...args),
      },
      responseStream: {
        on: (cb: (msg: IResponseMessage) => void) => {
          streamCallback = cb;
          return unsubscribeMock;
        },
      },
    },
  },
}));

// Mock Arco Popover so children and popoverContent can both be inspected in DOM
vi.mock('@arco-design/web-react', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    Popover: ({ content, children }: { content: React.ReactNode; children: React.ReactNode }) =>
      ReactModule.createElement('div', { 'data-testid': 'mock-popover' }, children, content),
  };
});

describe('SiderModelUsage and useActiveModelUsage', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    unsubscribeMock.mockClear();
    getUsageInvokeMock.mockReset().mockResolvedValue(null);
    streamCallback = null;
    currentPathname = '/conversation/conv-1';
    activeConversationId = 'conv-1';

    mockConversations = [
      {
        id: 'conv-1',
        title: 'Test Conv',
        createTime: Date.now(),
        updateTime: Date.now(),
        status: 'idle',
        type: 'chat',
        extra: {
          current_model_id: 'claude-3-7-sonnet',
          agent_name: 'Claude Agent',
          last_token_usage: {
            total_tokens: 50000,
            cost: { amount: 0.15, currency: 'USD' },
            breakdown: {
              input_tokens: 40000,
              output_tokens: 10000,
              cached_read_tokens: 5000,
              cached_write_tokens: 2000,
              thought_tokens: 1000,
            },
          },
          last_context_limit: 200000,
        },
      },
    ];
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders model name, usage progress, and percentage badge in expanded mode', () => {
    render(<SiderModelUsage collapsed={false} />);

    expect(screen.getByTestId('sider-model-usage')).toBeInTheDocument();
    expect(screen.getAllByText('claude-3-7-sonnet').length).toBeGreaterThan(0);
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getAllByText('25.0% quota • 50.0K / 200K').length).toBeGreaterThan(0);
  });

  it('navigates to /settings/model when clicked in expanded mode', () => {
    render(<SiderModelUsage collapsed={false} />);

    fireEvent.click(screen.getByTestId('sider-model-usage'));
    expect(navigateMock).toHaveBeenCalledWith('/settings/model');
  });

  it('renders circular gauge in collapsed mode and navigates on click', () => {
    render(<SiderModelUsage collapsed={true} />);

    const collapsedItem = screen.getByTestId('sider-model-usage-collapsed');
    expect(collapsedItem).toBeInTheDocument();

    fireEvent.click(collapsedItem);
    expect(navigateMock).toHaveBeenCalledWith('/settings/model');
  });

  it('renders popover with token breakdown, cost, and agent label', () => {
    render(<SiderModelUsage collapsed={false} />);

    const popover = screen.getByTestId('sider-model-usage-popover');
    expect(popover).toBeInTheDocument();

    expect(screen.getByText('Quota')).toBeInTheDocument();
    expect(screen.getByText('Claude Agent')).toBeInTheDocument();
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('Cache read')).toBeInTheDocument();
    expect(screen.getByText('Cache write')).toBeInTheDocument();
    expect(screen.getByText('Thinking')).toBeInTheDocument();
    expect(screen.getByText('Session cost')).toBeInTheDocument();
    expect(screen.getByText('Model settings')).toBeInTheDocument();
  });

  it('renders fallback when conversations is empty', () => {
    mockConversations = [];
    render(<SiderModelUsage collapsed={false} />);

    expect(screen.getAllByText('Default Model').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.0% quota • 0 / 128K').length).toBeGreaterThan(0);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('applies warning threshold when usage exceeds 70%', () => {
    mockConversations[0].extra = {
      ...mockConversations[0].extra,
      last_token_usage: { total_tokens: 150000 },
      last_context_limit: 200000,
    };

    render(<SiderModelUsage collapsed={false} />);
    expect(screen.getByText('75%')).toHaveClass('text-warning-6');
  });

  it('applies danger threshold when usage exceeds 90%', () => {
    mockConversations[0].extra = {
      ...mockConversations[0].extra,
      last_token_usage: { total_tokens: 190000 },
      last_context_limit: 200000,
    };

    render(<SiderModelUsage collapsed={false} />);
    expect(screen.getByText('95%')).toHaveClass('text-danger-6');
  });

  it('updates live usage when backend getUsage resolves', async () => {
    getUsageInvokeMock.mockResolvedValueOnce({
      used: 80000,
      size: 200000,
    });

    const { result } = renderHook(() => useActiveModelUsage());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.totalTokens).toBe(80000);
    expect(result.current.percentage).toBe(40);
  });

  it('updates live usage and model info from stream events', () => {
    const { result } = renderHook(() => useActiveModelUsage());

    expect(streamCallback).toBeTypeOf('function');

    act(() => {
      streamCallback?.({
        conversation_id: 'conv-1',
        type: 'acp_context_usage',
        data: { used: 120000, size: 200000 },
      });
    });

    expect(result.current.totalTokens).toBe(120000);
    expect(result.current.percentage).toBe(60);

    act(() => {
      streamCallback?.({
        conversation_id: 'conv-1',
        type: 'acp_model_info',
        data: { model: 'gpt-4o' },
      });
    });

    expect(result.current.modelName).toBe('gpt-4o');
  });

  it('ignores stream messages from other conversations', () => {
    const { result } = renderHook(() => useActiveModelUsage());

    act(() => {
      streamCallback?.({
        conversation_id: 'other-conv',
        type: 'acp_context_usage',
        data: { used: 180000, size: 200000 },
      });
    });

    expect(result.current.totalTokens).toBe(50000);
  });

  it('unsubscribes from stream on unmount', () => {
    const { unmount } = renderHook(() => useActiveModelUsage());
    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('resolves default model context quota limits when limit is not reported', () => {
    expect(resolveModelContextLimit('claude-3-7-sonnet')).toBe(200000);
    expect(resolveModelContextLimit('gemini-2.5-pro')).toBe(1000000);
    expect(resolveModelContextLimit('gpt-4o')).toBe(128000);
    expect(resolveModelContextLimit('deepseek-v3')).toBe(64000);
    expect(resolveModelContextLimit('custom-model', 500000)).toBe(500000);
    expect(resolveModelContextLimit()).toBe(128000);
  });
});
