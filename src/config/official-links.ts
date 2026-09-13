export const officialLinks = {
  academy: "https://www.paloaltonetworks.com/services/education/academy",
} as const;
export function allowedOfficialLink(url: string): boolean {
  return Object.values(officialLinks).some((allowed) => url === allowed);
}
