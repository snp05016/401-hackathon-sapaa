import type { DetectedFormField, MasterResume, ProfileField, ResumeReference } from "@ghostboard/shared";
import { matchFormField } from "@ghostboard/autofill";

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
  const wrappedLabel = element.closest("label")?.textContent?.trim();
  if (wrappedLabel) return wrappedLabel;
  const automationLabel = [
    "data-testid",
    "data-test",
    "data-qa",
    "data-automation-id",
    "data-field",
  ]
    .map((attribute) => element.getAttribute(attribute)?.trim())
    .find((value): value is string => !!value);
  if (automationLabel) return automationLabel;

  let container: HTMLElement | null = element.parentElement;
  for (let depth = 0; container && depth < 4; depth += 1, container = container.parentElement) {
    const precedingText = [...container.querySelectorAll<HTMLElement>("label, span, div, p")]
      .filter((candidate) => candidate.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
      .map((candidate) => candidate.textContent?.replace(/\*/g, "").trim())
      .filter((text): text is string => !!text && text.length <= 80 && !/^(delete|add|remove)$/i.test(text))
      .at(-1);
    if (precedingText) return precedingText;
  }

  return null;
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
  if (fields.length === 0) return false;
  const evidence = [
    root.title,
    root.location?.pathname,
    root.querySelector("h1")?.textContent,
    ...[...root.querySelectorAll("form")].slice(0, 3).map((form) => form.textContent?.slice(0, 4_000)),
  ].filter(Boolean).join(" ");
  const explicitSignal = /\b(?:apply|application|candidate|resume|cover letter|work authorization|sponsorship)\b/i.test(evidence);
  const labels = normalized(fields.map((field) => [field.label, field.name, field.placeholder].filter(Boolean).join(" ")).join(" "));
  const identitySignals = ["first name", "last name", "email"].filter((signal) => labels.includes(signal)).length;
  const applicationPath = /\b(?:apply|application|candidate|careers|jobs)\b/i.test(root.location?.pathname ?? "");
  const hasForm = root.querySelector("form") !== null;
  return explicitSignal || identitySignals >= 2 || (hasForm && applicationPath && identitySignals >= 1);
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
    || ["submit", "button", "reset", "image", "hidden", "password", "file"].includes(inputType)
  ) return false;

  let value = requestedValue;
  if (inputType === "checkbox" || inputType === "radio") {
    const checked = /^(?:true|yes|checked|1)$/i.test(requestedValue.trim());
    if (!checked) return false;
    (element as HTMLInputElement).checked = true;
    const EventConstructor = element.ownerDocument?.defaultView?.Event ?? globalThis.Event;
    for (const type of ["input", "change", "blur"]) {
      element.dispatchEvent(new EventConstructor(type, { bubbles: true }));
    }
    return true;
  }

  if (element.tagName === "SELECT") {
    const expected = normalized(requestedValue);
    const options = [...(element as HTMLSelectElement).options];
    const option = options.find((candidate) => normalized(candidate.value) === expected || normalized(candidate.text) === expected)
      // Portals commonly decorate a country or region label with a language or
      // code (for example "Canada (English)"). Only use a bounded substring
      // fallback after exact matching so a generic value cannot select an
      // unrelated option.
      ?? options.find((candidate) => {
        const text = normalized(candidate.text);
        return expected.length >= 3 && (text.includes(expected) || expected.includes(text));
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

function referenceField(key: string, label: string, value: string): ProfileField | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return { key, label, value: trimmed, category: "custom" };
}

function monthNumber(month: string): string | null {
  const normalizedMonth = month.toLowerCase().slice(0, 3);
  const index = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(normalizedMonth);
  return index >= 0 ? String(index + 1).padStart(2, "0") : null;
}

function formatWorkdayMonthYear(value: string): string | null {
  const text = value.trim();
  const numeric = text.match(/\b(0?[1-9]|1[0-2])\s*[/-]\s*((?:19|20)\d{2})\b/);
  if (numeric) return `${numeric[1].padStart(2, "0")}/${numeric[2]}`;

  const named = text.match(/\b([A-Za-z]{3,9})\.?\s+((?:19|20)\d{2})\b/);
  if (!named) return null;
  const month = monthNumber(named[1]);
  return month ? `${month}/${named[2]}` : null;
}

function splitDateRange(dateRange: string | null): { from: string | null; to: string | null; current: boolean } {
  if (!dateRange) return { from: null, to: null, current: false };
  const parts = dateRange.split(/\s+(?:to|through|-|--|–|—)\s+/i).map((part) => part.trim()).filter(Boolean);
  const from = formatWorkdayMonthYear(parts[0] ?? dateRange);
  const toText = parts[1] ?? "";
  const current = /\b(?:present|current|now)\b/i.test(toText || dateRange);
  return { from, to: current ? null : formatWorkdayMonthYear(toText), current };
}

function experienceDescription(bullets: string[]): string {
  return bullets.join("\n");
}

function resumeReferenceToFields(reference: ResumeReference | undefined): ProfileField[] {
  if (!reference) return [];
  const experienceFields = reference.experience.flatMap((experience, index) => {
    const position = index + 1;
    const dates = splitDateRange(experience.dateRange);
    return [
      referenceField(`resumeExperience${position}Title`, `Work experience ${position} job title position role`, experience.title),
      referenceField(`resumeExperience${position}Company`, `Work experience ${position} company employer organization`, experience.company),
      referenceField(`resumeExperience${position}Location`, `Work experience ${position} location city country`, experience.location ?? ""),
      referenceField(`resumeExperience${position}Current`, `Work experience ${position} currently work here current role present`, dates.current ? "true" : ""),
      referenceField(`resumeExperience${position}From`, `Work experience ${position} from start date start month year`, dates.from ?? ""),
      referenceField(`resumeExperience${position}To`, `Work experience ${position} to end date end month year`, dates.to ?? ""),
      referenceField(`resumeExperience${position}Description`, `Work experience ${position} role description responsibilities duties achievements`, experienceDescription(experience.bullets)),
    ].filter((field): field is ProfileField => field !== null);
  });
  const educationFields = reference.education.flatMap((education, index) => {
    const position = index + 1;
    return [
      referenceField(`resumeEducation${position}School`, `Education ${position} school university college institution`, education.school),
      referenceField(`resumeEducation${position}Degree`, `Education ${position} degree program field of study major`, education.degree ?? ""),
      referenceField(`resumeEducation${position}Location`, `Education ${position} location city country`, education.location ?? ""),
      referenceField(`resumeEducation${position}Date`, `Education ${position} graduation date dates attended year`, education.dateRange ?? ""),
      referenceField(`resumeEducation${position}Details`, `Education ${position} details coursework honors`, education.details.join("\n")),
    ].filter((field): field is ProfileField => field !== null);
  });
  return [
    ...experienceFields,
    ...educationFields,
    referenceField("resumeSummary", "Resume summary", reference.summary ?? ""),
    referenceField("resumeSkills", "Resume skills", reference.skills.join(", ")),
    referenceField(
      "resumeExperience",
      "Resume experience",
      reference.experience
        .map((experience) => {
          const heading = [experience.title, experience.company, experience.location, experience.dateRange].filter(Boolean).join(", ");
          return [heading, ...experience.bullets.map((bullet) => `- ${bullet}`)].join("\n");
        })
        .join("\n\n")
    ),
    referenceField(
      "resumeEducation",
      "Resume education",
      reference.education
        .map((education) => [education.degree, education.school, education.location, education.dateRange, ...education.details].filter(Boolean).join(", "))
        .join("\n")
    ),
    referenceField(
      "resumeProjects",
      "Resume projects",
      reference.projects
        .map((project) => [project.name, project.dateRange, ...project.bullets].filter(Boolean).join("\n"))
        .join("\n\n")
    ),
    referenceField("resumeText", "Resume text", reference.plainText),
  ].filter((field): field is ProfileField => field !== null);
}

function profileFieldsForAutofill(fields: unknown): ProfileField[] {
  if (!Array.isArray(fields)) return [];
  const profileFields = fields as ProfileField[];
  const firstName = profileFields.find((field) => field.key === "firstName")?.value.trim() ?? "";
  const lastName = profileFields.find((field) => field.key === "lastName")?.value.trim() ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  if (!fullName || profileFields.some((field) => field.key === "fullName" && field.value.trim())) return profileFields;
  return [
    ...profileFields,
    { key: "fullName", label: "Full name", value: fullName, category: "personal" },
  ];
}

async function requestAutofillSources(): Promise<ProfileField[] | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "request-autofill-profile" }, (response) => {
      const fields = profileFieldsForAutofill(response?.profile?.fields);
      const resume = response?.resume as MasterResume | null | undefined;
      if (fields.length === 0 && !resume?.reference) {
        resolve(null);
        return;
      }
      resolve([...fields, ...resumeReferenceToFields(resume?.reference)]);
    });
  });
}

