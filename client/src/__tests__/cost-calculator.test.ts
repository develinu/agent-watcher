import { describe, it, expect } from "vitest";
import { estimateCost } from "../lib/cost-calculator.js";

describe("estimateCost", () => {
  const baseUsage = {
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };

  it("calculates haiku cost correctly", () => {
    const cost = estimateCost("claude-haiku-4-5-20251001", baseUsage);
    // input: 0.8, output: 4.0
    expect(cost).toBeCloseTo(4.8, 2);
  });

  it("calculates sonnet cost correctly", () => {
    const cost = estimateCost("claude-sonnet-4-6", baseUsage);
    // input: 3, output: 15
    expect(cost).toBeCloseTo(18, 2);
  });

  it("calculates opus cost correctly", () => {
    const cost = estimateCost("claude-opus-4-6", baseUsage);
    // input: 15, output: 75
    expect(cost).toBeCloseTo(90, 2);
  });

  it("falls back to sonnet for unknown model", () => {
    const cost = estimateCost("unknown-model", baseUsage);
    expect(cost).toBeCloseTo(18, 2);
  });

  it("includes cache token costs", () => {
    const usage = {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
    };
    const cost = estimateCost("claude-haiku-4-5-20251001", usage);
    // cache_read: 0.08, cache_creation: 1.0
    expect(cost).toBeCloseTo(1.08, 2);
  });

  it("returns 0 for zero usage", () => {
    const cost = estimateCost("claude-haiku-4-5-20251001", {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    });
    expect(cost).toBe(0);
  });
});
