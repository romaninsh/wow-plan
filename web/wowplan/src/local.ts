// The only state the page keeps itself, because it belongs to this browser, not to a plan: the
// list of recently opened plans. Whether this browser may edit a plan is its session's, on the
// server (unlock_plan, plan_access; the session token is in localStorage, main.tsx); names and
// everything else are read live from the API.

const COOKIE_PREFIX = "wp_edit_";
const RECENT_KEY = "wowplan.recent";
const RECENT_MAX = 12;

/** An edit key this browser kept from before the unlock (an `#edit=` link, or its cookie),
 *  taken once so the page can unlock with it: /p/<id>#edit=<code> */
export function takeOldEditCode(planId: string): string | null {
  const m = /(?:^|[#&])edit=([^&]+)/.exec(window.location.hash);
  if (m?.[1]) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return decodeURIComponent(m[1]);
  }
  const name = COOKIE_PREFIX + planId + "=";
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(name)) {
      document.cookie = `${COOKIE_PREFIX}${planId}=; path=/; max-age=0; SameSite=Lax`;
      return decodeURIComponent(part.slice(name.length));
    }
  }
  return null;
}

export interface RecentPlan {
  id: string;
  openedAt: string;
  /** the server's last answer to plan_access for this browser's session */
  editable: boolean;
}

export function recentPlans(): RecentPlan[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const KEYS_KEY = "wowplan.keys";

function editKeys(): Record<string, string> {
  try {
    const keys = JSON.parse(localStorage.getItem(KEYS_KEY) ?? "{}");
    return keys && typeof keys === "object" ? keys : {};
  } catch {
    return {};
  }
}

/** The edit key this browser used for a plan (made here, or unlocked with it). It survives Lock:
 *  unlocked, the plan page's Share copies it; locked, Edit unlocks with it and Forget drops it,
 *  as does a key the server no longer takes (a new one was made). The empty-plan card puts it
 *  in the request for an AI assistant while the plan is unlocked. */
export function editKeyFor(planId: string): string | undefined {
  return editKeys()[planId];
}

export function rememberEditKey(planId: string, key: string): void {
  localStorage.setItem(KEYS_KEY, JSON.stringify({ ...editKeys(), [planId]: key }));
}

export function forgetEditKey(planId: string): void {
  const keys = editKeys();
  if (!(planId in keys)) return;
  delete keys[planId];
  localStorage.setItem(KEYS_KEY, JSON.stringify(keys));
}

export function rememberPlan(id: string, editable?: boolean): void {
  const list = recentPlans();
  const previous = list.find((p) => p.id === id);
  const entry: RecentPlan = { id, openedAt: new Date().toISOString(), editable: editable ?? previous?.editable ?? false };
  const next = [entry, ...list.filter((p) => p.id !== id)].slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}
