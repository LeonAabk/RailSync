// =============================================================================
// VÆR I DAGSPLANEN – værmelding nær i tid, ellers vanlig vær for årstiden
// =============================================================================
// Kilde: Open-Meteo (gratis, ingen nøkkel, CC BY 4.0 – kreditering vises under dagsplanen).
// - Dager fra i dag og 15 dager fram: værmelding (api.open-meteo.com).
// - Dager lenger fram: normalvær = snitt for samme tid på året de siste 10 hele årene
//   (archive-api.open-meteo.com). Vises alltid tydelig merket som «vanlig for årstiden».
// - Tidligere dager: ingen vær.
// Alt lagres bare i nettleseren (railsync_weather_v1), aldri i Firestore.
// Stedet for en dag er overnattingsstoppet, ellers stoppet man er på.

const WEATHER_FORECAST_DAYS = 16; // i dag + 15
const WEATHER_NORMAL_YEARS = 10;
const WEATHER_NORMAL_WINDOW = 7; // ± dager rundt datoen i snittet
const WEATHER_STORAGE_KEY = "railsync_weather_v1";
const WEATHER_FORECAST_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const WEATHER_NORMAL_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const WEATHER_RETRY_MS = 10 * 60 * 1000;
const WEATHER_MAX_NORMAL_PLACES = 40;
let weatherCache = null;
const weatherLoading = new Set();
const weatherFailedAt = {};

// Værkoder fra WMO, som Open-Meteo bruker
function weatherCodeInfo(code) {
  const c = Number(code);
  if (c === 0) return { text: "Klart", icon: "sun" };
  if (c === 1) return { text: "Stort sett klart", icon: "cloud-sun" };
  if (c === 2) return { text: "Delvis skyet", icon: "cloud-sun" };
  if (c === 3) return { text: "Overskyet", icon: "cloud" };
  if (c === 45 || c === 48) return { text: "Tåke", icon: "cloud-fog" };
  if (c >= 51 && c <= 57) return { text: "Yr", icon: "cloud-drizzle" };
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { text: "Regn", icon: "cloud-rain" };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { text: "Snø", icon: "cloud-snow" };
  if (c >= 95 && c <= 99) return { text: "Torden", icon: "cloud-lightning" };
  return { text: "", icon: "cloud" };
}

// Hva slags vær en dato får: "forecast", "normal" eller "" (tidligere dager)
function weatherKindForDate(date, today) {
  if (!isIsoDate(date) || !isIsoDate(today)) return "";
  const diff = isoDiffDays(today, date);
  if (diff < 0) return "";
  return diff < WEATHER_FORECAST_DAYS ? "forecast" : "normal";
}

// Første dag værmeldingen for datoen finnes
function weatherForecastFrom(date) {
  return isoAddDays(date, -(WEATHER_FORECAST_DAYS - 1));
}

