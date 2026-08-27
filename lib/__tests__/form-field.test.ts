import { describe, expect, it } from "vitest";
import { formField } from "@/lib/validation/form-field";
import { memberSchema } from "@/lib/validation/schemas";

/**
 * The bug this pins, reported from the running app: saving a family member's birthday showed
 *
 *     Invalid input: expected string, received null
 *
 * That is Zod's own internal message for a `z.string()` field handed `null`, and the actions
 * surface `parsed.error.issues[0].message` straight to the UI. `FormData.get()` returns null
 * for any field that was not submitted — and a **disabled** control is never submitted, while
 * every control on these forms carries `disabled={pending}`. So a submission that races the
 * pending state posts nothing and the person is shown a sentence about types.
 *
 * The guarantee is therefore not "formField returns a string" — it is that **no reachable
 * input makes a schema emit a message written for a developer**.
 */
describe("formField", () => {
  it("reads a normal value unchanged", () => {
    const data = new FormData();
    data.set("displayName", "Elizabeth");
    expect(formField(data, "displayName")).toBe("Elizabeth");
  });

  it("treats an absent field as empty rather than null", () => {
    expect(formField(new FormData(), "displayName")).toBe("");
  });

  it("treats a File value as empty, so it cannot be stringified into the database", () => {
    const data = new FormData();
    data.set("displayName", new File(["x"], "x.txt"));
    // Without this, `String(value)` would yield "[object File]" — which passes z.string()
    // and then gets stored as somebody's name.
    expect(formField(data, "displayName")).toBe("");
  });
});

describe("memberSchema, fed the way the actions feed it", () => {
  function parseFrom(data: FormData) {
    return memberSchema.safeParse({
      displayName: formField(data, "displayName"),
      role: formField(data, "role"),
      color: formField(data, "color") || "#B6E6B0",
      birthday: formField(data, "birthday") || "",
      hasLogin: false,
      email: "",
    });
  }

  it("reports a human message when the form posted nothing at all", () => {
    const result = parseFrom(new FormData());
    expect(result.success).toBe(false);
    if (result.success) return;

    const message = result.error.issues[0]?.message ?? "";
    expect(message).toBe("Name is required");
    // The regression itself: Zod's internal phrasing must never be what a person reads.
    expect(message).not.toMatch(/expected string/i);
    expect(message).not.toMatch(/received null/i);
  });

  it("never emits a developer-facing message for ANY missing field", () => {
    // Walk each field in turn, leaving the rest valid, and check every message a person could
    // actually be shown.
    const complete: Record<string, string> = {
      displayName: "Elizabeth",
      role: "parent",
      color: "#F3B3D4",
      birthday: "1998-05-14",
    };

    for (const omitted of Object.keys(complete)) {
      const data = new FormData();
      for (const [key, value] of Object.entries(complete)) {
        if (key !== omitted) data.set(key, value);
      }
      const result = parseFrom(data);
      if (result.success) continue; // an optional field being absent is fine
      for (const issue of result.error.issues) {
        expect(issue.message, `omitting ${omitted}`).not.toMatch(/expected string/i);
        expect(issue.message, `omitting ${omitted}`).not.toMatch(/received null/i);
      }
    }
  });

  it("still accepts a complete submission", () => {
    const data = new FormData();
    data.set("displayName", "Elizabeth");
    data.set("role", "parent");
    data.set("color", "#F3B3D4");
    data.set("birthday", "1998-05-14");
    expect(parseFrom(data).success).toBe(true);
  });
});
