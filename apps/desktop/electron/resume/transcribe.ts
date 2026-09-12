export interface AudioTranscriptionInput {
  audio: Uint8Array;
  mimeType: string;
}

const MAX_AUDIO_BYTES = 25_000_000;

export function validateAudioForTranscription(input: AudioTranscriptionInput): void {
  if (!input || !(input.audio instanceof Uint8Array) || input.audio.byteLength === 0) {
    throw new Error("No audio captured. Allow microphone access and record a clip to transcribe.");
  }
  if (input.audio.byteLength > MAX_AUDIO_BYTES) {
    throw new Error("Audio clip is too large to transcribe (25 MB limit).");
  }
  if (typeof input.mimeType !== "string" || !input.mimeType.startsWith("audio/")) {
    throw new Error("Unsupported audio format. Record audio from the microphone to transcribe.");
  }
}