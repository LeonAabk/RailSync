// =============================================================================
// DAGSPLAN – én rad per dag på reisen: tog, overnatting og egne aktiviteter
// =============================================================================
// Aktivitetene lagres i reisen som appState.dayPlan = [{ id, date, time, text, done }]
// og synkes og slås sammen med reisefølget på samme måte som pakkelisten.

const PLAN_WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const PLAN_MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
const PLAN_MAX_DAYS = 180;
let planShowPastDays = false;
let planRenderedDay = "";

const isIsoDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

function planDateLabel(iso, withWeekday = true) {
  const d = new Date(iso + "T00:00:00Z");
  const txt = `${d.getUTCDate()}. ${PLAN_MONTHS[d.getUTCMonth()]}`;
  return withWeekday ? `${PLAN_WEEKDAYS[d.getUTCDay()]} ${txt}` : txt;
}

function planWeekdayShort(iso) {
  return PLAN_WEEKDAYS[new Date(iso + "T00:00:00Z").getUTCDay()].slice(0, 3);
}

// Første og siste dag: reisens datoer, ellers fra stoppene
function planTripRange() {
  const trip = appState.trip || {};
  const stops = appState.stops || [];
  const arrivals = stops.map(s => s.arrival).filter(isIsoDate).sort();
  const departures = stops.map(s => s.departure).filter(isIsoDate).sort();
  const start = isIsoDate(trip.startDate) ? trip.startDate : (arrivals[0] || "");
  let end = isIsoDate(trip.endDate) ? trip.endDate : (departures[departures.length - 1] || arrivals[arrivals.length - 1] || "");
  if (start && end && end < start) end = start;
  return { start, end };
}

// Alle datoer i planen: hele reiseperioden + datoer med tog eller aktiviteter utenfor den
function planDates() {
  const { start, end } = planTripRange();
  const set = new Set();
  if (start) {
    const last = end || start;
    for (let d = start, i = 0; d <= last && i < PLAN_MAX_DAYS; d = isoAddDays(d, 1), i++) set.add(d);
  }
  (appState.trains || []).forEach(t => { if (isIsoDate(t.date)) set.add(t.date); });
  (appState.dayPlan || []).forEach(p => { if (isIsoDate(p.date)) set.add(p.date); });
  return [...set].sort();
}

