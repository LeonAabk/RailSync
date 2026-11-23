// ---------------------------------------------------------------------------
// Mobil: handlingsark («⋯»), stopp/kart-valg, togsøk bak knapp, topplinje
// ---------------------------------------------------------------------------
let actionSheetItems = [];
let actionSheetReturnFocus = null;

export function openActionSheet(title, items) {
  const sheet = document.getElementById("action-sheet");
  const list = document.getElementById("action-sheet-list");
  if (!sheet || !list) return;
  actionSheetItems = items.filter(Boolean);
  actionSheetReturnFocus = document.activeElement;
  document.getElementById("action-sheet-title").textContent = title || "";
  list.innerHTML = actionSheetItems.map((it, i) => `
    <button type="button" data-onclick="runActionSheetItem(${i})" ${it.disabled ? "disabled" : ""} class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-medium transition ${it.danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-800 hover:bg-slate-50"} disabled:opacity-40 disabled:cursor-not-allowed">
      <i data-lucide="${escapeHtml(it.icon || "circle")}" class="w-4 h-4 shrink-0 ${it.danger ? "" : "text-slate-500"}"></i>
      <span class="flex-1 min-w-0 truncate">${escapeHtml(it.label)}</span>
      ${it.hint ? `<span class="text-xs text-slate-500 shrink-0">${escapeHtml(it.hint)}</span>` : ""}
    </button>`).join("");
  sheet.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
  const first = list.querySelector("button:not([disabled])");
  if (first) first.focus();
}

export function closeActionSheet() {
  const sheet = document.getElementById("action-sheet");
  if (!sheet || sheet.classList.contains("hidden")) return;
  sheet.classList.add("hidden");
  actionSheetItems = [];
  if (actionSheetReturnFocus && document.body.contains(actionSheetReturnFocus)) {
    try { actionSheetReturnFocus.focus(); } catch (e) {}
  }
}

export function runActionSheetItem(i) {
  const it = actionSheetItems[i];
  closeActionSheet();
  if (it && !it.disabled && typeof it.run === "function") it.run();
}

document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeActionSheet(); });

export function openStopMenu(stopId) {
  const idx = appState.stops.findIndex(s => s.id === stopId);
  if (idx < 0) return;
  const stop = appState.stops[idx];
  const edit = canEditActiveTrip();
  openActionSheet(stop.city || "Stoppested", [
    edit && { label: "Endre stopp", icon: "pencil", run: () => openEditStopModal(stopId) },
    { label: "Vis på kartet", icon: "map-pin", run: () => centerMapOnStop(Number(stop.lat), Number(stop.lng)) },
    idx < appState.stops.length - 1 && { label: `Finn tog til ${appState.stops[idx + 1].city}`, icon: "train", run: () => quickSearchBetweenStops(idx, idx + 1) },
    edit && { label: "Flytt opp", icon: "chevron-up", disabled: idx === 0, run: () => moveStopOrder(stopId, -1) },
    edit && { label: "Flytt ned", icon: "chevron-down", disabled: idx === appState.stops.length - 1, run: () => moveStopOrder(stopId, 1) },
    edit && { label: "Slett stopp", icon: "trash-2", danger: true, run: () => deleteStop(stopId) }
  ]);
}

export function openTripActionsSheet() {
  const active = getActiveTripObject();
  if (!active) { switchTab("trips"); return; }
  const passInfo = passDisplay(getMyPassStatus());
  openActionSheet(appState.trip.title || "Reisen", [
    { label: "Mitt pass", icon: "ticket", hint: passInfo.short, run: () => openPassModal() },
    { label: "Del reisen og reisefølget", icon: "users", run: () => handleSaveAndShareTrip() },
    canEditActiveTrip() && { label: "Reiseinnstillinger", icon: "sliders-horizontal", run: () => openTripSettingsModal() },
    { label: "Alle reiser", icon: "folder", hint: String(allTrips.length), run: () => switchTab("trips") },
    !isStandaloneApp() && { label: "Legg på hjemskjermen", icon: "smartphone", run: () => openInstallHelp() }
  ]);
}

export function handleHeaderTitleClick() {
  if (window.innerWidth < 640 || !hasActiveTrip() || !canEditActiveTrip()) switchTab("trips");
  else openTripSettingsModal();
}

let overviewView = "stops";
export function setOverviewView(view, opts = {}) {
  overviewView = view === "map" ? "map" : "stops";
  const stops = document.getElementById("ov-panel-stops");
  const mapPanel = document.getElementById("ov-panel-map");
  if (stops) stops.classList.toggle("max-lg:hidden", overviewView === "map");
  if (mapPanel) mapPanel.classList.toggle("max-lg:hidden", overviewView !== "map");
  [["ov-seg-stops", overviewView === "stops"], ["ov-seg-map", overviewView === "map"]].forEach(([id, on]) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.setAttribute("aria-selected", on ? "true" : "false");
    b.classList.toggle("bg-white", on);
    b.classList.toggle("shadow-xs", on);
    b.classList.toggle("text-slate-900", on);
    b.classList.toggle("text-slate-600", !on);
  });
  if (overviewView === "map" && map) {
    map.invalidateSize();
    if (!opts.keepMap) setTimeout(() => { map.invalidateSize(); resetMapView(); }, 60);
  }
}

