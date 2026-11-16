// =============================================================================
// LAND OG VALUTA – landinfo, valutakurser, utgifter i andre valutaer,
// valutakalkulator og lenker for setereservasjon
// =============================================================================

// ---------- Land ----------
// plugs: stikkontakttyper. eea: EU/EØS-roaming («som hjemme»).
// lang: språkkode for frasene under. extra: lokale nødnumre i tillegg til 112.
const COUNTRY_INFO = [
  { code: "NO", name: "Norge", aliases: ["norway", "noreg"], currency: "NOK", plugs: "CF", eea: true, language: "Norsk", lang: "" },
  { code: "SE", name: "Sverige", aliases: ["sweden"], currency: "SEK", plugs: "CF", eea: true, language: "Svensk", lang: "sv" },
  { code: "DK", name: "Danmark", aliases: ["denmark"], currency: "DKK", plugs: "CEFK", eea: true, language: "Dansk", lang: "da" },
  { code: "FI", name: "Finland", aliases: ["suomi"], currency: "EUR", plugs: "CF", eea: true, language: "Finsk og svensk", lang: "fi" },
  { code: "IS", name: "Island", aliases: ["iceland", "ísland"], currency: "ISK", plugs: "CF", eea: true, language: "Islandsk", lang: "is" },
  { code: "DE", name: "Tyskland", aliases: ["germany", "deutschland"], currency: "EUR", plugs: "CF", eea: true, language: "Tysk", lang: "de" },
  { code: "NL", name: "Nederland", aliases: ["netherlands", "holland", "the netherlands"], currency: "EUR", plugs: "CF", eea: true, language: "Nederlandsk", lang: "nl" },
  { code: "BE", name: "Belgia", aliases: ["belgium", "belgië", "belgique"], currency: "EUR", plugs: "CE", eea: true, language: "Nederlandsk og fransk", lang: "nl" },
  { code: "LU", name: "Luxembourg", aliases: ["luxemburg"], currency: "EUR", plugs: "CF", eea: true, language: "Luxembourgsk, fransk og tysk", lang: "fr" },
  { code: "FR", name: "Frankrike", aliases: ["france"], currency: "EUR", plugs: "CE", eea: true, language: "Fransk", lang: "fr" },
  { code: "MC", name: "Monaco", aliases: [], currency: "EUR", plugs: "CEF", eea: false, language: "Fransk", lang: "fr" },
  { code: "CH", name: "Sveits", aliases: ["switzerland", "schweiz", "suisse", "svizzera"], currency: "CHF", plugs: "CJ", eea: false, language: "Tysk, fransk og italiensk", lang: "de" },
  { code: "LI", name: "Liechtenstein", aliases: [], currency: "CHF", plugs: "CJ", eea: true, language: "Tysk", lang: "de" },
  { code: "AT", name: "Østerrike", aliases: ["austria", "österreich"], currency: "EUR", plugs: "CF", eea: true, language: "Tysk", lang: "de" },
  { code: "IT", name: "Italia", aliases: ["italy"], currency: "EUR", plugs: "CFL", eea: true, language: "Italiensk", lang: "it" },
  { code: "SM", name: "San Marino", aliases: [], currency: "EUR", plugs: "CFL", eea: false, language: "Italiensk", lang: "it" },
  { code: "VA", name: "Vatikanstaten", aliases: ["vatikanet", "vatican", "vatican city"], currency: "EUR", plugs: "CFL", eea: false, language: "Italiensk", lang: "it" },
  { code: "ES", name: "Spania", aliases: ["spain", "españa"], currency: "EUR", plugs: "CF", eea: true, language: "Spansk", lang: "es" },
  { code: "PT", name: "Portugal", aliases: [], currency: "EUR", plugs: "CF", eea: true, language: "Portugisisk", lang: "pt" },
  { code: "AD", name: "Andorra", aliases: [], currency: "EUR", plugs: "CF", eea: false, language: "Katalansk", lang: "es" },
  { code: "GB", name: "Storbritannia", aliases: ["united kingdom", "uk", "great britain", "england", "skottland", "scotland", "wales", "det forente kongerike"], currency: "GBP", plugs: "G", eea: false, language: "Engelsk", lang: "", extra: "999 eller 112" },
  { code: "IE", name: "Irland", aliases: ["ireland", "éire"], currency: "EUR", plugs: "G", eea: true, language: "Engelsk og irsk", lang: "" },
  { code: "MT", name: "Malta", aliases: [], currency: "EUR", plugs: "G", eea: true, language: "Maltesisk og engelsk", lang: "" },
  { code: "CY", name: "Kypros", aliases: ["cyprus"], currency: "EUR", plugs: "G", eea: true, language: "Gresk", lang: "el" },
  { code: "PL", name: "Polen", aliases: ["poland", "polska"], currency: "PLN", plugs: "CE", eea: true, language: "Polsk", lang: "pl" },
  { code: "CZ", name: "Tsjekkia", aliases: ["czechia", "czech republic", "česko", "tsjekkiske republikk"], currency: "CZK", plugs: "CE", eea: true, language: "Tsjekkisk", lang: "cs" },
  { code: "SK", name: "Slovakia", aliases: ["slovensko"], currency: "EUR", plugs: "CE", eea: true, language: "Slovakisk", lang: "sk" },
  { code: "HU", name: "Ungarn", aliases: ["hungary", "magyarország"], currency: "HUF", plugs: "CF", eea: true, language: "Ungarsk", lang: "hu" },
  { code: "SI", name: "Slovenia", aliases: ["slovenija"], currency: "EUR", plugs: "CF", eea: true, language: "Slovensk", lang: "sl" },
  { code: "HR", name: "Kroatia", aliases: ["croatia", "hrvatska"], currency: "EUR", plugs: "CF", eea: true, language: "Kroatisk", lang: "hr" },
  { code: "BA", name: "Bosnia-Hercegovina", aliases: ["bosnia and herzegovina", "bosnia", "bosna i hercegovina", "bosnia og hercegovina"], currency: "BAM", plugs: "CF", eea: false, language: "Bosnisk, kroatisk og serbisk", lang: "bs", extra: "Politi 122, ambulanse 124" },
  { code: "RS", name: "Serbia", aliases: ["srbija"], currency: "RSD", plugs: "CF", eea: false, language: "Serbisk", lang: "sr", extra: "Politi 192, ambulanse 194" },
  { code: "ME", name: "Montenegro", aliases: ["crna gora"], currency: "EUR", plugs: "CF", eea: false, language: "Montenegrinsk", lang: "sr" },
  { code: "XK", name: "Kosovo", aliases: [], currency: "EUR", plugs: "CF", eea: false, language: "Albansk og serbisk", lang: "sq" },
  { code: "AL", name: "Albania", aliases: ["shqipëri", "shqiperia"], currency: "ALL", plugs: "CF", eea: false, language: "Albansk", lang: "sq", extra: "Politi 129, ambulanse 127" },
  { code: "MK", name: "Nord-Makedonia", aliases: ["north macedonia", "makedonia", "macedonia"], currency: "MKD", plugs: "CF", eea: false, language: "Makedonsk", lang: "mk" },
  { code: "GR", name: "Hellas", aliases: ["greece", "hellás", "ellada"], currency: "EUR", plugs: "CF", eea: true, language: "Gresk", lang: "el" },
  { code: "BG", name: "Bulgaria", aliases: ["bălgarija"], currency: "EUR", plugs: "CF", eea: true, language: "Bulgarsk", lang: "bg" },
  { code: "RO", name: "Romania", aliases: ["românia"], currency: "RON", plugs: "CF", eea: true, language: "Rumensk", lang: "ro" },
  { code: "MD", name: "Moldova", aliases: [], currency: "MDL", plugs: "CF", eea: false, language: "Rumensk", lang: "ro" },
  { code: "UA", name: "Ukraina", aliases: ["ukraine"], currency: "UAH", plugs: "CF", eea: false, language: "Ukrainsk", lang: "" },
  { code: "TR", name: "Tyrkia", aliases: ["turkey", "türkiye"], currency: "TRY", plugs: "CF", eea: false, language: "Tyrkisk", lang: "tr" },
  { code: "EE", name: "Estland", aliases: ["estonia", "eesti"], currency: "EUR", plugs: "CF", eea: true, language: "Estisk", lang: "et" },
  { code: "LV", name: "Latvia", aliases: ["latvija"], currency: "EUR", plugs: "CF", eea: true, language: "Latvisk", lang: "lv" },
  { code: "LT", name: "Litauen", aliases: ["lithuania", "lietuva"], currency: "EUR", plugs: "CF", eea: true, language: "Litauisk", lang: "lt" }
];

