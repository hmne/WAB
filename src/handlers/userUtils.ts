import { registerLocale, getAlpha2Code } from "i18n-iso-countries";
import arLang from "i18n-iso-countries/langs/ar.json";

registerLocale(arLang);

function getCountryCode(countryName: string): string {
  const countryCode = getAlpha2Code(countryName, "ar");
  if (!countryCode) {
    throw new Error(`Country not found for name: ${countryName}`);
  }
  return countryCode;
}

export function isValidDate(date: string): boolean {
  const dateRegex = /^(0?[1-9]|[12][0-9]|3[01])[-/](0?[1-9]|1[012])[-/]?(?:\d{4})?$/;
  return dateRegex.test(date);
}

function arabicToHinduNumbers(input: string): string {
  const arabicNumbers = "٠١٢٣٤٥٦٧٨٩";
  const hinduNumbers = "0123456789";
  return input.replace(/[٠-٩]/g, (match) => {
    return hinduNumbers[arabicNumbers.indexOf(match)];
  });
}

export function parseDate(dateString: string): Date | null {
  const hinduDateString = arabicToHinduNumbers(dateString);
  const dateParts = hinduDateString.split(/[-/]/).map(Number);
  const day = dateParts[0];
  const month = dateParts[1] - 1; // JavaScript month is 0-indexed
  const year = dateParts[2] || new Date().getFullYear();

  const dateObj = new Date(year, month, day);

  if (dateObj < new Date()) {
    return null;
  }

  return dateObj;
}

export { getCountryCode, flightRegex, arLang };
