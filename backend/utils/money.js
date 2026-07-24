function parseAmountToPaise(raw) {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") {
    if (Number.isNaN(raw)) return null;
    return Math.round(raw * 100);
  }

  const cleaned = String(raw).replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "—") return null;

  const value = Number(cleaned);
  if (Number.isNaN(value)) return null;

  return Math.round(value * 100);
}
function paiseToRupees(paise) {
  if (paise === null || paise === undefined) return null;
  return paise / 100;
}

function formatRupees(paise) {
  if (paise === null || paise === undefined) return "unavailable";
  const rupees = paise / 100;
  return "₹" + rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = { parseAmountToPaise, paiseToRupees, formatRupees };