// Google Analytics: wow-plan.com's own GA4 stream, linked across vantage-ui.com and wow-plan.com.
// The measurement ID comes from VITE_GA_MEASUREMENT_ID at build time (deploy.sh sets it). The tag
// loads only when that is set and the page is on a production host; anywhere else (dev, tests,
// previews, a build without the variable) track() logs `[ga] name params` and sends nothing.
//
// Page views come from GA's enhanced measurement, which follows the router's history changes, so
// nothing here sends them.

const MEASUREMENT_ID: string = import.meta.env.VITE_GA_MEASUREMENT_ID ?? "";
const PRODUCTION_HOSTS = ["wow-plan.com", "www.wow-plan.com", "wow.demo.vantage-ui.com"];

type Params = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;

/** Loads gtag once, on a production host only. Says whether events go to GA. */
function ensureGtag(): boolean {
  if (!MEASUREMENT_ID || !PRODUCTION_HOSTS.includes(location.hostname)) return false;
  if (loaded) return true;
  loaded = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer ?? [];
  // gtag.js reads the queued `arguments` objects, not arrays
  window.gtag = function gtag() { window.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    linker: { domains: ["vantage-ui.com", "wow-plan.com"] },
    content_group: "demo-wow",
  });
  return true;
}

export function track(name: string, params: Params = {}) {
  if (ensureGtag()) window.gtag!("event", name, params);
  else console.log("[ga]", name, params);
}

/** Loads the tag for the first page view and reports clicks on links that leave the app. */
export function startAnalytics() {
  ensureGtag();
  document.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || !/^https?:$/.test(a.protocol) || a.hostname === location.hostname) return;
    track("outbound_click", { link_url: a.href });
  }, true);
}
