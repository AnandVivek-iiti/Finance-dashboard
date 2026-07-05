const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};


function parseStatementDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // 05-AUG-2024 / 05-Aug-2024
  let m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month === undefined) return null;
    return new Date(Date.UTC(Number(m[3]), month, Number(m[1])));
  }

  // 05/08/2024 or 05-08-2024 (DD/MM/YYYY, standard for Indian bank exports)
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) {
    return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  }

  // 2024-08-05 (ISO)
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }

  // Excel serial date number (e.g. 45510)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 60000) {
      // Excel epoch: Dec 30 1899
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      return new Date(ms);
    }
  }

  return null;
}

module.exports = { parseStatementDate };
