"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "backspace"] as const;

export type PinPadHandle = {
  /** Refocuses the pad's key group so physical digit/Backspace/Enter presses land immediately —
   * used after a wrong guess, mirroring the old `<Input>`'s `pinRef.current.focus()`. */
  focus: () => void;
  /** Clears any typed digits and their dot feedback, without touching focus. */
  reset: () => void;
};

export type PinPadProps = {
  /** The form field name the hidden bubble input submits under (`switchToMemberAction` reads
   * `formData.get("pin")`, so this stays "pin" at every call site). */
  name?: string;
  /** Called once 4 digits have been entered, or Enter is pressed with 4 already entered — the
   * caller decides what "done" means (auto-submitting the surrounding form, in `PinDialog`'s
   * case). */
  onComplete: (pin: string) => void;
  /** Disables every key (and clears any typed digits) while a submission is in flight, matching
   * the old `<Input disabled>` behavior this replaces. */
  disabled?: boolean;
  ariaLabel: string;
};

/**
 * Design-Spec §6: "PIN pad (profile switch): 4-digit, large 64px keys, dots feedback." Replaces
 * `PinDialog`'s old `<Input type="password" maxLength={4}>` — a text field means summoning an
 * on-screen keyboard, which defeats the point on the wall-mounted tablet this is the PRIMARY
 * interaction for (this task's brief).
 *
 * No `<input>`/`<textarea>` of any kind is focusable here — the 12-key grid is plain `<button>`
 * elements, which never trigger a mobile OS keyboard. A `type="hidden"` field carries the typed
 * digits into the surrounding `<form>`'s `FormData` under `name` (default "pin") without being
 * focusable or visible, so `switchToMemberAction` (app/switch/actions.ts, UNCHANGED by this
 * component) keeps reading `formData.get("pin")` exactly as before.
 *
 * Fully keyboard-operable two ways at once: every digit/backspace key is a real, Tab-reachable
 * `<button>` (pointer AND keyboard Tab+Enter/Space both work on each one individually), AND the
 * group itself listens for physical digit keys, Backspace, and Enter directly while it holds
 * focus — the fast path an actual kiosk keypad needs, so a caller doesn't have to Tab through
 * ten buttons to enter a 4-digit PIN.
 *
 * Typed digits are intentionally kept in a ref, not React state: every keystroke would
 * otherwise re-render the whole 12-key grid, when only the 4 feedback dots need to change —
 * `render()` flips each dot's own `data-filled` attribute directly.
 */
export const PinPad = forwardRef<PinPadHandle, PinPadProps>(function PinPad(
  { name = "pin", onComplete, disabled = false, ariaLabel },
  ref,
) {
  const valueRef = useRef("");
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  function render() {
    if (hiddenInputRef.current) hiddenInputRef.current.value = valueRef.current;
    const dots = dotsRef.current?.children;
    if (!dots) return;
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      if (!(dot instanceof HTMLElement)) continue;
      dot.dataset.filled = i < valueRef.current.length ? "true" : "false";
    }
  }

  function reset() {
    valueRef.current = "";
    render();
  }

  useImperativeHandle(ref, () => ({
    focus: () => groupRef.current?.focus(),
    reset,
  }));

  function append(digit: string) {
    if (disabled || valueRef.current.length >= 4) return;
    valueRef.current += digit;
    render();
    if (valueRef.current.length === 4) onComplete(valueRef.current);
  }

  function backspace() {
    if (disabled) return;
    valueRef.current = valueRef.current.slice(0, -1);
    render();
  }

  useEffect(() => {
    if (disabled) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      append(event.key);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      backspace();
    } else if (event.key === "Enter" && valueRef.current.length === 4) {
      event.preventDefault();
      onComplete(valueRef.current);
    }
  }

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={ariaLabel}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="flex flex-col items-center gap-6 outline-none"
    >
      <input ref={hiddenInputRef} type="hidden" name={name} />

      <div ref={dotsRef} aria-hidden className="flex items-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            data-filled="false"
            className="size-3.5 rounded-full border border-hairline bg-transparent transition-colors duration-150 data-[filled=true]:border-accent data-[filled=true]:bg-accent"
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, index) => {
          if (key === "") return <span key={`spacer-${index}`} aria-hidden />;
          if (key === "backspace") {
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={backspace}
                aria-label="Backspace"
                className={cn(
                  "flex size-16 items-center justify-center rounded-full bg-glass-hover text-text transition-colors duration-150",
                  "hover:brightness-110 active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  "disabled:pointer-events-none disabled:opacity-40",
                )}
              >
                <Delete size={22} aria-hidden />
              </button>
            );
          }
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => append(key)}
              className={cn(
                "flex size-16 items-center justify-center rounded-full bg-glass-hover text-[22px] font-semibold text-text transition-colors duration-150",
                "hover:brightness-110 active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
});
