/** Local time with its UTC offset, e.g. 2026-09-12T10:32:05+05:30. Readable by people, sortable as text. */
export function nowIso(d = new Date()) {
  const pad = (n, w = 2) => String(Math.abs(n)).padStart(w, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(off / 60))}:${pad(off % 60)}`
  );
}
export function today() { return nowIso().slice(0, 10); }
/** Short form for briefs: "09-12 10:32". */
export function shortStamp(iso) {
  if (!iso) return "never";
  return iso.slice(5, 16).replace("T", " ");
}
export function hoursSince(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (Date.now() - t) / 3.6e6 : Infinity;
}
