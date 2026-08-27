import { EmptyPane } from "@/components/settings/empty-pane";

/** Design-Spec §9 lists push notifications (chore claimed, event reminders, bedtime routine,
 * reward unlocked), but none of that is wired up yet -- an honest empty state rather than
 * toggles that would flip on and do nothing. */
export default function SettingsNotificationsPage() {
  return (
    <EmptyPane
      title="Notifications"
      message="Nothing to configure yet -- push notifications aren't wired up. This will list them once they are."
    />
  );
}
