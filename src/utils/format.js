export function toArabicNumbers(str) {
  return str.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
}