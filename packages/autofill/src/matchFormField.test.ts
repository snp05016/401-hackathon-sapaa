import assert from "node:assert/strict";
import { test } from "node:test";
import { matchFormField } from "./matchFormField";
import type { DetectedFormField, ProfileField } from "@ghostboard/shared";

const profileFields: ProfileField[] = [
  { key: "firstName", label: "First name", value: "Ada", category: "personal" },
  { key: "lastName", label: "Last name", value: "Lovelace", category: "personal" },
  { key: "fullName", label: "Full name", value: "Ada Lovelace", category: "personal" },
  { key: "email", label: "Email", value: "ada@example.com", category: "contact" },
  { key: "phone", label: "Phone", value: "+15555555555", category: "contact" },
  { key: "address", label: "Address", value: "1 Analytical Engine Way", category: "personal" },
  { key: "city", label: "City", value: "London", category: "personal" },
  { key: "region", label: "State / province / region", value: "Ontario", category: "personal" },
  { key: "postalCode", label: "Postal code", value: "N1A 1A1", category: "personal" },
  { key: "country", label: "Country", value: "Canada", category: "personal" },
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

test("matchFormField returns no match when the field is unrelated", () => {
  const result = matchFormField(field({ label: "Start Date", name: "start_date" }), profileFields);
  assert.equal(result.matchedProfileKey, null);
  assert.equal(result.confidence, 0);
});

test("matchFormField uses native types and location aliases when labels are sparse", () => {
  const email = matchFormField(field({ label: null, name: "contact", fieldType: "email" }), profileFields);
  assert.equal(email.matchedProfileKey, "email");

  const address = matchFormField(field({ label: "Street address", name: "address_line_1" }), profileFields);
  assert.equal(address.matchedProfileKey, "address");

  const country = matchFormField(field({ label: "Country of residence", name: "country" }), profileFields);
  assert.equal(country.matchedProfileKey, "country");

  assert.equal(matchFormField(field({ label: "City / town" }), profileFields).matchedProfileKey, "city");
  assert.equal(matchFormField(field({ label: "Province" }), profileFields).matchedProfileKey, "region");
  assert.equal(matchFormField(field({ label: "Postal code" }), profileFields).matchedProfileKey, "postalCode");
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

test("matchFormField maps education fields to granular resume entries", () => {
  const resumeFields: ProfileField[] = [
    { key: "resumeEducation1School", label: "Education 1 school university college institution", value: "University of Alberta", category: "custom" },
    { key: "resumeEducation1Degree", label: "Education 1 degree program field of study major", value: "BSc Computer Science", category: "custom" },
    { key: "resumeEducation1Location", label: "Education 1 location city country", value: "Edmonton, AB", category: "custom" },
    { key: "resumeEducation1Date", label: "Education 1 graduation date dates attended year", value: "2027", category: "custom" },
  ];

  assert.equal(matchFormField(field({ label: "School or University" }), resumeFields).matchedProfileKey, "resumeEducation1School");
  assert.equal(matchFormField(field({ label: "Degree" }), resumeFields).matchedProfileKey, "resumeEducation1Degree");
  assert.equal(matchFormField(field({ label: "Expected Graduation Date" }), resumeFields).matchedProfileKey, "resumeEducation1Date");
});
