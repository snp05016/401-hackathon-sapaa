import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMonthYear, matchFormField, splitEducationDegree, splitResumeDateRange, valueForDetectedField } from "./matchFormField";
import type { DetectedFormField, ProfileField } from "@ghostboard/shared";

const profileFields: ProfileField[] = [
  { key: "firstName", label: "First name", value: "Ada", category: "personal" },
  { key: "middleName", label: "Middle name", value: "", category: "personal" },
  { key: "lastName", label: "Last name", value: "Lovelace", category: "personal" },
  { key: "fullName", label: "Full name", value: "Ada Lovelace", category: "personal" },
  { key: "email", label: "Email", value: "ada@example.com", category: "contact" },
  { key: "phone", label: "Phone", value: "+15555555555", category: "contact" },
  { key: "phoneExtension", label: "Phone extension", value: "", category: "contact" },
  { key: "street", label: "Street address", value: "123 Example Street", category: "personal" },
  { key: "city", label: "City", value: "Edmonton", category: "personal" },
  { key: "province", label: "Province or state", value: "Alberta", category: "personal" },
  { key: "linkedin", label: "LinkedIn URL", value: "https://linkedin.com/in/ada", category: "links" },
  { key: "github", label: "GitHub URL", value: "https://github.com/ada", category: "links" },
];

function field(overrides: Partial<DetectedFormField> = {}): DetectedFormField {
  return {
    selector: "#example",
    label: null,
    fieldType: "text",
    name: null,
    placeholder: null,
    options: null,
    ...overrides,
  };
}

test("matchFormField recognizes common identity fields from labels and names", () => {
  const firstName = matchFormField(field({ label: "First Name", name: "first_name" }), profileFields);
  assert.equal(firstName.matchedProfileKey, "firstName");
  assert.ok(firstName.confidence >= 0.75);

  const fullName = matchFormField(field({ label: "Full Name", name: "name" }), profileFields);
  assert.equal(fullName.matchedProfileKey, "fullName");
  assert.ok(fullName.confidence >= 0.75);

  const email = matchFormField(field({ label: "Email Address", name: "email" }), profileFields);
  assert.equal(email.matchedProfileKey, "email");
  assert.ok(email.confidence >= 0.8);

  const linkedIn = matchFormField(field({ label: "LinkedIn Profile", placeholder: "linkedin.com/in/you" }), profileFields);
  assert.equal(linkedIn.matchedProfileKey, "linkedin");
  assert.ok(linkedIn.confidence >= 0.8);
});

test("matchFormField recognizes split address fields without confusing phone extensions", () => {
  assert.equal(matchFormField(field({ label: "Address Line 1" }), profileFields).matchedProfileKey, "street");
  assert.equal(matchFormField(field({ label: "City" }), profileFields).matchedProfileKey, "city");
  assert.equal(matchFormField(field({ label: "Province" }), profileFields).matchedProfileKey, "province");

  const withExtension = profileFields.map((candidate) => candidate.key === "phoneExtension" ? { ...candidate, value: "42" } : candidate);
  assert.equal(matchFormField(field({ label: "Phone Extension" }), withExtension).matchedProfileKey, "phoneExtension");
});

test("matchFormField returns no match when the field is unrelated", () => {
  const result = matchFormField(field({ label: "Start Date", name: "start_date" }), profileFields);
  assert.equal(result.matchedProfileKey, null);
  assert.equal(result.confidence, 0);
});

test("matchFormField recognizes resume reference fields", () => {
  const resumeFields: ProfileField[] = [
    { key: "resumeText", label: "Resume text", value: "Ada's resume", category: "custom" },
    { key: "resumeSkills", label: "Resume skills", value: "TypeScript, SQL", category: "custom" },
    { key: "resumeExperience", label: "Resume experience", value: "Built analytical engines.", category: "custom" },
  ];

  const resumeText = matchFormField(field({ label: "Paste resume text" }), resumeFields);
  assert.equal(resumeText.matchedProfileKey, "resumeText");
  assert.ok(resumeText.confidence >= 0.8);

  const skills = matchFormField(field({ label: "Technical Skills" }), resumeFields);
  assert.equal(skills.matchedProfileKey, "resumeSkills");
  assert.ok(skills.confidence >= 0.8);
});

