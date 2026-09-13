import type { DetectedFormField, MasterResume, ProfileField, ResumeReference } from "@ghostboard/shared";
import { formatMonthYear, matchFormField, splitEducationDegree, splitResumeDateRange, valueForDetectedField } from "@ghostboard/autofill";

type FillableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement;

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
  "button[role='combobox']",
  "button[aria-haspopup='listbox']",
].join(",");

const SAVED_FORM_ANSWERS_KEY = "ghostboardSavedFormAnswers";

function normalized(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function fieldType(element: FillableElement): DetectedFormField["fieldType"] | null {
  if (element.tagName === "TEXTAREA") return "textarea";
  if (element.tagName === "SELECT") return "select";
  if (element.getAttribute("role") === "combobox" || element.getAttribute("aria-haspopup") === "listbox") return "select";
  const inputType = (element as HTMLInputElement).type.toLowerCase();
  if (["text", "email", "tel", "file", "checkbox", "radio", "date"].includes(inputType)) {
    return inputType as DetectedFormField["fieldType"];
  }
  if (["url", "number", "search"].includes(inputType)) return "text";
  if (["submit", "button", "reset", "image", "hidden", "password"].includes(inputType)) return null;
  return "text";
}

function optionLabel(element: FillableElement): string | null {
  const directLabel = "labels" in element ? element.labels?.[0]?.textContent?.trim() : "";
  if (directLabel) return directLabel;
  const wrappedLabel = element.closest("label")?.textContent?.trim();
  if (wrappedLabel) return wrappedLabel;
  return element.getAttribute("aria-label")?.trim() || null;
}

function groupQuestion(element: FillableElement): string | null {
  const fieldset = element.closest("fieldset");
  const legend = fieldset?.querySelector(":scope > legend")?.textContent?.replace(/\*/g, "").trim();
  if (legend) return legend;

  const group = element.closest<HTMLElement>("[role='radiogroup'], [data-automation-id='formField']");
  const labelledBy = group?.getAttribute("aria-labelledby")?.split(/\s+/).filter(Boolean) ?? [];
  const ariaQuestion = labelledBy
    .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(" ");
  if (ariaQuestion) return ariaQuestion;
  const workdayLabel = group?.querySelector<HTMLElement>("[data-automation-id='formLabel'], legend")?.textContent?.replace(/\*/g, "").trim();
  return workdayLabel || null;
}

function baseFieldLabel(element: FillableElement): string | null {
  const directLabel = optionLabel(element);
  const question = groupQuestion(element);
  if (question && directLabel && normalized(question) !== normalized(directLabel)) return `${question} ${directLabel}`;
  if (question) return question;
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

function repeatedGroupLabel(element: FillableElement): string | null {
  let container: HTMLElement | null = element.parentElement;
  for (let depth = 0; container && depth < 10; depth += 1, container = container.parentElement) {
    const headings = container.querySelectorAll<HTMLElement>(
      "h1, h2, h3, h4, h5, h6, legend, [role='heading'], [data-automation-id='panelHeaderTitle']",
    );
    const heading = [...headings]
      .filter((candidate) => candidate === element || Boolean(candidate.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING))
      .map((candidate) => candidate.textContent?.replace(/\*/g, "").trim() ?? "")
      .filter((text) => /^(?:work experience|education(?: history)?)\s+\d+$/i.test(text))
      .at(-1);
    if (heading) return heading;
  }
  return null;
}

function fieldLabel(element: FillableElement): string | null {
  const label = baseFieldLabel(element);
  const group = repeatedGroupLabel(element);
  if (!group) return label;
  if (!label || normalized(label) === normalized(group)) return group;
  return `${group} ${label}`;
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
        name: element.getAttribute("name") ?? element.getAttribute("data-automation-id"),
        placeholder: element.getAttribute("placeholder"),
        options: element.tagName === "SELECT"
          ? [...(element as HTMLSelectElement).options].map((option) => option.text.trim()).filter(Boolean)
          : element.tagName === "INPUT" && ["radio", "checkbox"].includes((element as HTMLInputElement).type)
            ? [...root.querySelectorAll<HTMLInputElement>(`input[name="${CSS.escape(element.getAttribute("name") ?? "")}"]`)]
              .map((option) => optionLabel(option) ?? option.value).filter(Boolean)
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
      : element.tagName === "INPUT"
        ? ownerWindow?.HTMLInputElement
        : undefined;
  const setter = constructor
    ? Object.getOwnPropertyDescriptor(constructor.prototype, "value")?.set
    : undefined;
  if (setter) setter.call(element, value);
  else element.value = value;
}

function setNativeChecked(element: HTMLInputElement, checked: boolean): void {
  const constructor = element.ownerDocument?.defaultView?.HTMLInputElement;
  const setter = constructor
    ? Object.getOwnPropertyDescriptor(constructor.prototype, "checked")?.set
    : undefined;
  if (setter) setter.call(element, checked);
  else element.checked = checked;
}

const REGION_ALIASES: Record<string, string[]> = {
  ab: ["alberta"], bc: ["british columbia"], mb: ["manitoba"], nb: ["new brunswick"],
  nl: ["newfoundland and labrador", "newfoundland"], ns: ["nova scotia"], nt: ["northwest territories"],
  nu: ["nunavut"], on: ["ontario"], pe: ["prince edward island"], qc: ["quebec", "québec"],
  sk: ["saskatchewan"], yt: ["yukon"],
};

function equivalentOption(candidate: string, requested: string): boolean {
  const actual = normalized(candidate);
  const expected = normalized(requested);
  if (!actual || !expected) return false;
  if (actual === expected) return true;
  const booleanAliases = [
    ["yes", "true", "1"],
    ["no", "false", "0"],
  ];
  if (booleanAliases.some((aliases) => aliases.includes(actual) && aliases.includes(expected))) return true;
  const degreeLevels = ["doctor", "master", "bachelor", "associate", "high school"];
  if (degreeLevels.some((level) => actual.includes(level) && expected.includes(level))) return true;
  for (const [abbreviation, names] of Object.entries(REGION_ALIASES)) {
    const equivalents = [abbreviation, ...names].map(normalized);
    const candidateMatches = equivalents.some((value) => actual === value || actual.includes(` ${value}`) || actual.startsWith(`${value} `));
    if (candidateMatches && equivalents.includes(expected)) return true;
  }
  if (expected.length >= 2 && (actual.endsWith(` ${expected}`) || actual.startsWith(`${expected} `))) return true;
  return false;
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
    const input = element as HTMLInputElement;
    const requested = normalized(requestedValue);
    const label = normalized(optionLabel(input) ?? "");
    const candidateValue = normalized(input.value);
    if (inputType === "radio" && !equivalentOption(label, requestedValue) && !equivalentOption(candidateValue, requestedValue)) {
      return false;
    }
    const checked = inputType === "radio"
      || /^(?:true|yes|checked|1)$/i.test(requested)
      || equivalentOption(label, requestedValue);
    if (inputType === "checkbox" && !checked && !/^(?:false|no|unchecked|0)$/i.test(requested)) return false;
    setNativeChecked(input, checked);
    const EventConstructor = element.ownerDocument?.defaultView?.Event ?? globalThis.Event;
    for (const type of ["input", "change", "blur"]) {
      element.dispatchEvent(new EventConstructor(type, { bubbles: true }));
    }
    return true;
  }

  if (element.tagName === "SELECT") {
    const option = [...(element as HTMLSelectElement).options].find((candidate) => {
      return equivalentOption(candidate.value, requestedValue) || equivalentOption(candidate.text, requestedValue);
    });
    if (!option) return false;
    value = option.value;
  }

  if (element.tagName === "INPUT" && (inputType === "month" || inputType === "date")) {
    const monthYear = formatMonthYear(requestedValue);
    const parts = monthYear?.match(/^(\d{2})\/(\d{4})$/);
    if (parts) value = inputType === "month" ? `${parts[2]}-${parts[1]}` : `${parts[2]}-${parts[1]}-01`;
  }

  setNativeValue(element, value);
  const EventConstructor = element.ownerDocument?.defaultView?.Event ?? globalThis.Event;
  for (const type of ["input", "change", "blur"]) {
    element.dispatchEvent(new EventConstructor(type, { bubbles: true }));
  }
  return true;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function writeCustomSelect(element: HTMLButtonElement | HTMLInputElement, requestedValue: string): Promise<boolean> {
  if (element.disabled) return false;
  element.focus();
  element.click();

  if (element.tagName === "INPUT") {
    setNativeValue(element, requestedValue);
    const InputEventConstructor = element.ownerDocument.defaultView?.InputEvent ?? globalThis.InputEvent;
    element.dispatchEvent(new InputEventConstructor("input", { bubbles: true, inputType: "insertText", data: requestedValue }));
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const options = [...element.ownerDocument.querySelectorAll<HTMLElement>(
      "[role='option'], [data-automation-id='promptOption'], [data-automation-id='menuItem']",
    )].filter((candidate) => {
      const style = candidate.ownerDocument.defaultView?.getComputedStyle(candidate);
      return style?.display !== "none" && style?.visibility !== "hidden";
    });
    const option = options.find((candidate) => equivalentOption(candidate.textContent ?? "", requestedValue));
    if (option) {
      option.click();
      return true;
    }
    await delay(50);
  }
  element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return false;
}

async function writeAnyFormValue(element: FillableElement, requestedValue: string): Promise<boolean> {
  if (element.tagName === "BUTTON") return writeCustomSelect(element as HTMLButtonElement, requestedValue);
  if (element.tagName === "INPUT" && element.getAttribute("role") === "combobox") {
    return writeCustomSelect(element as HTMLInputElement, requestedValue);
  }
  return writeFormValue(element, requestedValue);
}

export async function fillApplicationForm(
  instructions: AutofillInstruction[],
  root: Document = document,
): Promise<AutofillResult> {
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
    if (!element || !await writeAnyFormValue(element, instruction.value)) {
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

function experienceDescription(bullets: string[]): string {
  return bullets.join("\n");
}

function resumeReferenceToFields(reference: ResumeReference | undefined): ProfileField[] {
  if (!reference) return [];
  const experienceFields = reference.experience.flatMap((experience, index) => {
    const position = index + 1;
    const dates = splitResumeDateRange(experience.dateRange);
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
    const degree = splitEducationDegree(education.degree);
    const dates = splitResumeDateRange(education.dateRange);
    return [
      referenceField(`resumeEducation${position}School`, `Education ${position} school university college institution`, education.school),
      referenceField(`resumeEducation${position}Degree`, `Education ${position} degree type degree level qualification`, degree.level ?? education.degree ?? ""),
      referenceField(`resumeEducation${position}FieldOfStudy`, `Education ${position} field of study major academic discipline`, degree.fieldOfStudy ?? ""),
      referenceField(`resumeEducation${position}Location`, `Education ${position} location city country`, education.location ?? ""),
      referenceField(`resumeEducation${position}From`, `Education ${position} from start date start month year`, dates.from ?? ""),
      referenceField(`resumeEducation${position}To`, `Education ${position} to end date end month year`, dates.to ?? ""),
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
  const middleName = profileFields.find((field) => field.key === "middleName")?.value.trim() ?? "";
  const lastName = profileFields.find((field) => field.key === "lastName")?.value.trim() ?? "";
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  if (!fullName || profileFields.some((field) => field.key === "fullName" && field.value.trim())) return profileFields;
  return [
    ...profileFields,
    { key: "fullName", label: "Full name", value: fullName, category: "personal" },
  ];
}

interface SavedFormAnswer {
  question: string;
  value: string;
  updatedAt: string;
}

async function savedAnswerFields(): Promise<ProfileField[]> {
  const stored = await chrome.storage.local.get(SAVED_FORM_ANSWERS_KEY);
  const answers = Array.isArray(stored[SAVED_FORM_ANSWERS_KEY])
    ? stored[SAVED_FORM_ANSWERS_KEY] as SavedFormAnswer[]
    : [];
  return answers
    .filter((answer) => answer.question?.trim() && answer.value?.trim())
    .map((answer) => ({
      key: `savedAnswer:${normalized(answer.question).slice(0, 160)}`,
      label: answer.question,
      value: answer.value,
      category: "custom" as const,
    }));
}

async function requestAutofillSources(mode: "master" | "tailored"): Promise<ProfileField[] | null> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "request-autofill-profile", mode }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error("The extension could not load your autofill profile."));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      void savedAnswerFields().then((answers) => {
        const fields = profileFieldsForAutofill(response?.profile?.fields);
        const resume = response?.resume as MasterResume | null | undefined;
        if (fields.length === 0 && answers.length === 0 && !resume?.reference) {
          resolve(null);
          return;
        }
        resolve([...fields, ...answers, ...resumeReferenceToFields(resume?.reference)]);
      });
    });
  });
}

