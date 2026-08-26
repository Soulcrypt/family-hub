import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { CountUp } from "@/components/dashboard/count-up";
import { describeWeatherCode, type WeatherData, type WeatherCondition } from "@/lib/dashboard/weather";

const ICONS: Record<WeatherCondition["icon"], typeof Sun> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  "cloud-fog": CloudFog,
  "cloud-drizzle": CloudDrizzle,
  "cloud-rain": CloudRain,
  "cloud-snow": CloudSnow,
  "cloud-lightning": CloudLightning,
};

export type WeatherWidgetProps = {
  data: WeatherData | null;
};

/**
 * Design-Spec §8.1: "Weather: current temp Display-size + condition, H/L, 4-day strip. Data:
 * Open-Meteo, Whitewater WI." The one widget besides news with real data
 * (lib/dashboard/weather.ts) -- `data` is `null` only on a genuine fetch/parse failure
 * (network outage, Open-Meteo down), which renders an honest "unavailable" state rather than a
 * guessed temperature.
 *
 * The current temperature is the dashboard's one `CountUp` (Design-Spec §7.1: "Numbers...
 * animate count-up 400ms on change") -- the 4-day strip's highs do not animate, matching the
 * spec's framing of count-up as a headline-numeral treatment, not something every number on
 * screen does.
 */
export function WeatherWidget({ data }: WeatherWidgetProps) {
  if (!data) {
    return (
      <WidgetCard id="weather" title="Weather" dashed meta="Whitewater, WI">
        <p className="flex flex-1 items-center justify-center text-center text-sm text-text-secondary">
          weather is unavailable right now
        </p>
      </WidgetCard>
    );
  }

  const condition = describeWeatherCode(data.code);
  const Icon = ICONS[condition.icon];

  return (
    <WidgetCard id="weather" title="Weather" meta="Whitewater, WI">
      <div className="flex items-center gap-4">
        <Icon aria-hidden className="size-10 shrink-0 text-accent-text" strokeWidth={1.75} />
        <div>
          <p className="tabular text-[44px] font-bold leading-none tracking-tight text-text">
            <CountUp value={data.temp} suffix="°" />
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {condition.label} · H{data.high}° L{data.low}°
          </p>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-4 gap-2 border-t border-hairline pt-4">
        {data.daily.map((day) => {
          const DayIcon = ICONS[describeWeatherCode(day.code).icon];
          return (
            <li key={day.day} className="flex flex-col items-center gap-1 text-center">
              <span className="text-xs font-semibold text-text-secondary">{day.day}</span>
              <DayIcon aria-hidden className="size-4 text-text-secondary" strokeWidth={1.75} />
              <span className="tabular text-sm font-medium text-text">{day.high}°</span>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
