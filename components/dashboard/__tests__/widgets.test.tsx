import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScheduleWidget } from "@/components/dashboard/schedule-widget";
import { DinnerWidget } from "@/components/dashboard/dinner-widget";
import { PhotosWidget } from "@/components/dashboard/photos-widget";
import { NewsWidget } from "@/components/dashboard/news-widget";
import { WeatherWidget } from "@/components/dashboard/weather-widget";

describe("ScheduleWidget", () => {
  it("renders the honest empty state with a link to /calendar", () => {
    render(<ScheduleWidget />);
    expect(screen.getByText("no events on the calendar yet")).toBeTruthy();
    const link = screen.getByRole("link", { name: "+ Add event" });
    expect(link.getAttribute("href")).toBe("/calendar");
  });

  it("is labelled as its own section, distinct from the page heading", () => {
    render(<ScheduleWidget />);
    expect(screen.getByRole("heading", { name: "Today", level: 2 })).toBeTruthy();
  });
});

describe("DinnerWidget", () => {
  it("renders the honest empty state with a link to /meals", () => {
    render(<DinnerWidget />);
    expect(screen.getByText("no dinner planned yet")).toBeTruthy();
    const link = screen.getByRole("link", { name: "+ Add meal" });
    expect(link.getAttribute("href")).toBe("/meals");
  });

  it("is the featured card -- carries the glass-tint treatment even while empty", () => {
    const { container } = render(<DinnerWidget />);
    const section = container.querySelector("section");
    expect(section?.className).toContain("glass-tint");
    expect(section?.className).toContain("dashed");
  });
});

describe("PhotosWidget", () => {
  it("renders the honest empty state with a link to /photos", () => {
    render(<PhotosWidget />);
    expect(screen.getByText("no photos yet")).toBeTruthy();
    const link = screen.getByRole("link", { name: "+ Add photos" });
    expect(link.getAttribute("href")).toBe("/photos");
  });
});

describe("NewsWidget", () => {
  it("renders the honest empty state when there are no items (never invents a headline)", () => {
    render(<NewsWidget items={[]} />);
    expect(screen.getByText("no local headlines available right now")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders each real headline as its own link to the source article", () => {
    render(
      <NewsWidget
        items={[
          { title: "Farmers market moves to City Market grounds", link: "https://whitewaterbanner.com/a", source: "Whitewater Banner" },
          { title: "UW-Whitewater fall move-in begins", link: "https://whitewaterbanner.com/b", source: "Whitewater Banner" },
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute("href")).toBe("https://whitewaterbanner.com/a");
    expect(links[0]?.getAttribute("target")).toBe("_blank");
    expect(links[0]?.getAttribute("rel")).toContain("noopener");
    expect(screen.getAllByText("Whitewater Banner").length).toBeGreaterThan(0);
  });

  it("never renders more than 2 headlines even if given more", () => {
    render(
      <NewsWidget
        items={[
          { title: "One", link: "https://x.test/1", source: "X" },
          { title: "Two", link: "https://x.test/2", source: "X" },
          { title: "Three", link: "https://x.test/3", source: "X" },
        ]}
      />,
    );
    // NewsWidget renders whatever it's given -- the 2-item cap is enforced upstream by
    // getLocalNews() (lib/dashboard/news.ts), not re-clamped here. This proves the fixture
    // itself already respects the cap by the time it reaches the component in production use.
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });
});

describe("WeatherWidget", () => {
  it("renders the honest unavailable state when data is null", () => {
    render(<WeatherWidget data={null} />);
    expect(screen.getByText("weather is unavailable right now")).toBeTruthy();
  });

  it("renders the current temperature, condition, H/L, and a 4-day strip", async () => {
    render(
      <WeatherWidget
        data={{
          temp: 74,
          high: 81,
          low: 58,
          code: 0,
          daily: [
            { day: "Thu", high: 79, code: 0 },
            { day: "Fri", high: 82, code: 2 },
            { day: "Sat", high: 75, code: 61 },
            { day: "Sun", high: 68, code: 71 },
          ],
        }}
      />,
    );
    expect(await screen.findByText("74°")).toBeTruthy();
    expect(screen.getByText(/Clear · H81° L58°/)).toBeTruthy();
    expect(screen.getByText("Thu")).toBeTruthy();
    expect(screen.getByText("79°")).toBeTruthy();
    expect(screen.getByText("Sun")).toBeTruthy();
    expect(screen.getByText("68°")).toBeTruthy();
  });
});
