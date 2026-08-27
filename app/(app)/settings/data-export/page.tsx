import { EmptyPane } from "@/components/settings/empty-pane";

/** No export pipeline exists yet -- an honest empty state rather than an "Export" button that
 * would produce nothing when pressed. */
export default function SettingsDataExportPage() {
  return (
    <EmptyPane
      title="Data & export"
      message="There's nothing to export yet. Once household data can be exported, you'll find it here."
    />
  );
}