// Hei · Takk · Unnskyld · Snakker du engelsk?
const PHRASES = {
  sv: ["Hej", "Tack", "Ursäkta", "Pratar du engelska?"],
  da: ["Hej", "Tak", "Undskyld", "Taler du engelsk?"],
  fi: ["Hei", "Kiitos", "Anteeksi", "Puhutteko englantia?"],
  is: ["Halló", "Takk", "Afsakið", "Talar þú ensku?"],
  de: ["Hallo", "Danke", "Entschuldigung", "Sprechen Sie Englisch?"],
  nl: ["Hallo", "Dank u wel", "Sorry", "Spreekt u Engels?"],
  fr: ["Bonjour", "Merci", "Pardon", "Vous parlez anglais ?"],
  it: ["Ciao", "Grazie", "Scusi", "Parla inglese?"],
  es: ["Hola", "Gracias", "Perdón", "¿Habla inglés?"],
  pt: ["Olá", "Obrigado / obrigada", "Desculpe", "Fala inglês?"],
  pl: ["Dzień dobry", "Dziękuję", "Przepraszam", "Czy mówi pan/pani po angielsku?"],
  cs: ["Dobrý den", "Děkuji", "Promiňte", "Mluvíte anglicky?"],
  sk: ["Dobrý deň", "Ďakujem", "Prepáčte", "Hovoríte po anglicky?"],
  hu: ["Jó napot", "Köszönöm", "Elnézést", "Beszél angolul?"],
  sl: ["Dober dan", "Hvala", "Oprostite", "Govorite angleško?"],
  hr: ["Dobar dan", "Hvala", "Oprostite", "Govorite li engleski?"],
  bs: ["Zdravo", "Hvala", "Izvinite", "Govorite li engleski?"],
  sr: ["Zdravo", "Hvala", "Izvinite", "Da li govorite engleski?"],
  sq: ["Përshëndetje", "Faleminderit", "Më falni", "A flisni anglisht?"],
  mk: ["Zdravo (Здраво)", "Blagodaram (Благодарам)", "Izvinete (Извинете)", "Zboruvate li angliski?"],
  bg: ["Zdravejte (Здравейте)", "Blagodarja (Благодаря)", "Izvinete (Извинете)", "Govorite li anglijski?"],
  el: ["Jiá sas (Γεια σας)", "Efcharistó (Ευχαριστώ)", "Signómi (Συγγνώμη)", "Miláte angliká?"],
  ro: ["Bună ziua", "Mulțumesc", "Scuzați-mă", "Vorbiți engleză?"],
  tr: ["Merhaba", "Teşekkürler", "Pardon", "İngilizce biliyor musunuz?"],
  et: ["Tere", "Aitäh", "Vabandust", "Kas te räägite inglise keelt?"],
  lv: ["Sveiki", "Paldies", "Atvainojiet", "Vai jūs runājat angliski?"],
  lt: ["Laba diena", "Ačiū", "Atsiprašau", "Ar kalbate angliškai?"]
};

