import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config before importing the module under test
vi.mock("../config.js", () => ({
  config: {
    analysisProvider: "anthropic",
    anthropicApiKey: "",
    openaiApiKey: "",
    geminiApiKey: "",
    analysisModel: "claude-haiku-4-5-20251001",
  },
}));

import { isAnalysisAvailable } from "../services/llm-provider.js";
import { config } from "../config.js";

const mutableConfig = config as { -readonly [K in keyof typeof config]: (typeof config)[K] };

describe("isAnalysisAvailable", () => {
  beforeEach(() => {
    mutableConfig.anthropicApiKey = "";
    mutableConfig.openaiApiKey = "";
    mutableConfig.geminiApiKey = "";
  });

  it("returns false when no API key is set for anthropic", () => {
    mutableConfig.analysisProvider = "anthropic";
    expect(isAnalysisAvailable()).toBe(false);
  });

  it("returns true when anthropic key is set", () => {
    mutableConfig.analysisProvider = "anthropic";
    mutableConfig.anthropicApiKey = "sk-test";
    expect(isAnalysisAvailable()).toBe(true);
  });

  it("returns true when openai key is set", () => {
    mutableConfig.analysisProvider = "openai";
    mutableConfig.openaiApiKey = "sk-test";
    expect(isAnalysisAvailable()).toBe(true);
  });

  it("returns true when gemini key is set", () => {
    mutableConfig.analysisProvider = "gemini";
    mutableConfig.geminiApiKey = "ai-test";
    expect(isAnalysisAvailable()).toBe(true);
  });

  it("returns false for mismatched provider/key", () => {
    mutableConfig.analysisProvider = "openai";
    mutableConfig.anthropicApiKey = "sk-test";
    // openaiApiKey is still empty
    expect(isAnalysisAvailable()).toBe(false);
  });
});
