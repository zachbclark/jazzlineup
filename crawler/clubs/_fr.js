// Shared French-language helpers for the Paris crawlers.
// Month names as they appear on venue sites: full ("juillet"), abbreviated
// ("juil.", "sept."), with or without accents.
const FR_MONTHS = {
  janvier: 1, janv: 1, jan: 1,
  fevrier: 2, février: 2, fevr: 2, févr: 2, fev: 2, fév: 2,
  mars: 3, mar: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7,
  aout: 8, août: 8, aou: 8, aoû: 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  decembre: 12, décembre: 12, dec: 12, déc: 12,
};

// "juil." / "JUILLET" / "août" -> month number, else null.
export function frMonthNum(name) {
  const key = String(name).toLowerCase().replace(/\./g, '').trim();
  if (FR_MONTHS[key]) return FR_MONTHS[key];
  // tolerate longer runs ("juillet2026") by prefix match
  for (const [k, v] of Object.entries(FR_MONTHS)) {
    if (key.startsWith(k)) return v;
  }
  return null;
}

// "19H30", "19h", "21h30" -> "19:30" / "19:00" (24h), else null.
export function frTime(str) {
  const m = String(str ?? '').match(/(\d{1,2})\s*[hH]\s*(\d{2})?/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
