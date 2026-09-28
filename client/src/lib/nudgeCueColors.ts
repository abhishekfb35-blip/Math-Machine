export interface NudgeCueThemeColors {
  pulse: string;
  halo: string;
}

export interface NudgeCueColors {
  light: NudgeCueThemeColors;
  dark: NudgeCueThemeColors;
}

export const DEFAULT_NUDGE_CUE_COLORS: NudgeCueColors = {
  light: {
    pulse: "#4a90e2",
    halo: "#4a90e2",
  },
  dark: {
    pulse: "#67a9ef",
    halo: "#88baf2",
  },
};

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizeNudgeCueColors(value: unknown): NudgeCueColors {
  if (!value || typeof value !== "object") return DEFAULT_NUDGE_CUE_COLORS;

  const candidate = value as Partial<Record<"light" | "dark", Partial<NudgeCueThemeColors>>>;
  return {
    light: {
      pulse: isHexColor(candidate.light?.pulse)
        ? candidate.light.pulse
        : DEFAULT_NUDGE_CUE_COLORS.light.pulse,
      halo: isHexColor(candidate.light?.halo)
        ? candidate.light.halo
        : DEFAULT_NUDGE_CUE_COLORS.light.halo,
    },
    dark: {
      pulse: isHexColor(candidate.dark?.pulse)
        ? candidate.dark.pulse
        : DEFAULT_NUDGE_CUE_COLORS.dark.pulse,
      halo: isHexColor(candidate.dark?.halo)
        ? candidate.dark.halo
        : DEFAULT_NUDGE_CUE_COLORS.dark.halo,
    },
  };
}

export function hexColorToRgb(color: string): string {
  const normalized = isHexColor(color) ? color.slice(1) : DEFAULT_NUDGE_CUE_COLORS.light.pulse.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}