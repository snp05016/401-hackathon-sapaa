import { useCallback, useEffect, useRef, useState } from "react";

export type SoundName =
  | "tap"
  | "toggle"
  | "navigate"
  | "open"
  | "close"
  | "success"
  | "error"
  | "drop"
  | "delete"
  | "chime";

export const SOUND_MUTED_STORAGE_KEY = "ghostboard:sound-muted";

const MUTE_CHANGE_EVENT = "ghostboard:sound-muted-change";

/** Minimum gap between two plays of the same voice. */
const PER_NAME_THROTTLE_MS = 70;
/** Global budget: at most BUDGET_COUNT sounds inside BUDGET_WINDOW_MS. */
const BUDGET_WINDOW_MS = 250;
const BUDGET_COUNT = 3;

const MASTER_GAIN = 0.09;
const LOWPASS_HZ = 2600;

type Voice = {
  type: OscillatorType;
  frequency: number;
  /** Optional ramp target; when set the oscillator glides frequency -> endFrequency. */
  endFrequency?: number;
  gain: number;
  /** Offset from the trigger instant, in seconds. */
  offset: number;
  attack: number;
  decay: number;
};

const RECIPES: Record<SoundName, Voice[]> = {
  tap: [{ type: "sine", frequency: 660, gain: 0.05, offset: 0, attack: 0.006, decay: 0.055 }],
  toggle: [
    { type: "triangle", frequency: 520, endFrequency: 680, gain: 0.045, offset: 0, attack: 0.006, decay: 0.06 },
  ],
  navigate: [
    { type: "sine", frequency: 440, endFrequency: 588, gain: 0.04, offset: 0, attack: 0.006, decay: 0.09 },
  ],
  open: [{ type: "sine", frequency: 392, endFrequency: 523, gain: 0.05, offset: 0, attack: 0.006, decay: 0.11 }],
  close: [{ type: "sine", frequency: 523, endFrequency: 392, gain: 0.04, offset: 0, attack: 0.006, decay: 0.09 }],
  success: [
    { type: "sine", frequency: 659, gain: 0.05, offset: 0, attack: 0.006, decay: 0.075 },
    { type: "sine", frequency: 988, gain: 0.05, offset: 0.055, attack: 0.006, decay: 0.065 },
  ],
  error: [
    { type: "triangle", frequency: 233, gain: 0.05, offset: 0, attack: 0.008, decay: 0.122 },
    { type: "triangle", frequency: 196, gain: 0.05, offset: 0, attack: 0.008, decay: 0.122 },
  ],
  drop: [{ type: "sine", frequency: 294, gain: 0.055, offset: 0, attack: 0.008, decay: 0.09 }],
  delete: [
    { type: "triangle", frequency: 196, endFrequency: 147, gain: 0.05, offset: 0, attack: 0.008, decay: 0.112 },
  ],
  chime: [
    { type: "sine", frequency: 659, gain: 0.04, offset: 0, attack: 0.005, decay: 0.055 },
    { type: "sine", frequency: 880, gain: 0.04, offset: 0.045, attack: 0.005, decay: 0.055 },
    { type: "sine", frequency: 1318, gain: 0.04, offset: 0.09, attack: 0.005, decay: 0.05 },
  ],
};

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let unlocked = false;
let engineBroken = false;
let listenersAttached = false;

let muted = false;
let mutedLoaded = false;

const lastPlayedAt: Partial<Record<SoundName, number>> = {};
let recentPlays: number[] = [];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function warnOnce(error: unknown): void {
  if (engineBroken) return;
  engineBroken = true;
  console.warn("[sound] audio engine disabled after failure", error);
}

function loadMuted(): boolean {
  if (mutedLoaded) return muted;
  mutedLoaded = true;
  if (!isBrowser()) return false;
  try {
    muted = window.localStorage.getItem(SOUND_MUTED_STORAGE_KEY) === "true";
  } catch {
    muted = false;
  }
  return muted;
}

