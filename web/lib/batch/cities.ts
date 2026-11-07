// Orange County's 34 cities plus the unincorporated county, for the batch city picker and for
// guessing a file's city from its name. Shared by browser and server.

export const OC_JURISDICTIONS = [
  "Aliso Viejo", "Anaheim", "Brea", "Buena Park", "Costa Mesa", "Cypress", "Dana Point",
  "Fountain Valley", "Fullerton", "Garden Grove", "Huntington Beach", "Irvine", "La Habra",
  "La Palma", "Laguna Beach", "Laguna Hills", "Laguna Niguel", "Laguna Woods", "Lake Forest",
  "Los Alamitos", "Mission Viejo", "Newport Beach", "Orange", "Orange County", "Placentia",
  "Rancho Santa Margarita", "San Clemente", "San Juan Capistrano", "Santa Ana", "Seal Beach",
  "Stanton", "Tustin", "Villa Park", "Westminster", "Yorba Linda",
] as const;

/** Best guess of the city from a file name ("anaheim-adu-checklist.pdf" → "Anaheim"), or null. */
export function guessCity(filename: string): string | null {
  const name = filename.toLowerCase().replace(/[_\-.]+/g, " ");
  // Longest names first, so "Orange County" wins over "Orange" and "Laguna Niguel" over nothing.
  const sorted = [...OC_JURISDICTIONS].sort((a, b) => b.length - a.length);
  for (const c of sorted) {
    if (new RegExp(`\\b${c.toLowerCase().replace(/ /g, "\\s*")}\\b`).test(name)) return c;
  }
  return null;
}
