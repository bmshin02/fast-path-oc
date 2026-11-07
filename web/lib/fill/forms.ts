// The city forms we ship with. PDFs live in evals/fixtures/ (see its README
// for source URLs, download dates and checksums).

export type SampleForm = {
  id: string;
  city: "Irvine" | "Anaheim";
  title: string;
  pages: number;
  fillable: boolean; // has real PDF form fields we can fill in place
  file: string; // path relative to the repo root
};

export const sampleForms: SampleForm[] = [
  {
    id: "irvine-adu-application",
    city: "Irvine",
    title: "ADU application package",
    pages: 10,
    fillable: true,
    file: "evals/fixtures/irvine-adu-application-package-2025.pdf",
  },
  {
    id: "irvine-development-standards",
    city: "Irvine",
    title: "Development standards checklist",
    pages: 1,
    fillable: true,
    file: "evals/fixtures/irvine-development-standards-checklist.pdf",
  },
  {
    id: "irvine-hold-harmless",
    city: "Irvine",
    title: "Hold harmless affidavit",
    pages: 2,
    fillable: true,
    file: "evals/fixtures/irvine-hold-harmless-affidavit.pdf",
  },
  {
    id: "anaheim-adu-checklist",
    city: "Anaheim",
    title: "ADU submittal requirements checklist",
    pages: 1,
    fillable: false,
    file: "evals/fixtures/anaheim-adu-checklist-z412-nov-2025.pdf",
  },
];
