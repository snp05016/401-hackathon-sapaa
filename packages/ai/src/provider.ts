import type { CompletionRequest, CompletionResponse } from "./types";
import { completeWithGroq } from "./groq";
import { completeWithGemini } from "./gemini";

export interface LLMProvider {
  name: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

const providers: Record<string, LLMProvider> = {
  groq: { name: "groq", complete: completeWithGroq },
  gemini: { name: "gemini", complete: completeWithGemini },
};

export function getProvider(): LLMProvider {
  const preferredProvider = typeof process === "undefined" ? "groq" : process.env.GHOSTBOARD_LLM_PROVIDER ?? "groq";
  const name = preferredProvider.toLowerCase();
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown GHOSTBOARD_LLM_PROVIDER "${name}". Expected one of: ${Object.keys(providers).join(", ")}`);
  }
  return provider;
}