export async function triggerAutofill(mode: "master" | "tailored" = "master"): Promise<AutofillResult> {
  if (!isApplicationFormPage()) {
    return { pageType: "unknown", filled: [], skipped: [], error: "This page was not recognized as an application form." };
  }

  const profileFields = await requestAutofillSources(mode);
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
        value: valueForDetectedField(field, sourceValue),
        profileKey: match.matchedProfileKey,
        confidence: match.confidence,
      } satisfies AutofillInstruction];
    });

  return fillApplicationForm(matches);
}

function startSavedAnswerCapture(): void {
  document.addEventListener("change", (event) => {
    if (!event.isTrusted || !(event.target instanceof HTMLElement)) return;
    const element = event.target.closest<FillableElement>("input, select");
    if (!element || !(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) return;

    const inputType = element instanceof HTMLInputElement ? element.type.toLowerCase() : "select";
    if (!["radio", "checkbox", "select"].includes(inputType)) return;
    if (inputType === "radio" && !(element as HTMLInputElement).checked) return;

    const question = groupQuestion(element) ?? element.getAttribute("aria-label")?.trim() ?? element.getAttribute("name")?.trim();
    if (!question || question.length > 500) return;
    const value = element instanceof HTMLSelectElement
      ? element.selectedOptions[0]?.text.trim() ?? element.value
      : inputType === "checkbox"
        ? (element.checked ? "Yes" : "No")
        : optionLabel(element) ?? element.value;
    if (!value.trim() || value.length > 500) return;

    void chrome.storage.local.get(SAVED_FORM_ANSWERS_KEY).then((stored) => {
      const current = Array.isArray(stored[SAVED_FORM_ANSWERS_KEY])
        ? stored[SAVED_FORM_ANSWERS_KEY] as SavedFormAnswer[]
        : [];
      const questionKey = normalized(question);
      const next = [
        ...current.filter((answer) => normalized(answer.question) !== questionKey),
        { question, value, updatedAt: new Date().toISOString() },
      ].slice(-100);
      return chrome.storage.local.set({ [SAVED_FORM_ANSWERS_KEY]: next });
    }).catch((error) => console.error("Could not remember the application answer", error));
  }, true);
}

export function startAutofillListener(): void {
  startSavedAnswerCapture();
  chrome.runtime.onMessage.addListener((message: AutofillContentMessage | { type: "trigger-autofill"; mode?: "master" | "tailored" }, _sender, sendResponse) => {
    if (!message || message.type === "trigger-autofill") {
      void triggerAutofill(message?.type === "trigger-autofill" ? message.mode : "master").then((result) => sendResponse(result)).catch((error) => {
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
    void fillApplicationForm(message.fields).then(sendResponse);
    return true;
  });
}
