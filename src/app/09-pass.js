// ---------------------------------------------------------------------------
// Interrail-pass – hver person har sitt eget (trips/{id}/budgets/{uid}.pass)
// kind: flexi (N reisedager innen en periode), continuous (fri reise hele perioden), custom
// travelDays 0 = ubegrenset · periodDays / periodMonths 0 = hele reisen
// ---------------------------------------------------------------------------
export const PASS_FLEXI_PRESETS = [
  { travelDays: 4, periodMonths: 1 }, { travelDays: 5, periodMonths: 1 }, { travelDays: 7, periodMonths: 1 },
  { travelDays: 10, periodMonths: 2 }, { travelDays: 15, periodMonths: 2 }
];
export const PASS_CONTINUOUS_PRESETS = [
  { periodDays: 15 }, { periodDays: 22 }, { periodMonths: 1 }, { periodMonths: 2 }, { periodMonths: 3 }
];

export function normalizePass(p) {
  if (!p || typeof p !== "object") return null;
  const kind = ["flexi", "continuous", "custom"].includes(p.kind) ? p.kind : null;
  if (!kind) return null;
  const int = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(max, n) : 0; };
  let travelDays = int(p.travelDays, 90);
  let periodMonths = int(p.periodMonths, 12);
  let periodDays = periodMonths ? 0 : int(p.periodDays, 400);
  if (kind === "continuous") travelDays = 0;
  if (kind === "flexi" && !travelDays) return null;
  if (kind === "continuous" && !periodDays && !periodMonths) return null;
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(p.startDate || "")) ? String(p.startDate) : "";
  return { kind, travelDays, periodDays, periodMonths, startDate };
}

function passPeriodText(p, short) {
  if (p.periodMonths) return short ? `${p.periodMonths} mnd` : `${p.periodMonths} ${p.periodMonths === 1 ? "måned" : "måneder"}`;
  if (p.periodDays) return `${p.periodDays} dager`;
  return "hele reisen";
}

export function passLabel(pass) {
  const p = normalizePass(pass);
  if (!p) return "Ikke satt";
  const per = passPeriodText(p, false);
  if (p.kind === "continuous") return `Sammenhengende pass, ${per}`;
  const days = p.travelDays ? `${p.travelDays} reisedager innen ${per}` : `Ubegrenset med reisedager i ${per}`;
  return p.kind === "flexi" ? `Fleksipass, ${days}` : `Eget pass, ${days}`;
}

export function passShortLabel(pass) {
  const p = normalizePass(pass);
  if (!p) return "–";
  const per = passPeriodText(p, true);
  if (!p.travelDays) return `Fri reise, ${per}`;
  return `${p.travelDays} dager på ${per}`;
}

function isoAddDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function isoAddMonths(iso, m) {
  const [y, mo, da] = iso.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, mo - 1 + m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, mo - 1 + m, Math.min(da, lastDay))).toISOString().slice(0, 10);
}
function isoDiffDays(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}
function todayISO() {
  if (typeof window !== "undefined" && window.__today) return window.__today;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Hvilken dato et tog bruker av passet. Direkte nattog etter kl. 19 som kommer fram neste dag, teller på ankomstdagen.
export function passTravelDateOfTrain(t) {
  if (!t || !t.isTravelDay || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.date || ""))) return null;
  const dep = String(t.departureTime || ""), arr = String(t.arrivalTime || "");
  const direct = !(Number(t.transfers) > 0);
  if (direct && /^\d{2}:\d{2}/.test(dep) && /^\d{2}:\d{2}/.test(arr) && dep >= "19:00" && arr < dep) return isoAddDays(t.date, 1);
  return t.date;
}

