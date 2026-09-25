// The OpenRouter key lives only in this module-private variable. It is never
// written to storage, cookies, URLs, the DOM, or logs.

let openRouterKey = '';

export function setOpenRouterKey(value) {
  openRouterKey = String(value ?? '').trim();
}

export function getOpenRouterKey() {
  return openRouterKey;
}

export function hasOpenRouterKey() {
  return openRouterKey.length > 0;
}

export function clearOpenRouterKey() {
  openRouterKey = '';
}
