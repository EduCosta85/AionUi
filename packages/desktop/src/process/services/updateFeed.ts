/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { CdnGenericProvider } from './cdnGenericProvider';
import type { CdnGenericProviderConfiguration } from './cdnGenericProvider';

export const DEFAULT_REPO = 'EduCosta85/AionUi';
export const CDN_UPDATE_BASE_URL = 'https://static.aionui.com/releases';

export type CdnFeedOptions = CdnGenericProviderConfiguration & {
  updateProvider: typeof CdnGenericProvider;
};

export function buildCdnFeedOptions(): CdnFeedOptions {
  return {
    provider: 'custom',
    url: CDN_UPDATE_BASE_URL,
    updateProvider: CdnGenericProvider,
  };
}

export type GitHubFeedOptions = {
  provider: 'github';
  owner: string;
  repo: string;
};

export type UpdateFeedOptions = CdnFeedOptions | GitHubFeedOptions;

export function buildUpdateFeedOptions(customRepo?: string): UpdateFeedOptions {
  const repo = (customRepo || process.env.AIONUI_GITHUB_REPO || DEFAULT_REPO).trim();

  // If explicitly requested to use CDN, or targeting the official repo when CDN is requested
  if (
    process.env.AIONUI_USE_CDN === '1' ||
    (repo.toLowerCase() === 'iofficeai/aionui' && process.env.AIONUI_USE_CDN !== '0')
  ) {
    return buildCdnFeedOptions();
  }

  const [owner, repoName] = repo.split('/');
  return {
    provider: 'github',
    owner: owner || 'EduCosta85',
    repo: repoName || 'AionUi',
  };
}
