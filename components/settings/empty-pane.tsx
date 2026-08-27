import type { ReactNode } from "react";

/**
 * Design-Spec §6 "Empty states": "Dashed-border card, centered: one-line prompt in
 * text/secondary + accent action. No illustrations, no mascots." Used for the Settings sections
 * this task's brief says to leave honest rather than build fake controls for — Calendars,
 * Notifications, and Data & export have nothing real behind them yet, so this renders the
 * dashed empty state the spec asks for instead of connection toggles or export buttons that
 * would do nothing when pressed.
 *
 * `action` is optional and deliberately omitted by every current caller: the spec's own example
 * ("+ Add meal") is an action that DOES something. None of Calendars/Notifications/Data & export
 * have anything real to do yet, and a button that looks actionable but isn't would be exactly
 * the disabled-looking-fake-control this task's brief calls out by name — so callers with
 * nothing real to offer just omit it rather than reaching for a placeholder.
 */
export function EmptyPane({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="dashed flex flex-col items-center gap-2 rounded-card px-6 py-16 text-center">
      <h2 className="text-[20px] font-bold tracking-[-0.01em] text-text">{title}</h2>
      <p className="max-w-sm text-[14px] text-text-secondary">{message}</p>
      {action}
    </div>
  );
}