function ensureContext(): AudioContext | null {
  if (engineBroken || !isBrowser()) return null;
  if (audioContext && masterGain) return audioContext;

  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      warnOnce(new Error("WebAudio unavailable"));
      return null;
    }
    const context = new Ctor();
    const gain = context.createGain();
    gain.gain.value = MASTER_GAIN;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = LOWPASS_HZ;
    gain.connect(filter);
    filter.connect(context.destination);
    audioContext = context;
    masterGain = gain;
    return context;
  } catch (error) {
    warnOnce(error);
    return null;
  }
}

function unlock(): void {
  if (unlocked || engineBroken) return;
  unlocked = true;
  const context = ensureContext();
  if (!context) return;
  if (context.state === "suspended") {
    void context.resume().catch((error) => warnOnce(error));
  }
}

function attachUnlockListeners(): void {
  if (listenersAttached || !isBrowser()) return;
  listenersAttached = true;
  const handler = () => {
    unlock();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
  };
  window.addEventListener("pointerdown", handler);
  window.addEventListener("keydown", handler);
}

if (isBrowser()) {
  loadMuted();
  attachUnlockListeners();
}

export function isSoundMuted(): boolean {
  return loadMuted();
}

export function setSoundMuted(nextMuted: boolean): void {
  loadMuted();
  muted = nextMuted;
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(SOUND_MUTED_STORAGE_KEY, nextMuted ? "true" : "false");
  } catch {
    // Preference is best-effort; an unavailable storage must not break the toggle.
  }
  window.dispatchEvent(new CustomEvent(MUTE_CHANGE_EVENT, { detail: nextMuted }));
}

function withinBudget(name: SoundName, now: number): boolean {
  const previous = lastPlayedAt[name];
  if (previous !== undefined && now - previous < PER_NAME_THROTTLE_MS) return false;
  recentPlays = recentPlays.filter((stamp) => now - stamp < BUDGET_WINDOW_MS);
  if (recentPlays.length >= BUDGET_COUNT) return false;
  lastPlayedAt[name] = now;
  recentPlays.push(now);
  return true;
}

export function playSound(name: SoundName): void {
  if (!isBrowser() || engineBroken || !unlocked || loadMuted()) return;

  const recipe = RECIPES[name];
  if (!recipe) return;

  const now = Date.now();
  if (!withinBudget(name, now)) return;

  try {
    const context = ensureContext();
    const destination = masterGain;
    if (!context || !destination) return;
    if (context.state === "suspended") {
      void context.resume().catch((error) => warnOnce(error));
    }

    const startedAt = context.currentTime;
    for (const voice of recipe) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = voice.type;

      const voiceStart = startedAt + voice.offset;
      const peak = voiceStart + voice.attack;
      const end = peak + voice.decay;

      oscillator.frequency.setValueAtTime(voice.frequency, voiceStart);
      if (voice.endFrequency !== undefined) {
        oscillator.frequency.linearRampToValueAtTime(voice.endFrequency, end);
      }

      envelope.gain.setValueAtTime(0.0001, voiceStart);
      envelope.gain.linearRampToValueAtTime(voice.gain, peak);
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(envelope);
      envelope.connect(destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
      oscillator.start(voiceStart);
      oscillator.stop(end + 0.01);
    }
  } catch (error) {
    warnOnce(error);
  }
}

export function useSoundMuted(): [boolean, (muted: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => isSoundMuted());

  useEffect(() => {
    const sync = () => setValue(isSoundMuted());
    window.addEventListener(MUTE_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MUTE_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((next: boolean) => {
    setSoundMuted(next);
    setValue(next);
  }, []);

  return [value, update];
}

export function useSound(): (name: SoundName) => void {
  return useCallback((name: SoundName) => playSound(name), []);
}

export function useSoundOnChange(name: SoundName, value: unknown, enabled: boolean = true): void {
  const previousRef = useRef<unknown>(value);

  useEffect(() => {
    if (Object.is(previousRef.current, value)) return;
    previousRef.current = value;
    if (enabled) playSound(name);
  }, [enabled, name, value]);
}
