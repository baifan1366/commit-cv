/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export interface CommitCVResume {
  name: string;
  title: string;
  slogan: string;
  summary: string;
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
  lastUpdated: string; // e.g. "Just now" or "2 minutes ago"
  avatarUrl?: string;
  latestPush?: {
    repository: string;
    commitMessage: string;
    timestamp: string;
    addedSkills: string[];
  };
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
