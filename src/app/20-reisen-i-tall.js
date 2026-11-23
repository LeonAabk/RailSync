// =============================================================================
// REISEN I TALL – kilometer, timer på tog, land, CO₂ og dyreste dag,
// som kort på oversikten og som bilde som kan deles
// =============================================================================

const RAIL_DETOUR = 1.2;     // jernbanen går ikke i rett linje
const CO2_FLY_KG_KM = 0.2;   // anslag per person og km, kortdistansefly
const CO2_TRAIN_KG_KM = 0.03; // anslag per person og km, tog i Europa

function kmBetween(a, b) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function trainMinutes(t) {
  if (Number(t.durationSec) > 0) return Math.round(Number(t.durationSec) / 60);
  const m = String(t.duration || "").match(/(?:(\d+)\s*[th])?\s*(?:(\d+)\s*m)?/i);
  if (m && (m[1] || m[2])) return (Number(m[1]) || 0) * 60 + (Number(m[2]) || 0);
  const p = s => { const x = String(s || "").match(/^(\d{1,2}):(\d{2})/); return x ? Number(x[1]) * 60 + Number(x[2]) : null; };
  const d = p(t.departureTime), a = p(t.arrivalTime);
  if (d === null || a === null) return 0;
  return a >= d ? a - d : a + 1440 - d;
}

export function computeTripStats() {
  const stops = (appState.stops || []).filter(s => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)));
  let km = 0;
  for (let i = 1; i < stops.length; i++) km += kmBetween([Number(stops[i - 1].lat), Number(stops[i - 1].lng)], [Number(stops[i].lat), Number(stops[i].lng)]);
  km = Math.round(km * RAIL_DETOUR);
  const trains = appState.trains || [];
  const minutes = trains.reduce((a, t) => a + trainMinutes(t), 0);
  const longest = trains.reduce((best, t) => (trainMinutes(t) > (best ? trainMinutes(best) : 0) ? t : best), null);
  const countries = new Set((appState.stops || []).map(s => {
    const info = countryInfoFor(s.country);
    return info ? info.code : String(s.country || "").trim().toLowerCase();
  }).filter(Boolean));
  const cities = new Set((appState.stops || []).map(s => String(s.city || "").trim().toLowerCase()).filter(Boolean));
  const { start, end } = planTripRange();
  const days = start && end ? isoDiffDays(start, end) + 1 : 0;
  const byDay = {};
  (appState.expenses || []).forEach(e => { if (e.date) byDay[e.date] = (byDay[e.date] || 0) + (Number(e.amount) || 0); });
  const priciest = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0] || null;
  const nightTrains = trains.filter(t => /night|nattog|nightjet|\bnj\b|euronight|\ben\b/i.test(`${t.trainType || ""} ${t.trainNumber || ""}`)).length;
  return {
    km,
    co2SavedKg: Math.round(km * (CO2_FLY_KG_KM - CO2_TRAIN_KG_KM)),
    trainHours: Math.round(minutes / 6) / 10,
    trains: trains.length,
    nightTrains,
    longest: longest && trainMinutes(longest) > 0 ? { from: longest.fromCity, to: longest.toCity, minutes: trainMinutes(longest) } : null,
    countries: countries.size,
    cities: cities.size,
    days,
    priciest: priciest ? { date: priciest[0], amount: priciest[1] } : null,
    title: (appState.trip && appState.trip.title) || "Min reise"
  };
}

const fmtInt = n => Math.round(Number(n) || 0).toLocaleString("nb-NO");
const fmtHours = m => { const h = Math.floor(m / 60), mm = m % 60; return h ? `${h} t${mm ? ` ${mm} min` : ""}` : `${mm} min`; };

