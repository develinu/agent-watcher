import type {
  TokenAnalytics,
  SessionTokenTimeline,
  TokenTimelinePoint,
  DailyTokenUsage,
  ModelBreakdown,
} from "@agent-watcher/shared";
import type { JournalRecord } from "@agent-watcher/shared";
import { parseJsonlFile } from "./jsonl-parser.js";
import { getProjectIndex } from "./project-service.js";
import { estimateCost } from "../config.js";

export async function getTokenAnalytics(from?: string, to?: string): Promise<TokenAnalytics> {
  const index = await getProjectIndex();
  const dailyMap = new Map<string, DailyTokenUsage>();
  const modelMap = new Map<
    string,
    { input: number; output: number; cacheCreation: number; cacheRead: number }
  >();
  let totalInput = 0;
  let totalOutput = 0;

  for (const [, project] of index) {
    for (const [, sessionMeta] of project.sessions) {
      let records: readonly JournalRecord[];
      try {
        records = await parseJsonlFile(sessionMeta.filePath);
      } catch {
        continue;
      }

      for (const record of records) {
        if (record.type !== "assistant" || !record.message.usage) continue;

        const ts = new Date(record.timestamp);
        if (from && ts < new Date(from)) continue;
        if (to && ts > new Date(to)) continue;

        const date = record.timestamp.slice(0, 10);
        const usage = record.message.usage;
        const model = record.message.model ?? "unknown";

        // Daily
        const existing = dailyMap.get(date) ?? {
          date,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          sessionCount: 0,
        };
        dailyMap.set(date, {
          ...existing,
          inputTokens: existing.inputTokens + usage.input_tokens,
          outputTokens: existing.outputTokens + usage.output_tokens,
          cacheCreationTokens:
            existing.cacheCreationTokens + (usage.cache_creation_input_tokens ?? 0),
          cacheReadTokens: existing.cacheReadTokens + (usage.cache_read_input_tokens ?? 0),
        });

        // Model
        const modelExisting = modelMap.get(model) ?? {
          input: 0,
          output: 0,
          cacheCreation: 0,
          cacheRead: 0,
        };
        modelMap.set(model, {
          input: modelExisting.input + usage.input_tokens,
          output: modelExisting.output + usage.output_tokens,
          cacheCreation: modelExisting.cacheCreation + (usage.cache_creation_input_tokens ?? 0),
          cacheRead: modelExisting.cacheRead + (usage.cache_read_input_tokens ?? 0),
        });

        totalInput += usage.input_tokens;
        totalOutput += usage.output_tokens;
      }
    }
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const byModel: ModelBreakdown[] = Array.from(modelMap.entries()).map(([model, tokens]) => ({
    model,
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    estimatedCost: estimateCost(model, {
      input_tokens: tokens.input,
      output_tokens: tokens.output,
      cache_creation_input_tokens: tokens.cacheCreation,
      cache_read_input_tokens: tokens.cacheRead,
    }),
  }));

  const totalEstimatedCost = byModel.reduce((sum, m) => sum + m.estimatedCost, 0);

  return { daily, byModel, totalInput, totalOutput, totalEstimatedCost };
}

export async function getSessionTokenTimeline(
  sessionFilePath: string,
  sessionId: string
): Promise<SessionTokenTimeline> {
  const records = await parseJsonlFile(sessionFilePath);
  const points: TokenTimelinePoint[] = [];
  let cumulativeInput = 0;
  let cumulativeOutput = 0;
  let cumulativeCacheCreation = 0;
  let cumulativeCacheRead = 0;
  let messageIndex = 0;

  for (const record of records) {
    if (record.type !== "assistant" || !record.message.usage) continue;

    const usage = record.message.usage;
    cumulativeInput += usage.input_tokens;
    cumulativeOutput += usage.output_tokens;
    cumulativeCacheCreation += usage.cache_creation_input_tokens ?? 0;
    cumulativeCacheRead += usage.cache_read_input_tokens ?? 0;

    points.push({
      timestamp: record.timestamp,
      messageIndex,
      cumulativeInput,
      cumulativeOutput,
      cumulativeCacheCreation,
      cumulativeCacheRead,
      model: record.message.model ?? "unknown",
    });

    messageIndex++;
  }

  return { sessionId, points };
}
