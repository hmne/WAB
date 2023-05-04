import { registerLocale, getAlpha2Code } from "i18n-iso-countries";
import arLang from "i18n-iso-countries/langs/ar.json";
import { searchFlights } from '../features/skyscanner';

registerLocale(arLang);

function getCountryCode(countryName: string): string | null {
  const countryCode = getAlpha2Code(countryName, "ar");
  if (!countryCode) {
    return null;
  }
  return countryCode;
}
export function isValidDate(date: string): boolean {
  const dateRegex = /^(0?[1-9]|[12][0-9]|3[01])([-\/])(0?[1-9]|1[012])\2(\d{4}|\d{2})?$/;
  return dateRegex.test(arabicToHinduNumbers(date));
}

function arabicToHinduNumbers(input: string): string {
  const arabicNumbers = "٠١٢٣٤٥٦٧٨٩";
  const hinduNumbers = "0123456789";
  return input.replace(/[٠-٩]/g, (match) => {
    return hinduNumbers[arabicNumbers.indexOf(match)];
  });
}

function hinduToNormalNumbers(input: string): string {
  const hinduNumbers = "٠١٢٣٤٥٦٧٨٩";
  const normalNumbers = "0123456789";
  return input.replace(/[٠-٩]/g, (match) => {
    return normalNumbers[hinduNumbers.indexOf(match)];
  });
}

function parseDate(dateString: string): string | null {
  const hinduDateString = hinduToNormalNumbers(arabicToHinduNumbers(dateString));
  const dateRegexes = [    /^(0?[1-9]|[12][0-9]|3[01])([\/])(0?[1-9]|1[012])\2?(\d{4})?$/, // DD/MM/YYYY
    /^(0?[1-9]|[12][0-9]|3[01])([.-])(0?[1-9]|1[012])\2?(\d{4})?$/, // DD-MM-YYYY or DD.MM.YYYY
    /^(0?[1-9]|1[012])([\/])(0?[1-9]|[12][0-9]|3[01])\2?(\d{4})?$/, // MM/DD/YYYY
    /^(0?[1-9]|1[012])([.-])(0?[1-9]|[12][0-9]|3[01])\2?(\d{4})?$/, // MM-DD-YYYY or MM.DD.YYYY
    /^(\d{4})([\/.-])(0?[1-9]|1[012])\2?(0?[1-9]|[12][0-9]|3[01])$/, // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
    /^(0?[1-9]|[12][0-9]|3[01])$/ // D or DD
  ];
  
  let year = new Date().getFullYear();
  let month = 1;
  let day = 1;
  let matched = false;

  for (const regex of dateRegexes) {
    const match = hinduDateString.match(regex);
    if (match) {
      matched = true;
      const [, dayStr, separator, monthStr, yearStr] = match;

      if (yearStr) {
        year = parseInt(yearStr);
      }

      day = parseInt(dayStr);
      month = parseInt(monthStr);

      break;
    }
  }

  if (!matched) {
    return null;
  }

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  const maxDaysInMonth = new Date(year, month, 0).getDate();
  if (day > maxDaysInMonth) {
    return null;
  }

  return `${year}-${month}-${day}`;
}


export async function handleFlightRequest(client: Client, message: Message, params: any[]): Promise<void> {
  const [_, from, to, date] = params;

  try {
    const flightResults = await searchFlights(from, to, date);
    await message.reply(flightResults);
  } catch (error) {
    console.error(error);
    await message.reply("حدث خطأ أثناء البحث عن الرحلات. يرجى المحاولة مرة أخرى.");
  }
}

export { parseDate, getCountryCode,isCountryOrCodeValid, isDateFormatValid, flightRegex, arLang };
