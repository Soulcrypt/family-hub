import { WidgetCard } from "@/components/dashboard/widget-card";
import { EmptyWidgetBody } from "@/components/dashboard/empty-widget-body";

/**
 * Design-Spec §6/§8.1: "Tonight's dinner" is the one FEATURED (accent-tint) card on the
 * dashboard -- "even when empty" per this task's brief, since no meal-plan/recipe data source
 * exists yet (`meals.hasScreen === false`). `dashed` layers §6's empty-state border on top of
 * the tint (rather than the tint's own solid accent border) so the card still reads as
 * "nothing here yet," not as a populated recipe card with no recipe.
 */
export function DinnerWidget() {
  return (
    <WidgetCard id="dinner" title="Tonight's dinner" featured dashed>
      <EmptyWidgetBody message="no dinner planned yet" actionLabel="+ Add meal" actionHref="/meals" />
    </WidgetCard>
  );
}
