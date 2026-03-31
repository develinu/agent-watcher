import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { open, stat } from "node:fs/promises";
import type { JournalRecord } from "@agent-watcher/shared";

const KNOWN_TYPES = new Set([
  "user",
  "assistant",
  "system",
  "ai-title",
  "file-history-snapshot",
  "queue-operation",
]);

function isValidRecord(obj: unknown): obj is JournalRecord {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "type" in obj &&
    KNOWN_TYPES.has((obj as { type: string }).type)
  );
}

export async function parseJsonlFile(filePath: string): Promise<readonly JournalRecord[]> {
  const records: JournalRecord[] = [];
  const stream = createReadStream(filePath, { encoding: "utf-8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isValidRecord(parsed)) {
        records.push(parsed);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return records;
}

export interface TailResult {
  readonly records: readonly JournalRecord[];
  readonly newOffset: number;
}

export async function parseJsonlTail(filePath: string, byteOffset: number): Promise<TailResult> {
  const fileStat = await stat(filePath);
  if (fileStat.size <= byteOffset) {
    // File was truncated or unchanged
    if (fileStat.size < byteOffset) {
      // File was truncated — re-parse from beginning
      const records = await parseJsonlFile(filePath);
      return { records, newOffset: fileStat.size };
    }
    return { records: [], newOffset: byteOffset };
  }

  const records: JournalRecord[] = [];
  const fd = await open(filePath, "r");
  try {
    const stream = fd.createReadStream({ start: byteOffset, encoding: "utf-8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let buffer = "";

    for await (const line of rl) {
      buffer = line.trim();
      if (!buffer) continue;
      try {
        const parsed: unknown = JSON.parse(buffer);
        if (isValidRecord(parsed)) {
          records.push(parsed);
        }
      } catch {
        // Could be partial line at boundary — skip
      }
    }
  } finally {
    await fd.close();
  }

  return { records, newOffset: fileStat.size };
}

export async function getFileSize(filePath: string): Promise<number> {
  try {
    const fileStat = await stat(filePath);
    return fileStat.size;
  } catch {
    return 0;
  }
}
