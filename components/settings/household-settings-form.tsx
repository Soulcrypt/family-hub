"use client";

import { useActionState } from "react";
import { updateHouseholdAction, updateFeaturesAction, type SettingsState } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FEATURES, isFeatureEnabled, type EnabledFeatures } from "@/lib/constants/features";

const INITIAL: SettingsState = { error: null };

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

function weekdayLabel(value: number): string {
  return WEEKDAYS.find((day) => day.value === value)?.label ?? "Sunday";
}

export type HouseholdSummary = { name: string; timezone: string; weekStart: number };

type HouseholdSettingsFormProps = {
  household: HouseholdSummary;
  enabledFeatures: EnabledFeatures;
  timeZones: readonly string[];
  /** Whether the CURRENT PROFILE (authenticated account AND, if switched, the attributed
   * member) may edit these settings. See lib/auth/permissions.ts's `isAdminProfile` doc
   * comment: this is a display decision, not the security boundary -- both server actions
   * this form submits to re-check authority themselves regardless of what this prop says. */
  canEdit: boolean;
};

/** Plain facts, no inputs -- rendered for a non-admin account, or when the currently attributed
 * profile on a shared device isn't an admin (see the `canEdit` prop's doc comment above). */
function ReadOnlyHousehold({
  household,
  enabledFeatures,
}: {
  household: HouseholdSummary;
  enabledFeatures: EnabledFeatures;
}) {
  const enabledLabels = FEATURES.filter(
    (feature) => feature.locked || isFeatureEnabled(enabledFeatures, feature.key),
  ).map((feature) => feature.label);

  return (
    <dl className="glass flex flex-col gap-3 rounded-card px-5 py-5">
      <div>
        <dt className="text-[13px] text-text-secondary">Name</dt>
        <dd className="min-w-0 truncate text-[15px] text-text">{household.name}</dd>
      </div>
      <div>
        <dt className="text-[13px] text-text-secondary">Timezone</dt>
        <dd className="text-[15px] text-text">{household.timezone}</dd>
      </div>
      <div>
        <dt className="text-[13px] text-text-secondary">Week starts on</dt>
        <dd className="text-[15px] text-text">{weekdayLabel(household.weekStart)}</dd>
      </div>
      <div>
        <dt className="text-[13px] text-text-secondary">Features</dt>
        <dd className="text-[15px] text-text">{enabledLabels.join(", ")}</dd>
      </div>
      <p className="text-[13px] text-text-secondary">Only a parent or owner can change these.</p>
    </dl>
  );
}

export function HouseholdSettingsForm({ household, enabledFeatures, timeZones, canEdit }: HouseholdSettingsFormProps) {
  const [householdState, householdAction, householdPending] = useActionState(updateHouseholdAction, INITIAL);
  const [featuresState, featuresAction, featuresPending] = useActionState(updateFeaturesAction, INITIAL);

  if (!canEdit) {
    return <ReadOnlyHousehold household={household} enabledFeatures={enabledFeatures} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={householdAction} className="glass flex flex-col gap-4 rounded-card px-5 py-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Household name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={household.name}
            autoComplete="off"
            required
            maxLength={80}
            disabled={householdPending}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select name="timezone" defaultValue={household.timezone} required disabled={householdPending}>
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeZones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="weekStart">Week starts on</Label>
          <Select name="weekStart" defaultValue={String(household.weekStart)} required disabled={householdPending}>
            <SelectTrigger id="weekStart" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((day) => (
                <SelectItem key={day.value} value={String(day.value)}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {householdState.error ? (
          <p role="alert" className="rounded-inset bg-danger/10 px-4 py-3 text-[13px] text-danger-text">
            {householdState.error}
          </p>
        ) : null}

        <div>
          <Button type="submit" disabled={householdPending}>
            {householdPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <form action={featuresAction} className="glass flex flex-col gap-4 rounded-card px-5 py-5">
        <div>
          <h3 className="text-[15px] font-semibold text-text">Features</h3>
          <p className="text-[13px] text-text-secondary">Turn on what your family will use.</p>
        </div>

        <ul className="flex flex-col gap-2">
          {FEATURES.map((feature) => (
            <li key={feature.key} className="rounded-inset bg-inset has-disabled:opacity-80">
              <label
                htmlFor={`feature-${feature.key}`}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 px-4 py-3 has-disabled:cursor-not-allowed"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[14px] font-medium text-text">
                    {feature.label}
                    {feature.locked ? <span className="ml-2 text-[12px] text-text-tertiary">Always on</span> : null}
                  </span>
                  <span className="text-[12px] text-text-secondary">{feature.description}</span>
                </span>
                <Switch
                  id={`feature-${feature.key}`}
                  name="features"
                  value={feature.key}
                  defaultChecked={feature.locked || isFeatureEnabled(enabledFeatures, feature.key)}
                  disabled={feature.locked || featuresPending}
                />
              </label>
            </li>
          ))}
        </ul>

        {featuresState.error ? (
          <p role="alert" className="rounded-inset bg-danger/10 px-4 py-3 text-[13px] text-danger-text">
            {featuresState.error}
          </p>
        ) : null}

        <div>
          <Button type="submit" disabled={featuresPending}>
            {featuresPending ? "Saving…" : "Save features"}
          </Button>
        </div>
      </form>
    </div>
  );
}