const normCountry = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

export function countryInfoFor(name) {
  const n = normCountry(name);
  if (!n) return null;
  return COUNTRY_INFO.find(c => normCountry(c.name) === n || c.code.toLowerCase() === n || c.aliases.includes(n)) || null;
}

// Land på ruten i rekkefølge (uten Norge først hvis man starter hjemme)
function routeCountries() {
  const seen = new Set();
  const out = [];
  (appState.stops || []).forEach(s => {
    const info = countryInfoFor(s.country);
    const key = info ? info.code : normCountry(s.country);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(info || { code: "", name: String(s.country || "").trim(), unknown: true });
  });
  return out;
}

function plugAdvice(plugs) {
  if (plugs.includes("G")) return { ok: false, text: "Norske stikk passer ikke. Ta med adapter type G." };
  if (plugs.includes("J")) return { ok: null, text: "Tynne stikk (som mobilladere) passer. Store jordede stikk trenger adapter type J." };
  if (plugs.includes("L")) return { ok: null, text: "Tynne stikk passer. Jordede stikk passer i de fleste, men en adapter type L er grei å ha." };
  return { ok: true, text: "Norske stikk passer." };
}

// ---------- Valutakurser ----------
const CURRENCY_NAMES = {
  NOK: "norske kroner", EUR: "euro", SEK: "svenske kroner", DKK: "danske kroner", GBP: "britiske pund",
  CHF: "sveitsiske franc", CZK: "tsjekkiske koruna", PLN: "polske złoty", HUF: "ungarske forint",
  RON: "rumenske lei", ISK: "islandske kroner", TRY: "tyrkiske lira", RSD: "serbiske dinarer",
  BAM: "bosniske mark", MKD: "makedonske denarer", ALL: "albanske lek", MDL: "moldovske lei",
  UAH: "ukrainske hryvnja", USD: "amerikanske dollar"
};
const CURRENCY_CODES = Object.keys(CURRENCY_NAMES);
const FX_STORAGE_KEY = "railsync_fx_v1";
const FX_MAX_AGE_MS = 12 * 60 * 60 * 1000;
let fxCache = null;
let fxLoading = null;

function loadFxCache() {
  if (fxCache) return fxCache;
  try { fxCache = JSON.parse(localStorage.getItem(FX_STORAGE_KEY) || "null"); } catch (e) { fxCache = null; }
  return fxCache;
}

