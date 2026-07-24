function normalizeHeader(raw) {
  if (raw === null || raw === undefined) return "";
  let s = String(raw);
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  s = s.toLowerCase();
  s = s.replace(/[_\-./]/g, " ");
  s = s.replace(/[()[\]{}]/g, " ");
  s = s.replace(/[^a-z0-9\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

module.exports = { normalizeHeader };
