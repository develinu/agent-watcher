import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseJsonlFile, getFileSize } from "../services/jsonl-parser.js";

const testDir = join(tmpdir(), "agent-watcher-test");

beforeEach(async () => {
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("parseJsonlFile", () => {
  it("parses valid JSONL records", async () => {
    const filePath = join(testDir, "valid.jsonl");
    const lines = [
      JSON.stringify({
        type: "user",
        uuid: "1",
        timestamp: "2026-01-01T00:00:00Z",
        message: { content: "hello" },
        cwd: "/tmp",
        isSidechain: false,
      }),
      JSON.stringify({
        type: "assistant",
        uuid: "2",
        timestamp: "2026-01-01T00:01:00Z",
        message: {
          content: [{ type: "text", text: "hi" }],
          model: "claude-haiku-4-5-20251001",
          usage: { input_tokens: 10, output_tokens: 5 },
        },
        isSidechain: false,
      }),
    ];
    await writeFile(filePath, lines.join("\n"), "utf-8");

    const records = await parseJsonlFile(filePath);
    expect(records).toHaveLength(2);
    expect(records[0].type).toBe("user");
    expect(records[1].type).toBe("assistant");
  });

  it("skips malformed JSON lines", async () => {
    const filePath = join(testDir, "malformed.jsonl");
    const lines = [
      JSON.stringify({
        type: "user",
        uuid: "1",
        timestamp: "2026-01-01T00:00:00Z",
        message: { content: "ok" },
        cwd: "/tmp",
        isSidechain: false,
      }),
      "{ invalid json",
      "",
      JSON.stringify({
        type: "assistant",
        uuid: "2",
        timestamp: "2026-01-01T00:01:00Z",
        message: { content: [], model: "test", usage: { input_tokens: 0, output_tokens: 0 } },
        isSidechain: false,
      }),
    ];
    await writeFile(filePath, lines.join("\n"), "utf-8");

    const records = await parseJsonlFile(filePath);
    expect(records).toHaveLength(2);
  });

  it("skips unknown record types", async () => {
    const filePath = join(testDir, "unknown.jsonl");
    const lines = [
      JSON.stringify({
        type: "user",
        uuid: "1",
        timestamp: "2026-01-01T00:00:00Z",
        message: { content: "ok" },
        cwd: "/tmp",
        isSidechain: false,
      }),
      JSON.stringify({ type: "unknown-type", data: "something" }),
    ];
    await writeFile(filePath, lines.join("\n"), "utf-8");

    const records = await parseJsonlFile(filePath);
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe("user");
  });

  it("returns empty array for empty file", async () => {
    const filePath = join(testDir, "empty.jsonl");
    await writeFile(filePath, "", "utf-8");

    const records = await parseJsonlFile(filePath);
    expect(records).toHaveLength(0);
  });
});

describe("getFileSize", () => {
  it("returns file size for existing file", async () => {
    const filePath = join(testDir, "sized.jsonl");
    const content = "hello world";
    await writeFile(filePath, content, "utf-8");

    expect(await getFileSize(filePath)).toBe(Buffer.byteLength(content));
  });

  it("returns 0 for non-existent file", async () => {
    expect(await getFileSize(join(testDir, "nonexistent.jsonl"))).toBe(0);
  });
});
