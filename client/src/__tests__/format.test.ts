import { describe, it, expect } from "vitest";
import { formatTokenCount, formatCost, formatDuration } from "../lib/format.js";

describe("formatTokenCount", () => {
  it("formats millions", () => {
    expect(formatTokenCount(1_500_000)).toBe("1.5M");
    expect(formatTokenCount(1_000_000)).toBe("1.0M");
  });

  it("formats thousands", () => {
    expect(formatTokenCount(1_500)).toBe("1.5K");
    expect(formatTokenCount(500_000)).toBe("500.0K");
  });

  it("formats small numbers as-is", () => {
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(0)).toBe("0");
  });
});

describe("formatCost", () => {
  it("formats dollar amounts >= 1", () => {
    expect(formatCost(1.5)).toBe("$1.50");
    expect(formatCost(10)).toBe("$10.00");
  });

  it("formats cent amounts", () => {
    expect(formatCost(0.05)).toBe("$0.050");
  });

  it("formats sub-cent amounts", () => {
    expect(formatCost(0.001)).toBe("$0.0010");
    expect(formatCost(0.0001)).toBe("$0.0001");
  });
});

describe("formatDuration", () => {
  it("formats minutes", () => {
    const start = "2026-01-01T00:00:00Z";
    const end = "2026-01-01T00:05:00Z";
    expect(formatDuration(start, end)).toBe("5m");
  });

  it("formats hours and minutes", () => {
    const start = "2026-01-01T00:00:00Z";
    const end = "2026-01-01T02:30:00Z";
    expect(formatDuration(start, end)).toBe("2h 30m");
  });

  it("handles zero duration", () => {
    const ts = "2026-01-01T00:00:00Z";
    expect(formatDuration(ts, ts)).toBe("0m");
  });
});
