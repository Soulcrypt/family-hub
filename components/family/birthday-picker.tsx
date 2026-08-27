"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  daysInMonth,
  isoFromParts,
  partsFromIso,
  type BirthdayParts,
} from "@/lib/family/birthday-parts";

/**
 * A month / day / year picker for a BIRTHDAY, replacing `<input type="date">`.
 *
 * A native date input is a good control for "pick a day near today" and a bad one for a
 * birthday, which is the opposite problem: the value is almost never near today. The native
 * desktop picker opens on the current month, so entering a parent's birth year means paging
 * back three or four hundred months, and the field renders as a raw `mm/dd/yyyy` OS widget —
 * the one unstyled control left in an otherwise designed form. Design-Spec §6 asks for "native
 * pickers on phone; inline calendar popover on desktop", but a calendar popover has the same
 * flaw for a date decades in the past, so this deviates deliberately: three fields you can fill
 * in any order, in the same number of interactions no matter how far back the date is.
 *
 * Year is a text input rather than a fourth select on purpose — typing "1985" is faster than
 * finding it in a list of 120, and it is the field most likely to be far from any default.
 *
 * Posts a single `YYYY-MM-DD` value under `name`, which is what `memberSchema`
 * (lib/validation/schemas.ts) validates with `z.string().date()`. An incomplete or invalid
 * combination posts an empty string, matching the schema's `.or(z.literal(""))` branch, because
 * birthday is optional and a half-filled date must not be stored as a real one.
 */
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function BirthdayPicker({
  name = "birthday",
  defaultValue,
  disabled = false,
  idPrefix = "birthday",
}: {
  name?: string;
  defaultValue?: string | null;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const [parts, setParts] = useState<BirthdayParts>(() => partsFromIso(defaultValue));
  const describedBy = useId();
  const rootRef = useRef<HTMLFieldSetElement>(null);

  /**
   * Re-seed when the owning form resets.
   *
   * React 19 resets a form automatically after a successful action, and a native reset walks
   * the real DOM controls — including the hidden `<select>` Radix renders behind each combobox.
   * Radix reports that as a change, so the month and day get set to "" while the year (a
   * controlled input React re-renders from state) keeps its value. The result was a picker that
   * still looked filled but had silently gone incomplete, complaining "add the month, day and
   * year" about a date the person had just successfully saved.
   *
   * Re-seeding from `defaultValue` is the right answer for both callers: an edit form restores
   * the value that was just saved, and the add-member dialog (no `defaultValue`) clears, which
   * is exactly what resetting that form should do.
   */
  useEffect(() => {
    const form = rootRef.current?.form;
    if (!form) return;
    const onReset = () => setParts(partsFromIso(defaultValue));
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  const monthNumber = parts.month ? Number(parts.month) : null;
  const yearNumber = /^\d{4}$/.test(parts.year) ? Number(parts.year) : null;
  const maxDay = daysInMonth(monthNumber, yearNumber);

  const dayOptions = useMemo(
    () => Array.from({ length: maxDay }, (_, index) => index + 1),
    [maxDay],
  );

  // A day already chosen can be invalidated by a later month change (31 -> February). Rather
  // than silently posting an impossible date, drop it and let the field read as incomplete.
  const dayNumber = parts.day ? Number(parts.day) : null;
  const effectiveDay = dayNumber !== null && dayNumber <= maxDay ? parts.day : "";

  // One source of truth for "is this a real date": the same function the unit tests drive.
  const iso = isoFromParts({ year: parts.year, month: parts.month, day: effectiveDay });
  const complete = iso !== "";

  // Only surface a problem once someone has actually started; an untouched optional field is
  // not an error.
  const started = parts.year !== "" || parts.month !== "" || parts.day !== "";

  // `today` is captured once, in a lazy initializer, rather than read during render. Reading
  // the clock while rendering is impure (React Compiler rejects it), and a picker's idea of
  // "today" does not need to change mid-session.
  const [today] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
  const currentYear = Number(today.slice(0, 4));

  let problem: string | null = null;
  if (started && !complete) {
    problem = "Add the month, day and year, or clear all three.";
  } else if (complete && yearNumber !== null) {
    if (yearNumber > currentYear) problem = "That year hasn’t happened yet.";
    else if (yearNumber < currentYear - 120) problem = "That looks too far back — check the year.";
    // Compared as date STRINGS, not Dates. ISO dates sort correctly as text, and it sidesteps
    // the timezone trap: parsing "2026-08-26" gives UTC midnight, so a plain `> Date.now()`
    // would call today's date "in the future" for anyone east of UTC in the early morning.
    else if (iso > today) problem = "A birthday can’t be in the future.";
  }

  const fieldClass = "min-w-0";

  return (
    <fieldset ref={rootRef} className="flex flex-col gap-2" disabled={disabled}>
      {/* A group of three controls needs a group label; a single <Label htmlFor> would point at
          only one of them, and a screen reader would announce the other two unlabelled. */}
      {/* Matches components/ui/label.tsx exactly (`text-sm font-medium`). A <legend> gets no
          styling from <Label>, so without this the one grouped field on the form announces
          itself in a different size and weight from every ungrouped one beside it. */}
      <legend className="mb-2 text-sm leading-none font-medium">Birthday</legend>

      <div className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-2">
        <div className={fieldClass}>
          <Label htmlFor={`${idPrefix}-month`} className="sr-only">
            Birth month
          </Label>
          <Select
            value={parts.month}
            onValueChange={(month) => setParts((p) => ({ ...p, month }))}
            disabled={disabled}
          >
            <SelectTrigger id={`${idPrefix}-month`} className="w-full">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((label, index) => (
                <SelectItem key={label} value={pad(index + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={fieldClass}>
          <Label htmlFor={`${idPrefix}-day`} className="sr-only">
            Birth day
          </Label>
          <Select
            value={effectiveDay}
            onValueChange={(day) => setParts((p) => ({ ...p, day }))}
            disabled={disabled}
          >
            <SelectTrigger id={`${idPrefix}-day`} className="w-full">
              <SelectValue placeholder="Day" />
            </SelectTrigger>
            <SelectContent>
              {dayOptions.map((day) => (
                <SelectItem key={day} value={pad(day)}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={fieldClass}>
          <Label htmlFor={`${idPrefix}-year`} className="sr-only">
            Birth year
          </Label>
          <Input
            id={`${idPrefix}-year`}
            // `inputMode="numeric"` brings up the digit keypad on a phone without the spinner
            // arrows and scroll-to-change behaviour of `type="number"`, which are a liability
            // on a touch screen next to a scrollable form.
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="Year"
            aria-describedby={problem ? describedBy : undefined}
            aria-invalid={problem ? true : undefined}
            value={parts.year}
            onChange={(event) => {
              const year = event.target.value.replace(/\D/g, "").slice(0, 4);
              setParts((p) => ({ ...p, year }));
            }}
            disabled={disabled}
          />
        </div>
      </div>

      {/* The single value the form actually posts. */}
      <input type="hidden" name={name} value={iso} />

      {problem ? (
        <p id={describedBy} role="alert" className={cn("text-[12px] text-danger-text")}>
          {problem}
        </p>
      ) : (
        <p className="text-[12px] text-text-secondary">Optional — used for ages and birthdays.</p>
      )}
    </fieldset>
  );
}

/** Read-only rendering for a viewer who can't edit the roster. A disabled input still looks
 * like a control someone might try to use; a plain sentence does not. */
export function BirthdayReadOnly({ value }: { value: string | null }) {
  const parts = partsFromIso(value);
  const label =
    parts.year && parts.month && parts.day
      ? `${MONTHS[Number(parts.month) - 1]} ${Number(parts.day)}, ${parts.year}`
      : "Not set";

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold text-text-secondary">Birthday</span>
      <span className="text-[15px] text-text">{label}</span>
    </div>
  );
}
