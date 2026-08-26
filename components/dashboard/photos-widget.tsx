import { WidgetCard } from "@/components/dashboard/widget-card";
import { EmptyWidgetBody } from "@/components/dashboard/empty-widget-body";

/**
 * Design-Spec §8.1/§8.7: "Photos: 3-up thumbnail grid + album caption... dashboard widget =
 * latest 3." No photo storage exists yet (`photos.hasScreen === false`), so this always
 * renders the honest §6 empty state rather than the mock's placeholder "photo / photo / photo"
 * tiles (which are themselves a mock-only placeholder, not real thumbnails).
 */
export function PhotosWidget() {
  return (
    <WidgetCard id="photos" title="Photos" dashed>
      <EmptyWidgetBody message="no photos yet" actionLabel="+ Add photos" actionHref="/photos" />
    </WidgetCard>
  );
}