// Stedet for dagen: overnattingen, ellers stoppet man er på. Må ha gyldige koordinater.
function weatherPlaceForDay(info) {
  const stop = (info && (info.night || info.here)) || null;
  if (!stop) return null;
  const lat = Number(stop.lat), lng = Number(stop.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  // Avrundet til 0,1° (ca. 10 km): færre oppslag, samme vær
  const rlat = Math.round(lat * 10) / 10, rlng = Math.round(lng * 10) / 10;
  return { key: `${rlat.toFixed(1)},${rlng.toFixed(1)}`, lat: rlat, lng: rlng, city: String(stop.city || "") };
}

// Svar fra værmeldingen → { "ÅÅÅÅ-MM-DD": { code, max, min, rain } }
function parseWeatherForecast(json) {
  const d = (json && json.daily) || {};
  const out = {};
  (Array.isArray(d.time) ? d.time : []).forEach((date, i) => {
    const maxRaw = d.temperature_2m_max && d.temperature_2m_max[i];
    const minRaw = d.temperature_2m_min && d.temperature_2m_min[i];
    if (maxRaw === null || minRaw === null) return;
    const max = Number(maxRaw), min = Number(minRaw);
    if (!isIsoDate(date) || !Number.isFinite(max) || !Number.isFinite(min)) return;
    const rainRaw = d.precipitation_probability_max && d.precipitation_probability_max[i];
    const rain = rainRaw === null || rainRaw === undefined ? null : Number(rainRaw);
    out[date] = {
      code: Number(d.weather_code && d.weather_code[i]),
      max: Math.round(max),
      min: Math.round(min),
      rain: Number.isFinite(rain) ? Math.round(rain) : null
    };
  });
  return out;
}

// Dag i året (0–365) i et skuddår, så 29. februar får egen plass
function weatherDayIndex(mmdd) {
  const d = new Date(`2024-${mmdd}T00:00:00Z`);
  return Math.round((d - Date.UTC(2024, 0, 1)) / 86400000);
}

// Historikk (flere år, daglig) → normalvær per dag i året:
// { "MM-DD": [snitt høyeste, snitt laveste, % dager med minst 1 mm nedbør] }
function computeWeatherNormals(json, windowDays = WEATHER_NORMAL_WINDOW) {
  const d = (json && json.daily) || {};
  const buckets = Array.from({ length: 366 }, () => ({ max: 0, min: 0, n: 0, wet: 0, p: 0 }));
  (Array.isArray(d.time) ? d.time : []).forEach((date, i) => {
    if (!isIsoDate(date)) return;
    const maxRaw = d.temperature_2m_max && d.temperature_2m_max[i];
    const minRaw = d.temperature_2m_min && d.temperature_2m_min[i];
    if (maxRaw === null || minRaw === null) return;
    const max = Number(maxRaw), min = Number(minRaw);
    if (!Number.isFinite(max) || !Number.isFinite(min)) return;
    const b = buckets[weatherDayIndex(date.slice(5))];
    b.max += max; b.min += min; b.n++;
    const precip = d.precipitation_sum && d.precipitation_sum[i];
    if (precip !== null && precip !== undefined && Number.isFinite(Number(precip))) {
      b.p++;
      if (Number(precip) >= 1) b.wet++;
    }
  });
  const out = {};
  for (let idx = 0; idx < 366; idx++) {
    let max = 0, min = 0, n = 0, wet = 0, p = 0;
    for (let k = -windowDays; k <= windowDays; k++) {
      const b = buckets[(idx + k + 366) % 366];
      max += b.max; min += b.min; n += b.n; wet += b.wet; p += b.p;
    }
    if (!n) continue;
    const date = new Date(Date.UTC(2024, 0, 1) + idx * 86400000).toISOString().slice(5, 10);
    out[date] = [Math.round(max / n), Math.round(min / n), p ? Math.round(wet / p * 100) : null];
  }
  return out;
}

// Normalvær for en dato, eller null
function weatherNormalFor(normals, date) {
  const v = normals && normals[String(date || "").slice(5, 10)];
  if (!Array.isArray(v)) return null;
  return { max: v[0], min: v[1], rainPct: v[2] };
}

// «regn omtrent 3 av 10 dager»
function weatherRainDaysText(pct) {
  if (pct === null || pct === undefined || !Number.isFinite(Number(pct))) return "";
  const tenths = Math.round(Number(pct) / 10);
  if (tenths <= 0) return "sjelden regn";
  if (tenths >= 10) return "regn nesten hver dag";
  return `regn omtrent ${tenths} av 10 dager`;
}

function formatTemp(v) {
  const n = Math.round(Number(v));
  return `${n < 0 ? "−" + Math.abs(n) : n}°`;
}

// ---------------------------------------------------------------- lagring

function loadWeatherCache() {
  if (weatherCache) return weatherCache;
  try { weatherCache = JSON.parse(localStorage.getItem(WEATHER_STORAGE_KEY) || "null"); } catch (e) { weatherCache = null; }
  if (!weatherCache || typeof weatherCache !== "object") weatherCache = {};
  if (!weatherCache.forecast || typeof weatherCache.forecast !== "object") weatherCache.forecast = {};
  if (!weatherCache.normals || typeof weatherCache.normals !== "object") weatherCache.normals = {};
  return weatherCache;
}

function saveWeatherCache() {
  const c = loadWeatherCache();
  const now = Date.now();
  // Rydd: gamle værmeldinger, og bare de nyeste stedene med normalvær
  Object.keys(c.forecast).forEach(k => { if (now - (c.forecast[k].fetchedAt || 0) > 2 * 86400000) delete c.forecast[k]; });
  const normalKeys = Object.keys(c.normals).sort((a, b) => (c.normals[b].fetchedAt || 0) - (c.normals[a].fetchedAt || 0));
  normalKeys.slice(WEATHER_MAX_NORMAL_PLACES).forEach(k => delete c.normals[k]);
  try { localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(c)); } catch (e) { /* fullt */ }
}

