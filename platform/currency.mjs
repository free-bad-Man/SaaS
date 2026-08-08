export function normalizeCurrency(value, fallback = "USD") {
  const currency = String(value ?? "").trim().toUpperCase() || fallback;
  return /^[A-Z]{3}$/.test(currency) ? currency : "";
}

export function assertSingleCurrency(...collections) {
  const currencies = new Set();
  for (const collection of collections) {
    for (const record of collection ?? []) {
      const currency = normalizeCurrency(record?.currency);
      if (!currency) throw new Error("Currency must be a three-letter ISO 4217 code.");
      currencies.add(currency);
    }
  }
  if (currencies.size > 1) {
    throw new Error(`Mixed currencies are not supported in one run (${[...currencies].sort().join(", ")}). Normalize spend and revenue to a single currency before processing.`);
  }
  return [...currencies][0] ?? "USD";
}
