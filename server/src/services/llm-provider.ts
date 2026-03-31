import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

// ─── Lazy-initialized clients ─────────────────────────────

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;
let gemini: GoogleGenerativeAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    if (!config.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return anthropic;
}

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");
    openai = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return openai;
}

function getGeminiClient(): GoogleGenerativeAI {
  if (!gemini) {
    if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY is not configured");
    gemini = new GoogleGenerativeAI(config.geminiApiKey);
  }
  return gemini;
}

// ─── Provider implementations ─────────────────────────────

async function callAnthropic(prompt: string, maxTokens: number): Promise<string> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: config.analysisModel,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
}

async function callOpenAI(prompt: string, maxTokens: number): Promise<string> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: config.analysisModel,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message?.content ?? "";
}

async function callGemini(prompt: string, maxTokens: number): Promise<string> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: config.analysisModel,
    generationConfig: { maxOutputTokens: maxTokens },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ─── Public API ───────────────────────────────────────────

export async function callLlm(prompt: string, maxTokens: number): Promise<string> {
  switch (config.analysisProvider) {
    case "anthropic":
      return callAnthropic(prompt, maxTokens);
    case "openai":
      return callOpenAI(prompt, maxTokens);
    case "gemini":
      return callGemini(prompt, maxTokens);
    default:
      throw new Error(`Unknown analysis provider: ${config.analysisProvider}`);
  }
}

export function isAnalysisAvailable(): boolean {
  switch (config.analysisProvider) {
    case "anthropic":
      return config.anthropicApiKey.length > 0;
    case "openai":
      return config.openaiApiKey.length > 0;
    case "gemini":
      return config.geminiApiKey.length > 0;
    default:
      return false;
  }
}
