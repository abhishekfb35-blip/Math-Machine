import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";

export const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const PHONE_COUNTRY_CODES = [
  ...getCountries()
    .map((country: CountryCode) => {
      const code = `+${getCountryCallingCode(country)}`;
      let name = country;
      try {
        name = new Intl.DisplayNames(["en"], { type: "region" }).of(country) || country;
      } catch {
        // Fall back to the ISO code in environments without Intl.DisplayNames.
      }
      return { code, label: `${name} ${code}`, country };
    })
    .sort((a, b) => {
      if (a.country === "IN") return -1;
      if (b.country === "IN") return 1;
      return a.label.localeCompare(b.label);
    }),
];

export function getMonthDayValue(month: string, day: string, label: string): { value: string | null; error?: string } {
  if (!month && !day) return { value: null };
  if (!month || !day) return { value: null, error: `Please choose both a month and day for ${label.toLowerCase()}.` };

  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!Number.isInteger(monthNumber) || !Number.isInteger(dayNumber) || monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > daysInMonth[monthNumber - 1]) {
    return { value: null, error: `Please enter a valid ${label.toLowerCase()}.` };
  }

  return { value: `${String(monthNumber).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}` };
}