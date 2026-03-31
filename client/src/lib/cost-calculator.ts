import type { TokenUsage, ModelPricing } from "@agent-watcher/shared";

const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-6": {
    inputPerMillion: 15,
    outputPerMillion: 75,
    cacheReadPerMillion: 1.5,
    cacheCreationPerMillion: 18.75,
  },
  "claude-opus-4-5-20250514": {
    inputPerMillion: 15,
    outputPerMillion: 75,
    cacheReadPerMillion: 1.5,
    cacheCreationPerMillion: 18.75,
  },
  "claude-sonnet-4-6": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheCreationPerMillion: 3.75,
  },
  "claude-sonnet-4-5-20250514": {
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheCreationPerMillion: 3.75,
  },
  "claude-haiku-4-5-20251001": {
    inputPerMillion: 0.8,
    outputPerMillion: 4,
    cacheReadPerMillion: 0.08,
    cacheCreationPerMillion: 1,
  },
};

const DEFAULT_PRICING = MODEL_PRICING["claude-sonnet-4-6"];

export function estimateCost(model: string, usage: TokenUsage): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  return (
    (usage.input_tokens * pricing.inputPerMillion) / 1_000_000 +
    (usage.output_tokens * pricing.outputPerMillion) / 1_000_000 +
    (usage.cache_read_input_tokens * pricing.cacheReadPerMillion) / 1_000_000 +
    (usage.cache_creation_input_tokens * pricing.cacheCreationPerMillion) / 1_000_000
  );
}
