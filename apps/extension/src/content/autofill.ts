import type { DetectedFormField } from "@ghostboard/shared";

type FillableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export interface AutofillInstruction {
  selector: string;
  value: string;
  profileKey: string;
  confidence: number;
}

export interface AutofillResult {
  pageType: "application_form" | "unknown";
  filled: Array<{ selector: string; profileKey: string }>;
  skipped: Array<{ selector: string; reason: string }>;
  error: string | null;
}

export interface AutofillContentMessage {
  type: "autofill-fields";
  pageType: "application_form";
  fields: AutofillInstruction[];
}

const FIELD_SELECTOR = [
  "input:not([type='hidden']):not([type='password']):not([type='button']):not([type='reset']):not([type='image'])",
  "textarea",
  "select",
].join(",");

function normalized(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function fieldType(element: FillableElement): DetectedFormField["fieldType"] | null {
  if (element.tagName === "TEXTAREA") return "textarea";
  if (element.tagName === "SELECT") return "select";
  const inputType = (element as HTMLInputElement).type.toLowerCase();
  if (["text", "email", "tel", "file", "checkbox", "radio", "date"].includes(inputType)) {
    return inputType as DetectedFormField["fieldType"];
  }
  if (["url", "number", "search"].includes(inputType)) return "text";
  if (["submit", "button", "reset", "image", "hidden", "password"].includes(inputType)) return null;
  return "text";
}

function fieldLabel(element: FillableElement): string | null {
  const directLabel = "labels" in element ? element.labels?.[0]?.textContent?.trim() : "";
  if (directLabel) return directLabel;
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;
  const labelledBy = element.getAttribute("aria-labelledby")?.trim().split(/\s+/).filter(Boolean) ?? [];
  const referenced = labelledBy
    .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(" ");
  if (referenced) return referenced;
  return element.closest("label")?.textContent?.trim() || null;
}

function selectorFor(element: FillableElement): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  if (element.getAttribute("name")) {
    const candidate = `${element.tagName.toLowerCase()}[name="${CSS.escape(element.getAttribute("name")!)}"]`;
    if (element.ownerDocument.querySelectorAll(candidate).length === 1) return candidate;
  }

  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current.tagName !== "HTML") {
    const tag = current.tagName.toLowerCase();
    const siblings = current.parentElement
      ? [...current.parentElement.children].filter((sibling) => sibling.tagName === current!.tagName)
      : [];
    segments.unshift(`${tag}:nth-of-type(${Math.max(1, siblings.indexOf(current) + 1)})`);
    current = current.parentElement;
    if (segments.length >= 6) break;
  }
  return segments.join(" > ");
}

function isVisible(element: FillableElement): boolean {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return !element.hidden && style?.display !== "none" && style?.visibility !== "hidden";
}

export function detectApplicationFormFields(root: Document = document): DetectedFormField[] {
  return [...root.querySelectorAll<FillableElement>(FIELD_SELECTOR)]
    .filter((element) => isVisible(element))
    .flatMap((element) => {
      const detectedType = fieldType(element);
      if (!detectedType) return [];
      return [{
        selector: selectorFor(element),
        label: fieldLabel(element),
        fieldType: detectedType,
        name: element.getAttribute("name"),
        placeholder: element.getAttribute("placeholder"),
        options: element.tagName === "SELECT"
          ? [...(element as HTMLSelectElement).options].map((option) => option.text.trim()).filter(Boolean)
          : null,
      }];
    });
}

export function isApplicationFormPage(root: Document = document): boolean {
  const fields = detectApplicationFormFields(root);
  if (fields.length < 2) return false;
  const evidence = [
    root.title,
    root.location?.pathname,
    root.querySelector("h1")?.textContent,
    ...[...root.querySelectorAll("form")].slice(0, 3).map((form) => form.textContent?.slice(0, 4_000)),
  ].filter(Boolean).join(" ");
  const explicitSignal = /\b(?:apply|application|candidate|resume|cover letter|work authorization|sponsorship)\b/i.test(evidence);
  const labels = normalized(fields.map((field) => [field.label, field.name, field.placeholder].filter(Boolean).join(" ")).join(" "));
  const identitySignals = ["first name", "last name", "email"].filter((signal) => labels.includes(signal)).length;
  return explicitSignal || identitySignals >= 2;
}

function setNativeValue(element: FillableElement, value: string): void {
  const ownerWindow = element.ownerDocument?.defaultView;
  const constructor = element.tagName === "TEXTAREA"
    ? ownerWindow?.HTMLTextAreaElement
    : element.tagName === "SELECT"
      ? ownerWindow?.HTMLSelectElement
      : ownerWindow?.HTMLInputElement;
  const setter = constructor
    ? Object.getOwnPropertyDescriptor(constructor.prototype, "value")?.set
    : undefined;
  if (setter) setter.call(element, value);
  else element.value = value;
}

export function writeFormValue(element: FillableElement, requestedValue: string): boolean {
  if (!["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)) return false;
  const inputType = element.tagName === "INPUT" ? (element as HTMLInputElement).type.toLowerCase() : "";
  if (
    element.disabled
    || ("readOnly" in element && element.readOnly)
    || ["submit", "button", "reset", "image", "hidden", "password", "file", "checkbox", "radio"].includes(inputType)
  ) return false;

  let value = requestedValue;
  if (element.tagName === "SELECT") {
    const option = [...(element as HTMLSelectElement).options].find((candidate) => {
      const expected = normalized(requestedValue);
      return normalized(candidate.value) === expected || normalized(candidate.text) === expected;
    });
    if (!option) return false;
    value = option.value;
  }

  setNativeValue(element, value);
  const EventConstructor = element.ownerDocument?.defaultView?.Event ?? globalThis.Event;
  for (const type of ["input", "change", "blur"]) {
    element.dispatchEvent(new EventConstructor(type, { bubbles: true }));
  }
  return true;
}

export function fillApplicationForm(
  instructions: AutofillInstruction[],
  root: Document = document,
): AutofillResult {
  if (!isApplicationFormPage(root)) {
    return { pageType: "unknown", filled: [], skipped: [], error: "This page was not recognized as an application form." };
  }

  const filled: AutofillResult["filled"] = [];
  const skipped: AutofillResult["skipped"] = [];
  const seenSelectors = new Set<string>();
  for (const instruction of instructions.slice(0, 100)) {
    if (
      instruction.confidence < 0.7
      || !instruction.selector
      || instruction.selector.length > 500
      || instruction.value.length > 10_000
      || seenSelectors.has(instruction.selector)
    ) {
      skipped.push({ selector: instruction.selector, reason: "The match was not safe to apply." });
      continue;
    }
    seenSelectors.add(instruction.selector);
    let element: FillableElement | null = null;
    try {
      element = root.querySelector<FillableElement>(instruction.selector);
    } catch {
      skipped.push({ selector: instruction.selector, reason: "The field selector was invalid." });
      continue;
    }
    if (!element || !writeFormValue(element, instruction.value)) {
      skipped.push({ selector: instruction.selector, reason: "The field could not be safely written." });
      continue;
    }
    filled.push({ selector: instruction.selector, profileKey: instruction.profileKey });
  }

  return { pageType: "application_form", filled, skipped, error: null };
}

export function startAutofillListener(): void {
  chrome.runtime.onMessage.addListener((message: AutofillContentMessage, _sender, sendResponse) => {
    if (
      !message
      || message.type !== "autofill-fields"
      || message.pageType !== "application_form"
      || !Array.isArray(message.fields)
    ) return;
    sendResponse(fillApplicationForm(message.fields));
  });
}
