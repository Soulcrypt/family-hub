import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";

// The installed jsdom (30.x) outpaces the jsdom vitest's built-in environment
// targets (27.x), so `window.localStorage` and `window.matchMedia` — both of
// which `next-themes` reads on mount — come back undefined here even though
// jsdom itself implements them. Polyfill just enough for ThemeProvider to
// initialize; this is test-environment plumbing, not a claim about the app.
if (typeof window.localStorage === "undefined") {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    getItem: (key) => (store.has(key) ? (store.get(key) ?? null) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, "localStorage", { value: memoryStorage, configurable: true });
}

if (typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderToggle() {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  it("gives exactly one option a Tab stop (roving tabindex)", () => {
    renderToggle();
    const radios = screen.getAllByRole("radio");
    const tabbable = radios.filter((radio) => radio.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
  });

  it("renders every option as an explicit type=button, never a form-submitting default", () => {
    renderToggle();
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.getAttribute("type")).toBe("button");
    }
  });

  it("ArrowRight moves selection and focus to the next option, wrapping at the end", () => {
    renderToggle();
    const [light, dark, system] = screen.getAllByRole("radio");
    if (!light || !dark || !system) throw new Error("expected three radio options");

    light.focus();
    fireEvent.keyDown(light, { key: "ArrowRight" });
    expect(document.activeElement).toBe(dark);
    expect(dark.getAttribute("aria-checked")).toBe("true");
    expect(dark.getAttribute("tabindex")).toBe("0");
    expect(light.getAttribute("tabindex")).toBe("-1");

    fireEvent.keyDown(dark, { key: "ArrowRight" });
    expect(document.activeElement).toBe(system);
    expect(system.getAttribute("aria-checked")).toBe("true");

    // Wraps from the last option back to the first.
    fireEvent.keyDown(system, { key: "ArrowRight" });
    expect(document.activeElement).toBe(light);
    expect(light.getAttribute("aria-checked")).toBe("true");
  });

  it("ArrowLeft moves selection and focus to the previous option, wrapping at the start", () => {
    renderToggle();
    const [light, , system] = screen.getAllByRole("radio");
    if (!light || !system) throw new Error("expected three radio options");

    light.focus();
    fireEvent.keyDown(light, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(system);
    expect(system.getAttribute("aria-checked")).toBe("true");
    expect(system.getAttribute("tabindex")).toBe("0");
  });

  it("ArrowDown and ArrowUp behave the same as ArrowRight and ArrowLeft", () => {
    renderToggle();
    const [light, dark] = screen.getAllByRole("radio");
    if (!light || !dark) throw new Error("expected three radio options");

    light.focus();
    fireEvent.keyDown(light, { key: "ArrowDown" });
    expect(document.activeElement).toBe(dark);

    fireEvent.keyDown(dark, { key: "ArrowUp" });
    expect(document.activeElement).toBe(light);
  });
});
