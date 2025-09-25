export function normalizePercent(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value > 1 ? value / 100 : value;
  let s = String(value).trim();
  if (s === "") return 0;
  s = s.replace("%", "").replace(",", ".");
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
}

export function avg(arr) {
  const a = arr.filter((n) => typeof n === "number" && !isNaN(n));
  if (!a.length) return 0;
  return a.reduce((s, v) => s + v, 0) / a.length;
}

export const pct = (v) => `${(v * 100).toFixed(1)}%`;