// Været for en dag fra det som er lagret: { kind, place, forecast | normal } eller null
function weatherForDay(info, today) {
  const kind = weatherKindForDate(info && info.date, today);
  if (!kind) return null;
  const place = weatherPlaceForDay(info);
  if (!place) return null;
  const c = loadWeatherCache();
  if (kind === "forecast") {
    const f = c.forecast[place.key];
    const day = f && f.days && f.days[info.date];
    return day ? { kind, place, forecast: day } : null;
  }
  const n = c.normals[place.key];
  const normal = n ? weatherNormalFor(n.days, info.date) : null;
  return normal ? { kind, place, normal, years: n.years || "" } : null;
}

// ---------------------------------------------------------------- henting

async function fetchWeatherForecast(place) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lng}`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=${WEATHER_FORECAST_DAYS}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Værmelding: HTTP " + r.status);
  const days = parseWeatherForecast(await r.json());
  if (!Object.keys(days).length) throw new Error("Værmelding: tomt svar");
  loadWeatherCache().forecast[place.key] = { fetchedAt: Date.now(), days };
}

async function fetchWeatherNormals(place) {
  const lastYear = new Date().getUTCFullYear() - 1;
  const firstYear = lastYear - WEATHER_NORMAL_YEARS + 1;
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${place.lat}&longitude=${place.lng}`
    + `&start_date=${firstYear}-01-01&end_date=${lastYear}-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Normalvær: HTTP " + r.status);
  const days = computeWeatherNormals(await r.json());
  if (!Object.keys(days).length) throw new Error("Normalvær: tomt svar");
  loadWeatherCache().normals[place.key] = { fetchedAt: Date.now(), years: `${firstYear}–${lastYear}`, days };
}

// Hent det som mangler for dagene som vises, og tegn på nytt når noe nytt har kommet
function queueWeatherFetch(infos, today) {
  if (typeof fetch !== "function") return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const c = loadWeatherCache();
  const now = Date.now();
  const jobs = new Map();
  (infos || []).forEach(info => {
    const kind = weatherKindForDate(info.date, today);
    const place = kind ? weatherPlaceForDay(info) : null;
    if (!place) return;
    const id = kind + ":" + place.key;
    if (jobs.has(id) || weatherLoading.has(id)) return;
    if (weatherFailedAt[id] && now - weatherFailedAt[id] < WEATHER_RETRY_MS) return;
    const entry = kind === "forecast" ? c.forecast[place.key] : c.normals[place.key];
    const maxAge = kind === "forecast" ? WEATHER_FORECAST_MAX_AGE_MS : WEATHER_NORMAL_MAX_AGE_MS;
    if (entry && now - (entry.fetchedAt || 0) < maxAge) return;
    jobs.set(id, { kind, place });
  });
  if (!jobs.size) return;
  const tasks = [...jobs.entries()].map(([id, job]) => {
    weatherLoading.add(id);
    return (job.kind === "forecast" ? fetchWeatherForecast(job.place) : fetchWeatherNormals(job.place))
      .then(() => { delete weatherFailedAt[id]; return true; })
      .catch(() => { weatherFailedAt[id] = Date.now(); return false; }) // uten nett eller tjenesten nede: vis bare uten vær
      .finally(() => weatherLoading.delete(id));
  });
  Promise.all(tasks).then(results => {
    if (!results.some(Boolean)) return;
    saveWeatherCache();
    refreshWeatherViews();
  });
}

function refreshWeatherViews() {
  if (typeof document === "undefined") return;
  // Ikke tegn dagsplanen på nytt midt i skrivingen av en ny aktivitet
  const active = document.activeElement;
  const typing = active && active.closest && active.closest("#plan-days form");
  if (!typing) renderDayPlan();
  renderOverviewDayCard();
  applyEditMode();
  if (window.lucide) lucide.createIcons();
}

// ---------------------------------------------------------------- visning

// Rad i dagskortet (samme oppsett som tog- og overnattingsradene)
function weatherRowHtml(info, today) {
  const w = weatherForDay(info, today);
  if (!w) return "";
  // Stedet står allerede i overskriften når dagen er på ett sted
  const where = w.place.city && w.place.city !== info.place ? ` i ${escapeHtml(w.place.city)}` : "";
  if (w.kind === "forecast") {
    const f = w.forecast;
    const ci = weatherCodeInfo(f.code);
    const rain = f.rain !== null && f.rain !== undefined ? `${Number(f.rain)} % sjanse for nedbør` : "";
    return `
      <div class="flex items-start gap-2.5" data-weather="forecast">
        ${planRowIcon(ci.icon, "bg-sky-50 text-sky-700")}
        <div class="min-w-0 flex-1">
          <p class="text-sm text-slate-900"><span class="font-semibold tabular-nums">${formatTemp(f.max)} / ${formatTemp(f.min)}</span>${ci.text ? ` ${escapeHtml(ci.text)}` : ""}${where}</p>
          <p class="text-xs text-slate-500 mt-0.5">Værmelding${rain ? ` · ${rain}` : ""}</p>
        </div>
      </div>`;
  }
  const n = w.normal;
  const rain = weatherRainDaysText(n.rainPct);
  return `
    <div class="flex items-start gap-2.5" data-weather="normal">
      ${planRowIcon("thermometer", "bg-slate-100 text-slate-500")}
      <div class="min-w-0 flex-1">
        <p class="text-sm text-slate-900">Vanligvis <span class="font-semibold tabular-nums">${formatTemp(n.max)} / ${formatTemp(n.min)}</span>${where}${rain ? `, ${rain}` : ""}</p>
        <p class="text-xs text-slate-500 mt-0.5">Vanlig vær for årstiden, ikke værmelding. Værmeldingen kommer ${planDateLabel(weatherForecastFrom(info.date), false)}.</p>
      </div>
    </div>`;
}

// Forklaring og kreditering under dagsplanen når noen dager viser vær
function weatherNoteHtml(infos, today) {
  const shown = (infos || []).map(info => weatherForDay(info, today)).filter(Boolean);
  if (!shown.length) return "";
  const normal = shown.find(w => w.kind === "normal");
  const explain = normal
    ? `Vær mer enn ${WEATHER_FORECAST_DAYS} dager fram er det som er vanlig for årstiden${normal.years ? ` (snitt for ${escapeHtml(normal.years)})` : ""}, ikke en værmelding. Hver dag får ekte værmelding ${WEATHER_FORECAST_DAYS} dager før. `
    : "";
  return `
    <p class="text-xs text-slate-500 pt-1 flex items-start gap-1.5">
      <i data-lucide="info" class="w-3.5 h-3.5 mt-px shrink-0 text-slate-400" aria-hidden="true"></i>
      <span>${explain}Værdata fra <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" class="underline hover:text-slate-700">Open-Meteo</a>.</span>
    </p>`;
}

// Kort linje til «I dag»-kortet på oversikten
function weatherTodayLineHtml(info, today) {
  const w = weatherForDay(info, today);
  if (!w || w.kind !== "forecast") return "";
  const ci = weatherCodeInfo(w.forecast.code);
  const rain = w.forecast.rain !== null && w.forecast.rain !== undefined && w.forecast.rain >= 30 ? ` · ${Number(w.forecast.rain)} % sjanse for nedbør` : "";
  return `<li class="flex items-center gap-2 min-w-0">${planRowIcon(ci.icon, "bg-sky-50 text-sky-700")}<span class="text-sm text-slate-900 truncate"><span class="font-semibold tabular-nums">${formatTemp(w.forecast.max)} / ${formatTemp(w.forecast.min)}</span>${ci.text ? ` ${escapeHtml(ci.text)}` : ""}${rain}</span></li>`;
}
