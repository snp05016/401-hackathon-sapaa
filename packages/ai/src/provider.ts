import type { CompletionRequest, CompletionResponse } from "./types";
import { completeWithGroq } from "./groq";
import { completeWithGemini } from "./gemini";
import { completeWithAgy, isAgyAvailable } from "./agy";

export interface LLMProvider {
  name: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

const providers: Record<string, LLMProvider> = {
  groq: { name: "groq", complete: completeWithGroq },
  gemini: { name: "gemini", complete: completeWithGemini },
  agy: { name: "agy", complete: completeWithAgy },
};

export function getProvider(): LLMProvider {
  const preferredProvider = typeof process === "undefined"
    ? "agy"
    : process.env.GHOSTBOARD_LLM_PROVIDER
      ? process.env.GHOSTBOARD_LLM_PROVIDER.toLowerCase()
      : isAgyAvailable()
        ? "agy"
        : "groq";

  const provider = providers[preferredProvider];
  if (!provider) {
    throw new Error(`Unknown GHOSTBOARD_LLM_PROVIDER "${preferredProvider}". Expected one of: ${Object.keys(providers).join(", ")}`);
  }
  return provider;
}
