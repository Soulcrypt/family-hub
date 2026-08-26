import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Photos — Design-Spec §8.7. Not built yet; this route exists so the navigation never
 * offers a link that fails to resolve (see components/shell/nav-items.ts). Replace the body
 * with the real screen when photos lands; the route and its nav entry already work.
 */
export default function PhotosPage() {
  return <ComingSoon feature="photos" />;
}