test("matchFormField maps Workday work experience fields to granular resume entries", () => {
  const resumeFields: ProfileField[] = [
    { key: "resumeExperience1Title", label: "Work experience 1 job title position role", value: "Software Developer Intern", category: "custom" },
    { key: "resumeExperience1Company", label: "Work experience 1 company employer organization", value: "Acme", category: "custom" },
    { key: "resumeExperience1Location", label: "Work experience 1 location city country", value: "Edmonton, AB", category: "custom" },
    { key: "resumeExperience1Current", label: "Work experience 1 currently work here current role present", value: "true", category: "custom" },
    { key: "resumeExperience1From", label: "Work experience 1 from start date start month year", value: "05/2025", category: "custom" },
    { key: "resumeExperience1To", label: "Work experience 1 to end date end month year", value: "08/2025", category: "custom" },
    { key: "resumeExperience1Description", label: "Work experience 1 role description responsibilities duties achievements", value: "Built application form autofill.", category: "custom" },
  ];

  assert.equal(matchFormField(field({ label: "Job Title" }), resumeFields).matchedProfileKey, "resumeExperience1Title");
  assert.equal(matchFormField(field({ label: "Company" }), resumeFields).matchedProfileKey, "resumeExperience1Company");
  assert.equal(matchFormField(field({ label: "Location" }), resumeFields).matchedProfileKey, "resumeExperience1Location");
  assert.equal(matchFormField(field({ label: "I currently work here", fieldType: "checkbox" }), resumeFields).matchedProfileKey, "resumeExperience1Current");
  assert.equal(matchFormField(field({ label: "From", placeholder: "MM/YYYY" }), resumeFields).matchedProfileKey, "resumeExperience1From");
  assert.equal(matchFormField(field({ label: "To", placeholder: "MM/YYYY" }), resumeFields).matchedProfileKey, "resumeExperience1To");
  assert.equal(matchFormField(field({ label: "Role Description", fieldType: "textarea" }), resumeFields).matchedProfileKey, "resumeExperience1Description");
});

test("matchFormField uses the Workday experience ordinal for repeated blocks", () => {
  const resumeFields: ProfileField[] = [
    { key: "resumeExperience", label: "Resume experience", value: "All jobs combined into one long block.", category: "custom" },
    { key: "resumeExperience1Title", label: "Work experience 1 job title", value: "Senior Developer", category: "custom" },
    { key: "resumeExperience1Company", label: "Work experience 1 company", value: "First Company", category: "custom" },
    { key: "resumeExperience2Title", label: "Work experience 2 job title", value: "Junior Developer", category: "custom" },
    { key: "resumeExperience2Company", label: "Work experience 2 company", value: "Second Company", category: "custom" },
    { key: "resumeExperience2Location", label: "Work experience 2 location", value: "Edmonton, AB", category: "custom" },
    { key: "resumeExperience2Current", label: "Work experience 2 current role", value: "true", category: "custom" },
    { key: "resumeExperience2From", label: "Work experience 2 from date", value: "01/2023", category: "custom" },
    { key: "resumeExperience2To", label: "Work experience 2 to date", value: "02/2024", category: "custom" },
    { key: "resumeExperience2Description", label: "Work experience 2 description", value: "Built the second product.", category: "custom" },
  ];

  assert.equal(
    matchFormField(field({ label: "Work Experience 2 Job Title" }), resumeFields).matchedProfileKey,
    "resumeExperience2Title",
  );
  assert.equal(
    matchFormField(field({ label: "Work Experience 2 Company" }), resumeFields).matchedProfileKey,
    "resumeExperience2Company",
  );
  assert.equal(
    matchFormField(field({ label: "Job Title", name: "workExperience-2-jobTitle" }), resumeFields).matchedProfileKey,
    "resumeExperience2Title",
  );
  assert.equal(matchFormField(field({ label: "Work Experience 2 Location" }), resumeFields).matchedProfileKey, "resumeExperience2Location");
  assert.equal(matchFormField(field({ label: "Work Experience 2 I currently work here", fieldType: "checkbox" }), resumeFields).matchedProfileKey, "resumeExperience2Current");
  assert.equal(matchFormField(field({ label: "Work Experience 2 From", placeholder: "MM/YYYY" }), resumeFields).matchedProfileKey, "resumeExperience2From");
  assert.equal(matchFormField(field({ label: "Work Experience 2 To", placeholder: "MM/YYYY" }), resumeFields).matchedProfileKey, "resumeExperience2To");
  assert.equal(matchFormField(field({ label: "Work Experience 2 Role Description", fieldType: "textarea" }), resumeFields).matchedProfileKey, "resumeExperience2Description");
  assert.equal(
    matchFormField(field({ label: "Work Experience 3 Job Title" }), resumeFields).matchedProfileKey,
    null,
  );
});

