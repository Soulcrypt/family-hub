import { unstable_cache } from "next/cache";

/**
 * Design-Spec §8.1: "Weather: current temp Display-size + condition, H/L, 4-day strip. Data:
 * Open-Meteo, Whitewater WI." Open-Meteo needs no API key -- a plain unauthenticated fetch,
 * which is what makes it the one real-data widget this task can ship honestly alongside news.
 *
 * Coordinates are Whitewater, WI's -- fixed, not the household's own address (no household
 * location field exists yet; Design-Spec §8.10 puts that in Settings, unbuilt). See this
 * task's brief for the exact pair used here.
 */
const LATITUDE = 42.8336;
const LONGITUDE = -88.7425;

const FORECAST_URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
  `&current=temperature_2m,weather_code` +
  `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
  `&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=5`;

export type WeatherCondition = {
  /** Sentence-case per Design-Spec §11 -- "Sunny", never "SUNNY" or "sunny weather". */
  label: string;
  /** One of lucide-react's icon names this app already depends on (weather-widget.tsx maps
   * this to the actual `<Icon>` component) -- kept as a string here so this module, which has
   * no business importing React, stays render-agnostic. */
  icon: "sun" | "cloud-sun" | "cloud" | "cloud-fog" | "cloud-drizzle" | "cloud-rain" | "cloud-snow" | "cloud-lightning";
};

/**
 * WMO weather codes (https://open-meteo.com/en/docs, "WMO Weather interpretation codes") to a
 * short condition label + icon key. Grouped exactly the way Open-Meteo's own docs group them;
 * unrecognized codes (a future WMO revision, or a malformed response) degrade to a plain
 * "cloud" icon and an honest "Unknown" label rather than guessing.
 */
export function describeWeatherCode(code: number): WeatherCondition {
  if (code === 0) return { label: "Clear", icon: "sun" };
  if (code === 1) return { label: "Mostly clear", icon: "cloud-sun" };
  if (code === 2) return { label: "Partly cloudy", icon: "cloud-sun" };
  if (code === 3) return { label: "Overcast", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Foggy", icon: "cloud-fog" };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: "Drizzle", icon: "cloud-drizzle" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "Rain", icon: "cloud-rain" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snow", icon: "cloud-snow" };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorms", icon: "cloud-lightning" };
  return { label: "Unknown", icon: "cloud" };
}

export type DailyForecast = {
  /** Short weekday label, e.g. "Thu" -- Design-Spec §8.1's 4-day strip. */
  day: string;
  high: number;
  code: number;
};

export type WeatherData = {
  temp: number;
  high: number;
  low: number;
  code: number;
  /** Tomorrow through the day after that, etc. -- always 4 entries when the API returns a
   * full 5-day forecast (today + 4), fewer only if Open-Meteo itself returns less. */
  daily: DailyForecast[];
};

type OpenMeteoResponse = {
  current?: { temperature_2m?: unknown; weather_code?: unknown };
  daily?: {
    time?: unknown;
    weather_code?: unknown;
    temperature_2m_max?: unknown;
    temperature_2m_min?: unknown;
  };
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Formats an Open-Meteo daily `time` entry ("2026-08-27") as a short weekday. `timeZone: "UTC"`
 * matters here for the exact reason lib/utils.ts's `formatBirthday` documents: a bare date
 * string parses as UTC midnight, and formatting it in a negative-offset zone would print the
 * PREVIOUS day's weekday. */
function shortWeekday(dateStr: string): string {
  const parsed = new Date(dateStr);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(parsed);
}

/**
 * The uncached fetch + parse, exported separately so tests can exercise its parsing/degradation
 * behavior directly without going through `unstable_cache`'s memoization (which would make a
 * second test's mocked `fetch` response invisible behind the first test's cached result).
 * `getWeather` (below) is what page code should actually call.
 */
export async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const res = await fetch(FORECAST_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const body = (await res.json()) as OpenMeteoResponse;
    const temp = body.current?.temperature_2m;
    const code = body.current?.weather_code;
    const times = body.daily?.time;
    const highs = body.daily?.temperature_2m_max;
    const lows = body.daily?.temperature_2m_min;
    const codes = body.daily?.weather_code;

    if (!isFiniteNumber(temp) || !isFiniteNumber(code)) return null;
    if (!Array.isArray(times) || !Array.isArray(highs) || !Array.isArray(lows) || !Array.isArray(codes)) return null;
    if (!isFiniteNumber(highs[0]) || !isFiniteNumber(lows[0])) return null;

    const daily: DailyForecast[] = [];
    // Index 0 is today (already summarized by temp/high/low above) -- the strip is the NEXT
    // four days.
    for (let i = 1; i < times.length && daily.length < 4; i++) {
      const day = times[i];
      const high = highs[i];
      const dayCode = codes[i];
      if (typeof day === "string" && isFiniteNumber(high) && isFiniteNumber(dayCode)) {
        daily.push({ day: shortWeekday(day), high: Math.round(high), code: dayCode });
      }
    }

    return {
      temp: Math.round(temp),
      high: Math.round(highs[0]),
      low: Math.round(lows[0]),
      code,
      daily,
    };
  } catch (error) {
    // Never fake data (this task's brief) -- a network failure/timeout/malformed body degrades
    // to `null` (weather-widget.tsx's honest empty state), never a guessed or stale-looking
    // number.
    console.error("[dashboard/weather] failed to fetch Open-Meteo forecast", error);
    return null;
  }
}

/**
 * Cached for 15 minutes -- this task's brief: "Cache it server-side; do not fetch on every
 * render." Open-Meteo's own data doesn't update faster than that, and the dashboard is the
 * kind of screen that gets reloaded/glanced at far more often than the weather actually
 * changes. `unstable_cache` (not a bare `fetch` cache option) because this page also reads
 * `cookies()` upstream of this call (getActiveMember()), which puts the whole request past
 * Next's "no request-time APIs yet" cutoff for automatic fetch caching -- see
 * node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md.
 */
export const getWeather = unstable_cache(fetchWeather, ["dashboard-weather"], {
  revalidate: 900,
});
