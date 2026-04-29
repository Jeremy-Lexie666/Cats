export function buildYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 31 }, (_, index) => `${currentYear - 30 + index}`);
}

export function buildMonthOptions(): string[] {
  return Array.from({ length: 12 }, (_, index) => `${index + 1}`.padStart(2, "0"));
}

export function getMonthDayCount(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function buildDayOptions(year: number, month: number): string[] {
  const dayCount = getMonthDayCount(year, month);
  return Array.from({ length: dayCount }, (_, index) => `${index + 1}`.padStart(2, "0"));
}

export function splitDateDisplay(value: string): [string, string, string] {
  if (!value) return ["年", "月", "日"];
  const [year = "年", month = "月", day = "日"] = value.split("-");
  return [year, month, day];
}

export function getDatePickerState(value: string): {
  years: string[];
  months: string[];
  days: string[];
  pickerValue: [number, number, number];
} {
  const years = buildYearOptions();
  const months = buildMonthOptions();
  const today = new Date();
  const currentYear = `${today.getFullYear()}`;
  const currentMonth = `${today.getMonth() + 1}`.padStart(2, "0");
  const currentDay = `${today.getDate()}`.padStart(2, "0");
  const [year = currentYear, month = currentMonth, day = currentDay] = value ? value.split("-") : [];
  const safeYear = years.includes(year) ? year : currentYear;
  const safeMonth = months.includes(month) ? month : currentMonth;
  const days = buildDayOptions(Number(safeYear), Number(safeMonth));
  const safeDay = days.includes(day) ? day : days[Math.min(Number(currentDay) - 1, days.length - 1)] || "01";

  return {
    years,
    months,
    days,
    pickerValue: [years.indexOf(safeYear), months.indexOf(safeMonth), days.indexOf(safeDay)]
  };
}
