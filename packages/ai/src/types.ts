export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /**
   * Opt-in. Reasoning models (Groq's gpt-oss family) otherwise spend a third of
   * the token budget thinking before answering. "low" is right for mechanical
   * extraction; leave unset for anything needing actual deliberation.
   * Providers that do not support it ignore it.
   */
  reasoningEffort?: "low" | "medium" | "high";
}

export interface CompletionResponse {
  text: string;
  provider: string;
  model: string;
}

export interface TranscriptionRequest {
  audio: Uint8Array;
  mimeType?: string;
  language?: string;
}

export interface TranscriptionResponse {
  text: string;
  provider: string;
  model: string;
}
