// Mock script for the Irvine ADU application package. It fills the Building
// Permit Application (page 2). PDF field names were read from the real PDF
// (evals/fixtures/irvine-adu-application-package-2025.pdf, form 65-59 rev 04/23).
// Boxes marked "For office use only" are never filled.

import type { FormField } from "../types";
import type { Ctx, Script } from "./engine";
import { firstNumber, phoneDigits, splitAddress, withZip, yesNo } from "./engine";

const field = (f: Omit<FormField, "value">): FormField => ({ ...f, value: null });

/** The boxes we fill on the Irvine Building Permit Application (page 2). */
export function irvineAduFields(): FormField[] {
  return [
    field({ id: "project-address", label: "Project address", type: "text", pdfField: "PROJECT ADDRESS_BPA" }),
    field({ id: "permit-residential", label: "Permit type: residential building", type: "checkbox", pdfField: "RESIDENTAL BUILDING_BPA" }),
    field({ id: "applicant-name", label: "Applicant name", type: "text", pdfField: "APPLICANT/COMPANY_BPA" }),
    field({ id: "applicant-address", label: "Applicant address", type: "text", pdfField: "ADDRESS_BPA" }),
    field({ id: "applicant-city", label: "Applicant city", type: "text", pdfField: "CITY_BPA" }),
    field({ id: "applicant-zip", label: "Applicant ZIP", type: "text", pdfField: "ZIP_BPA" }),
    field({ id: "applicant-phone", label: "Applicant phone", type: "text", pdfField: "PHONE_BPA" }),
    field({ id: "applicant-email", label: "Applicant email", type: "text", pdfField: "EMAIL_BPA" }),
    field({ id: "owner-name", label: "Owner of the property", type: "text", pdfField: "OWNER OF THE PROPERTY_BPA" }),
    field({ id: "owner-address", label: "Owner address", type: "text", pdfField: "ADDRESS_2_BPA" }),
    field({ id: "owner-city", label: "Owner city", type: "text", pdfField: "CITY_2_BPA" }),
    field({ id: "owner-zip", label: "Owner ZIP", type: "text", pdfField: "ZIP_2_BPA" }),
    field({ id: "description", label: "Description of work", type: "text", pdfField: "DESC OF WORK_BPA" }),
    field({
      id: "includes-adu", label: "Project includes an ADU", type: "choice",
      options: [{ label: "Yes", pdfField: "Check Box2 ADU_BPA" }, { label: "No", pdfField: "Check Box3 ADU_BPA" }],
    }),
    field({
      id: "adu-type", label: "Type of ADU", type: "choice",
      options: [
        { label: "Attached", pdfField: "ATTACHED_ADU_BPA" },
        { label: "Detached", pdfField: "DETACHED_ADU_BPA" },
        { label: "Garage conversion", pdfField: "GARAGE_ADU_BPA" },
      ],
    }),
    field({
      id: "solar", label: "ADU includes solar panels", type: "choice",
      options: [{ label: "Yes", pdfField: "Check Box4 SOLAR ADU_BPA" }, { label: "No", pdfField: "Check Box5 SOLAR ADU_BPA" }],
    }),
    field({ id: "scope-adu", label: "Scope of work: ADU", type: "checkbox", pdfField: "ADU BOX_BPA" }),
    field({ id: "adu-sqft", label: "ADU size (sq ft)", type: "text", pdfField: "ADU TOTAL SQFT_BPA" }),
    field({ id: "stories", label: "Number of stories", type: "text", pdfField: "NO OF STORIES_BPA" }),
    field({ id: "current-use", label: "Current use", type: "text", pdfField: "CURRENT USE_BPA" }),
    field({ id: "proposed-use", label: "Proposed use", type: "text", pdfField: "PROPOSED USE_BPA" }),
    field({ id: "print-name", label: "Printed applicant name", type: "text", pdfField: "PRINT APPLICANT NAME_BPA" }),
    field({ id: "signature", label: "Applicant signature", type: "signature", pdfField: "APPLICANT_SIG_BPA", note: "Sign by hand after you print the form" }),
    field({ id: "date", label: "Date", type: "date", pdfField: "DATE__BPA", note: "Write the date when you sign" }),
  ];
}

