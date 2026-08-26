import { afterEach, describe, expect, it, vi } from "vitest";
import { describeWeatherCode, fetchWeather } from "@/lib/dashboard/weather";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

describe("describeWeatherCode", () => {
  it("maps clear sky to Clear/sun", () => {
    expect(describeWeatherCode(0)).toEqual({ label: "Clear", icon: "sun" });
  });

  it("maps overcast to Overcast/cloud", () => {
    expect(describeWeatherCode(3)).toEqual({ label: "Overcast", icon: "cloud" });
  });

  it("maps rain codes to Rain/cloud-rain", () => {
    for (const code of [61, 63, 65, 80, 81, 82]) {
      expect(describeWeatherCode(code)).toEqual({ label: "Rain", icon: "cloud-rain" });
    }
  });

  it("maps thunderstorm codes to Thunderstorms/cloud-lightning", () => {
    expect(describeWeatherCode(95)).toEqual({ label: "Thunderstorms", icon: "cloud-lightning" });
  });

  it("degrades an unrecognized code to an honest Unknown/cloud rather than guessing", () => {
    expect(describeWeatherCode(-1)).toEqual({ label: "Unknown", icon: "cloud" });
  });
});

describe("fetchWeather", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a well-formed Open-Meteo response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          current: { temperature_2m: 74.4, weather_code: 0 },
          daily: {
            time: ["2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30"],
            weather_code: [0, 0, 3, 51, 55],
            temperature_2m_max: [79.6, 77.9, 83.3, 78.6, 87.2],
            temperature_2m_min: [58.1, 60.9, 59.1, 64.2, 64.6],
          },
        }),
      ),
    );

    const data = await fetchWeather();
    expect(data).not.toBeNull();
    expect(data?.temp).toBe(74);
    expect(data?.high).toBe(80);
    expect(data?.low).toBe(58);
    expect(data?.code).toBe(0);
    expect(data?.daily).toHaveLength(4);
    expect(data?.daily[0]).toEqual({ day: "Thu", high: 78, code: 0 });
  });

  it("returns null (never fake data) when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false)));
    expect(await fetchWeather()).toBeNull();
  });

  it("returns null when the body is missing expected fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ current: {} })));
    expect(await fetchWeather()).toBeNull();
  });

  it("returns null (does not throw) when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await fetchWeather()).toBeNull();
  });
});