export function setLiveSearchOpen(open) {
  const card = document.getElementById("live-search-card");
  const btn = document.getElementById("btn-toggle-live-search");
  const label = document.getElementById("btn-toggle-live-search-label");
  if (!card) return;
  card.classList.toggle("max-sm:hidden", !open);
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  if (label) label.textContent = open ? "Skjul søk" : "Søk etter tog";
}

export function toggleLiveSearch() {
  const card = document.getElementById("live-search-card");
  const open = card ? card.classList.contains("max-sm:hidden") : true;
  setLiveSearchOpen(open);
  if (open) {
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => { const f = document.getElementById("live-from-input"); if (f) f.focus({ preventScroll: true }); }, 250);
  }
}


// Reisekortet øverst på oversikten: nedtelling og rute
export function renderOverviewHero() {
  const kicker = document.getElementById("overview-hero-kicker");
  const main = document.getElementById("overview-hero-main");
  const route = document.getElementById("overview-hero-route");
  if (!kicker || !main || !route) return;
  const trip = appState.trip || {};
  const today = todayISO();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(trip.startDate || "")) ? trip.startDate : "";
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(trip.endDate || "")) ? trip.endDate : "";
  let k = "Neste reise", m = "Sett datoer for reisen";
  if (start && today < start) {
    const n = isoDiffDays(today, start);
    m = n === 1 ? "Avreise i morgen" : `Avreise om ${n} dager`;
  } else if (start && (!end || today <= end)) {
    k = "På reise nå";
    m = start === today ? "Avreise i dag" : (end ? `Dag ${isoDiffDays(start, today) + 1} av ${isoDiffDays(start, end) + 1}` : `Dag ${isoDiffDays(start, today) + 1}`);
  } else if (end && today > end) {
    k = "Reisen er over";
    m = "Velkommen hjem";
  }
  if (start) k += ` · ${formatDate(start)}${start.slice(0, 4) !== today.slice(0, 4) ? " " + start.slice(0, 4) : ""}`;
  const cities = (appState.stops || []).map(s => String(s.city || "").trim()).filter(Boolean);
  kicker.textContent = k;
  main.textContent = m;
  route.textContent = cities.length ? cities.join(" → ") : "Legg til stopp for å se ruten";
}

export function openTripSettingsModal() {
  const trip = appState.trip;
  document.getElementById("settings-title").value = trip.title;
  document.getElementById("settings-start-date").value = trip.startDate;
  document.getElementById("settings-end-date").value = trip.endDate;
  const passLabelEl = document.getElementById("settings-pass-label");
  if (passLabelEl) passLabelEl.textContent = passLabel(getMyPass(getActiveTripObject()));
  document.getElementById("settings-total-budget").value = trip.totalBudget;
  openModal('modal-trip-settings');
}

export function handleSaveTripSettings(e) {
  e.preventDefault();
  if (!requireEditPermission()) return;
  const newStart = document.getElementById("settings-start-date").value;
  const newEnd = document.getElementById("settings-end-date").value;
  if (newStart && newEnd && newEnd < newStart) {
    showToast("Sjekk datoene", "Sluttdatoen kan ikke være før startdatoen.", "alert-triangle");
    return;
  }
  appState.trip.title = document.getElementById("settings-title").value.trim() || appState.trip.title || "Min reise";
  appState.trip.startDate = newStart;
  appState.trip.endDate = newEnd;
  const budgetVal = parseFloat(document.getElementById("settings-total-budget").value);
  if (Number.isFinite(budgetVal) && budgetVal >= 0) appState.trip.totalBudget = Math.round(budgetVal);

  persistState(`Oppdaterte reiseinnstillinger for «${appState.trip.title}»`);
  renderAll();
  closeModal('modal-trip-settings');
}

export function handleSaveTrain(e) {
  e.preventDefault();
  if (!requireEditPermission()) return;
  const fromCity = document.getElementById("train-from").value.trim();
  const toCity = document.getElementById("train-to").value.trim();
  const date = document.getElementById("train-date").value;
  const departureTime = document.getElementById("train-dep").value;
  const arrivalTime = document.getElementById("train-arr").value;
  const trainType = document.getElementById("train-type").value.trim() || "EuroCity";
  const trainNumber = document.getElementById("train-number").value.trim() || "EC 100";
  const resStatus = document.getElementById("train-res-status").value;
  const resPrice = parseFloat(document.getElementById("train-res-price").value) || 0;
  const isTravelDay = document.getElementById("train-is-travel-day").checked;

  const newTrain = {
    id: "tr-" + Date.now(),
    fromCity,
    toCity,
    date,
    departureTime,
    arrivalTime,
    trainType,
    trainNumber,
    reservationStatus: resStatus,
    reservationPrice: resPrice,
    duration: "Beregnes",
    isTravelDay
  };

  appState.trains.push(newTrain);
  persistState(`La til togreise: ${fromCity} → ${toCity}`);
  renderAll();
  closeModal('modal-add-train');
  document.getElementById("form-add-train").reset();
}

