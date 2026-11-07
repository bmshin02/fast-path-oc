// PARSER SUBAGENT: one uploaded checklist PDF (plus an optional applicant package PDF)
// in, ParsedDoc JSON out. It only reads and transcribes. It never judges whether a
// citation is current or a requirement is lawful; that's the compliance subagent's job.

import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { client, MODEL, today, logUsage } from "./client";
import { RULES } from "./prompts";
import { ParsedDoc, type RunParser } from "./schemas";

// Static, so it caches across runs. Per-run facts (city, date, note) go in the user turn.
const SYSTEM = `You are the parser for Fast Path Check, a prototype that audits Orange County, California housing permit checklists against current state law. You read one uploaded city document and transcribe it into structured JSON. You do not judge whether a citation is current or a requirement is lawful; another agent does that from your output, so completeness and exact wording matter more than anything else.

What to extract:
- items: every line an applicant has to act on or read, in reading order. That includes numbered steps, checkbox lines, nested sub-checkboxes (e.g. "Title report", "Grant deed" under a covenant step), fee lines, and overview or note paragraphs that cite law or set a rule. Skip page furniture: headers, footers, logos, the office address block, page numbers.
- Packages that bundle a checklist with blank forms (permit application, fee worksheets, take-off sheets): the checklist lines are items as above. From each attached form, take only lines that state a rule, condition, exemption, fee basis, deadline or legal citation (e.g. "ADU is 749 sq. ft. or less" as a school-fee exemption, a fire-sprinkler question about ADUs, a paragraph citing the municipal code). Never make an item of a blank field label (name, address, phone, "office use only" boxes, fixture code tables, signature lines). If a form is attached but has no such lines, one "document" item naming the form and its form number is enough.
- Some PDFs have a garbled text layer (runs of symbols like "$$&4403:%8"). When the text and the page image disagree, transcribe what the page image shows.
- id: "p<page>-<n>", numbering items 1, 2, 3... in reading order on each page, ignoring the document's own numbering (documents often restart at 1 in each section). Ids must be unique.
- text: the line verbatim, including its bullets and sub-points if they belong to it. Don't summarize, fix typos, or reword. If a line runs onto the next page, keep it as one item on the page where it starts.
- page: the 1-based PDF page the item starts on.
- citations: every legal authority the line cites, one string per section, keeping the document's own wording for the code name and never changing a number. "California Government Code Sections 65852.2 and 65852.22" becomes ["California Government Code Section 65852.2", "California Government Code Section 65852.22"]. Include state statutes, bills (e.g. "SB 9"), regulations, and local code (e.g. "AMC Section 18.38.015.110"). Read hyperlinked section numbers too. Don't add citations the line doesn't make, and don't infer one from the topic. Empty array if none.
- kind: "document" for something to submit (a plan, report, deed, form); "fee" for a charge; "requirement" for a rule or step the applicant must satisfy; "info" for overview or explanatory text.

Document-level fields:
- isChecklist: true if this is a city permit checklist, submittal requirements list, application form or similar permit handout. False for anything else (a menu, a lease, a news article, a blank page). If false, return items: [] and fill the other fields as best you can.
- containsPersonalInfo: true only if the upload contains a private individual's details: a named person with a home address, personal phone or personal email, an APN tied to a named owner, signatures. City office addresses, department emails and phone numbers, and staff job titles are public government contact information, not personal information. Blank form fields (an empty "APPLICANT NAME" box) are not personal information either; only filled-in details count.
- city: the city that issued the document. If the document doesn't say, use the city the user gave.
- projectType: the project the document covers. A combined ADU and JADU checklist is "adu". If it doesn't say, use the project type the user gave.
- docTitle: the title as printed, plus any form number (e.g. "Accessory Dwelling Unit Submittal Requirements Checklist (Z412)").
- docDate: the revision or issue date as printed (e.g. "NOV 2025", "REV 10/24"), or null if there is none. Don't guess one. In a package, use the date of the checklist or cover form, not the attached forms.
- package: null unless an applicant package PDF was also uploaded. If it was, give one entry per checklist item of kind "document" or "requirement": "present" if the package clearly includes it, "missing" if it clearly doesn't, "inconsistent" if it's there but contradicts the checklist (wrong form, expired date), "cant_tell" otherwise. Say why in note, without quoting anyone's personal details.

${RULES}`;

function pdfBlock(data: string, title: string): Anthropic.Beta.BetaRequestDocumentBlock {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data },
    title,
  };
}

export const runParser: RunParser = async ({ pdfBase64, city, projectType, packagePdfBase64, note }, emit) => {
  emit({
    type: "progress",
    agent: "parser",
    message: `${note ? "Re-reading" : "Reading"} the ${city} checklist${packagePdfBase64 ? " and applicant package" : ""}`,
  });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [pdfBlock(pdfBase64, "City checklist")];
  if (packagePdfBase64) content.push(pdfBlock(packagePdfBase64, "Applicant package"));
  content.push({
    type: "text",
    text: [
      `Today is ${today()}.`,
      `The user says this checklist is from: ${city}. Project type they selected: ${projectType}.`,
      packagePdfBase64
        ? "The second document is the applicant's package. Fill `package` by checking it against the checklist."
        : "No applicant package was uploaded, so `package` must be null.",
      note ? `A previous parse of this document was incomplete. Fix this: ${note}` : "",
      "Parse the city checklist.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: betaZodOutputFormat(ParsedDoc) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });
  const msg = await stream.finalMessage();
  logUsage("parser", msg.usage);

  if (msg.stop_reason === "refusal") {
    throw new Error(`Parser declined this document (${msg.stop_details?.category ?? "no category"}).`);
  }
  if (msg.stop_reason === "max_tokens") {
    throw new Error("Parser output was cut off (document too long). Try uploading fewer pages.");
  }
  const doc = msg.parsed_output;
  if (!doc) throw new Error("Parser returned no structured output.");

  const result = tidy(doc, Boolean(packagePdfBase64));
  const citeCount = new Set(result.items.flatMap((i) => i.citations)).size;
  emit({
    type: "progress",
    agent: "parser",
    message: !result.isChecklist
      ? "This doesn't look like a permit checklist"
      : `Parsed ${result.items.length} lines, ${citeCount} distinct citations` +
        (result.package ? `, ${result.package.length} package items checked` : ""),
  });
  return result;
};

/** Cheap guarantees the schema can't express: unique ids, package only when uploaded, no blank citations. */
function tidy(doc: ParsedDoc, hasPackage: boolean): ParsedDoc {
  const seen = new Map<string, number>();
  const items = doc.items.map((item) => {
    const n = seen.get(item.id) ?? 0;
    seen.set(item.id, n + 1);
    return {
      ...item,
      id: n === 0 ? item.id : `${item.id}-${String.fromCharCode(97 + n)}`, // p1-3, p1-3-b, ...
      citations: [...new Set(item.citations.map((c) => c.trim()).filter(Boolean))],
    };
  });
  return { ...doc, items, package: hasPackage ? (doc.package ?? []) : null };
}
