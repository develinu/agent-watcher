import { watch, type FSWatcher } from "chokidar";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { parseJsonlTail, getFileSize } from "../services/jsonl-parser.js";
import type { JournalRecord } from "@agent-watcher/shared";

export interface FileChangeEvent {
  readonly projectId: string;
  readonly sessionId: string;
  readonly records: readonly JournalRecord[];
}

export class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private offsets = new Map<string, number>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly claudeDir: string;

  constructor(claudeDir: string) {
    super();
    this.claudeDir = claudeDir;
  }

  start(): void {
    const projectsDir = join(this.claudeDir, "projects");

    this.watcher = watch(projectsDir, {
      persistent: true,
      ignoreInitial: true,
      depth: 4,
      ignored: [
        (filePath: string) => {
          // Ignore dotfiles/dotdirs by basename only (not full path)
          const basename = filePath.split("/").pop() ?? "";
          return basename.startsWith(".") && basename !== ".jsonl";
        },
        "**/file-history/**",
        "**/*.tmp",
      ],
    });

    this.watcher.on("change", (path) => this.handleChange(path));
    this.watcher.on("add", (path) => this.handleChange(path));

    this.watcher.on("error", (err) => {
      console.error("File watcher error:", err);
    });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  private handleChange(filePath: string): void {
    if (!filePath.endsWith(".jsonl")) return;

    // Debounce rapid changes
    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      filePath,
      setTimeout(() => {
        this.debounceTimers.delete(filePath);
        this.processChange(filePath);
      }, 100)
    );
  }

  private async processChange(filePath: string): Promise<void> {
    try {
      const parsed = this.parseFilePath(filePath);
      if (!parsed) return;

      const currentOffset = this.offsets.get(filePath) ?? 0;
      const currentSize = await getFileSize(filePath);

      // File was truncated
      if (currentSize < currentOffset) {
        this.offsets.set(filePath, 0);
      }

      const offset = currentSize < currentOffset ? 0 : currentOffset;
      const { records, newOffset } = await parseJsonlTail(filePath, offset);
      this.offsets.set(filePath, newOffset);

      if (records.length > 0) {
        this.emit("session-updated", {
          projectId: parsed.projectId,
          sessionId: parsed.sessionId,
          records,
        } satisfies FileChangeEvent);
      }
    } catch (err) {
      console.error("Error processing file change:", filePath, err);
    }
  }

  private parseFilePath(filePath: string): { projectId: string; sessionId: string } | null {
    const projectsDir = join(this.claudeDir, "projects");
    const relative = filePath.slice(projectsDir.length + 1);
    const parts = relative.split("/");

    if (parts.length < 2) return null;

    const projectId = parts[0];

    // Direct session file: projects/{projectId}/{sessionId}.jsonl
    if (parts.length === 2 && parts[1].endsWith(".jsonl")) {
      return { projectId, sessionId: parts[1].replace(".jsonl", "") };
    }

    // Subagent file: projects/{projectId}/{sessionId}/subagents/agent-{id}.jsonl
    if (parts.length >= 4 && parts[2] === "subagents") {
      return { projectId, sessionId: parts[1] };
    }

    return null;
  }
}
