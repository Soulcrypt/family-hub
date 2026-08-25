import { z } from "zod";
import { ROLES } from "@/lib/constants/roles";

export const roleSchema = z.enum(ROLES);

// A bare `z.string()` accepts any non-empty text (e.g. "Not/AZone"), which passes validation
// here and then throws a RangeError deep inside `Intl.DateTimeFormat` the first time
// something tries to render a date in that "timezone". Validate against the runtime's own
// IANA database instead of trusting free text.
//
// `Intl.supportedValuesOf("timeZone")` deliberately excludes "UTC" — it enumerates IANA zone
// identifiers, and "UTC" is a separate ECMA-402 special case, not one of them — even though
// `new Intl.DateTimeFormat("en", { timeZone: "UTC" })` accepts it without error. This
// schema's own default value is "UTC", so it must be added back explicitly or the schema
// would reject its own default. Verified live: `Intl.supportedValuesOf("timeZone").includes("UTC")`
// is `false` on Node 20 here.
const VALID_TIME_ZONES = new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, "Your name is required").max(40),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const householdSchema = z.object({
  name: z.string().trim().min(1, "Give your household a name").max(80),
  timezone: z
    .string()
    .trim()
    .min(1)
    .default("UTC")
    .refine((tz) => VALID_TIME_ZONES.has(tz), "Enter a valid time zone (e.g. America/New_York)"),
});

export const memberSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(40),
  role: roleSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a color"),
  birthday: z.string().date().optional().or(z.literal("")),
  hasLogin: z.boolean().default(false),
  email: z.string().trim().email().optional().or(z.literal("")),
});

export const pinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "Enter your 4-digit PIN"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type HouseholdInput = z.infer<typeof householdSchema>;
export type MemberInput = z.infer<typeof memberSchema>;
