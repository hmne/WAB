import arLang from "i18n-iso-countries/langs/ar.json";
import { registerLocale, getAlpha2Code } from "i18n-iso-countries";
import { getCode } from "country-list";

const flightRegex = /^\.رحله(?:\s*من\s+(\S+))?(?:\s*ل(\S+))?(?:\s*بتاريخ\s+(\S+))?$/;

registerLocale(arLang);

function getCountryCode(countryName: string) {
  const allCountryNames = arLang.countries;
  const foundCountryCode = Object.keys(allCountryNames).find(
    (code) => allCountryNames[code].toLowerCase() === countryName.toLowerCase()
  );

  if (foundCountryCode) {
    return foundCountryCode;
  }
  throw new Error(`Country not found for name: ${countryName}`);
}

export { getCountryCode, flightRegex, getCode };