export function renderTripStats() {
  const el = document.getElementById("trip-stats-card");
  if (!el) return;
  const s = computeTripStats();
  if (!s.cities) { el.classList.add("hidden"); el.innerHTML = ""; return; }
  el.classList.remove("hidden");
  const today = todayISO();
  const { end } = planTripRange();
  const done = end && today > end;
  const tile = (icon, chip, value, label) => `
    <div class="min-w-0">
      <span class="w-8 h-8 rounded-lg ${chip} flex items-center justify-center mb-2" aria-hidden="true"><i data-lucide="${icon}" class="w-4 h-4"></i></span>
      <p class="text-lg sm:text-xl font-bold text-slate-900 tabular-nums truncate">${value}</p>
      <p class="text-[11px] text-slate-500 truncate">${label}</p>
    </div>`;
  const facts = [];
  if (s.longest) facts.push(`Lengste togtur: <span class="font-semibold text-slate-900">${escapeHtml(s.longest.from || "")} → ${escapeHtml(s.longest.to || "")}</span> (${fmtHours(s.longest.minutes)})`);
  if (s.nightTrains) facts.push(`${s.nightTrains} ${s.nightTrains === 1 ? "nattog" : "nattog"}`);
  if (s.priciest) facts.push(`Dyreste dag: <span class="font-semibold text-slate-900">${formatDate(s.priciest.date)}</span> (${formatMoney(s.priciest.amount)})`);
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <span class="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0" aria-hidden="true"><i data-lucide="bar-chart-3" class="w-5 h-5"></i></span>
        <div class="min-w-0">
          <h2 class="text-sm sm:text-base font-bold text-slate-900">Reisen i tall</h2>
          <p class="text-xs text-slate-500 truncate">${done ? "Slik ble turen" : "Slik blir turen etter planen"}</p>
        </div>
      </div>
      <button type="button" data-onclick="shareTripStats()" class="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-fjord-800 hover:bg-fjord-700 px-3 py-1.5 rounded-lg transition"><i data-lucide="share-2" class="w-3.5 h-3.5"></i>Del som bilde</button>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
      ${tile("route", "bg-brand-50 text-brand-700", `ca. ${fmtInt(s.km)} km`, "med tog")}
      ${tile("clock", "bg-violet-50 text-violet-700", s.trainHours ? `${s.trainHours.toLocaleString("nb-NO")} t` : "–", `på tog (${s.trains} ${s.trains === 1 ? "tur" : "turer"})`)}
      ${tile("flag", "bg-amber-50 text-amber-700", `${s.countries} land`, `${s.cities} byer · ${s.days || "–"} dager`)}
      ${tile("leaf", "bg-emerald-50 text-emerald-700", `ca. ${fmtInt(s.co2SavedKg)} kg`, "CO₂ spart mot fly")}
    </div>
    ${facts.length ? `<p class="text-xs text-slate-600 mt-4 leading-relaxed">${facts.join(" · ")}</p>` : ""}
    <p class="text-[11px] text-slate-500 mt-2">Kilometer er beregnet langs ruten. CO₂ er et anslag: fly ca. 200 g og tog ca. 30 g per person og km.</p>`;
}

// Tegner et delbart bilde (1080 × 1350, passer Instagram)
export function drawTripStatsImage() {
  const s = computeTripStats();
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const font = (w, px) => `${w} ${px}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0f4c4a"); bg.addColorStop(1, "#082b2a");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // rute-strek
  g.strokeStyle = "rgba(167, 211, 204, 0.18)"; g.lineWidth = 6; g.setLineDash([2, 22]); g.lineCap = "round";
  g.beginPath(); g.moveTo(-40, 1180); g.bezierCurveTo(300, 900, 700, 1300, 1140, 980); g.stroke(); g.setLineDash([]);
  g.fillStyle = "#a7d3cc"; g.font = font(700, 34);
  g.fillText("REISEN I TALL", 90, 140);
  g.fillStyle = "#ffffff"; g.font = font(800, 68);
  const title = s.title.length > 26 ? s.title.slice(0, 25) + "…" : s.title;
  g.fillText(title, 90, 225);
  const cities = (appState.stops || []).map(x => String(x.city || "").trim()).filter(Boolean);
  g.fillStyle = "#d5ebe7"; g.font = font(500, 30);
  let route = cities.join(" → ");
  while (g.measureText(route).width > W - 180 && route.length > 4) route = route.slice(0, -2);
  if (route !== cities.join(" → ")) route = route.trimEnd() + "…";
  g.fillText(route, 90, 280);
  const tiles = [
    [`${fmtInt(s.km)} km`, "med tog"],
    [s.trainHours ? `${s.trainHours.toLocaleString("nb-NO")} timer` : "–", "på tog"],
    [`${s.countries} land`, `${s.cities} byer`],
    [`${s.days || "–"} dager`, "på reise"],
    [`${fmtInt(s.co2SavedKg)} kg`, "CO₂ spart mot fly"],
    [`${s.trains}`, s.trains === 1 ? "togtur" : "togturer"]
  ];
  tiles.forEach(([v, l], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 90 + col * 470, y = 360 + row * 230;
    g.fillStyle = "rgba(255,255,255,0.08)";
    if (g.roundRect) { g.beginPath(); g.roundRect(x, y, 430, 200, 28); g.fill(); } else g.fillRect(x, y, 430, 200);
    g.fillStyle = "#ffffff"; g.font = font(800, 60);
    let vv = v; while (g.measureText(vv).width > 380 && vv.length > 2) vv = vv.slice(0, -1);
    g.fillText(vv, x + 34, y + 105);
    g.fillStyle = "#a7d3cc"; g.font = font(600, 30);
    g.fillText(l, x + 34, y + 155);
  });
  g.fillStyle = "#d5ebe7"; g.font = font(500, 28);
  if (s.longest) {
    let t = `Lengste togtur: ${s.longest.from} → ${s.longest.to} (${fmtHours(s.longest.minutes)})`;
    while (g.measureText(t).width > W - 180 && t.length > 4) t = t.slice(0, -2);
    g.fillText(t, 90, 1100);
  }
  g.fillStyle = "#ffffff"; g.font = font(800, 36);
  g.fillText("RailSync", 90, 1260);
  g.fillStyle = "#7fb8af"; g.font = font(500, 26);
  g.fillText("aabakstudio.com/RailSync", 90, 1300);
  return c;
}

export async function shareTripStats() {
  const canvas = drawTripStatsImage();
  const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
  if (!blob) return;
  const name = `${String((appState.trip && appState.trip.title) || "reisen").replace(/[^\wæøåÆØÅ-]+/g, "-").slice(0, 40)}-i-tall.png`;
  const file = typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null;
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Reisen i tall" });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  showToast("Bildet er lastet ned", "Del det der du vil, for eksempel på Instagram.", "image");
}
