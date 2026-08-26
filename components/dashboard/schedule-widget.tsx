import { WidgetCard } from "@/components/dashboard/widget-card";
import { EmptyWidgetBody } from "@/components/dashboard/empty-widget-body";

/**
 * Design-Spec §8.1: "Schedule widget: next 3 events, member color bar + dot; past events
 * collapsed at 45% opacity." No calendar table/data source exists in this build
 * (lib/constants/features.ts: `calendar.hasScreen === false`), so per this task's brief --
 * "Never fake data" -- this always renders the honest §6 empty state rather than inventing
 * events like the mock's "Elizabeth — book club" / "Ivy — bedtime routine" rows.
 */
export function ScheduleWidget() {
  return (
    <WidgetCard id="schedule" title="Today" dashed>
      <EmptyWidgetBody message="no events on the calendar yet" actionLabel="+ Add event" actionHref="/calendar" />
    </WidgetCard>
  );
}
