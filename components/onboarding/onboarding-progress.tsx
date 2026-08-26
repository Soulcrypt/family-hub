/**
 * The step progress indicator mocks 4c/4d/4e show at the top of every onboarding screen:
 * equal-width pill segments, done = `success` (green), current = white, upcoming = 15% white.
 * Design-Spec §6 "Progress / Step progress (cook mode)" defines exactly this recipe; the
 * mockups reuse it verbatim for onboarding instead of inventing a second progress style.
 *
 * Five segments, matching the mockup captions themselves: 4c is captioned "Onboarding 2/5",
 * 4d "Onboarding 3/5", 4e "Onboarding 5/5" — household is 1/5, members 2/5, location 3/5,
 * features 4/5 (no mock was handed down for this slot; it is the existing, already-wired
 * "choose your features" step kept in place per this task's "keep every step that already
 * works" instruction), widgets 5/5.
 */
const TOTAL_STEPS = 5;

export function OnboardingProgress({ step }: { step: number }) {
  return (
    <div role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-label={`Step ${step} of ${TOTAL_STEPS}`} className="flex gap-[5px]">
      {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map((segment) => (
        <span
          key={segment}
          aria-hidden="true"
          className="h-[3px] flex-1 rounded-pill"
          style={{
            backgroundColor:
              segment < step ? "var(--color-success)" : segment === step ? "var(--color-text)" : "var(--color-dashed)",
          }}
        />
      ))}
    </div>
  );
}
