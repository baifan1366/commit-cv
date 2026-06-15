/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ResumeFormatId } from './resumeFormats';

export interface GitHubActivity {
  repositories: Array<{
    name: string;
    description: string | null;
    language: string | null;
    stars: number;
    updatedAt: string;
    url: string;
  }>;
  commits: Array<{
    sha: string;
    message: string;
    date: string;
    repository: string;
    author: string;
  }>;
  pullRequests: Array<{
    title: string;
    state: string;
    number: number;
    repository: string;
    createdAt: string;
    url: string;
  }>;
  issues: Array<{
    title: string;
    state: string;
    number: number;
    repository: string;
    createdAt: string;
  }>;
}

export interface TechSkills {
  languages: string[];
  frameworks: string[];
  databases: string[];
  tools: string[];
}

export interface ResumeProject {
  id: string;
  name: string;
  role: string;
  techStack: string[];
  description: string[]; // bullets
  stars?: number;
  url?: string;
}

export interface OpenSourceContribution {
  project: string;
  role: string;
  prCount: number;
  highlight: string;
}

export interface ResumeContact {
  location?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  twitter?: string;
  instagram?: string;
  facebook?: string;
  age?: string;
  languages?: string[];
}

export interface CommitCVResume {
  name: string;
  title: string;
  slogan: string;
  summary: string;
  contact?: ResumeContact;
  skills: TechSkills;
  projects: ResumeProject[];
  openSourceSummary: string;
  openSourceContributions: OpenSourceContribution[];
  statistics: {
    repositoriesCount: number;
    commitsCount: number;
    pullRequestsCount: number;
    issuesCount: number;
  };
  lastUpdated: string | number; // timestamp in ms or legacy string
  resumeFormat?: ResumeFormatId;
  fontSize?: '10pt' | '11pt' | '12pt';
  fontFamily?: 'Georgia' | 'Times New Roman' | 'Arial' | 'Helvetica' | 'Calibri';
  avatarUrl?: string;
  latestPush?: {
    repository: string;
    commitMessage: string;
    timestamp: string;
    addedSkills: string[];
  };
  githubData?: GitHubActivity; // Store raw GitHub data for AI Coach
}

export interface CoachInsights {
  mentorProfile: {
    name: string;
    role: string;
    style: string;
  };
  overallVerdict: string;
  alerts: CoachAlert[];
  observations: CoachObservation[];
  generatedAt: number; // timestamp
}

export interface CoachAlert {
  id: string;
  type: 'trajectory' | 'depth' | 'warning' | 'opportunity';
  title: string;
  explanation: string;
}

export interface CoachObservation {
  timestamp: string;
  note: string;
}

export interface CoachMessage {
  id: string;
  sender: 'user' | 'mentor';
  text: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface ResumeChatState {
  resume: CommitCVResume;
  messages: ChatMessage[];
  isLoading: boolean;
}

export interface WebhookSetupResult {
  success: boolean;
  message: string;
  totalRepos: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    repo: string;
    success: boolean;
    error?: string;
    hookId?: number;
  }>;
}

export interface WebhookStatus {
  enabled: boolean;
  totalRepos: number;
  reposWithWebhook: number;
  coverage: number;
}
