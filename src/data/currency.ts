export type CurrencyCode = "USD";

export type CurrencyOption = {
  code: CurrencyCode;
  flag: string;
  name: string;
  locale: string;
};

export const currencies: CurrencyOption[] = [
  { code: "USD", flag: "🇺🇸", name: "United States Dollar", locale: "en-US" },
];

export const defaultCurrencyRates: Record<CurrencyCode, number> = {
  USD: 1,
};

export function getCurrency(code: CurrencyCode) {
  return currencies.find((currency) => currency.code === code) ?? currencies[0];
}

export function formatCurrencyAmount(usdAmount: number, currencyCode: CurrencyCode = "USD", rate = 1, precise = false) {
  const currency = getCurrency(currencyCode);
  const amount = usdAmount * rate;
  const fractionDigits = 2;
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
