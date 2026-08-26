"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WidgetEntrance } from "@/components/dashboard/widget-entrance";
import { AddWidgetDrawer } from "@/components/dashboard/add-widget-drawer";
import { ScheduleWidget } from "@/components/dashboard/schedule-widget";
import { DinnerWidget } from "@/components/dashboard/dinner-widget";
import { PhotosWidget } from "@/components/dashboard/photos-widget";
import { NewsWidget } from "@/components/dashboard/news-widget";
import { WeatherWidget } from "@/components/dashboard/weather-widget";
import { WIDGET_REGISTRY, type WidgetKey } from "@/lib/dashboard/widget-meta";
import { addWidget, isFirstInGroup, isLastInGroup, moveWithinGroup, remainingWidgets, removeWidget } from "@/lib/dashboard/layout";
import { saveDashboardLayoutAction } from "@/app/(app)/dashboard/actions";
import type { WeatherData } from "@/lib/dashboard/weather";
import type { NewsItem } from "@/lib/dashboard/news";

export type WidgetGridProps = {
  memberId: string;
  initialLayout: WidgetKey[];
  weather: WeatherData | null;
  news: NewsItem[];
};

function renderWidget(key: WidgetKey, weather: WeatherData | null, news: NewsItem[]) {
  switch (key) {
    case "schedule":
      return <ScheduleWidget />;
    case "dinner":
      return <DinnerWidget />;
    case "photos":
      return <PhotosWidget />;
    case "weather":
      return <WeatherWidget data={weather} />;
    case "news":
      return <NewsWidget items={news} />;
  }
}

/**
 * The dashboard's widget system -- Design-Spec §8.1. Owns the per-member layout's client-side
 * state (`order`), the primary/secondary asymmetric grid (§4: "avoid uniform 3-up monotony" --
 * schedule/dinner in a wide 1.25fr/1fr row, weather/photos/news in a compact 3-up row below),
 * and edit mode (remove badges, "+ Add" drawer, reorder controls).
 *
 * Every mutation (remove/add/reorder) updates `order` immediately (the UI never waits on the
 * network to reflect a change) and fires `saveDashboardLayoutAction` in a transition to persist
 * it; a save failure is logged and left for the next successful save to reconcile rather than
 * rolling back an already-comfortable UI -- this is a low-stakes preference, not a payment.
 *
 * Reordering is two buttons per widget in edit mode ("Move earlier"/"Move later",
 * `moveWithinGroup` -- lib/dashboard/layout.ts), not a pointer-drag handle. Design-Spec §10
 * requires full keyboard navigation, and a drag-only affordance would exclude keyboard and
 * switch-access users from rearranging their own dashboard entirely -- these buttons are plain,
 * natively-focusable `<button>`s, so keyboard support isn't a separate feature to build, it's
 * just what a button already does. Pointer drag, if ever added later, would be a second way to
 * call the same `moveWithinGroup`, never a replacement for these.
 */
export function WidgetGrid({ memberId, initialLayout, weather, news }: WidgetGridProps) {
  const [order, setOrder] = useState<WidgetKey[]>(initialLayout);
  const [editMode, setEditMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [, startTransition] = useTransition();

  function persist(next: WidgetKey[]) {
    setOrder(next);
    startTransition(() => {
      void saveDashboardLayoutAction(memberId, next).then((result) => {
        if (!result.ok) console.error("[dashboard] widget layout save failed:", result.error);
      });
    });
  }

  const primary = order.filter((key) => WIDGET_REGISTRY[key].size === "primary");
  const secondary = order.filter((key) => WIDGET_REGISTRY[key].size === "secondary");
  const available = remainingWidgets(order);

  function widgetSlot(key: WidgetKey, index: number) {
    const meta = WIDGET_REGISTRY[key];
    return (
      <WidgetEntrance key={key} index={index} className="relative">
        <div className={cn(editMode && "hearth-edit-jiggle")}>{renderWidget(key, weather, news)}</div>
        {editMode ? (
          <>
            <button
              type="button"
              aria-label={`Remove ${meta.label} widget`}
              onClick={() => persist(removeWidget(order, key))}
              className="absolute -top-2 -right-2 flex size-11 items-center justify-center rounded-full bg-danger text-on-accent shadow-dock transition-transform active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <X aria-hidden className="size-4" strokeWidth={2.5} />
            </button>
            <div className="mt-2 flex justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={`Move ${meta.label} widget earlier`}
                disabled={isFirstInGroup(order, key)}
                onClick={() => persist(moveWithinGroup(order, key, "earlier"))}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={`Move ${meta.label} widget later`}
                disabled={isLastInGroup(order, key)}
                onClick={() => persist(moveWithinGroup(order, key, "later"))}
              >
                <ChevronRight aria-hidden className="size-4" />
              </Button>
            </div>
          </>
        ) : null}
      </WidgetEntrance>
    );
  }

  return (
    <div className="space-y-5">
      {/* The 2°-alternating "jiggle" cue (Design-Spec §8.1: "cards jiggle subtly... in edit
          mode") is a pure CSS keyframe, so app/globals.css's global `prefers-reduced-motion`
          rule (forcing every animation-duration to 0.01ms) already neutralizes it there without
          this component doing anything extra -- unlike the JS-driven count-up/entrance timing,
          which had to check `prefersReducedMotion()` itself. Scoped here (a plain <style> tag)
          rather than in app/globals.css, which is out of scope for this task. */}
      <style>{`
        @keyframes hearth-edit-jiggle {
          0%, 100% { transform: rotate(-1deg); }
          50% { transform: rotate(1deg); }
        }
        .hearth-edit-jiggle { animation: hearth-edit-jiggle 200ms ease-in-out infinite; }
      `}</style>

      {primary.length > 0 ? (
        <div className={cn("grid gap-4 md:gap-5", primary.length >= 2 ? "md:grid-cols-[1.25fr_1fr]" : "grid-cols-1")}>
          {primary.map((key, i) => widgetSlot(key, i))}
        </div>
      ) : null}

      {secondary.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {secondary.map((key, i) => widgetSlot(key, primary.length + i))}
        </div>
      ) : null}

      {order.length === 0 ? (
        <div className="dashed flex flex-col items-center gap-3 rounded-card p-10 text-center">
          <p className="text-sm text-text-secondary">every widget has been removed</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setDrawerOpen(true)}>
            + Add a widget
          </Button>
        </div>
      ) : null}

      <div className="flex justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          className="dashed inline-flex min-h-[44px] items-center rounded-pill px-5 text-sm font-semibold text-text-secondary transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {editMode ? "Done editing" : "+ Edit widgets"}
        </button>
        {editMode ? (
          <Button type="button" variant="secondary" size="default" onClick={() => setDrawerOpen(true)} disabled={available.length === 0}>
            + Add
          </Button>
        ) : null}
      </div>

      <AddWidgetDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        available={available}
        onAdd={(key) => persist(addWidget(order, key))}
      />
    </div>
  );
}