function planDayInfo(date) {
  const stops = appState.stops || [];
  const trains = (appState.trains || []).filter(t => t.date === date)
    .sort((a, b) => String(a.departureTime || "").localeCompare(String(b.departureTime || "")));
  const items = (appState.dayPlan || []).filter(p => p.date === date)
    .sort((a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || String(a.time || "").localeCompare(String(b.time || "")));
  // Natten etter denne dagen: stoppet der man kommer før eller samme dag og drar senere
  const night = stops.find(s => isIsoDate(s.arrival) && isIsoDate(s.departure) && s.arrival <= date && date < s.departure) || null;
  const here = night || stops.find(s => isIsoDate(s.arrival) && s.arrival <= date && (!isIsoDate(s.departure) || date <= s.departure)) || null;
  let place = "";
  if (trains.length) {
    const first = trains[0], last = trains[trains.length - 1];
    place = `${first.fromCity || "?"} → ${last.toCity || "?"}`;
  } else if (here) {
    place = here.city || "";
  }
  return { date, trains, items, night, place };
}

function planTrainResBadge(train) {
  if (train.reservationStatus === "confirmed") return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/80">Reservert</span>`;
  if (train.reservationStatus === "required") return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/80">Må reserveres</span>`;
  return "";
}

function planAccommodationBadge(stop) {
  const s = String(stop.accommodationStatus || "");
  if (!s) return "";
  const style = s.includes("Bestilt") ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
    : s.includes("Ser etter") ? "bg-amber-50 text-amber-800 border-amber-200/80"
    : "bg-slate-100 text-slate-600 border-slate-200";
  return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded border ${style}">${escapeHtml(s)}</span>`;
}

function planRowIcon(icon, cls) {
  return `<span class="w-7 h-7 rounded-lg ${cls} flex items-center justify-center shrink-0" aria-hidden="true"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i></span>`;
}

function planDayCardHtml(info, dayNo, today, { compact = false } = {}) {
  const isToday = info.date === today;
  const isPast = info.date < today;
  const { end } = planTripRange();
  const d = new Date(info.date + "T00:00:00Z");
  const trainsHtml = info.trains.map(t => `
      <div class="flex items-start gap-2.5">
        ${planRowIcon("train-front", "bg-sky-50 text-sky-700")}
        <div class="min-w-0 flex-1">
          <p class="text-sm text-slate-900"><span class="font-semibold tabular-nums">${escapeHtml(t.departureTime || "–")}</span> ${escapeHtml(t.fromCity || "")} → ${escapeHtml(t.toCity || "")}${t.arrivalTime ? ` <span class="text-slate-500 tabular-nums">(fremme ${escapeHtml(t.arrivalTime)})</span>` : ""}</p>
          <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
            ${t.trainNumber ? `<span class="text-xs text-slate-500">${escapeHtml(t.trainNumber)}</span>` : ""}
            ${planTrainResBadge(t)}
          </div>
        </div>
      </div>`).join("");
  let nightHtml = "";
  if (info.night) {
    nightHtml = `
      <div class="flex items-start gap-2.5">
        ${planRowIcon("bed", "bg-violet-50 text-violet-700")}
        <div class="min-w-0 flex-1">
          <p class="text-sm text-slate-900 flex items-center gap-1.5 flex-wrap"><span>Overnatting i ${escapeHtml(info.night.city || "")}</span>${planAccommodationBadge(info.night)}</p>
          ${info.night.accommodationNote ? `<p class="text-xs text-slate-500 mt-0.5 truncate">${escapeHtml(info.night.accommodationNote)}</p>` : ""}
        </div>
      </div>`;
  } else if (!compact && dayNo && end && info.date < end) {
    nightHtml = `
      <div class="flex items-center gap-2.5">
        ${planRowIcon("bed", "bg-slate-100 text-slate-500")}
        <p class="text-sm text-slate-500">Ingen overnatting lagt inn for natten</p>
      </div>`;
  }
  const itemsHtml = info.items.map(p => `
      <div class="flex items-center gap-2.5 group">
        <button type="button" onclick="toggleDayPlanItem(${jsArg(p.id)})" class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${p.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}" aria-label="${p.done ? "Marker som ikke gjort" : "Marker som gjort"}: ${escapeHtml(p.text || "")}" aria-pressed="${p.done ? "true" : "false"}">
          <i data-lucide="${p.done ? "check" : "map-pin"}" class="w-3.5 h-3.5"></i>
        </button>
        <p class="min-w-0 flex-1 text-sm ${p.done ? "text-slate-500 line-through" : "text-slate-900"}">${p.time ? `<span class="font-semibold tabular-nums">${escapeHtml(p.time)}</span> ` : ""}${escapeHtml(p.text || "")}</p>
        <button type="button" onclick="deleteDayPlanItem(${jsArg(p.id)})" class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0 transition" aria-label="Slett ${escapeHtml(p.text || "aktivitet")}"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
      </div>`).join("");
  const addForm = compact ? "" : `
      <form onsubmit="handleAddDayPlanItem(event, ${jsArg(info.date)})" class="flex items-center gap-1.5 pt-1">
        <label class="sr-only" for="plan-time-${info.date}">Klokkeslett</label>
        <input id="plan-time-${info.date}" name="time" type="time" class="w-[5.5rem] shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500">
        <label class="sr-only" for="plan-text-${info.date}">Ny aktivitet</label>
        <input id="plan-text-${info.date}" name="text" type="text" maxlength="140" required placeholder="Ny aktivitet" class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500">
        <button type="submit" class="w-8 h-8 rounded-lg bg-fjord-800 hover:bg-fjord-700 text-white flex items-center justify-center shrink-0 transition" aria-label="Legg til aktivitet"><i data-lucide="plus" class="w-4 h-4"></i></button>
      </form>`;
  const empty = !info.trains.length && !nightHtml && !info.items.length
    ? `<p class="text-sm text-slate-500">${compact ? "Ingenting planlagt i dag ennå." : "Ingenting planlagt ennå."}</p>` : "";
  return `
    <article id="plan-day-${info.date}" data-plan-date="${info.date}"${compact ? " data-plan-extra" : ""} class="bg-white rounded-2xl border ${isToday ? "border-brand-300 ring-2 ring-brand-100" : "border-slate-200/90"} shadow-2xs p-4 sm:p-5 ${isPast && !isToday ? "opacity-80" : ""}">
      <header class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl ${isToday ? "bg-brand-600 text-white" : "bg-sand-200 text-slate-800"} flex flex-col items-center justify-center shrink-0 leading-none" aria-hidden="true">
          <span class="text-[10px] font-semibold uppercase">${planWeekdayShort(info.date)}</span>
          <span class="text-base font-bold mt-0.5">${d.getUTCDate()}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold text-slate-500">${dayNo ? `Dag ${dayNo}` : "Utenfor reiseperioden"}${info.place ? ` · <span class="text-slate-700">${escapeHtml(info.place)}</span>` : ""}</p>
          <h3 class="text-sm sm:text-base font-bold text-slate-900 first-letter:uppercase">${planDateLabel(info.date)}</h3>
        </div>
        ${isToday ? `<span class="text-[11px] font-bold px-2 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200 shrink-0">I dag</span>` : ""}
      </header>
      <div class="mt-3 space-y-2.5">
        ${trainsHtml}${nightHtml}${itemsHtml}${empty}${addForm}
      </div>
    </article>`;
}

export function renderDayPlan() {
  const list = document.getElementById("plan-days");
  if (!list) return;
  const today = todayISO();
  const { start, end } = planTripRange();
  const allDates = planDates();
  const inTrip = d => !start || (d >= start && d <= (end || start));
  const dates = allDates.filter(inTrip);
  const extraDates = allDates.filter(d => !inTrip(d));
  const subtitle = document.getElementById("plan-subtitle");
  const pastToggle = document.getElementById("plan-past-toggle");
  const itemsCount = (appState.dayPlan || []).length;
  if (subtitle) {
    subtitle.textContent = !dates.length ? "Tog, overnatting og aktiviteter for hver dag."
      : `${dates.length} ${dates.length === 1 ? "dag" : "dager"}${itemsCount ? ` · ${itemsCount} ${itemsCount === 1 ? "aktivitet" : "aktiviteter"}` : ""}`;
  }
  if (!allDates.length) {
    if (pastToggle) pastToggle.classList.add("hidden");
    list.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs px-5 py-10 text-center">
        <span class="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto" aria-hidden="true"><i data-lucide="calendar-days" class="w-5 h-5"></i></span>
        <p class="text-sm font-medium text-slate-900 mt-3">Sett datoer for reisen</p>
        <p class="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Når reisen har start- og sluttdato, får du én plan per dag med tog, overnatting og det dere skal gjøre.</p>
        <button type="button" onclick="openTripSettingsModal()" class="mt-4 px-4 py-2 rounded-lg bg-fjord-800 hover:bg-fjord-700 text-white text-sm font-semibold transition">Sett datoer</button>
      </div>`;
    return;
  }
  const onTrip = start && today >= start && (!end || today <= end);
  const pastDates = onTrip ? dates.filter(d => d < today) : [];
  if (pastToggle) {
    pastToggle.classList.toggle("hidden", pastDates.length === 0);
    pastToggle.textContent = planShowPastDays ? "Skjul tidligere dager" : `Vis tidligere dager (${pastDates.length})`;
    pastToggle.setAttribute("aria-expanded", planShowPastDays ? "true" : "false");
  }
  const shown = onTrip && !planShowPastDays ? dates.filter(d => d >= today) : dates;
  const extraHtml = extraDates.length ? `
    <div class="pt-3">
      <h3 class="text-sm font-semibold text-slate-700">Utenfor reisedatoene</h3>
      <p class="text-xs text-slate-500 mt-0.5">Tog og aktiviteter med en dato før eller etter reisen. Endre datoen deres, eller reisens datoer, hvis de hører til turen.</p>
    </div>
    ${extraDates.map(date => planDayCardHtml(planDayInfo(date), 0, today, { compact: true })).join("")}` : "";
  list.innerHTML = shown.map(date => {
    const dayNo = start && date >= start && (!end || date <= end) ? isoDiffDays(start, date) + 1 : 0;
    return planDayCardHtml(planDayInfo(date), dayNo, today);
  }).join("") + extraHtml;
}

// Kort på oversikten: «I dag» under reisen, ellers en snarvei til dagsplanen
export function renderOverviewDayCard() {
  const el = document.getElementById("overview-day-card");
  if (!el) return;
  const today = todayISO();
  planRenderedDay = today;
  const { start, end } = planTripRange();
  const dates = planDates().filter(d => !start || (d >= start && d <= (end || start)));
  if (!dates.length) { el.classList.add("hidden"); el.innerHTML = ""; return; }
  el.classList.remove("hidden");
  const onTrip = start && today >= start && (!end || today <= end);
  if (onTrip) {
    const info = planDayInfo(today);
    const nextTrain = info.trains.find(t => !t.departureTime || t.departureTime >= new Date().toTimeString().slice(0, 5)) || info.trains[0];
    const openItems = info.items.filter(p => !p.done);
    const lines = [];
    if (nextTrain) lines.push(`<li class="flex items-center gap-2 min-w-0">${planRowIcon("train-front", "bg-sky-50 text-sky-700")}<span class="text-sm text-slate-900 truncate"><span class="font-semibold tabular-nums">${escapeHtml(nextTrain.departureTime || "–")}</span> ${escapeHtml(nextTrain.fromCity || "")} → ${escapeHtml(nextTrain.toCity || "")}</span></li>`);
    if (info.night) lines.push(`<li class="flex items-center gap-2 min-w-0">${planRowIcon("bed", "bg-violet-50 text-violet-700")}<span class="text-sm text-slate-900 truncate">Overnatting i ${escapeHtml(info.night.city || "")}</span>${planAccommodationBadge(info.night)}</li>`);
    openItems.slice(0, 3).forEach(p => lines.push(`<li class="flex items-center gap-2 min-w-0">${planRowIcon("map-pin", "bg-amber-50 text-amber-700")}<span class="text-sm text-slate-900 truncate">${p.time ? `<span class="font-semibold tabular-nums">${escapeHtml(p.time)}</span> ` : ""}${escapeHtml(p.text || "")}</span></li>`));
    const more = openItems.length > 3 ? `<p class="text-xs text-slate-500 mt-2">+ ${openItems.length - 3} til</p>` : "";
    el.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0" aria-hidden="true"><i data-lucide="calendar-days" class="w-5 h-5"></i></span>
          <div class="min-w-0">
            <h2 class="text-sm sm:text-base font-bold text-slate-900">I dag</h2>
            <p class="text-xs text-slate-500 truncate first-letter:uppercase">${planDateLabel(today)}${info.place ? ` · ${escapeHtml(info.place)}` : ""}</p>
          </div>
        </div>
        <button type="button" onclick="openDayPlan(${jsArg(today)})" class="shrink-0 text-xs font-semibold text-slate-700 bg-sand-200 hover:bg-sand-300 px-3 py-1.5 rounded-lg transition">Dagsplan</button>
      </div>
      ${lines.length ? `<ul class="mt-3 space-y-2">${lines.join("")}</ul>${more}` : `<p class="text-sm text-slate-500 mt-3">Ingenting planlagt i dag ennå. <button type="button" onclick="openDayPlan(${jsArg(today)})" class="font-semibold text-brand-700 hover:underline">Legg til noe</button></p>`}`;
    return;
  }
  const itemsCount = (appState.dayPlan || []).length;
  const before = start && today < start;
  el.innerHTML = `
    <button type="button" onclick="openDayPlan()" class="w-full flex items-center justify-between gap-3 text-left">
      <span class="flex items-center gap-3 min-w-0">
        <span class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0" aria-hidden="true"><i data-lucide="calendar-days" class="w-5 h-5"></i></span>
        <span class="min-w-0">
          <span class="block text-sm sm:text-base font-bold text-slate-900">Dagsplan</span>
          <span class="block text-xs text-slate-500 truncate">${dates.length} ${dates.length === 1 ? "dag" : "dager"} · ${itemsCount ? `${itemsCount} ${itemsCount === 1 ? "aktivitet" : "aktiviteter"} planlagt` : (before ? "Planlegg hva dere skal gjøre hver dag" : "Se hva dere gjorde hver dag")}</span>
        </span>
      </span>
      <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 shrink-0"></i>
    </button>`;
}

export function openDayPlan(date) {
  switchTab("plan");
  if (date) {
    setTimeout(() => {
      const card = document.getElementById(`plan-day-${date}`);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }
}

export function togglePlanPastDays() {
  planShowPastDays = !planShowPastDays;
  renderDayPlan();
  applyEditMode();
  if (window.lucide) lucide.createIcons();
}

export function handleAddDayPlanItem(e, date) {
  e.preventDefault();
  if (!requireEditPermission()) return;
  const form = e.target;
  const text = String(form.elements.text && form.elements.text.value || "").trim().slice(0, 140);
  const time = String(form.elements.time && form.elements.time.value || "");
  if (!text || !isIsoDate(date)) return;
  if (!Array.isArray(appState.dayPlan)) appState.dayPlan = [];
  appState.dayPlan.push({
    id: "plan-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    date,
    time: /^\d{2}:\d{2}$/.test(time) ? time : "",
    text,
    done: false
  });
  persistState();
  renderDayPlan();
  renderOverviewDayCard();
  if (window.lucide) lucide.createIcons();
  const input = document.getElementById(`plan-text-${date}`);
  if (input) input.focus();
}

export function toggleDayPlanItem(id) {
  if (!requireEditPermission()) return;
  const item = (appState.dayPlan || []).find(p => p.id === id);
  if (!item) return;
  item.done = !item.done;
  persistState();
  renderDayPlan();
  renderOverviewDayCard();
  if (window.lucide) lucide.createIcons();
}

export function deleteDayPlanItem(id) {
  if (!requireEditPermission()) return;
  appState.dayPlan = (appState.dayPlan || []).filter(p => p.id !== id);
  persistState();
  renderDayPlan();
  renderOverviewDayCard();
  if (window.lucide) lucide.createIcons();
}

// Ny dag mens appen står åpen (f.eks. åpnet i går kveld): tegn «I dag» på nytt
function refreshDayViewsIfDateChanged() {
  if (!planRenderedDay || planRenderedDay === todayISO()) return;
  planRenderedDay = todayISO();
  renderOverviewHero();
  renderOverviewDayCard();
  renderDayPlan();
  applyEditMode();
  if (window.lucide) lucide.createIcons();
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshDayViewsIfDateChanged(); });
  setInterval(refreshDayViewsIfDateChanged, 60000);
}
