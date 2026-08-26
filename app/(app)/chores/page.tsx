import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Chores — Design-Spec §8.5. Not built yet; this route exists so the navigation never
 * offers a link that fails to resolve (see components/shell/nav-items.ts). Replace the body
 * with the real screen when chores lands; the route and its nav entry already work.
 */
export default function ChoresPage() {
  return <ComingSoon feature="chores" />;
}
