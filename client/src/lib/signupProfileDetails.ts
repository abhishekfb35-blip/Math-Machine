export const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const PHONE_COUNTRY_CODES = [
  { code: "+91", label: "India +91" },
  { code: "+1", label: "USA / Canada +1" },
  { code: "+44", label: "United Kingdom +44" },
  { code: "+61", label: "Australia +61" },
  { code: "+65", label: "Singapore +65" },
  { code: "+971", label: "United Arab Emirates +971" },
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