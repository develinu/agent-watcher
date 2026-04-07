import { describe, it, expect } from "vitest";
import { resolveSessionTitle } from "../lib/format.js";

describe("resolveSessionTitle", () => {
  it("uses aiTitle when available", () => {
    expect(resolveSessionTitle({ aiTitle: "My Feature", summary: "" })).toBe("My Feature");
  });

  it("falls back to summary when aiTitle is null", () => {
    expect(resolveSessionTitle({ aiTitle: null, summary: "fix the login bug" })).toBe(
      "fix the login bug"
    );
  });

  it("truncates long summaries to 40 chars", () => {
    const long = "a".repeat(50);
    expect(resolveSessionTitle({ aiTitle: null, summary: long })).toHaveLength(40);
  });

  it('returns "Untitled" when aiTitle is null and summary is empty string', () => {
    expect(resolveSessionTitle({ aiTitle: null, summary: "" })).toBe("Untitled");
  });

  it('returns "Untitled" when summary is whitespace only', () => {
    expect(resolveSessionTitle({ aiTitle: null, summary: "   " })).toBe("Untitled");
  });
});
