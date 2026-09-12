export interface ProfileField {
  key: string;
  label: string;
  value: string;
  category: "personal" | "contact" | "links" | "eeo" | "custom";
}

export interface Profile {
  id: string;
  fields: ProfileField[];
  updatedAt: string;
}
