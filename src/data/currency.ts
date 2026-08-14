export type CurrencyCode =
  | "USD"
  | "CAD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "AUD"
  | "CHF"
  | "CNY"
  | "NZD"
  | "SEK"
  | "NOK"
  | "RUB"
  | "SGD";

export type CurrencyOption = {
  code: CurrencyCode;
  flag: string;
  name: string;
  locale: string;
};

export const currencies: CurrencyOption[] = [
  { code: "USD", flag: "🇺🇸", name: "United States Dollar", locale: "en-US" },
  { code: "CAD", flag: "🇨🇦", name: "Canadian Dollar", locale: "en-US" },
  { code: "EUR", flag: "🇪🇺", name: "Euro", locale: "en-IE" },
  { code: "GBP", flag: "🇬🇧", name: "British Pound", locale: "en-GB" },
  { code: "JPY", flag: "🇯🇵", name: "Japanese Yen", locale: "ja-JP" },
  { code: "AUD", flag: "🇦🇺", name: "Australian Dollar", locale: "en-AU" },
  { code: "CHF", flag: "🇨🇭", name: "Swiss Franc", locale: "de-CH" },
  { code: "CNY", flag: "🇨🇳", name: "Chinese Yuan", locale: "zh-CN" },
  { code: "NZD", flag: "🇳🇿", name: "New Zealand Dollar", locale: "en-NZ" },
  { code: "SEK", flag: "🇸🇪", name: "Swedish Krona", locale: "sv-SE" },
  { code: "NOK", flag: "🇳🇴", name: "Norwegian Krone", locale: "nb-NO" },
  { code: "RUB", flag: "🇷🇺", name: "Russian Ruble", locale: "ru-RU" },
  { code: "SGD", flag: "🇸🇬", name: "Singapore Dollar", locale: "en-SG" },
];

export const defaultCurrencyRates: Record<CurrencyCode, number> = {
  USD: 1, CAD: 1, EUR: 1, GBP: 1, JPY: 1, AUD: 1,
  CHF: 1, CNY: 1, NZD: 1, SEK: 1, NOK: 1, RUB: 1, SGD: 1,
};

export function getCurrency(code: CurrencyCode) {
  return currencies.find((currency) => currency.code === code) ?? currencies[0];
}

export function formatCurrencyAmount(usdAmount: number, currencyCode: CurrencyCode, rate: number, precise = false) {
  const currency = getCurrency(currencyCode);
  const amount = usdAmount * rate;
  const fractionDigits = currency.code === "JPY" ? 0 : 2;
  const meaningfulFractionDigits = precise && amount !== 0
    ? Math.min(8, (Math.abs(amount).toFixed(8).split(".")[1] ?? "").replace(/0+$/, "").length)
    : fractionDigits;
  const displayFractionDigits = Math.max(fractionDigits, meaningfulFractionDigits);

  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: displayFractionDigits,
    maximumFractionDigits: displayFractionDigits,
  }).format(amount);
}
