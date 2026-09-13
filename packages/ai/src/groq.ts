import type { CompletionRequest, CompletionResponse, TranscriptionRequest, TranscriptionResponse } from "./types";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TRANSCRIBE_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const DEFAULT_WHISPER_MODEL = "whisper-large-v3-turbo";
const MAX_RATE_LIMIT_RETRIES = 2;

function retryDelay(response: Response, attempt: number): number {
  const seconds = Number.parseFloat(response.headers.get("retry-after") ?? "");
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(30_000, Math.ceil(seconds * 1_000) + 250);
  return 10_000 * (attempt + 1);
}

// A reset this far out is a daily-budget exhaustion, not a burst. Retrying
// just makes the user wait through the backoff before the same failure.
function worthRetrying(response: Response): boolean {
  const seconds = Number.parseFloat(response.headers.get("retry-after") ?? "");
  return !(Number.isFinite(seconds) && seconds > 60);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Groq enforces both a per-minute and a per-day token budget. The per-day one
// can be hours from resetting, so report the wait it actually sends back
// instead of guessing.
function rateLimitMessage(response: Response, detail: string, action: string): string {
  const seconds = Number.parseFloat(response.headers.get("retry-after") ?? "");
  const wait = Number.isFinite(seconds) && seconds > 0
    ? seconds >= 5400 ? `about ${Math.round(seconds / 3600)} hours`
      : seconds >= 90 ? `about ${Math.round(seconds / 60)} minutes`
      : `about ${Math.max(1, Math.round(seconds))} seconds`
    : "a few minutes";
  const daily = /per day|TPD/i.test(detail);
  return daily
    ? `Groq's daily token limit is used up. It resets in ${wait}, then you can ${action}.`
    : `Groq is rate-limiting requests. Wait ${wait}, then ${action}.`;
}

export async function completeWithGroq(request: CompletionRequest): Promise<CompletionResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set. Add it to your .env file.");
  }
  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 1024,
        ...(request.reasoningEffort ? { reasoning_effort: request.reasoningEffort } : {}),
      }),
    });

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES && worthRetrying(response)) {
      await wait(retryDelay(response, attempt));
      continue;
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      if (response.status === 429) throw new Error(rateLimitMessage(response, detail, "try again"));
      throw new Error(`Groq API error ${response.status}${detail ? `: ${detail}` : ""}`);
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return {
      text: data.choices[0]?.message.content ?? "",
      provider: "groq",
      model,
    };
  }
  throw new Error("Groq could not complete the request.");
}

export async function transcribeWithGroq(request: TranscriptionRequest): Promise<TranscriptionResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set. Add it to your .env file.");
  }
  const model = process.env.GROQ_WHISPER_MODEL?.trim() || DEFAULT_WHISPER_MODEL;
  const audio = Uint8Array.from(request.audio);
  const form = new FormData();
  form.append("model", model);
  form.append("file", new Blob([audio], { type: request.mimeType ?? "" }), "recording.webm");
  if (request.language) form.append("language", request.language);

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const response = await fetch(GROQ_TRANSCRIBE_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES && worthRetrying(response)) {
      await wait(retryDelay(response, attempt));
      continue;
    }
    if (!response.ok) {
      if (response.status === 429) throw new Error(rateLimitMessage(response, await response.clone().text(), "try again"));
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Groq transcription API error ${response.status}${detail ? `: ${detail}` : ""}`);
    }

    const data = (await response.json()) as { text?: string };
    return {
      text: data.text ?? "",
      provider: "groq",
      model,
    };
  }
  throw new Error("Groq could not complete the transcription request.");
}
