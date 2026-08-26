import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Meals — Design-Spec §8.2. Not built yet; this route exists so the navigation never
 * offers a link that fails to resolve (see components/shell/nav-items.ts). Replace the body
 * with the real screen when meals lands; the route and its nav entry already work.
 */
export default function MealsPage() {
  return <ComingSoon feature="meals" />;
}
