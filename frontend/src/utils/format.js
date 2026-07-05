export function formatRupees(paise, { decimals = 0 } = {}) {
  if (paise === null || paise === undefined) return "unavailable";
  const rupees = paise / 100;
  return "₹" + rupees.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatRupeesShort(paise) {
  if (paise === null || paise === undefined) return "unavailable";
  const rupees = Math.abs(paise / 100);
  const sign = paise < 0 ? "-" : "";
  if (rupees >= 10000000) return `${sign}₹${(rupees / 10000000).toFixed(2)}Cr`;
  if (rupees >= 100000) return `${sign}₹${(rupees / 100000).toFixed(2)}L`;
  if (rupees >= 1000) return `${sign}₹${(rupees / 1000).toFixed(1)}K`;
  return `${sign}₹${rupees.toFixed(0)}`;
}

export function formatDate(date) {
  if (!date) return "unavailable";
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatMonth(monthKey) {
  if (!monthKey) return "unavailable";
  const [year, month] = monthKey.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

export function formatPercent(value) {
  if (value === null || value === undefined) return "unavailable";
  return `${value.toFixed(1)}%`;
}

const BANK_PROFILE_NAMES = {
  sbi: "State Bank of India",
  canara: "Canara Bank",
  generic: "Generic / Unrecognized Bank",
};

export function formatBankName(bankProfileId) {
  if (!bankProfileId || bankProfileId === "unknown") return "Unknown bank";
  if (BANK_PROFILE_NAMES[bankProfileId]) return BANK_PROFILE_NAMES[bankProfileId];
  return bankProfileId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatDateHyphen(date) {
  if (!date) return "?";
  return new Date(date)
    .toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/ /g, "-");
}