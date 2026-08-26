import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Calendar — Design-Spec §8.4. Not built yet; this route exists so the navigation never
 * offers a link that fails to resolve (see components/shell/nav-items.ts). Replace the body
 * with the real screen when calendar lands; the route and its nav entry already work.
 */
export default function CalendarPage() {
  return <ComingSoon feature="calendar" />;
}
