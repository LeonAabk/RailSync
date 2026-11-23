// Layout-sjekker i index.html
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('rullefeltet i main er "relative", så sr-only-etiketter ikke gjør siden for lang', () => {
  const m = html.match(/<main[^>]*>\s*(?:<!--[\s\S]*?-->\s*)*/);
  assert.ok(m, 'fant ikke <main>');
  const scroller = html.match(/<div class="([^"]*max-w-7xl[^"]*overflow-x-hidden[^"]*)">/);
  assert.ok(scroller, 'fant ikke rullefeltet');
  assert.ok(scroller[1].split(/\s+/).includes('relative'), 'rullefeltet mangler "relative"');
});

test('Utseende kan åpnes fra kontomenyen og sidemenyen, og står øverst på kontosiden', () => {
  const menu = html.slice(html.indexOf('id="account-menu"'), html.indexOf('</div>', html.indexOf('data-onclick="closeAccountMenu(); handleLogout()"')));
  assert.match(menu, /openDesignPicker\(\)/, 'mangler i kontomenyen');
  assert.match(html, /id="nav-btn-design"[^>]*|data-onclick="openDesignPicker\(\)" id="nav-btn-design"/, 'mangler i sidemenyen');
  const account = html.indexOf('id="tab-account"');
  assert.ok(html.indexOf('id="design-picker"', account) < html.indexOf('id="form-user-profile"', account), 'velgeren står ikke øverst');
});
