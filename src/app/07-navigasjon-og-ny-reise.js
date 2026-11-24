// =============================================================================
// 5. NAVIGATION & TAB SWITCHING
// =============================================================================
// ---------------------------------------------------------------------------
// Velkomst og ny reise
// ---------------------------------------------------------------------------
const TRIP_TABS = ["overview", "plan", "trains", "budget", "packing"];
let welcomeMode = "welcome";
export let currentTab = "overview";

export function openNewTripPage() {
  welcomeMode = hasActiveTrip() ? "new" : "welcome";
  switchTab("welcome");
}

function renderWelcome() {
  const first = String(userProfile.displayName || "").trim().split(/\s+/)[0];
  const isNew = welcomeMode === "new" && allTrips.length > 0;
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set("welcome-eyebrow", el => { el.textContent = isNew ? "Reiser" : "Velkommen til RailSync"; });
  set("welcome-title", el => { el.textContent = isNew ? "Ny reise" : (first ? `Hei, ${first}! La oss planlegge reisen din.` : "La oss planlegge reisen din."); });
  set("welcome-lead", el => { el.textContent = isNew ? "Fyll inn det du vet nå. Alt kan endres senere." : "Lag en reise, legg inn stoppene dine og finn tog. Du kan planlegge alene eller sammen med venner."; });
  set("new-trip-cancel", el => el.classList.toggle("hidden", !isNew));
  set("welcome-steps", el => el.classList.toggle("hidden", isNew));
  set("new-trip-start-station", el => { if (!el.value && userProfile.homeStation) el.value = userProfile.homeStation; });
  set("new-trip-station-list", el => {
    if (el.childElementCount) return;
    el.innerHTML = EUROPEAN_RAIL_STATIONS.map(st => `<option value="${escapeHtml(st.name)}"></option>`).join("");
  });
}

function findStationByName(value) {
  const q = String(value || "").trim().toLowerCase();
  if (!q) return null;
  return EUROPEAN_RAIL_STATIONS.find(st => st.name.toLowerCase() === q)
    || EUROPEAN_RAIL_STATIONS.find(st => st.city.toLowerCase() === q)
    || null;
}

export function handleCreateTripFromForm(e) {
  if (e && e.preventDefault) e.preventDefault();
  const err = document.getElementById("new-trip-error");
  const val = (id) => (document.getElementById(id) || {}).value || "";
  const title = val("new-trip-title").trim();
  const start = val("new-trip-start");
  const end = val("new-trip-end");
  const stationText = val("new-trip-start-station").trim();
  const passChoice = val("new-trip-pass");
  const fail = (msg, focusId) => {
    if (err) { err.textContent = msg; err.classList.remove("hidden"); }
    const f = document.getElementById(focusId);
    if (f) f.focus();
  };
  if (err) err.classList.add("hidden");
  if (!title) return fail("Gi reisen et navn.", "new-trip-title");
  if (start && end && end < start) return fail("Sluttdatoen kan ikke være før startdatoen.", "new-trip-end");
  const station = stationText ? findStationByName(stationText) : null;
  if (stationText && !station) return fail("Fant ikke stasjonen. Velg en fra listen, eller la feltet stå tomt.", "new-trip-start-station");

  const created = createNewTrip({ title, startDate: start, endDate: end, passDays: 0, startStation: station });
  persistState(`Opprettet «${title}»`);
  const newTripId = (created && created.id) || activeTripId;
  if (passChoice && passChoice !== "custom") {
    const [kind, travelDays, periodDays, periodMonths] = passChoice.split(":");
    setMyPass(newTripId, { kind, travelDays, periodDays, periodMonths, startDate: start });
  } else if (passChoice !== "custom") {
    setMyPass(newTripId, null);
  }
  const form = document.getElementById("form-new-trip");
  if (form) form.reset();
  switchTab("overview");
  renderAll();
  if (passChoice === "custom") { openPassModal("custom"); return; }
  showToast("Reisen er opprettet", "Neste steg: legg til stoppene dine.", "check");
}

