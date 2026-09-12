import type { CompletionRequest, CompletionResponse } from "./types";

const GEMINI_MODEL = "gemini-1.5-flash";

export async function completeWithGemini(request: CompletionRequest): Promise<CompletionResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to your .env file.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const systemMessages = request.messages.filter((m) => m.role === "system").map((m) => m.content);
  const contents = request.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: systemMessages.length ? { parts: [{ text: systemMessages.join("\n") }] } : undefined,
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? 1024,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  return {
    text: data.candidates[0]?.content.parts.map((p) => p.text).join("") ?? "",
    provider: "gemini",
    model: GEMINI_MODEL,
  };
}
