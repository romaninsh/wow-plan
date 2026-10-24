// The only state the page keeps itself, because it belongs to this browser, not to a plan:
// edit codes (cookies, so a code someone sent you works on this laptop from then on) and the
// list of recently opened plans. Whether a code really edits a plan is the server's answer
// (check_edit_code); names and everything else are read live from the API.

const COOKIE_PREFIX = "wp_edit_";
const RECENT_KEY = "wowplan.recent";
const RECENT_MAX = 12;

export function getEditCode(planId: string): string | null {
  const name = COOKIE_PREFIX + planId + "=";
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(name)) return decodeURIComponent(part.slice(name.length));
  }
  return null;
}

export function setEditCode(planId: string, code: string): void {
  const year = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_PREFIX}${planId}=${encodeURIComponent(code)}; path=/; max-age=${year}; SameSite=Lax`;
}

export function forgetEditCode(planId: string): void {
  document.cookie = `${COOKIE_PREFIX}${planId}=; path=/; max-age=0; SameSite=Lax`;
}

/** An edit link carries the code after `#`, so it never reaches a server log: /p/<id>#edit=<code> */
export function takeEditCodeFromHash(planId: string): void {
  const m = /(?:^|[#&])edit=([^&]+)/.exec(window.location.hash);
  if (!m?.[1]) return;
  setEditCode(planId, decodeURIComponent(m[1]));
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

export interface RecentPlan {
  id: string;
  openedAt: string;
  /** the server's last answer to check_edit_code for this browser's code */
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

export function rememberPlan(id: string, editable?: boolean): void {
  const list = recentPlans();
  const previous = list.find((p) => p.id === id);
  const entry: RecentPlan = { id, openedAt: new Date().toISOString(), editable: editable ?? previous?.editable ?? false };
  const next = [entry, ...list.filter((p) => p.id !== id)].slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}
