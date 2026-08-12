/**
 * Design tokens — the single source of truth for colors and geometry.
 * SPEC.md "Design tokens" section. No component may hardcode a hex value;
 * if a color is missing, add it here and say why.
 *
 * Web build re-exports these as CSS custom properties so both platforms
 * stay in sync. Native reads the JS values directly.
 */

export interface ColorTokens {
  /** Page background. */
  bg: string;
  /** Cards, popups, header. */
  surface: string;
  /** Hover, inactive tabs, map panel. */
  surfaceAlt: string;
  /** Dividers, card borders. */
  border: string;
  /** Drop shadow color. */
  shadow: string;
  /** Body text. */
  text: string;
  /** Metadata, "verified on" dates. */
  muted: string;
  /** Brand red — fills, borders, focus ring. */
  accent: string;
  /** Darkened accent for text and small icons (accent fails AA on body copy). */
  accentInk: string;
  /** Federal level color. */
  fed: string;
  /** State level color. */
  state: string;
  /** City level color. */
  city: string;
  /** Success / positive status. */
  ok: string;
  /** Stale data, low-confidence geocode match. */
  warn: string;
  /** Error status. */
  error: string;
}

export interface GeometryTokens {
  /** Default border radius. */
  r: number;
  /** Small border radius. */
  rSm: number;
  /** Header height in px. */
  headerH: number;
}

export const colors: ColorTokens = {
  bg: "rgb(254, 254, 254)",
  surface: "#ffffff",
  surfaceAlt: "#f6f6f6",
  border: "#e3e3e3",
  shadow: "rgba(0, 0, 0, 0.07)",
  text: "#111111",
  muted: "#888888",
  accent: "#FF5A5F",
  accentInk: "#C0272D",
  fed: "#1F6FEB",
  state: "#7C3AED",
  city: "#0d9488",
  ok: "#0d9488",
  warn: "#D97706",
  error: "#C0272D",
};

export const geometry: GeometryTokens = {
  r: 10,
  rSm: 6,
  headerH: 56,
};

/** Level color for a government tier. Used for card left-rules and polygon fills. */
export function levelColor(level: "federal" | "state" | "city"): string {
  switch (level) {
    case "federal":
      return colors.fed;
    case "state":
      return colors.state;
    case "city":
      return colors.city;
  }
}

/** CSS custom properties for the web build. Native ignores this. */
export function cssCustomProperties(): string {
  const entries: string[] = [];
  for (const [key, value] of Object.entries(colors)) {
    const cssName = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    entries.push(`  ${cssName}: ${value};`);
  }
  entries.push(`  --r: ${geometry.r}px;`);
  entries.push(`  --r-sm: ${geometry.rSm}px;`);
  entries.push(`  --header-h: ${geometry.headerH}px;`);
  return `:root {\n${entries.join("\n")}\n}`;
}
