import { describe, it, expect } from "vitest";
import { estimateCost, MODEL_PRICING } from "../config.js";

describe("estimateCost", () => {
  const usage = {
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };

  it("calculates cost for a known model", () => {
    const cost = estimateCost("claude-haiku-4-5-20251001", usage);
    // input: 1M * 0.8 / 1M = 0.8, output: 1M * 4 / 1M = 4
    expect(cost).toBeCloseTo(4.8, 2);
  });

  it("falls back to sonnet pricing for unknown model", () => {
    const cost = estimateCost("unknown-model", usage);
    // input: 1M * 3 / 1M = 3, output: 1M * 15 / 1M = 15
    expect(cost).toBeCloseTo(18, 2);
  });

  it("includes cache costs", () => {
    const usageWithCache = {
      input_tokens: 500_000,
      output_tokens: 100_000,
      cache_creation_input_tokens: 200_000,
      cache_read_input_tokens: 300_000,
    };
    const cost = estimateCost("claude-haiku-4-5-20251001", usageWithCache);
    const pricing = MODEL_PRICING["claude-haiku-4-5-20251001"];
    const expected =
      (500_000 * pricing.inputPerMillion) / 1_000_000 +
      (100_000 * pricing.outputPerMillion) / 1_000_000 +
      (200_000 * pricing.cacheCreationPerMillion) / 1_000_000 +
      (300_000 * pricing.cacheReadPerMillion) / 1_000_000;
    expect(cost).toBeCloseTo(expected, 6);
  });

  it("returns 0 for zero tokens", () => {
    const cost = estimateCost("claude-haiku-4-5-20251001", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });
    expect(cost).toBe(0);
  });
});

describe("MODEL_PRICING", () => {
  it("has pricing for all expected models", () => {
    expect(MODEL_PRICING).toHaveProperty("claude-opus-4-6");
    expect(MODEL_PRICING).toHaveProperty("claude-sonnet-4-6");
    expect(MODEL_PRICING).toHaveProperty("claude-haiku-4-5-20251001");
  });

  it("all pricing values are positive", () => {
    for (const [, pricing] of Object.entries(MODEL_PRICING)) {
      expect(pricing.inputPerMillion).toBeGreaterThan(0);
      expect(pricing.outputPerMillion).toBeGreaterThan(0);
      expect(pricing.cacheReadPerMillion).toBeGreaterThan(0);
      expect(pricing.cacheCreationPerMillion).toBeGreaterThan(0);
    }
  });
});