export function toggleTrainReservation(trainId) {
  if (!requireEditPermission()) return;
  const train = appState.trains.find(t => t.id === trainId);
  if (!train) return;
  if (train.reservationStatus === "required") {
    train.reservationStatus = "confirmed";
  } else if (train.reservationStatus === "confirmed") {
    train.reservationStatus = "not_needed";
  } else {
    train.reservationStatus = "required";
  }
  persistState();
  renderTrains();
}

export function deleteTrain(id) {
  if (!requireEditPermission()) return;
  const train = appState.trains.find(t => t.id === id);
  appState.trains = appState.trains.filter(t => t.id !== id);
  persistState(train ? `Fjernet togreise: ${train.fromCity} → ${train.toCity}` : null);
  renderAll();
  updateMapLayers();
}

export function savePersonalBudgetStateOnly() {
  updatePersonalBudgetForTrip(activeTripId, appState.trip.totalBudget, appState.expenses);
  const active = allTrips.find(t => t.id === activeTripId);
  if (active) {
    if (!active.trip) active.trip = {};
    active.trip.totalBudget = appState.trip.totalBudget;
    active.expenses = JSON.parse(JSON.stringify(appState.expenses));
  }
  saveAllTripsToLocalStorage();
}

// Hurtigvalg i «Mitt totalbudsjett» (10 000 kr osv.)
export function setPersonalBudgetPreset(amount) {
  const input = document.getElementById("personal-budget-input");
  if (input) input.value = Number(amount) || 0;
}

export function openEditPersonalBudgetPrompt() {
  const input = document.getElementById("personal-budget-input");
  if (input) {
    input.value = appState.trip.totalBudget > 0 ? appState.trip.totalBudget : "";
  }
  openModal("modal-edit-budget");
}

export function handleSavePersonalBudget(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById("personal-budget-input");
  const newVal = input ? parseFloat(input.value) : 0;
  appState.trip.totalBudget = !isNaN(newVal) && newVal >= 0 ? Math.round(newVal) : 0;
  savePersonalBudgetStateOnly();
  renderAll();
  closeModal("modal-edit-budget");
  showToast("Budsjettet er oppdatert", appState.trip.totalBudget > 0 ? `Rammen er ${formatMoney(appState.trip.totalBudget)}.` : "Du har ikke satt noen ramme.", "wallet");
}

export function handleSaveExpense(e) {
  e.preventDefault();
  const title = document.getElementById("expense-title").value.trim();
  const category = document.getElementById("expense-category").value;
  const date = document.getElementById("expense-date").value;
  const fx = readFxAmount("expense");
  const errEl = document.getElementById("expense-error");
  if (fx.error) {
    if (errEl) { errEl.textContent = fx.error; errEl.classList.remove("hidden"); }
    return;
  }
  if (errEl) errEl.classList.add("hidden");
  const amount = fx.nok;

  const newExp = {
    id: "exp-" + Date.now(),
    title,
    category,
    amount,
    date,
    ...fx.fields
  };

  appState.expenses.push(newExp);
  savePersonalBudgetStateOnly();
  renderAll();
  closeModal('modal-add-expense');
  document.getElementById("form-add-expense").reset();
  showToast("Utgift lagret", `${title} · ${fx.fields.currency ? `${formatCurrency(fx.fields.origAmount, fx.fields.currency)} ≈ ` : ""}${formatMoney(amount)}`, "wallet");
}

export function deleteExpense(id) {
  appState.expenses = appState.expenses.filter(e => e.id !== id);
  savePersonalBudgetStateOnly();
  renderAll();
}

export function togglePackingItem(id) {
  if (!requireEditPermission()) return;
  const item = appState.packingList.find(i => i.id === id);
  if (item) {
    item.checked = !item.checked;
    persistState();
    renderPacking();
  }
}

export function handleSavePackingItem(e) {
  e.preventDefault();
  if (!requireEditPermission()) return;
  const text = document.getElementById("packing-text").value.trim();
  const category = document.getElementById("packing-category").value;

  appState.packingList.push({
    id: "pack-" + Date.now(),
    category,
    text,
    checked: false
  });

  persistState();
  renderPacking();
  closeModal('modal-add-packing');
  document.getElementById("form-add-packing").reset();
}

export function handleQuickAddPacking(e, category) {
  e.preventDefault();
  if (!requireEditPermission()) return;
  const form = e.target;
  const input = form.elements['quickItemText'];
  if (!input || !input.value.trim()) return;

  appState.packingList.push({
    id: "pack-" + Date.now(),
    category,
    text: input.value.trim(),
    checked: false
  });

  persistState();
  renderPacking();
  form.reset();
}

export function deletePackingItem(id) {
  if (!requireEditPermission()) return;
  appState.packingList = appState.packingList.filter(i => i.id !== id);
  persistState();
  renderPacking();
}

