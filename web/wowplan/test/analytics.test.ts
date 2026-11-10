import { afterEach, describe, expect, it, vi } from "vitest";

// analytics.ts loads gtag at most once per page, so each case imports a fresh copy
async function trackOn(hostname: string) {
  vi.resetModules();
  vi.stubGlobal("location", { hostname });
  const appendChild = vi.spyOn(document.head, "appendChild").mockImplementation((n) => n);
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const { track } = await import("../src/analytics");
  track("demo_action", { action: "create_plan" });
  return { appendChild, log };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete window.gtag;
  delete window.dataLayer;
});

describe("track", () => {
  it.each(["wow-plan.com", "www.wow-plan.com", "wow.demo.vantage-ui.com"])("loads gtag on %s", async (host) => {
    const { appendChild, log } = await trackOn(host);
    const script = appendChild.mock.calls[0]?.[0] as HTMLScriptElement;
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(script.src).toBe("https://www.googletagmanager.com/gtag/js?id=G-R3BJYDRX24");
    expect(window.dataLayer?.map((a) => Array.from(a as ArrayLike<unknown>)[0])).toEqual(["js", "config", "event"]);
    expect(log).not.toHaveBeenCalled();
  });

  it.each(["localhost", "wow-plan.com.evil.example", "demo.vantage-ui.com"])("only logs on %s", async (host) => {
    const { appendChild, log } = await trackOn(host);
    expect(appendChild).not.toHaveBeenCalled();
    expect(window.gtag).toBeUndefined();
    expect(log).toHaveBeenCalledWith("[ga]", "demo_action", { action: "create_plan" });
  });
});
