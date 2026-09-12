export interface DetectedFormField {
  selector: string;
  label: string | null;
  fieldType: "text" | "email" | "tel" | "textarea" | "select" | "file" | "checkbox" | "radio" | "date";
  name: string | null;
  placeholder: string | null;
  options: string[] | null;
}
