import type { ChatTheme } from "./config";

function hexToRgbArray(hex: string): number[] | null {
  const cleanHex = String(hex || "").trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleanHex)) return null;
  const intVal = parseInt(cleanHex, 16);
  return [(intVal >> 16) & 255, (intVal >> 8) & 255, intVal & 255];
}

function rgbArrayToHex(rgb: number[]): string {
  return (
    "#" +
    rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")
  );
}

function shiftBrightness(hex: string, ratio: number): string {
  const rgb = hexToRgbArray(hex);
  if (!rgb) return hex;
  const shifted =
    ratio < 0
      ? rgb.map((c) => c * (1 + ratio))
      : rgb.map((c) => c + (255 - c) * ratio);
  return rgbArrayToHex(shifted);
}

export function applyProjectTheme(el: HTMLElement, theme: ChatTheme | undefined): void {
  if (!theme || typeof theme !== "object") return;
  const primary = theme.primary;
  if (!primary) return;
  const primaryDark = theme.primaryDark || shiftBrightness(primary, -0.18);
  const primarySoft = theme.primarySoft || shiftBrightness(primary, 0.22);
  const rgb = hexToRgbArray(primary);
  const rgbString = rgb ? rgb.join(", ") : "4, 120, 87";

  el.style.setProperty("--primary", primary);
  el.style.setProperty("--primary-dark", primaryDark);
  el.style.setProperty("--primary-soft", primarySoft);
  el.style.setProperty("--primary-rgb", rgbString);
  el.style.setProperty("--ring", `rgba(${rgbString}, 0.18)`);
  el.style.setProperty(
    "--header-gradient",
    `linear-gradient(135deg, ${primaryDark} 0%, ${primary} 48%, ${primarySoft} 100%)`
  );
  if (theme.onPrimary) el.style.setProperty("--on-primary", theme.onPrimary);
  if (theme.botBubble) el.style.setProperty("--bot", theme.botBubble);
}

export function avatarFallbackDataUrl(agentName: string, brandHex: string): string {
  const initial = (agentName || "A").trim().charAt(0).toUpperCase() || "A";
  const brand = brandHex || "#2563eb";
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>` +
        `<rect width='100%' height='100%' fill='#f3f4f6'/>` +
        `<text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' ` +
        `font-family='Arial, sans-serif' font-size='34' font-weight='700' fill='${brand}'>` +
        initial +
        `</text></svg>`
    )
  );
}
