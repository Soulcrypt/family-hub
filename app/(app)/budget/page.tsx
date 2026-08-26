import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Budget — Design-Spec §8.9. Not built yet; this route exists so the navigation never
 * offers a link that fails to resolve (see components/shell/nav-items.ts). Replace the body
 * with the real screen when budget lands; the route and its nav entry already work.
 */
export default function BudgetPage() {
  return <ComingSoon feature="budget" />;
}
