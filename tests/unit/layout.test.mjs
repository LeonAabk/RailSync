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

test('toppen holder seg under statuslinjen på mobil (safe-area-inset-top)', () => {
  assert.match(html, /viewport-fit=cover/, 'forventet viewport-fit=cover');
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  assert.match(css, /body > main > header\.sticky\s*\{[^}]*safe-area-inset-top/, 'toppmenyen mangler avstand');
  assert.match(css, /#auth-screen[^{]*\{[^}]*safe-area-inset-top/, 'innloggingssiden mangler avstand');
  assert.match(css, /max-height:[^;]*safe-area-inset-top/, 'bunnarkene kan gå under statuslinjen');
  const header = html.match(/<header class="([^"]*)"/);
  assert.ok(header && header[1].split(/\s+/).includes('sticky'), 'header må ha klassen sticky');
});

test('menyen: samme navn på PC og mobil, delt i «Denne reisen» og «Deg», uten doble knapper', () => {
  const sidebar = html.slice(html.indexOf('aria-label="Hovednavigasjon"'), html.indexOf('</aside>', html.indexOf('aria-label="Hovednavigasjon"')));
  const mobile = html.slice(html.indexOf('aria-label="Mobilnavigasjon"'), html.indexOf('</nav>', html.indexOf('aria-label="Mobilnavigasjon"')));
  const label = (part, id) => (part.match(new RegExp(`id="${id}"[\\s\\S]*?<span[^>]*>([^<]+)</span>`)) || [])[1];
  const names = { overview: 'Oversikt', plan: 'Dagsplan', trains: 'Tog', budget: 'Budsjett', packing: 'Pakkeliste' };
  for (const [tab, name] of Object.entries(names)) {
    assert.equal(label(sidebar, `nav-btn-${tab}`), name, `sidemenyen: ${tab}`);
    assert.equal(label(mobile, `mobile-tab-${tab}`), name, `mobilmenyen: ${tab}`);
  }
  assert.equal((mobile.match(/class="mobile-nav-btn/g) || []).length, 5, 'mobilmenyen skal ha 5 faner');
  assert.match(sidebar, />Denne reisen</);
  assert.match(sidebar, />Deg</);
  assert.equal(label(sidebar, 'nav-btn-trips'), 'Mine reiser');
  // Mine reiser og profilen nås fra kontomenyen (eneste vei på mobil)
  const menu = html.slice(html.indexOf('id="account-menu"'), html.indexOf('handleLogout()', html.indexOf('id="account-menu"')));
  assert.match(menu, /switchTab\('trips'\)/, 'Mine reiser mangler i kontomenyen');
  assert.match(menu, /switchTab\('social'\)/, 'profilen mangler i kontomenyen');
  // Ingen doble snarveier
  assert.equal((html.match(/data-onclick="openTripSettingsModal\(\)"[^>]*title="Reiseinnstillinger"/g) || []).length, 1, 'reiseinnstillinger står flere steder');
  assert.doesNotMatch(html, /id="header-trip-count-badge"/, '«Reiser»-knappen i toppen skal bort');
  assert.doesNotMatch(sidebar.slice(sidebar.indexOf('</nav>')), /switchTab\('social'\)/, 'profillenken nederst i sidemenyen skal bort');
});
