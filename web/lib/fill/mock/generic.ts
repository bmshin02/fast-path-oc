// Mock script for every other form (other samples and uploads). The questions
// are generic because the mock can't read the file; the real version (step 5)
// reads the actual form.

import type { FormField, FormSource } from "../types";
import type { Script } from "./engine";
import { phoneDigits, splitAddress, withZip } from "./engine";

const field = (f: Omit<FormField, "value">): FormField => ({ ...f, value: null });

export function genericScript(source: FormSource): Script {
  const name = source.kind === "sample" ? source.form.title : source.file.name;
  return {
    intro: `I read "${name}". I'll ask you a few questions to fill it in. Take your time.`,
    fields: [
      field({ id: "applicant-name", label: "Applicant name", type: "text" }),
      field({ id: "property-address", label: "Property address", type: "text" }),
      field({ id: "phone", label: "Phone", type: "text" }),
      field({ id: "project", label: "Description of the project", type: "text" }),
      field({ id: "signature", label: "Signature", type: "signature", note: "Sign by hand after you print the form" }),
      field({ id: "date", label: "Date", type: "date", note: "Write the date when you sign" }),
    ],
    steps: [
      {
        id: "name",
        fieldIds: ["applicant-name"],
        ask: () => "What's your full name?",
        handle: (a) => (a.length < 2 ? { followUp: "Please type your first and last name." } : { fill: [{ id: "applicant-name", value: a }] }),
      },
      {
        id: "address",
        fieldIds: ["property-address"],
        ask: () => "What's the address of the property? Please include the ZIP code.",
        handle: (answer, _ctx, earlier) => {
          const a = withZip(answer, earlier);
          return splitAddress(a).zip
            ? { status: ["Checking the address…"], fill: [{ id: "property-address", value: a }] }
            : { followUp: "What's the ZIP code? It's the 5-digit number at the end of the address." };
        },
      },
      {
        id: "phone",
        fieldIds: ["phone"],
        ask: () => "What's the best phone number to reach you?",
        handle: (a) => {
          const p = phoneDigits(a);
          return p ? { fill: [{ id: "phone", value: p }] } : { followUp: "Please type all 10 digits, like 949-555-0123." };
        },
      },
      {
        id: "project",
        fieldIds: ["project"],
        ask: () => "In a sentence, what are you building or changing?",
        handle: (a) =>
          a.split(/\s+/).length < 3
            ? { followUp: "Could you say a little more? For example: a new 640 square foot unit in the backyard." }
            : { fill: [{ id: "project", value: a }] },
      },
    ],
  };
}