test("matchFormField maps education fields to granular resume entries", () => {
  const resumeFields: ProfileField[] = [
    { key: "resumeEducation1School", label: "Education 1 school university college institution", value: "University of Alberta", category: "custom" },
    { key: "resumeEducation1Degree", label: "Education 1 degree type degree level", value: "Bachelor's Degree", category: "custom" },
    { key: "resumeEducation1FieldOfStudy", label: "Education 1 field of study major", value: "Computer Science", category: "custom" },
    { key: "resumeEducation1Location", label: "Education 1 location city country", value: "Edmonton, AB", category: "custom" },
    { key: "resumeEducation1Date", label: "Education 1 graduation date dates attended year", value: "2027", category: "custom" },
    { key: "resumeEducation2School", label: "Education 2 school university college institution", value: "University of Toronto", category: "custom" },
    { key: "resumeEducation2Degree", label: "Education 2 degree type degree level", value: "Master's Degree", category: "custom" },
    { key: "resumeEducation2FieldOfStudy", label: "Education 2 field of study major", value: "Data Science", category: "custom" },
    { key: "resumeEducation2From", label: "Education 2 from date", value: "09/2020", category: "custom" },
    { key: "resumeEducation2To", label: "Education 2 to date", value: "04/2022", category: "custom" },
  ];

  assert.equal(matchFormField(field({ label: "School or University" }), resumeFields).matchedProfileKey, "resumeEducation1School");
  assert.equal(matchFormField(field({ label: "Degree" }), resumeFields).matchedProfileKey, "resumeEducation1Degree");
  assert.equal(matchFormField(field({ label: "Education 1 Field of Study" }), resumeFields).matchedProfileKey, "resumeEducation1FieldOfStudy");
  assert.equal(matchFormField(field({ label: "Education 2 Degree", fieldType: "select" }), resumeFields).matchedProfileKey, "resumeEducation2Degree");
  assert.equal(matchFormField(field({ label: "Education 2 Field of Study" }), resumeFields).matchedProfileKey, "resumeEducation2FieldOfStudy");
  assert.equal(matchFormField(field({ label: "Education History 2 From" }), resumeFields).matchedProfileKey, "resumeEducation2From");
  assert.equal(matchFormField(field({ label: "Education History 2 To" }), resumeFields).matchedProfileKey, "resumeEducation2To");
  assert.equal(matchFormField(field({ label: "Expected Graduation Date" }), resumeFields).matchedProfileKey, "resumeEducation1Date");
});

test("resume dates are normalized to MM/YYYY for both ends of a range", () => {
  assert.equal(formatMonthYear("2025-5"), "05/2025");
  assert.equal(formatMonthYear("September 2024"), "09/2024");
  assert.deepEqual(splitResumeDateRange("May 2023 – Sep 2025"), {
    from: "05/2023",
    to: "09/2025",
    current: false,
  });
  assert.deepEqual(splitResumeDateRange("01/2022 to Present"), {
    from: "01/2022",
    to: null,
    current: true,
  });
  assert.deepEqual(splitResumeDateRange("Jan 2021 to Present"), { from: "01/2021", to: null, current: true });
  assert.deepEqual(splitResumeDateRange("Jun 2017 to Dec 2019"), { from: "06/2017", to: "12/2019", current: false });
});

test("segmented Workday date controls receive only their month or year component", () => {
  assert.equal(valueForDetectedField(field({ label: "From", name: "dateSectionMonth-input", placeholder: "MM" }), "01/2021"), "01");
  assert.equal(valueForDetectedField(field({ label: "From", name: "dateSectionYear-input", placeholder: "YYYY" }), "01/2021"), "2021");
  assert.equal(valueForDetectedField(field({ label: "From", placeholder: "MM/YYYY" }), "Jan 2021"), "01/2021");
  assert.equal(valueForDetectedField(field({ label: "To", name: "endDateYear" }), "12/2019"), "2019");
});

test("education degrees split into Workday degree level and field of study", () => {
  assert.deepEqual(splitEducationDegree("Master of Science in Data Science"), {
    level: "Master's Degree",
    fieldOfStudy: "Data Science",
  });
  assert.deepEqual(splitEducationDegree("Bachelor of Science in Computer Science"), {
    level: "Bachelor's Degree",
    fieldOfStudy: "Computer Science",
  });
  assert.deepEqual(splitEducationDegree("Master of Science - Software Engineering"), {
    level: "Master's Degree",
    fieldOfStudy: "Software Engineering",
  });
});

test("remembered answers match a repeated Workday radio question", () => {
  const question = "Have you previously worked for or are you currently working for Workday as an employee or contractor?";
  const remembered: ProfileField[] = [{
    key: "savedAnswer:workday-employment",
    label: question,
    value: "No",
    category: "custom",
  }];
  const result = matchFormField(field({
    label: `${question} No`,
    fieldType: "radio",
    options: ["Yes", "No"],
  }), remembered);
  assert.equal(result.matchedProfileKey, "savedAnswer:workday-employment");
  assert.ok(result.confidence >= 0.7);
});
