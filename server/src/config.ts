import { config as loadEnv } from "dotenv";
import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../.env") });

function envOrDefault(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function resolveHome(p: string): string {
  return p.startsWith("~") ? resolve(homedir(), p.slice(2)) : resolve(p);
}

export type AnalysisProvider = "anthropic" | "openai" | "gemini";

const DEFAULT_MODELS: Record<AnalysisProvider, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
};

const analysisProvider = envOrDefault("ANALYSIS_PROVIDER", "anthropic") as AnalysisProvider;

export const config = {
  claudeDir: resolveHome(envOrDefault("CLAUDE_DIR", "~/.claude")),
  serverPort: parseInt(envOrDefault("SERVER_PORT", "3001"), 10),
  activeThresholdMs: parseInt(envOrDefault("ACTIVE_THRESHOLD_MS", "60000"), 10),
  analysisProvider,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  analysisModel: envOrDefault("ANALYSIS_MODEL", DEFAULT_MODELS[analysisProvider]),
} as const;

export const MODEL_PRICING: Record<
  string,
  {
    inputPerMillion: number;
    outputPerMillion: number;
    cacheReadPerMillion: number;
    cacheCreationPerMillion: number;
  }
> = {
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

export function estimateCost(
  model: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  }
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-sonnet-4-6"];
  return (
    (usage.input_tokens * pricing.inputPerMillion) / 1_000_000 +
    (usage.output_tokens * pricing.outputPerMillion) / 1_000_000 +
    (usage.cache_read_input_tokens * pricing.cacheReadPerMillion) / 1_000_000 +
    (usage.cache_creation_input_tokens * pricing.cacheCreationPerMillion) / 1_000_000
  );
}
