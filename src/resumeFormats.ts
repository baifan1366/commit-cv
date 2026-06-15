/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ResumeFormatId = 'classic' | 'sidebar' | 'two-column' | 'compact' | 'modern';

export type ResumeLayoutId = ResumeFormatId;

export interface ResumeFormatOption {
  id: ResumeFormatId;
  name: string;
  description: string;
  layout: ResumeLayoutId;
}

export const DEFAULT_RESUME_FORMAT: ResumeFormatId = 'classic';

const LEGACY_FORMAT_MAP: Record<string, ResumeFormatId> = {
  readable: 'classic',
  'impact-focused': 'classic',
  'project-first': 'compact',
  'tech-stack': 'sidebar',
  highlight: 'modern',
  metrics: 'two-column',
  'software-engineer': 'classic',
  'ai-engineer': 'modern',
  'frontend-engineer': 'modern',
  portfolio: 'sidebar',
};

export const RESUME_FORMAT_OPTIONS: ResumeFormatOption[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional single-column flow — header, summary, skills, then projects.',
    layout: 'classic',
  },
  {
    id: 'sidebar',
    name: 'Sidebar',
    description: 'Left sidebar for contact & skills; main column for summary and projects.',
    layout: 'sidebar',
  },
  {
    id: 'two-column',
    name: 'Two Column',
    description: 'Full-width header, then skills and projects side by side.',
    layout: 'two-column',
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Dense one-page layout with minimal spacing — ideal for students.',
    layout: 'compact',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Bold header band with split body — contact strip and project focus.',
    layout: 'modern',
  },
];

export function resolveResumeFormat(id?: string): ResumeFormatId {
  if (!id) return DEFAULT_RESUME_FORMAT;
  if (RESUME_FORMAT_OPTIONS.some((f) => f.id === id)) return id as ResumeFormatId;
  return LEGACY_FORMAT_MAP[id] ?? DEFAULT_RESUME_FORMAT;
}

export function getResumeFormatOption(id?: string): ResumeFormatOption {
  const resolved = resolveResumeFormat(id);
  return RESUME_FORMAT_OPTIONS.find((f) => f.id === resolved) ?? RESUME_FORMAT_OPTIONS[0];
}
