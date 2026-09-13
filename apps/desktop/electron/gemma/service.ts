import { mkdir } from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { LlamaCompletion, createModelDownloader, getLlama } from "node-llama-cpp";

// The official checkpoint is distributed as safetensors; this verified GGUF
// conversion preserves the same base Gemma 3 270M model for llama.cpp.
const MODEL_URI = "hf:gguf-org/gemma-3-270m-gguf/gemma-3-270m-q4_k_m.gguf";
const MAX_PROMPT_LENGTH = 180;
const MAX_COMPLETION_WORDS = 8;

export interface GemmaPrediction {
  completion: string;
}

function normalizePrompt(input: unknown): string {
  if (typeof input !== "string") throw new Error("A title prompt is required.");
  const prompt = input.replace(/\s+/g, " ").trim();
  if (!prompt) throw new Error("Enter a job title before requesting a prediction.");
  if (prompt.length > MAX_PROMPT_LENGTH) throw new Error(`Keep the title prompt under ${MAX_PROMPT_LENGTH} characters.`);
  if (prompt.split(/[.!?]+/).filter(Boolean).length > 1) {
    throw new Error("Use one short prompt sentence for a prediction.");
  }
  return prompt;
}

function normalizeCompletion(value: string): string {
  const firstLine = value.split(/\r?\n/, 1)[0]?.replace(/\s+/g, " ").trimEnd() ?? "";
  const words = [...firstLine.matchAll(/\S+/g)];
  if (words.length <= MAX_COMPLETION_WORDS) return firstLine;
  return firstLine.slice(0, words[MAX_COMPLETION_WORDS].index).trimEnd();
}

export class GemmaCompletionService {
  private completion: LlamaCompletion | undefined;
  private initialization: Promise<LlamaCompletion> | undefined;
  private cleanup: (() => Promise<void>) | undefined;
  private predictionChain: Promise<void> = Promise.resolve();

  async predict(input: unknown): Promise<GemmaPrediction> {
    const prompt = normalizePrompt(input);
    const previousPrediction = this.predictionChain;
    let releaseQueue: () => void = () => undefined;
    this.predictionChain = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousPrediction;
    try {
      const completion = await this.getCompletion();
      const prediction = normalizeCompletion(
        await completion.generateCompletion(prompt, {
          maxTokens: 12,
          temperature: 0.2,
          topP: 0.9,
          trimWhitespaceSuffix: true,
          customStopTriggers: ["\n", ".", ",", ";", ":"],
        }),
      );
      return { completion: prediction };
    } finally {
      releaseQueue();
    }
  }

  async dispose(): Promise<void> {
    if (this.initialization) await this.initialization.catch(() => undefined);
    const cleanup = this.cleanup;
    this.cleanup = undefined;
    this.completion = undefined;
    this.initialization = undefined;
    await cleanup?.();
  }

  private async getCompletion(): Promise<LlamaCompletion> {
    if (this.completion) return this.completion;
    if (!this.initialization) this.initialization = this.initialize();
    return this.initialization;
  }

  private async initialize(): Promise<LlamaCompletion> {
    const directory = path.join(app.getPath("userData"), "models");
    await mkdir(directory, { recursive: true });

    const downloader = await createModelDownloader({
      modelUri: MODEL_URI,
      dirPath: directory,
      fileName: "gemma-3-270m-q4_k_m.gguf",
    });
    const modelPath = await downloader.download();
    const llama = await getLlama();
    const model = await llama.loadModel({ modelPath, gpuLayers: "auto" });
    const context = await model.createContext({ contextSize: 1024, sequences: 1 });
    const completion = new LlamaCompletion({ contextSequence: context.getSequence(), autoDisposeSequence: true });
    this.cleanup = async () => {
      completion.dispose({ disposeSequence: true });
      await context.dispose();
      await model.dispose();
      await llama.dispose();
    };
    this.completion = completion;
    return completion;
  }
}
