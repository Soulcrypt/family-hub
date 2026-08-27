import { EmptyPane } from "@/components/settings/empty-pane";

/**
 * Design-Spec §8.10 lists Google/HEY calendar connections here, but neither is built yet --
 * an honest empty state (§6: dashed border, one line, no fake "Connected" status) rather than
 * the mock's illustrative "Connected ✓" rows, which this task's brief explicitly says not to
 * fake. See this task's report for the mock/spec disagreement this reflects.
 */
export default function SettingsCalendarsPage() {
  return (
    <EmptyPane
      title="Calendars"
      message="Google Calendar and HEY aren't connected yet. Connections will show up here once they're built."
    />
  );
}
