export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
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
