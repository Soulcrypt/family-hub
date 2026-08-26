import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Ivy — Design-Spec §8.6. Not built yet; this route exists so the navigation never
 * offers a link that fails to resolve (see components/shell/nav-items.ts). Replace the body
 * with the real screen when ivy lands; the route and its nav entry already work.
 */
export default function IvyPage() {
  return <ComingSoon feature="ivy" />;
}
