import type { TokenUsage, ContentBlock } from "./session.js";

export interface ParsedMessage {
  readonly uuid: string;
  readonly type: "user" | "assistant" | "system";
  readonly timestamp: string;
  readonly content: string | readonly ContentBlock[];
  readonly model?: string;
  readonly usage?: TokenUsage;
  readonly toolName?: string;
  readonly agentId?: string;
  readonly isSidechain: boolean;
}

export interface SubagentMeta {
  readonly agentId: string;
  readonly agentType: string;
  readonly description: string;
}

export interface Subagent extends SubagentMeta {
  readonly messageCount: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly model?: string;
  readonly lastActiveAt: string | null;
}

export interface SessionSummary {
  readonly id: string;
  readonly projectId: string;
  readonly aiTitle: string | null;
  readonly slug: string | null;
  readonly summary: string;
  readonly entrypoint: string | null;
  readonly cwd: string;
  readonly version: string | null;
  readonly gitBranch: string | null;
  readonly startedAt: string;
  readonly lastActiveAt: string;
  readonly messageCount: number;
  readonly model: string | null;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalCacheCreationTokens: number;
  readonly totalCacheReadTokens: number;
  readonly subagentCount: number;
  readonly isActive: boolean;
}

export interface Session extends SessionSummary {
  readonly messages: readonly ParsedMessage[];
  readonly subagents: readonly Subagent[];
}

export interface CostRecord {
  readonly timestamp: string;
  readonly session_id: string;
  readonly model: string;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly estimated_cost_usd: number;
}

export interface TokenTimelinePoint {
  readonly timestamp: string;
  readonly messageIndex: number;
  readonly cumulativeInput: number;
  readonly cumulativeOutput: number;
  readonly cumulativeCacheCreation: number;
  readonly cumulativeCacheRead: number;
  readonly model: string;
}

export interface SessionTokenTimeline {
  readonly sessionId: string;
  readonly points: readonly TokenTimelinePoint[];
}

export interface DailyTokenUsage {
  readonly date: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationTokens: number;
  readonly cacheReadTokens: number;
  readonly sessionCount: number;
}

export interface ModelBreakdown {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost: number;
}

export interface TokenAnalytics {
  readonly daily: readonly DailyTokenUsage[];
  readonly byModel: readonly ModelBreakdown[];
  readonly totalInput: number;
  readonly totalOutput: number;
  readonly totalEstimatedCost: number;
}

export interface CostAnalytics {
  readonly daily: readonly { date: string; cost: number; model: string }[];
  readonly totalCost: number;
  readonly byModel: readonly { model: string; cost: number }[];
}

export interface ModelPricing {
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
  readonly cacheReadPerMillion: number;
  readonly cacheCreationPerMillion: number;
}
