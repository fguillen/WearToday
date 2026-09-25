import { afterEach, describe, expect, it } from 'vitest';
import { clearOpenRouterKey, getOpenRouterKey, hasOpenRouterKey, setOpenRouterKey } from '../src/services/session-key.js';

const KEY = 'sk-or-v1-session-only';

function storageContents(storage) {
  return Array.from({ length: storage.length }, (_, index) => {
    const name = storage.key(index);
    return `${name}=${storage.getItem(name)}`;
  }).join('\n');
}

describe('session key', () => {
  afterEach(() => clearOpenRouterKey());

  it('is readable after set and trimmed', () => {
    setOpenRouterKey(`  ${KEY}  `);
    expect(getOpenRouterKey()).toBe(KEY);
    expect(hasOpenRouterKey()).toBe(true);
  });

  it('is cleared correctly', () => {
    setOpenRouterKey(KEY);
    clearOpenRouterKey();
    expect(getOpenRouterKey()).toBe('');
    expect(hasOpenRouterKey()).toBe(false);
  });

  it('is never serialized to browser storage or cookies', () => {
    setOpenRouterKey(KEY);
    expect(storageContents(localStorage)).not.toContain(KEY);
    expect(storageContents(sessionStorage)).not.toContain(KEY);
    expect(document.cookie).not.toContain(KEY);
  });
});
