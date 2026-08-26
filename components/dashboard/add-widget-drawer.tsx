"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WIDGET_REGISTRY, type WidgetKey } from "@/lib/dashboard/widget-meta";

export type AddWidgetDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Widgets not currently on the dashboard -- lib/dashboard/layout.ts's `remainingWidgets()`. */
  available: WidgetKey[];
  onAdd: (key: WidgetKey) => void;
};

/**
 * Design-Spec §8.1: "'+ Add' opens drawer of remaining widgets with previews." This build's
 * catalogue is small and fixed (five widgets total, lib/dashboard/widget-meta.ts), so "preview"
 * here is just the widget's own name rather than a thumbnail -- there's nothing visually
 * distinctive enough to preview beyond what the label already says. Implemented on the existing
 * `Dialog` primitive (components/ui/dialog.tsx) rather than a dedicated phone-vs-desktop
 * sheet/modal split (Design-Spec §6 describes both), which is a deliberate scope trim for this
 * build -- one centered overlay works acceptably at every width this app supports.
 */
export function AddWidgetDrawer({ open, onOpenChange, available, onAdd }: AddWidgetDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-hairline">
        <DialogHeader>
          <DialogTitle>Add a widget</DialogTitle>
          <DialogDescription>
            {available.length > 0
              ? "Choose a widget to add back to your dashboard."
              : "Every widget is already on your dashboard."}
          </DialogDescription>
        </DialogHeader>

        {available.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {available.map((key) => {
              const meta = WIDGET_REGISTRY[key];
              return (
                <li key={key}>
                  <div className="flex items-center justify-between gap-3 rounded-tile bg-inset px-4 py-3">
                    <span className="text-sm font-medium text-text">{meta.label}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onAdd(key);
                        if (available.length === 1) onOpenChange(false);
                      }}
                    >
                      + Add
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