export function computePassStatus(pass, trains, trip, today = todayISO()) {
  const p = normalizePass(pass);
  const dates = [...new Set((trains || []).map(passTravelDateOfTrain).filter(Boolean))].sort();
  const base = { pass: p, dates, used: dates.length, outside: [], start: "", end: "", length: 0, state: "none", daysLeft: null, unlimited: false, total: 0, remaining: null, over: 0 };
  if (!p) return base;
  const tr = trip || {};
  const start = p.startDate || tr.startDate || dates[0] || "";
  let end = "";
  if (start) {
    if (p.periodMonths) end = isoAddDays(isoAddMonths(start, p.periodMonths), -1);
    else if (p.periodDays) end = isoAddDays(start, p.periodDays - 1);
    else if (tr.endDate && tr.endDate >= start) end = tr.endDate;
  }
  const inPeriod = d => (!start || d >= start) && (!end || d <= end);
  const usedDates = dates.filter(inPeriod);
  const unlimited = !p.travelDays;
  const length = start && end ? isoDiffDays(start, end) + 1 : 0;
  let state = "nodates", daysLeft = null;
  if (start && end) {
    if (today < start) { state = "before"; daysLeft = length; }
    else if (today > end) { state = "expired"; daysLeft = 0; }
    else { state = "active"; daysLeft = isoDiffDays(today, end) + 1; }
  }
  return {
    ...base, start, end, length, state, daysLeft, unlimited,
    used: usedDates.length, outside: dates.filter(d => !inPeriod(d)),
    total: p.travelDays, remaining: unlimited ? null : Math.max(0, p.travelDays - usedDates.length),
    over: unlimited ? 0 : Math.max(0, usedDates.length - p.travelDays)
  };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Tekster til oversikten, sidemenyen og mobilen
export function passDisplay(s) {
  if (!s || !s.pass) return { main: "Ikke satt", sub: "Legg til passet ditt", pct: 0, short: "Pass", warn: "" };
  let warn = "";
  if (s.over > 0) warn = `${plural(s.over, "reisedag", "reisedager")} for mye`;
  else if (s.outside.length) warn = `${plural(s.outside.length, "reisedag", "reisedager")} utenfor passperioden`;
  if (!s.unlimited) {
    const pct = s.total ? Math.min(100, Math.round((s.used / s.total) * 100)) : 0;
    let sub = `${s.remaining} igjen`;
    if (s.state === "active") sub += ` · gyldig til ${formatDate(s.end)}`;
    else if (s.state === "before") sub += ` · fra ${formatDate(s.start)}`;
    else if (s.state === "expired") sub = `Gikk ut ${formatDate(s.end)}`;
    return { main: `${s.used} / ${s.total} dager`, sub, pct, short: `${s.used}/${s.total} dgr`, warn };
  }
  if (s.state === "active") {
    const elapsed = s.length - s.daysLeft;
    return { main: `${plural(s.daysLeft, "dag", "dager")} igjen`, sub: `av ${s.length} · til ${formatDate(s.end)}`, pct: Math.round((elapsed / s.length) * 100), short: `${s.daysLeft} d igjen`, warn };
  }
  if (s.state === "before") return { main: `${s.length} dager`, sub: `Fri reise fra ${formatDate(s.start)}`, pct: 0, short: `${s.length} d`, warn };
  if (s.state === "expired") return { main: "Utløpt", sub: `Gikk ut ${formatDate(s.end)}`, pct: 100, short: "Utløpt", warn };
  return { main: "Fri reise", sub: "Sett startdato på passet", pct: 0, short: "Fri reise", warn };
}

// Gamle reiser hadde ett felles tall for reisedager på selve reisen
function legacyPassFromTrip(tripObj) {
  const n = Number(tripObj && tripObj.trip && tripObj.trip.totalPassDays) || 0;
  if (!n) return null;
  const preset = PASS_FLEXI_PRESETS.find(x => x.travelDays === n);
  return preset ? normalizePass({ kind: "flexi", ...preset }) : normalizePass({ kind: "custom", travelDays: n });
}

export function getMyPass(tripObj) {
  if (!tripObj) return null;
  const entry = personalBudgetsByTrip[tripObj.id];
  if (entry && Object.prototype.hasOwnProperty.call(entry, "pass")) return normalizePass(entry.pass);
  return legacyPassFromTrip(tripObj);
}

export function getMyPassStatus(tripObj) {
  const t = tripObj || getActiveTripObject();
  if (!t) return computePassStatus(null, [], {});
  const isActive = t.id === activeTripId;
  return computePassStatus(getMyPass(t), isActive ? appState.trains : t.trains, isActive ? appState.trip : t.trip);
}

export function setMyPass(tid, pass) {
  if (!tid) return;
  const entry = personalBudgetsByTrip[tid] || { totalBudget: 0, expenses: [] };
  entry.pass = normalizePass(pass);
  entry.updatedAt = new Date().toISOString();
  personalBudgetsByTrip[tid] = entry;
  savePersonalBudgetsToStorage();
  pushMyBudget(tid);
}

