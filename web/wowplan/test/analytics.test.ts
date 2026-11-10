import { afterEach, describe, expect, it, vi } from "vitest";

const ID = "G-TEST123";

type Settings = { status: number; body: unknown } | "unreachable";

// analytics.ts reads /config/settings.json and loads gtag at most once per page, so each case
// imports a fresh copy with its own hostname and settings response
async function trackOn(hostname: string, settings: Settings = { status: 200, body: { gaMeasurementId: ID } }) {
  vi.resetModules();
  vi.stubGlobal("location", { hostname });
  const fetch = vi.fn(async () => {
    if (settings === "unreachable") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(settings.body), { status: settings.status });
  });
  vi.stubGlobal("fetch", fetch);
  const appendChild = vi.spyOn(document.head, "appendChild").mockImplementation((n) => n);
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const { track, loadAnalytics } = await import("../src/analytics");
  track("demo_action", { action: "create_plan" });
  await loadAnalytics();
  return { appendChild, log, fetch };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete window.gtag;
  delete window.dataLayer;
});

describe("track", () => {
  it.each(["wow-plan.com", "www.wow-plan.com", "wow.demo.vantage-ui.com"])(
    "loads gtag with the settings' ID on %s and sends the queued event",
    async (host) => {
      const { appendChild, log, fetch } = await trackOn(host);
      const script = appendChild.mock.calls[0]?.[0] as HTMLScriptElement;
      expect(fetch).toHaveBeenCalledWith("/config/settings.json", { cache: "no-store" });
      expect(appendChild).toHaveBeenCalledTimes(1);
      expect(script.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`);
      expect(window.dataLayer?.map((a) => Array.from(a as ArrayLike<unknown>)[0])).toEqual(["js", "config", "event"]);
      expect(log).not.toHaveBeenCalled();
    },
  );

  it.each(["localhost", "wow-plan.com.evil.example", "demo.vantage-ui.com"])(
    "only logs on %s, without asking for settings",
    async (host) => {
      const { appendChild, log, fetch } = await trackOn(host);
      expect(fetch).not.toHaveBeenCalled();
      expect(appendChild).not.toHaveBeenCalled();
      expect(window.gtag).toBeUndefined();
      expect(log).toHaveBeenCalledWith("[ga]", "demo_action", { action: "create_plan" });
    },
  );

  it.each<[string, Settings]>([
    ["no settings file", { status: 404, body: {} }],
    ["no ID in the settings", { status: 200, body: {} }],
    ["an ID that isn't a GA4 one", { status: 200, body: { gaMeasurementId: "GTM-123" } }],
    ["the settings unreachable", "unreachable"],
  ])("only logs on a production host with %s", async (_, settings) => {
    const { appendChild, log } = await trackOn("wow-plan.com", settings);
    expect(appendChild).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("[ga]", "demo_action", { action: "create_plan" });
  });
});