export function irvineAduScript(): Script {
  const fields = irvineAduFields();
  const isOwner = (ctx: Ctx) => yesNo(ctx.answers.owner ?? "") === true;

  return {
    intro:
      "I read the Irvine ADU application. Page 2 is the building permit application, with 24 boxes for you. I can fill several of them from your answers, so I only need to ask you a few questions. Take your time.",
    fields,
    steps: [
      {
        id: "address",
        fieldIds: ["project-address"],
        ask: () =>
          "What's the address of the property where the new unit will go? Please include the ZIP code.",
        handle: (answer, _ctx, earlier) => {
          const a = withZip(answer, earlier);
          const { street, zip } = splitAddress(a);
          if (street.length < 4) return { followUp: "Please type the street address, for example 14 Sample Court, Irvine 92618." };
          if (!zip) return { followUp: `What's the ZIP code for ${street}? It's the 5-digit number at the end of the address.` };
          return {
            status: [`Looking up ${street}…`],
            fill: [
              { id: "project-address", value: a.replace(/\s+/g, " ") },
              { id: "permit-residential", value: true, source: "document", note: "An ADU is a residential building" },
              { id: "current-use", value: "Single-family home", source: "research", note: "Demo value. The real version checks city records." },
            ],
          };
        },
      },
      {
        id: "name",
        fieldIds: ["applicant-name", "print-name"],
        ask: () => "What's your full name?",
        handle: (a) =>
          a.length < 2
            ? { followUp: "Please type your first and last name." }
            : { fill: [{ id: "applicant-name", value: a }, { id: "print-name", value: a }] },
      },
      {
        id: "owner",
        fieldIds: ["owner-name", "owner-address", "applicant-address"],
        ask: () => "Are you the owner of this property?",
        choices: ["Yes", "No"],
        handle: (a, ctx) => {
          const owner = yesNo(a);
          if (owner === null) return { followUp: "Sorry, I didn't catch that. Do you own this property? Yes or no." };
          if (!owner) return {};
          const { street, city, zip } = splitAddress(String(ctx.get("project-address")));
          const assumption = "ASSUMPTION: you get mail at the property. Change this if not.";
          return {
            fill: [
              { id: "owner-name", value: String(ctx.get("applicant-name")) },
              { id: "owner-address", value: street },
              { id: "owner-city", value: city ?? "Irvine" },
              { id: "owner-zip", value: zip ?? "" },
              { id: "applicant-address", value: street, note: assumption },
              { id: "applicant-city", value: city ?? "Irvine", note: assumption },
              { id: "applicant-zip", value: zip ?? "", note: assumption },
            ],
          };
        },
      },
      {
        id: "owner-name",
        fieldIds: ["owner-name"],
        skip: isOwner,
        ask: () => "What's the full name of the property owner?",
        handle: (a) => (a.length < 2 ? { followUp: "Please type the owner's first and last name." } : { fill: [{ id: "owner-name", value: a }] }),
      },
      {
        id: "phone",
        fieldIds: ["applicant-phone"],
        ask: () => "What's the best phone number to reach you?",
        handle: (a) => {
          const phone = phoneDigits(a);
          return phone
            ? { fill: [{ id: "applicant-phone", value: phone }] }
            : { followUp: "That number doesn't look complete. Please type all 10 digits, like 949-555-0123." };
        },
      },
      {
        id: "email",
        fieldIds: ["applicant-email"],
        ask: () => "What's your email address? If you don't have one, just say none.",
        handle: (a) => {
          if (/^(none|no|n\/a|i don't|i dont)/i.test(a)) return {};
          return /\S+@\S+\.\S+/.test(a)
            ? { fill: [{ id: "applicant-email", value: a }] }
            : { followUp: "That email doesn't look quite right. Please check it, for example name@example.com, or say none." };
        },
      },
      {
        id: "adu-type",
        fieldIds: ["adu-type", "includes-adu"],
        ask: () =>
          "Will the new unit be attached to your house, separate in the yard, or a garage conversion?",
        handle: (a) => {
          const t = a.toLowerCase();
          const type = /garage/.test(t) ? "Garage conversion" : /attach/.test(t) && !/detach/.test(t) ? "Attached" : /(separ|detach|backyard|yard|stand)/.test(t) ? "Detached" : null;
          if (!type) return { followUp: "Sorry, I didn't catch that. Is it attached to the house, separate, or a garage conversion?" };
          return {
            fill: [
              { id: "includes-adu", value: "Yes", source: "document" },
              { id: "adu-type", value: type },
              { id: "scope-adu", value: true, source: "document" },
            ],
          };
        },
      },
      {
        id: "sqft",
        fieldIds: ["adu-sqft"],
        ask: () => "About how many square feet will the new unit be?",
        handle: (a) => {
          const n = firstNumber(a);
          if (!n) return { followUp: "I need a number for this one. About how many square feet? For example, 640." };
          if (n < 100 || n > 5000) return { followUp: `${n} square feet sounds unusual for an ADU. Could you check the number? Most are between 300 and 1,200.` };
          return { fill: [{ id: "adu-sqft", value: String(Math.round(n)) }] };
        },
      },
      {
        id: "stories",
        fieldIds: ["stories"],
        ask: () => "Will the new unit be one story or two?",
        choices: ["One story", "Two stories"],
        handle: (a) => {
          const t = a.toLowerCase();
          const n = /\b(1|one|single)\b/.test(t) ? "1" : /\b(2|two)\b/.test(t) ? "2" : null;
          return n ? { fill: [{ id: "stories", value: n }] } : { followUp: "Please answer one or two." };
        },
      },
      {
        id: "solar",
        fieldIds: ["solar"],
        ask: () => "Will the new unit have solar panels? Yes or no is fine, or say not sure.",
        handle: (a) => {
          if (/not sure|don.?t know|unsure/i.test(a)) {
            return { message: "No problem. I'll leave that box empty so you can ask your builder." };
          }
          const yes = yesNo(a);
          return yes === null ? { followUp: "Sorry, I didn't catch that. Yes, no, or not sure?" } : { fill: [{ id: "solar", value: yes ? "Yes" : "No" }] };
        },
      },
    ],
    finish: (ctx) => {
      const type = String(ctx.get("adu-type") ?? "").toLowerCase();
      const sqft = ctx.get("adu-sqft");
      const stories = ctx.get("stories");
      const desc = `New ${type || ""} accessory dwelling unit (ADU)${sqft ? `, ${sqft} sq ft` : ""}${stories ? `, ${stories} ${stories === "1" ? "story" : "stories"}` : ""}`.replace(/\s+/g, " ");
      return {
        status: ["Writing the description of work…", "Checking every box…"],
        fill: [
          { id: "description", value: desc },
          { id: "proposed-use", value: "Single-family home with ADU" },
        ],
      };
    },
  };
}