export async function joinFromWelcome(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById("welcome-join-code");
  const err = document.getElementById("welcome-join-error");
  if (!input || !input.value.trim()) return;
  if (err) err.classList.add("hidden");
  const ok = await fetchAndJoinSharedTrip(input.value.trim(), false);
  if (ok) {
    input.value = "";
    switchTab("overview");
  } else if (err) {
    err.textContent = "Fant ingen reise med den koden. Sjekk koden og prøv igjen.";
    err.classList.remove("hidden");
  }
}

// Kom i gang-listen på oversikten
function onboardingKey(id) { return "railsync_onboarding_done_" + id; }

export function dismissOnboarding() {
  const active = getActiveTripObject();
  if (!active) return;
  try { localStorage.setItem(onboardingKey(active.id), "1"); } catch (e) {}
  renderOnboarding();
}

export function addPackingSuggestions() {
  if (!requireEditPermission()) return;
  const existing = new Set(appState.packingList.map(p => String(p.title || p.name || "").toLowerCase()));
  const toAdd = PACKING_SUGGESTIONS
    .filter(p => !existing.has(String(p.title || p.name || "").toLowerCase()))
    .map((p, i) => ({ ...p, id: "pack-" + Date.now().toString(36) + "-" + i, checked: false }));
  appState.packingList.push(...toAdd);
  persistState(); // pakkelisten er personlig: ingen linje i reisens aktivitetslogg
  renderAll();
  showToast("Forslag lagt til", `${toAdd.length} ting er lagt til. Fjern det du ikke trenger.`, "check");
}

function renderOnboarding() {
  const card = document.getElementById("getting-started-card");
  if (!card) return;
  const active = getActiveTripObject();
  let dismissed = false;
  try { dismissed = active ? localStorage.getItem(onboardingKey(active.id)) === "1" : true; } catch (e) {}
  const owned = active && isTripOwnedByCurrentUser(active);
  const steps = active ? [
    { done: appState.stops.length >= 2, label: "Legg til stoppene dine", action: "openAddStopModal()", edit: true },
    { done: appState.trains.length > 0, label: "Finn og legg til tog", action: "switchTab('trains')", edit: true },
    { done: Number(appState.trip.totalBudget) > 0 || appState.expenses.length > 0, label: "Sett et budsjett", action: "switchTab('budget')" },
    { done: (active.members || []).length > 1 || !owned, label: "Inviter reisefølget", action: "handleSaveAndShareTrip()" },
    { done: Boolean(userProfile.homeStation || userProfile.bio || userProfile.photo), label: "Fyll ut profilen din", action: "openUserProfileModal()" }
  ] : [];
  const doneCount = steps.filter(s => s.done).length;
  const show = active && !dismissed && doneCount < steps.length;
  card.classList.toggle("hidden", !show);
  if (!show) return;
  // Ny reise (under to steg gjort): rett under toppseksjonen. Senere: under stopp og kart, så hovedinnholdet kommer først.
  const hero = document.getElementById("overview-hero");
  const later = document.getElementById("overview-day-card");
  if (hero && later) {
    if (doneCount < 2) { if (hero.nextElementSibling !== card) hero.after(card); }
    else if (later.previousElementSibling !== card) later.before(card);
  }
  card.innerHTML = `
    <div class="flex items-start justify-between gap-4">
      <div>
        <h3 class="text-sm font-semibold text-slate-900">Kom i gang</h3>
        <p class="text-xs text-slate-500 mt-0.5">${doneCount} av ${steps.length} er gjort</p>
      </div>
      <button type="button" data-onclick="dismissOnboarding()" class="text-xs font-medium text-slate-500 hover:text-slate-900 transition">Skjul</button>
    </div>
    <div class="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div class="bg-brand-600 h-1.5 rounded-full" style="width:${Math.round(doneCount / steps.length * 100)}%"></div></div>
    <ol class="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-5">
      ${steps.map(st => `
        <li>
          <button type="button" ${st.done ? "disabled" : `data-onclick="${st.action}"`} class="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${st.done ? "text-slate-400" : "text-slate-800 hover:bg-slate-50"}">
            <span class="w-5 h-5 rounded-full shrink-0 flex items-center justify-center ${st.done ? "bg-emerald-500 text-white" : "border border-slate-300"}">${st.done ? '<i data-lucide="check" class="w-3 h-3"></i>' : ""}</span>
            <span class="${st.done ? "line-through" : ""}">${st.label}</span>
          </button>
        </li>`).join("")}
    </ol>`;
}

