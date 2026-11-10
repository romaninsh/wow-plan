// Google Analytics: wow-plan.com's own GA4 stream, linked across vantage-ui.com and wow-plan.com.
// The measurement ID is read at run time from /config/settings.json (`gaMeasurementId`), which
// Cloud Run mounts into the web root (vantage-terraform, modules/wow-plan-gcp), so changing it
// needs no rebuild. The tag loads only when that file names an ID and the page is on a production
// host; anywhere else (dev, tests, previews, no settings file) track() logs `[ga] name params` to
// the console and sends nothing.
//
// Page views come from GA's enhanced measurement, which follows the router's history changes, so
// nothing here sends them.

const PRODUCTION_HOSTS = ["wow-plan.com", "www.wow-plan.com", "wow.demo.vantage-ui.com"];
const SETTINGS_URL = "/config/settings.json";

type Params = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// undefined while the settings are loading; then the loaded measurement ID, or null for "don't send"
let measurementId: string | null | undefined;
let ready: Promise<void> | null = null;
const queued: [string, Params][] = [];

async function readMeasurementId(): Promise<string | null> {
  if (!PRODUCTION_HOSTS.includes(location.hostname)) return null;
  try {
    const res = await fetch(SETTINGS_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const id = (await res.json())?.gaMeasurementId;
    return typeof id === "string" && /^G-[A-Z0-9]+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function loadGtag(id: string) {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer ?? [];
  // gtag.js reads the queued `arguments` objects, not arrays
  window.gtag = function gtag() { window.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
  window.gtag("js", new Date());
  window.gtag("config", id, {
    linker: { domains: ["vantage-ui.com", "wow-plan.com"] },
    content_group: "demo-wow",
  });
}

function send(name: string, params: Params) {
  if (measurementId) window.gtag!("event", name, params);
  else console.log("[ga]", name, params);
}

/** Reads the settings once and loads the tag if they name an ID. Resolves when that's decided. */
export function loadAnalytics(): Promise<void> {
  ready ??= readMeasurementId().then((id) => {
    measurementId = id;
    if (id) loadGtag(id);
    for (const [name, params] of queued.splice(0)) send(name, params);
  });
  return ready;
}

export function track(name: string, params: Params = {}) {
  if (measurementId === undefined) {
    queued.push([name, params]);
    void loadAnalytics();
  } else {
    send(name, params);
  }
}

/** Loads the tag for the first page view and reports clicks on links that leave the app. */
export function startAnalytics() {
  void loadAnalytics();
  document.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || !/^https?:$/.test(a.protocol) || a.hostname === location.hostname) return;
    track("outbound_click", { link_url: a.href });
  }, true);
}