// Kroner for én enhet av valutaen, eller 0 hvis ukjent
export function nokPerUnit(cur) {
  if (!cur || cur === "NOK") return 1;
  const c = loadFxCache();
  const per = c && c.perNok ? Number(c.perNok[cur]) : 0;
  return per > 0 ? 1 / per : 0;
}

export function ensureFxRates(force = false) {
  const c = loadFxCache();
  if (!force && c && Date.now() - (c.fetchedAt || 0) < FX_MAX_AGE_MS) return Promise.resolve(c);
  if (fxLoading) return fxLoading;
  fxLoading = (async () => {
    const perNok = {};
    let date = "";
    // Den europeiske sentralbanken (via Frankfurter)
    try {
      const r = await fetch("https://api.frankfurter.dev/v1/latest?base=NOK");
      if (r.ok) {
        const j = await r.json();
        Object.assign(perNok, j.rates || {});
        date = j.date || "";
      }
    } catch (e) { /* uten nett */ }
    // Valutaer ECB ikke har (dinar, lek, denar ...)
    const missing = CURRENCY_CODES.filter(k => k !== "NOK" && k !== "BAM" && !(perNok[k] > 0));
    if (missing.length) {
      try {
        const r = await fetch("https://open.er-api.com/v6/latest/NOK");
        if (r.ok) {
          const j = await r.json();
          missing.forEach(k => { if (j.rates && j.rates[k] > 0) perNok[k] = j.rates[k]; });
          if (!date && j.time_last_update_unix) date = new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10);
        }
      } catch (e) { /* uten nett */ }
    }
    // Bosnisk mark er låst til euro
    if (perNok.EUR > 0) perNok.BAM = perNok.EUR * 1.95583;
    if (Object.keys(perNok).length) {
      fxCache = { date, fetchedAt: Date.now(), perNok };
      try { localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(fxCache)); } catch (e) { /* fullt */ }
    }
    fxLoading = null;
    return loadFxCache();
  })();
  return fxLoading;
}

function fxDateText() {
  const c = loadFxCache();
  return c && c.date ? formatDate(c.date) : "";
}

export function formatCurrency(amount, cur) {
  const v = Number(amount) || 0;
  if (!cur || cur === "NOK") return formatMoney(v);
  try {
    return new Intl.NumberFormat("nb-NO", { style: "currency", currency: cur, maximumFractionDigits: v % 1 === 0 ? 0 : 2 }).format(v);
  } catch (e) {
    return `${v.toLocaleString("nb-NO")} ${cur}`;
  }
}