// Elementer som bare gir mening når en reise er valgt
const NEEDS_TRIP = /\b(handleSaveAndShareTrip|openTripSettingsModal)\(/;
function applyTripPresence() {
  const has = hasActiveTrip();
  document.body.dataset.hasTrip = has ? "true" : "false";
  document.querySelectorAll("[data-onclick]").forEach(el => {
    if (NEEDS_TRIP.test(el.getAttribute("data-onclick") || "") && !el.closest("#tab-welcome")) el.setAttribute("data-needs-trip", "");
  });
  if (!has) {
    const title = document.getElementById("header-trip-title");
    if (title) title.textContent = "RailSync";
    const dates = document.getElementById("header-trip-dates");
    if (dates) dates.textContent = allTrips.length ? "Velg en reise" : "Ingen reiser ennå";
  }
}

export function switchTab(tabId) {
  // Uten reise: planleggingssidene viser velkomst i stedet
  if (TRIP_TABS.includes(tabId) && !hasActiveTrip()) {
    welcomeMode = "welcome";
    tabId = "welcome";
  }
  currentTab = tabId;
  if (tabId === "welcome") renderWelcome();
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));

  const target = document.getElementById(`tab-${tabId}`);
  if (target) {
    target.classList.remove("hidden");
  }

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.remove("text-white", "bg-white/10", "shadow-sm", "font-semibold");
    btn.classList.add("text-fjord-200", "hover:bg-white/10", "font-medium");
    btn.removeAttribute("aria-current");
  });
  const activeNavBtn = document.getElementById(`nav-btn-${tabId}`);
  if (activeNavBtn) {
    activeNavBtn.classList.add("text-white", "bg-white/10", "shadow-sm", "font-semibold");
    activeNavBtn.classList.remove("text-fjord-200", "font-medium");
    activeNavBtn.setAttribute("aria-current", "page");
  }

  document.querySelectorAll(".mobile-nav-btn").forEach(btn => {
    btn.classList.remove("text-brand-600", "font-bold", "bg-brand-50/70");
    btn.classList.add("text-slate-500", "font-medium");
  });
  document.querySelectorAll(".mobile-nav-btn").forEach(btn => btn.removeAttribute("aria-current"));
  const mobileTabFor = { welcome: "overview" };
  const activeMobileBtn = document.getElementById(`mobile-tab-${mobileTabFor[tabId] || tabId}`);
  if (activeMobileBtn) {
    activeMobileBtn.classList.add("text-brand-600", "font-bold", "bg-brand-50/70");
    activeMobileBtn.classList.remove("text-slate-500", "font-medium");
    activeMobileBtn.setAttribute("aria-current", "page");
  }

  // On mobile, scroll smoothly to the top when switching main tabs
  if (window.innerWidth < 768) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (tabId === "overview") setOverviewView(overviewView, { keepMap: true });
  if (tabId === "overview" && map) {
    setTimeout(() => {
      map.invalidateSize();
      resetMapView();
    }, 150);
  }

  if (tabId === "social") {
    renderSocialHub();
    fetchCloudTravelerDirectory();
  }

  if (tabId === "account") {
    renderUserProfileModal();
  }

  if (tabId === "trips") {
    switchTripManagerTab(currentTripManagerTab);
  }

  if (tabId === "budget") {
    renderFxCalculator();
  }

  if (tabId === "plan") {
    renderDayPlan();
    applyEditMode();
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

