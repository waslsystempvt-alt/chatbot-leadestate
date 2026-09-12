export function normalizeIndianMobile(value: string): string {
  let d = String(value || "").replace(/\D/g, "");
  if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2);
  if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
  return d;
}

export function isValidIndianPhone(value: string): boolean {
  const digits = normalizeIndianMobile(value);
  if (digits.length !== 10) return false;
  if (/^[1-5]/.test(digits)) return false;
  return true;
}

export function isValidLeadName(name: string): boolean {
  const s = String(name || "").trim();
  if (s.length < 2) return false;
  const collapsed = s.replace(/\s+/g, "");
  if (/^\d+$/.test(collapsed)) return false;
  return true;
}
