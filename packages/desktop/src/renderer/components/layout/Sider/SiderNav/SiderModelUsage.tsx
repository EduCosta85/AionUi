/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Popover } from '@arco-design/web-react';
import { Brain, SettingTwo } from '@icon-park/react';
import classNames from 'classnames';
import {
  formatCostAmount,
  formatPercentage,
  formatTokenCount,
} from '@/renderer/components/agent/ContextUsageIndicator';
import { useActiveModelUsage } from '@/renderer/hooks/agent/useActiveModelUsage';
import type { SiderTooltipProps } from '@/renderer/utils/ui/siderTooltip';

interface SiderModelUsageProps {
  collapsed?: boolean;
  isMobile?: boolean;
  siderTooltipProps?: SiderTooltipProps;
}

const SiderModelUsage: React.FC<SiderModelUsageProps> = ({
  collapsed = false,
  isMobile,
  siderTooltipProps: _siderTooltipProps,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const navigate = useNavigate();

  const {
    modelName,
    agentName,
    totalTokens,
    contextLimit,
    percentage,
    hasLimit,
    isWarning,
    isDanger,
    cost,
    breakdown,
  } = useActiveModelUsage();

  const displayModelName = modelName || t('common.defaultModel', 'Default Model');

  const displayTotal = useMemo(() => formatTokenCount(totalTokens, locale), [totalTokens, locale]);
  const displayLimit = useMemo(
    () => (hasLimit ? formatTokenCount(contextLimit, locale, true) : '0'),
    [hasLimit, contextLimit, locale]
  );

  const formattedPct = useMemo(() => formatPercentage(percentage, locale), [percentage, locale]);

  const usageSubtitle = useMemo(() => {
    if (hasLimit) {
      return t('conversation.contextUsage.quotaSummary', '{{percentage}} quota • {{tokens}}', {
        percentage: formattedPct,
        tokens: `${displayTotal} / ${displayLimit}`,
      });
    }
    if (totalTokens <= 0) {
      return t('conversation.contextUsage.noUsage', '0 tokens');
    }
    return t('conversation.contextUsage.tokensUsed', '{{tokens}} tokens', { tokens: displayTotal });
  }, [hasLimit, totalTokens, formattedPct, displayTotal, displayLimit, t]);

  const handleNavigateToModelSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigate('/settings/model');
  };

  // Ring calculations for SVG gauge
  const strokeColor = isDanger ? 'rgb(var(--danger-6))' : isWarning ? 'rgb(var(--warning-6))' : 'rgb(var(--primary-6))';

  // Expanded ring (size 22, r 8.5)
  const radiusExpanded = 8.5;
  const circumferenceExpanded = 2 * Math.PI * radiusExpanded;
  const strokeDashoffsetExpanded = circumferenceExpanded - (Math.min(percentage, 100) / 100) * circumferenceExpanded;

  // Collapsed ring (size 20, r 7.5)
  const radiusCollapsed = 7.5;
  const circumferenceCollapsed = 2 * Math.PI * radiusCollapsed;
  const strokeDashoffsetCollapsed = circumferenceCollapsed - (Math.min(percentage, 100) / 100) * circumferenceCollapsed;

  const breakdownParts = useMemo(() => {
    if (!breakdown) return [];
    const parts: Array<{ label: string; value: string }> = [];
    if (typeof breakdown.input_tokens === 'number') {
      parts.push({
        label: t('conversation.contextUsage.input', 'Input'),
        value: formatTokenCount(breakdown.input_tokens, locale),
      });
    }
    if (typeof breakdown.output_tokens === 'number') {
      parts.push({
        label: t('conversation.contextUsage.output', 'Output'),
        value: formatTokenCount(breakdown.output_tokens, locale),
      });
    }
    if (breakdown.cached_read_tokens) {
      parts.push({
        label: t('conversation.contextUsage.cachedRead', 'Cache read'),
        value: formatTokenCount(breakdown.cached_read_tokens, locale),
      });
    }
    if (breakdown.cached_write_tokens) {
      parts.push({
        label: t('conversation.contextUsage.cachedWrite', 'Cache write'),
        value: formatTokenCount(breakdown.cached_write_tokens, locale),
      });
    }
    if (breakdown.thought_tokens) {
      parts.push({
        label: t('conversation.contextUsage.thought', 'Thinking'),
        value: formatTokenCount(breakdown.thought_tokens, locale),
      });
    }
    return parts;
  }, [breakdown, locale, t]);

  const popoverContent = (
    <div
      className='p-10px min-w-220px max-w-280px flex flex-col gap-8px select-none'
      data-testid='sider-model-usage-popover'
    >
      {/* Header */}
      <div className='flex items-center justify-between gap-8px pb-8px border-b border-solid border-[var(--color-border-2)]'>
        <div className='flex items-center gap-6px min-w-0 flex-1'>
          <Brain theme='outline' size='16' fill='currentColor' className='text-primary shrink-0' />
          <span className='text-13px font-semibold text-t-primary truncate' title={displayModelName}>
            {displayModelName}
          </span>
        </div>
        {agentName && (
          <span className='px-6px py-1px text-10px font-medium rd-4px bg-fill-2 text-t-secondary shrink-0'>
            {agentName}
          </span>
        )}
      </div>

      {/* Progress bar or tokens used */}
      {hasLimit ? (
        <div className='flex flex-col gap-4px'>
          <div className='flex items-center justify-between text-12px'>
            <span className='text-t-secondary'>{t('conversation.contextUsage.quota', 'Quota')}</span>
            <span
              className={classNames(
                'font-mono font-medium',
                isDanger ? 'text-danger-6' : isWarning ? 'text-warning-6' : 'text-t-primary'
              )}
            >
              {formattedPct} ({displayTotal} / {displayLimit})
            </span>
          </div>
          <div className='w-full h-6px rd-3px bg-fill-3 overflow-hidden'>
            <div
              className='h-full rd-3px transition-all duration-300'
              style={{
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: strokeColor,
              }}
            />
          </div>
        </div>
      ) : (
        <div className='flex items-center justify-between text-12px'>
          <span className='text-t-secondary'>
            {t('conversation.contextUsage.tokensUsed', 'Tokens used', { tokens: '' }).trim()}
          </span>
          <span className='font-mono font-medium text-t-primary'>{displayTotal}</span>
        </div>
      )}

      {/* Breakdown Details */}
      {breakdownParts.length > 0 && (
        <div className='flex flex-col gap-4px pt-4px border-t border-dashed border-[var(--color-border-2)] text-11px text-t-secondary'>
          {breakdownParts.map((part, index) => (
            <div key={index} className='flex items-center justify-between'>
              <span>{part.label}</span>
              <span className='font-mono text-t-primary'>{part.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Session Cost */}
      {cost && (
        <div className='flex items-center justify-between text-11px text-t-secondary pt-4px border-t border-dashed border-[var(--color-border-2)]'>
          <span>{t('conversation.contextUsage.sessionCost', 'Session cost')}</span>
          <span className='font-mono font-medium text-t-primary'>≈ {formatCostAmount(cost, locale)}</span>
        </div>
      )}

      {/* Footer Action: Settings Link */}
      <div className='pt-6px border-t border-solid border-[var(--color-border-2)] flex justify-end'>
        <div
          onClick={handleNavigateToModelSettings}
          className='flex items-center gap-4px text-11px text-primary hover:text-primary-hover cursor-pointer transition-colors'
        >
          <SettingTwo theme='outline' size='12' fill='currentColor' />
          <span>{t('settings.model', 'Model settings')}</span>
        </div>
      </div>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      position={collapsed ? 'right' : 'top'}
      trigger='hover'
      popupHoverStay
      className='sider-model-usage-popover'
    >
      {collapsed ? (
        <div
          onClick={handleNavigateToModelSettings}
          data-testid='sider-model-usage-collapsed'
          className='h-34px w-full flex items-center justify-center rd-0.5rem cursor-pointer transition-colors hover:bg-fill-3 active:bg-fill-4'
        >
          {hasLimit ? (
            <svg width='20' height='20' viewBox='0 0 20 20' style={{ transform: 'rotate(-90deg)' }}>
              <circle cx='10' cy='10' r='7.5' fill='none' stroke='var(--color-fill-3)' strokeWidth='2' />
              <circle
                cx='10'
                cy='10'
                r='7.5'
                fill='none'
                stroke={strokeColor}
                strokeWidth='2'
                strokeLinecap='round'
                strokeDasharray={circumferenceCollapsed}
                strokeDashoffset={strokeDashoffsetCollapsed}
                style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
              />
            </svg>
          ) : (
            <Brain theme='outline' size='16' fill='currentColor' className='text-t-secondary' />
          )}
        </div>
      ) : (
        <div
          onClick={handleNavigateToModelSettings}
          data-testid='sider-model-usage'
          className={classNames(
            'group h-40px flex items-center rd-0.5rem cursor-pointer transition-colors px-10px py-4px hover:bg-fill-3 active:bg-fill-4 select-none min-w-0',
            isMobile && 'sider-footer-btn-mobile'
          )}
        >
          {/* Leading Icon / Circular Gauge */}
          <span className='size-22px flex items-center justify-center shrink-0 me-8px relative'>
            {hasLimit ? (
              <svg width='22' height='22' viewBox='0 0 22 22' style={{ transform: 'rotate(-90deg)' }}>
                <circle cx='11' cy='11' r='8.5' fill='none' stroke='var(--color-fill-3)' strokeWidth='2' />
                <circle
                  cx='11'
                  cy='11'
                  r='8.5'
                  fill='none'
                  stroke={strokeColor}
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeDasharray={circumferenceExpanded}
                  strokeDashoffset={strokeDashoffsetExpanded}
                  style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
                />
              </svg>
            ) : (
              <Brain
                theme='outline'
                size='16'
                fill='currentColor'
                className='text-t-secondary group-hover:text-primary transition-colors'
              />
            )}
          </span>

          {/* Center Text: Model Name & Usage Subtitle */}
          <div className='flex-1 min-w-0 flex flex-col justify-center overflow-hidden'>
            <span className='text-13px font-medium leading-16px text-t-primary truncate' title={displayModelName}>
              {displayModelName}
            </span>
            <span className='text-11px leading-14px text-t-secondary truncate'>{usageSubtitle}</span>
          </div>

          {/* Right percentage badge if limit is known */}
          {hasLimit && (
            <span
              className={classNames(
                'ms-4px px-5px py-1px text-10px font-mono font-medium rd-4px shrink-0',
                isDanger
                  ? 'bg-danger-1 text-danger-6'
                  : isWarning
                    ? 'bg-warning-1 text-warning-6'
                    : 'bg-fill-2 text-t-secondary'
              )}
            >
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
    </Popover>
  );
};

export default SiderModelUsage;
