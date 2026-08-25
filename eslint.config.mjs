import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // TypeScript's `strictFunctionTypes` deliberately exempts method-shorthand signatures
    // (`interface X { m(role: MemberRole): boolean }`, or the equivalent object-literal
    // method syntax) from contravariant parameter checking — it's a documented, intentional
    // bivariance hole. Left open, it launders an attribution-only MemberRole into a call to
    // an AuthorityRole-gated function (lib/auth/permissions.ts) with NO cast and NO error:
    // `interface Gate { allows(role: MemberRole): boolean }; const g: Gate = { allows:
    // canEditSettings }; g.allows(attributionRole)` compiles clean without this rule. Forcing
    // every method signature into property form (`m: (role: MemberRole) => boolean`)
    // project-wide restores full contravariance and makes that shape unwritable. This rule
    // is required for lib/constants/roles.ts's AuthorityRole brand to hold — do not remove
    // or weaken it without re-verifying that brand.
    rules: {
      "@typescript-eslint/method-signature-style": ["error", "property"],
    },
  },
  {
    // The single legitimate mint site for AuthorityRole is requireAccountMembership() in
    // lib/auth/active-member.ts (see the comment at its cast for why). Test files may
    // construct a synthetic AuthorityRole to exercise the pure permission logic in
    // lib/auth/permissions.ts directly (never touches real authentication). Everywhere else,
    // `as AuthorityRole` hands out authority nobody proved the caller owns.
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["lib/auth/active-member.ts", "lib/__tests__/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAsExpression[typeAnnotation.typeName.name='AuthorityRole']",
          message:
            "`as AuthorityRole` is only permitted inside lib/auth/active-member.ts (the one trust-boundary mint site) or lib/__tests__/ (non-exported test fixtures). See lib/constants/roles.ts.",
        },
        // `text-muted`/`text-sunken`/`text-surface`/`text-bg` are shadcn SURFACE-role color
        // names (bg-muted, bg-sunken, ...) repointed onto this palette's near-background
        // tones -- pairing any of them with `text-` puts foreground-legible text in a
        // background-legible color, which is how `text-muted` shipped at 1.09:1 contrast
        // (roughly 40% of on-screen text effectively invisible) and survived twelve task
        // reviews and 207 tests before anyone measured it. Use the matching `-foreground`
        // token instead (`text-muted-foreground`, etc. -- see app/globals.css's `--muted-
        // foreground` mapping) or `text-ink` for full-strength text.
        {
          selector: "Literal[value=/(^|\\s)text-(muted|sunken|surface|bg)(\\s|$)/]",
          message:
            "Bare `text-muted`/`text-sunken`/`text-surface`/`text-bg` is a surface-role color paired with text -- it renders at ~1:1 contrast against the very surface it names. Use `text-muted-foreground` (or another `-foreground`/`text-ink` token) instead.",
        },
        {
          selector: "TemplateElement[value.raw=/(^|\\s)text-(muted|sunken|surface|bg)(\\s|$)/]",
          message:
            "Bare `text-muted`/`text-sunken`/`text-surface`/`text-bg` is a surface-role color paired with text -- it renders at ~1:1 contrast against the very surface it names. Use `text-muted-foreground` (or another `-foreground`/`text-ink` token) instead.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local Supabase CLI runtime artifacts (gitignored, not project source).
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