function formatRate(nok) {
  const digits = nok >= 10 ? 2 : nok >= 0.1 ? 3 : 4;
  return nok.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

// Valutaer på ruten først
function preferredCurrencies() {
  const route = routeCountries().map(c => c.currency).filter(Boolean);
  return [...new Set(["NOK", ...route])];
}

function currencyOptionsHtml(selected, short = false) {
  const pref = preferredCurrencies();
  const rest = CURRENCY_CODES.filter(c => !pref.includes(c));
  const opt = c => `<option value="${c}"${c === selected ? " selected" : ""}>${short ? c : `${c} – ${escapeHtml(CURRENCY_NAMES[c] || c)}`}</option>`;
  return `<optgroup label="På ruten">${pref.map(opt).join("")}</optgroup>${rest.length ? `<optgroup label="Andre">${rest.map(opt).join("")}</optgroup>` : ""}`;
}

// Valuta der man er i dag, ellers sist brukte, ellers NOK
function defaultExpenseCurrency() {
  const today = todayISO();
  const here = (appState.stops || []).find(s => s.arrival && s.departure && s.arrival <= today && today < s.departure);
  const info = here ? countryInfoFor(here.country) : null;
  if (info && info.currency) return info.currency;
  let last = "";
  try { last = localStorage.getItem("railsync_last_currency_" + (activeTripId || "")) || ""; } catch (e) { /* */ }
  return CURRENCY_CODES.includes(last) ? last : "NOK";
}

// ---------- Utgiftsskjemaene ----------
// prefix: "expense" (personlig) eller "shared-expense" (felles)
export function setupFxFields(prefix, existing) {
  const sel = document.getElementById(`${prefix}-currency`);
  const amountEl = document.getElementById(`${prefix}-amount`);
  const rateEl = document.getElementById(`${prefix}-fx-rate`);
  if (!sel || !amountEl) return;
  const cur = existing && existing.currency && existing.currency !== "NOK" ? existing.currency : (existing ? "NOK" : defaultExpenseCurrency());
  sel.innerHTML = currencyOptionsHtml(cur, true);
  sel.value = cur;
  if (existing && existing.currency && existing.currency !== "NOK" && existing.origAmount) amountEl.value = existing.origAmount;
  if (rateEl) rateEl.value = existing && existing.rate && existing.currency !== "NOK" ? existing.rate : "";
  if (!sel.dataset.fxBound) {
    sel.dataset.fxBound = "1";
    const upd = () => updateFxNote(prefix);
    sel.addEventListener("change", () => { if (rateEl) rateEl.value = ""; upd(); });
    amountEl.addEventListener("input", upd);
    if (rateEl) rateEl.addEventListener("input", upd);
  }
  updateFxNote(prefix);
  ensureFxRates().then(() => updateFxNote(prefix));
}

function fxResolve(prefix) {
  const sel = document.getElementById(`${prefix}-currency`);
  const cur = sel && sel.value ? sel.value : "NOK";
  const raw = parseFloat(String(document.getElementById(`${prefix}-amount`).value).replace(",", "."));
  const orig = Number.isFinite(raw) ? Math.round(raw * 100) / 100 : 0;
  if (cur === "NOK") return { currency: "NOK", origAmount: orig, rate: 1, nok: orig };
  const rateEl = document.getElementById(`${prefix}-fx-rate`);
  const manual = rateEl ? parseFloat(String(rateEl.value).replace(",", ".")) : NaN;
  const rate = manual > 0 ? manual : nokPerUnit(cur);
  if (!(rate > 0)) return { currency: cur, origAmount: orig, rate: 0, nok: 0, missingRate: true };
  return { currency: cur, origAmount: orig, rate: Math.round(rate * 10000) / 10000, nok: Math.round(orig * rate * 100) / 100 };
}

function updateFxNote(prefix) {
  const note = document.getElementById(`${prefix}-fx-note`);
  const wrap = document.getElementById(`${prefix}-fx-rate-wrap`);
  if (!note) return;
  const r = fxResolve(prefix);
  const rateEl = document.getElementById(`${prefix}-fx-rate`);
  const manual = rateEl && parseFloat(String(rateEl.value).replace(",", ".")) > 0;
  if (wrap) wrap.classList.toggle("hidden", r.currency === "NOK" || (!r.missingRate && !manual));
  if (r.currency === "NOK") { note.classList.add("hidden"); note.textContent = ""; return; }
  note.classList.remove("hidden");
  if (r.missingRate) {
    note.textContent = `Fant ingen kurs for ${r.currency} akkurat nå. Skriv inn hvor mange kroner 1 ${r.currency} er.`;
    return;
  }
  const d = fxDateText();
  note.textContent = `${r.origAmount > 0 ? `≈ ${formatMoney(r.nok)} · ` : ""}1 ${r.currency} = ${formatRate(r.rate)} kr${manual ? " (din kurs)" : d ? ` (kurs ${d})` : ""}`;
}

// Gir beløp i kroner pluss valutafeltene som skal lagres, eller en feilmelding
export function readFxAmount(prefix) {
  const r = fxResolve(prefix);
  if (!(r.origAmount > 0)) return { error: "Skriv inn et gyldig beløp." };
  if (r.missingRate) return { error: `Skriv inn kursen for ${r.currency}.` };
  try { localStorage.setItem("railsync_last_currency_" + (activeTripId || ""), r.currency); } catch (e) { /* */ }
  const fields = r.currency === "NOK" ? {} : { currency: r.currency, origAmount: r.origAmount, rate: r.rate };
  return { nok: r.nok, fields };
}

// Liten tekst under beløpet i utgiftslister
export function expenseOrigHtml(e) {
  if (!e || !e.currency || e.currency === "NOK" || !(e.origAmount > 0)) return "";
  return `<span class="block text-[11px] text-slate-500 tabular-nums text-right">${escapeHtml(formatCurrency(e.origAmount, e.currency))}</span>`;
}

// ---------- Valutakalkulator ----------
let fxCalc = { amount: "100", from: "", to: "NOK" };

export function renderFxCalculator() {
  const el = document.getElementById("fx-calc-card");
  if (!el) return;
  if (!fxCalc.from) {
    const route = preferredCurrencies().filter(c => c !== "NOK");
    fxCalc.from = route[0] || "EUR";
  }
  const chips = preferredCurrencies().filter(c => c !== "NOK");
  el.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0" aria-hidden="true"><i data-lucide="arrow-left-right" class="w-5 h-5"></i></span>
      <div class="min-w-0">
        <h3 class="text-sm sm:text-base font-bold text-slate-900">Valutakalkulator</h3>
        <p id="fx-calc-source" class="text-xs text-slate-500">Kurs fra Den europeiske sentralbanken</p>
      </div>
    </div>
    ${chips.length ? `<div class="flex flex-wrap gap-1.5 mt-3" aria-label="Valutaer på ruten">${chips.map(c => `<button type="button" onclick="setFxCalcCurrency(${jsArg(c)})" class="px-2.5 py-1 rounded-full text-xs font-semibold border transition ${c === fxCalc.from ? "bg-fjord-800 text-white border-fjord-800" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}">${c}</button>`).join("")}</div>` : ""}
    <div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <label class="sr-only" for="fx-calc-amount">Beløp</label>
      <input id="fx-calc-amount" type="number" inputmode="decimal" min="0" step="any" value="${escapeHtml(fxCalc.amount)}" class="field-input tabular-nums text-base">
      <label class="sr-only" for="fx-calc-from">Fra valuta</label>
      <div class="w-24 shrink-0"><select id="fx-calc-from" class="field-input">${currencyOptionsHtml(fxCalc.from, true)}</select></div>
    </div>
    <div class="flex items-center justify-center my-2">
      <button type="button" onclick="swapFxCalc()" class="w-9 h-9 rounded-full bg-sand-200 hover:bg-sand-300 text-slate-700 flex items-center justify-center transition" aria-label="Bytt om valutaene"><i data-lucide="arrow-up-down" class="w-4 h-4"></i></button>
    </div>
    <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
      <p id="fx-calc-result" class="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-lg font-bold text-slate-900 tabular-nums truncate" aria-live="polite">–</p>
      <label class="sr-only" for="fx-calc-to">Til valuta</label>
      <div class="w-24 shrink-0"><select id="fx-calc-to" class="field-input">${currencyOptionsHtml(fxCalc.to, true)}</select></div>
    </div>
    <p id="fx-calc-rate" class="text-xs text-slate-500 mt-2"></p>`;
  const amountEl = document.getElementById("fx-calc-amount");
  const fromEl = document.getElementById("fx-calc-from");
  const toEl = document.getElementById("fx-calc-to");
  fromEl.value = fxCalc.from;
  toEl.value = fxCalc.to;
  amountEl.addEventListener("input", () => { fxCalc.amount = amountEl.value; updateFxCalcResult(); });
  fromEl.addEventListener("change", () => { fxCalc.from = fromEl.value; renderFxCalculator(); if (window.lucide) lucide.createIcons(); });
  toEl.addEventListener("change", () => { fxCalc.to = toEl.value; updateFxCalcResult(); });
  updateFxCalcResult();
  ensureFxRates().then(() => updateFxCalcResult());
}

function updateFxCalcResult() {
  const out = document.getElementById("fx-calc-result");
  const rateLine = document.getElementById("fx-calc-rate");
  if (!out) return;
  const a = nokPerUnit(fxCalc.from), b = nokPerUnit(fxCalc.to);
  const amount = parseFloat(String(fxCalc.amount).replace(",", "."));
  if (!(a > 0) || !(b > 0)) {
    out.textContent = "–";
    rateLine.textContent = navigator.onLine === false ? "Ingen lagrede kurser ennå. Koble til nett én gang, så virker kalkulatoren også uten nett." : "Henter kurser …";
    return;
  }
  const result = Number.isFinite(amount) ? amount * a / b : 0;
  out.textContent = formatCurrency(Math.round(result * 100) / 100, fxCalc.to);
  const d = fxDateText();
  rateLine.textContent = `1 ${fxCalc.from} = ${formatRate(a / b)} ${fxCalc.to}${d ? ` · kurs ${d}` : ""}`;
}

export function setFxCalcCurrency(cur) {
  fxCalc.from = cur;
  if (fxCalc.to === cur) fxCalc.to = "NOK";
  renderFxCalculator();
  if (window.lucide) lucide.createIcons();
}

export function swapFxCalc() {
  const f = fxCalc.from;
  fxCalc.from = fxCalc.to;
  fxCalc.to = f;
  renderFxCalculator();
  if (window.lucide) lucide.createIcons();
}

export function openFxCalculator(cur) {
  closeModal("modal-country-info");
  if (cur) { fxCalc.from = cur; if (fxCalc.to === cur) fxCalc.to = "NOK"; }
  switchTab("budget");
  renderFxCalculator();
  if (window.lucide) lucide.createIcons();
  setTimeout(() => {
    const el = document.getElementById("fx-calc-card");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    const input = document.getElementById("fx-calc-amount");
    if (input) input.focus({ preventScroll: true });
  }, 120);
}

// ---------- Landinfo ----------
export function openCountryInfo() {
  renderCountryInfo();
  openModal("modal-country-info");
  if (window.lucide) lucide.createIcons();
  ensureFxRates().then(() => { renderCountryInfo(); if (window.lucide) lucide.createIcons(); });
}

export function renderCountryInfo() {
  const el = document.getElementById("country-info-list");
  if (!el) return;
  const countries = routeCountries();
  if (!countries.length) {
    el.innerHTML = `<p class="text-sm text-slate-500 text-center py-6">Legg til stopp på ruten, så ser du praktisk info om hvert land her.</p>`;
    return;
  }
  el.innerHTML = countries.map(c => {
    if (c.unknown) {
      return `<article class="rounded-2xl border border-slate-200 p-4"><h4 class="font-bold text-slate-900">${escapeHtml(c.name)}</h4><p class="text-sm text-slate-500 mt-1">Vi har ikke info om dette landet ennå.</p></article>`;
    }
    const plug = plugAdvice(c.plugs);
    const rate = c.currency !== "NOK" ? nokPerUnit(c.currency) : 0;
    const phrases = PHRASES[c.lang];
    const row = (icon, chip, label, html) => `
      <div class="flex items-start gap-2.5">
        <span class="w-7 h-7 rounded-lg ${chip} flex items-center justify-center shrink-0" aria-hidden="true"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i></span>
        <div class="min-w-0 flex-1"><p class="text-xs text-slate-500">${label}</p><div class="text-sm text-slate-900">${html}</div></div>
      </div>`;
    return `
      <article class="rounded-2xl border border-slate-200 p-4 space-y-3" data-country="${c.code}">
        <header class="flex items-center gap-2.5">
          <span class="w-9 h-7 rounded-md bg-fjord-800 text-white text-[11px] font-bold tracking-wide flex items-center justify-center shrink-0" aria-hidden="true">${escapeHtml(c.code)}</span>
          <h4 class="font-bold text-slate-900 text-base">${escapeHtml(c.name)}</h4>
        </header>
        ${row("banknote", "bg-amber-50 text-amber-700", "Valuta", c.currency === "NOK" ? "Norske kroner" : `${escapeHtml((n => n.charAt(0).toUpperCase() + n.slice(1))(CURRENCY_NAMES[c.currency] || c.currency))} (${c.currency})${rate > 0 ? ` · 1 ${c.currency} = ${formatRate(rate)} kr` : ""}
          <button type="button" onclick="openFxCalculator(${jsArg(c.currency)})" class="ml-1 text-xs font-semibold text-brand-700 hover:underline">Regn om</button>`)}
        ${row("plug", plug.ok === false ? "bg-rose-50 text-rose-700" : plug.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700", `Stikkontakt (type ${c.plugs.split("").join(", ")})`, escapeHtml(plug.text))}
        ${row("phone", "bg-rose-50 text-rose-700", "Nødnummer", `<span class="font-semibold">112</span>${c.extra ? ` · ${escapeHtml(c.extra)}` : ""}`)}
        ${row("smartphone", c.eea ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700", "Mobil", c.eea ? "EU-roaming: som hjemme" : "Ikke EU-roaming. Sjekk prisen hos mobilselskapet ditt.")}
        ${row("languages", "bg-violet-50 text-violet-700", "Språk", escapeHtml(c.language) + (phrases ? `
          <dl class="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
            ${["Hei", "Takk", "Unnskyld", "Snakker du engelsk?"].map((no, i) => `<dt class="text-slate-500">${no}</dt><dd class="text-slate-900 font-medium">${escapeHtml(phrases[i])}</dd>`).join("")}
          </dl>` : ""))}
      </article>`;
  }).join("");
}

// Pakkelisten: forslag om adapter når ruten krever det
export function renderPackingAdapterHint() {
  const el = document.getElementById("packing-adapter-hint");
  if (!el) return;
  const need = {};
  routeCountries().forEach(c => {
    if (c.unknown) return;
    const type = c.plugs.includes("G") ? "G" : c.plugs.includes("J") ? "J" : "";
    if (type) (need[type] = need[type] || []).push(c.name);
  });
  const types = Object.keys(need);
  const have = (appState.packingList || []).map(p => String(p.text || "").toLowerCase());
  const missing = types.filter(t => !have.some(h => h.includes("adapter") && h.includes(`type ${t.toLowerCase()}`)));
  if (!missing.length) { el.classList.add("hidden"); el.innerHTML = ""; return; }
  el.classList.remove("hidden");
  el.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0" aria-hidden="true"><i data-lucide="plug" class="w-4 h-4"></i></span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-slate-900">Husk strømadapter</p>
        <p class="text-sm text-slate-600 mt-0.5">${missing.map(t => `${escapeHtml(need[t].join(" og "))} bruker stikkontakt type ${t}${t === "J" ? " (tynne stikk passer)" : ""}.`).join(" ")}</p>
      </div>
      <button type="button" onclick="addAdapterToPacking()" class="shrink-0 px-3 py-1.5 rounded-lg bg-fjord-800 hover:bg-fjord-700 text-white text-xs font-semibold transition">Legg til</button>
    </div>`;
}

export function addAdapterToPacking() {
  if (!requireEditPermission()) return;
  const routeTypes = [...new Set(routeCountries().filter(c => !c.unknown).map(c => c.plugs.includes("G") ? "G" : c.plugs.includes("J") ? "J" : "").filter(Boolean))];
  const have = (appState.packingList || []).map(p => String(p.text || "").toLowerCase());
  routeTypes.forEach((t, i) => {
    if (have.some(h => h.includes("adapter") && h.includes(`type ${t.toLowerCase()}`))) return;
    appState.packingList.push({ id: "pack-" + Date.now() + "-" + i, category: "Elektronikk", text: `Strømadapter type ${t}`, checked: false });
  });
  persistState();
  renderPacking();
  if (window.lucide) lucide.createIcons();
}

// ---------- Setereservasjon ----------
const BOOKING_SITES = [
  { re: /EUROSTAR|THALYS/, name: "Eurostar", url: "https://www.eurostar.com/" },
  { re: /NIGHTJET|\bNJ\b|ÖBB|OBB|RAILJET|\bRJX?\b/, name: "ÖBB", url: "https://www.oebb.at/en/" },
  { re: /EUROPEAN SLEEPER/, name: "European Sleeper", url: "https://www.europeansleeper.eu/" },
  { re: /SNÄLLTÅGET|SNALLTAGET/, name: "Snälltåget", url: "https://www.snalltaget.se/en" },
  { re: /TGV|INOUI|OUIGO|SNCF|INTERCIT[EÉ]S|LYRIA/, name: "SNCF Connect", url: "https://www.sncf-connect.com/en-en/" },
  { re: /FRECCIA|TRENITALIA|LE FRECCE/, name: "Trenitalia", url: "https://www.trenitalia.com/en.html" },
  { re: /ITALO/, name: "Italo", url: "https://www.italotreno.com/en" },
  { re: /RENFE|\bAVE\b|AVLO|ALVIA|EUROMED/, name: "Renfe", url: "https://www.renfe.com/es/en" },
  { re: /\bSJ\b|SNABBTÅG|X2000/, name: "SJ", url: "https://www.sj.se/en" },
  { re: /PKP|\bEIP\b|PENDOLINO|INTERCITY\.PL/, name: "PKP Intercity", url: "https://www.intercity.pl/en/" },
  { re: /SBB|\bCFF\b|\bFFS\b/, name: "SBB", url: "https://www.sbb.ch/en" },
  { re: /\bICE\b|\bDB\b|DEUTSCHE BAHN|FERNVERKEHR/, name: "Deutsche Bahn", url: "https://int.bahn.de/en" },
  { re: /\bČD\b|\bCD\b|ČESKÉ DRÁHY|CESKE DRAHY/, name: "České dráhy", url: "https://www.cd.cz/en/" },
  { re: /\bNS\b|NS INTERNATIONAL/, name: "NS International", url: "https://www.nsinternational.com/en" },
  { re: /\bDSB\b/, name: "DSB", url: "https://www.dsb.dk/en/" },
  { re: /\bVY\b/, name: "Vy", url: "https://www.vy.no/" }
];
const INTERRAIL_RESERVATIONS = "https://www.interrail.eu/en/book-reservations";

export function reservationLinksFor(train) {
  if (!train || train.reservationStatus !== "required") return [];
  const texts = [];
  (Array.isArray(train.legsSummary) ? train.legsSummary : []).forEach(l => texts.push(`${l.line || ""} ${l.agency || ""}`));
  texts.push(`${train.trainType || ""} ${train.trainNumber || ""}`);
  const found = [];
  texts.forEach(t => {
    const up = ` ${String(t).toUpperCase()} `;
    const site = BOOKING_SITES.find(s => s.re.test(up));
    if (site && !found.includes(site)) found.push(site);
  });
  return [...found.slice(0, 2), { name: "Interrail", url: INTERRAIL_RESERVATIONS }];
}

export function reservationLinksHtml(train, small = false) {
  const links = reservationLinksFor(train);
  if (!links.length) return "";
  return `<div class="flex flex-wrap items-center gap-1.5">
    ${links.map((l, i) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} rounded-lg font-semibold transition ${i === 0 ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"}">${i === 0 ? `<i data-lucide="ticket" class="w-3.5 h-3.5"></i>Reserver hos ${escapeHtml(l.name)}` : escapeHtml(l.name)}<i data-lucide="external-link" class="w-3 h-3 opacity-70"></i></a>`).join("")}
  </div>`;
}
