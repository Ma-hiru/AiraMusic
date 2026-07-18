import { LLMDefaultContextWindowTokens, resolveLLMContextWindowTokens } from "@/model";

describe("resolveLLMContextWindowTokens", () => {
  it("resolves official exact model IDs", () => {
    expect(resolveLLMContextWindowTokens("gpt-5.6-sol")).toBe(1_050_000);
    expect(resolveLLMContextWindowTokens("gpt-5.4-mini")).toBe(400_000);
    expect(resolveLLMContextWindowTokens("gpt-5.4-nano")).toBe(400_000);
    expect(resolveLLMContextWindowTokens("gpt-4.1-mini")).toBe(1_047_576);
    expect(resolveLLMContextWindowTokens("o4-mini")).toBe(200_000);
    expect(resolveLLMContextWindowTokens("deepseek-v4-pro")).toBe(1_000_000);
  });

  it("matches only conservative dated snapshots", () => {
    expect(resolveLLMContextWindowTokens("gpt-4.1-mini-2025-04-14")).toBe(1_047_576);
    expect(resolveLLMContextWindowTokens("gpt-5-mini-2025-08-07")).toBe(400_000);
    expect(resolveLLMContextWindowTokens("gpt-5.4-2026-03-05")).toBe(1_050_000);
    expect(resolveLLMContextWindowTokens("gpt-5.5-2026-04-23")).toBe(1_050_000);
    expect(resolveLLMContextWindowTokens("gpt-5.4-mini-2026-03-17")).toBe(400_000);
    expect(resolveLLMContextWindowTokens("gpt-4.1-mini-preview")).toBe(
      LLMDefaultContextWindowTokens
    );
    expect(resolveLLMContextWindowTokens("gpt-5-chat-latest")).toBe(LLMDefaultContextWindowTokens);
    expect(resolveLLMContextWindowTokens("gpt-5.6-sol-2026-07-18")).toBe(
      LLMDefaultContextWindowTokens
    );
  });

  it("gives a valid user override the highest priority", () => {
    expect(resolveLLMContextWindowTokens("gpt-5.6-sol", 64_000)).toBe(64_000);
    expect(resolveLLMContextWindowTokens("unknown-model", 256_000)).toBe(256_000);
  });

  it("falls back to the backwards-compatible 128K budget", () => {
    expect(resolveLLMContextWindowTokens("unknown-model")).toBe(128_000);
  });
});