export async function triggerAutofill(): Promise<AutofillResult> {
  if (!isApplicationFormPage()) {
    return { pageType: "unknown", filled: [], skipped: [], error: "This page was not recognized as an application form." };
  }

  const profileFields = await requestAutofillSources();
  if (!profileFields || profileFields.length === 0) {
    return { pageType: "application_form", filled: [], skipped: [], error: "No saved profile is available for autofill." };
  }

  const nonEmptyProfileFields = profileFields.filter((field) => field.value && field.value.trim().length > 0);
  if (nonEmptyProfileFields.length === 0) {
    return { pageType: "application_form", filled: [], skipped: [], error: "Save profile details before autofilling an application form." };
  }

  const matches = detectApplicationFormFields()
    .map((field) => ({ field, match: matchFormField(field, nonEmptyProfileFields) }))
    .flatMap(({ field, match }) => {
      if (!match.matchedProfileKey || match.confidence <= 0) return [];
      const sourceValue = nonEmptyProfileFields.find((profileField) => profileField.key === match.matchedProfileKey)?.value?.trim();
      if (!sourceValue) return [];
      return [{
        selector: field.selector,
        value: sourceValue,
        profileKey: match.matchedProfileKey,
        confidence: match.confidence,
      } satisfies AutofillInstruction];
    });

  return fillApplicationForm(matches);
}

export function startAutofillListener(): void {
  chrome.runtime.onMessage.addListener((message: AutofillContentMessage | { type: "trigger-autofill" }, _sender, sendResponse) => {
    if (!message || message.type === "trigger-autofill") {
      void triggerAutofill().then((result) => sendResponse(result)).catch((error) => {
        sendResponse({
          pageType: "unknown",
          filled: [],
          skipped: [{ selector: "", reason: error instanceof Error ? error.message : "Autofill failed." }],
          error: error instanceof Error ? error.message : "Autofill failed.",
        });
      });
      return true;
    }

    if (
      message.type !== "autofill-fields"
      || message.pageType !== "application_form"
      || !Array.isArray(message.fields)
    ) return;
    sendResponse(fillApplicationForm(message.fields));
  });
}
