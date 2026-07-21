import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex color");

export const moduleAppearanceSchema = z.object({
  concept: z.object({
    source: z.enum(["user_reference", "imagegen", "existing_system"]),
    direction: z.string().trim().min(12).max(500),
    referenceLabel: z.string().trim().min(1).max(160).nullable(),
    approvedByUser: z.literal(true),
  }).strict(),
  layout: z.enum(["ledger", "cards", "timeline", "showcase"]),
  density: z.enum(["compact", "comfortable", "spacious"]),
  typography: z.object({
    display: z.enum(["editorial", "grotesk", "humanist", "monospace"]),
    body: z.enum(["grotesk", "humanist", "monospace"]),
  }).strict(),
  tokens: z.object({
    canvas: hexColor,
    surface: hexColor,
    surfaceStrong: hexColor,
    text: hexColor,
    mutedText: hexColor,
    accent: hexColor,
    accentText: hexColor,
    border: hexColor,
    focus: hexColor,
  }).strict(),
  motion: z.enum(["none", "subtle"]),
}).strict().superRefine((appearance, context) => {
  const checks: Array<[keyof typeof appearance.tokens, keyof typeof appearance.tokens, number, string]> = [
    ["text", "canvas", 4.5, "Text must contrast with the canvas"],
    ["text", "surface", 4.5, "Text must contrast with the surface"],
    ["mutedText", "surface", 4.5, "Muted text must remain readable"],
    ["accentText", "accent", 4.5, "Accent text must remain readable"],
    ["focus", "surface", 3, "Focus color must remain visible"],
  ];
  for (const [foreground, background, minimum, message] of checks) {
    if (contrastRatio(appearance.tokens[foreground], appearance.tokens[background]) < minimum) {
      context.addIssue({ code: "custom", message, path: ["tokens", foreground] });
    }
  }
});

export type ModuleAppearance = z.infer<typeof moduleAppearanceSchema>;

export const DEFAULT_MODULE_APPEARANCE: ModuleAppearance = {
  concept: {
    source: "existing_system",
    direction: "Buildmates editorial workspace with clear, quiet working states.",
    referenceLabel: null,
    approvedByUser: true,
  },
  layout: "ledger",
  density: "comfortable",
  typography: { display: "editorial", body: "humanist" },
  tokens: {
    canvas: "#f5f1e8",
    surface: "#fffdf8",
    surfaceStrong: "#ece6da",
    text: "#20211e",
    mutedText: "#5d6058",
    accent: "#244f3e",
    accentText: "#ffffff",
    border: "#aaa99f",
    focus: "#8b3d16",
  },
  motion: "subtle",
};

export function safeParseModuleAppearance(value: unknown) {
  return moduleAppearanceSchema.safeParse(value);
}

export function parseModuleAppearance(value: unknown): ModuleAppearance {
  const parsed = moduleAppearanceSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_MODULE_APPEARANCE;
}

function contrastRatio(left: string, right: string): number {
  const light = relativeLuminance(left);
  const dark = relativeLuminance(right);
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
