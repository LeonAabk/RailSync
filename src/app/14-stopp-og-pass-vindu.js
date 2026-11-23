// =============================================================================
// 7. ACTIONS & MUTATIONS
// =============================================================================

export function moveStopOrder(stopId, direction) {
  if (!requireEditPermission()) return;
  const index = appState.stops.findIndex(s => s.id === stopId);
  if (index === -1) return;
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= appState.stops.length) return;

  const [moved] = appState.stops.splice(index, 1);
  appState.stops.splice(newIndex, 0, moved);

  appState.stops.forEach((s, idx) => { s.order = idx + 1; });

  persistState();
  updateMapLayers();
  renderAll();
}

export function handlePresetCitySelect(val) {
  if (!val) return;
  const [city, country, lat, lng] = val.split("|");
  document.getElementById("stop-city").value = city;
  document.getElementById("stop-country").value = country;
  document.getElementById("stop-lat").value = lat;
  document.getElementById("stop-lng").value = lng;
  stopCoordsCity = city;
  updateStopMapStatus();
}

// Byen koordinatene i skjemaet hører til (satt av søk, liste eller når et stopp redigeres)
let stopCoordsCity = "";

// Statuslinje i stoppvinduet: vises stoppet på kartet? (erstatter synlige koordinatfelt)
function updateStopMapStatus() {
  const el = document.getElementById("stop-map-status");
  if (!el) return;
  const city = (document.getElementById("stop-city").value || "").trim();
  const lat = parseFloat(document.getElementById("stop-lat").value);
  const lng = parseFloat(document.getElementById("stop-lng").value);
  const dot = (cls) => `<span class="w-2 h-2 mt-1.5 rounded-full shrink-0 ${cls}" aria-hidden="true"></span>`;
  let tone = "bg-slate-50 text-slate-600";
  let html;
  const sameCity = !stopCoordsCity || stopCoordsCity.toLowerCase() === city.toLowerCase();
  if (Number.isFinite(lat) && Number.isFinite(lng) && city && !sameCity) {
    tone = "bg-amber-50 text-amber-900";
    html = `${dot("bg-amber-500")}<span>Kartposisjonen er for ${escapeHtml(stopCoordsCity)}. Søk etter ${escapeHtml(city)} over hvis stoppet ligger et annet sted.</span>`;
  } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
    tone = "bg-emerald-50 text-emerald-800";
    html = `${dot("bg-emerald-500")}<span>${city ? `${escapeHtml(city)} vises på kartet.` : "Vises på kartet."}</span>`;
  } else if (city && findStationByName(city)) {
    tone = "bg-emerald-50 text-emerald-800";
    html = `${dot("bg-emerald-500")}<span>${escapeHtml(city)} plasseres på kartet når du lagrer.</span>`;
  } else if (city) {
    tone = "bg-amber-50 text-amber-900";
    html = `${dot("bg-amber-500")}<span>Fant ikke ${escapeHtml(city)} på kartet. Søk etter byen over for å plassere den, eller lagre uten kartposisjon.</span>`;
  } else {
    html = `${dot("bg-slate-400")}<span>Søk etter en by, eller velg fra listen. Da vises stoppet på kartet.</span>`;
  }
  el.className = `flex items-start gap-2 text-sm rounded-xl px-3 py-2.5 ${tone}`;
  el.innerHTML = html;
}

let searchDebounceTimer = null;

export function setupNominatimSearch() {
  ["stop-city", "stop-lat", "stop-lng"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateStopMapStatus);
  });
  const input = document.getElementById("stop-search-input");
  const dropdown = document.getElementById("search-results-dropdown");
  const spinner = document.getElementById("search-spinner");
  if (!input || !dropdown) return;

  input.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchDebounceTimer);

    if (query.length < 2) {
      dropdown.innerHTML = "";
      dropdown.classList.add("hidden");
      if (spinner) spinner.classList.add("hidden");
      return;
    }

    if (spinner) spinner.classList.remove("hidden");

    searchDebounceTimer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&accept-language=no,en`;
        const res = await fetch(url, {
          headers: { "Accept": "application/json" }
        });
        const data = await res.json();

        if (spinner) spinner.classList.add("hidden");

        if (!data || data.length === 0) {
          dropdown.innerHTML = `<div class="p-3 text-xs text-slate-500 text-center">Ingen byer funnet for "${escapeHtml(query)}"</div>`;
          dropdown.classList.remove("hidden");
          return;
        }

        dropdown.innerHTML = data.map(item => {
          const addr = item.address || {};
          const cityName = addr.city || addr.town || addr.village || addr.municipality || item.name || query;
          const countryName = addr.country || "";
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);

          return `
            <button type="button" 
              onclick="selectSearchResult(${jsArg(cityName)}, ${jsArg(countryName)}, ${Number(lat)}, ${Number(lon)})"
              class="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between text-xs transition">
              <div class="min-w-0 pr-2">
                <p class="font-bold text-slate-800">${escapeHtml(cityName)}</p>
                <p class="text-slate-500 text-[11px] truncate">${escapeHtml(item.display_name)}</p>
              </div>
              <span class="text-[10px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded font-semibold ml-2 shrink-0">Velg</span>
            </button>
          `;
        }).join("");

        dropdown.classList.remove("hidden");
      } catch (err) {
        if (spinner) spinner.classList.add("hidden");
        dropdown.innerHTML = `<div class="p-3 text-xs text-slate-500 text-center">Søk utilgjengelig akkurat nå. Fyll ut manuelt.</div>`;
        dropdown.classList.remove("hidden");
      }
    }, 400);
  });
}

export function selectSearchResult(city, country, lat, lng) {
  document.getElementById("stop-city").value = city;
  document.getElementById("stop-country").value = country;
  document.getElementById("stop-lat").value = lat;
  document.getElementById("stop-lng").value = lng;
  document.getElementById("stop-search-input").value = `${city}, ${country}`;
  document.getElementById("search-results-dropdown").classList.add("hidden");
  stopCoordsCity = city;
  updateStopMapStatus();
}

export function openAddStopModal() {
  if (!requireEditPermission()) return;
  document.getElementById("stop-edit-id").value = "";
  document.getElementById("modal-stop-title").textContent = "Legg til stoppested";
  document.getElementById("modal-stop-btn-text").textContent = "Lagre stoppested";
  document.getElementById("form-add-stop").reset();
  stopCoordsCity = "";
  document.getElementById("stop-preset-select").value = "";
  document.getElementById("stop-search-input").value = "";
  document.getElementById("search-results-dropdown").classList.add("hidden");

  // Smart default arrival & departure dates based on previous stop
  const lastStop = appState.stops.length > 0 ? appState.stops[appState.stops.length - 1] : null;
  const baseArrival = (lastStop && lastStop.departure) || (appState.trip && appState.trip.startDate) || "2026-07-15";
  const arrEl = document.getElementById("stop-arrival");
  const depEl = document.getElementById("stop-departure");
  if (arrEl) arrEl.value = baseArrival;
  if (depEl) {
    try {
      const d = new Date(baseArrival);
      d.setDate(d.getDate() + 3);
      depEl.value = d.toISOString().split("T")[0];
    } catch (e) {
      depEl.value = baseArrival;
    }
  }

  const coords = document.getElementById("stop-coords-details");
  if (coords) coords.open = false;
  updateStopMapStatus();
  openModal('modal-add-stop');
}

export function openEditStopModal(stopId) {
  if (!requireEditPermission()) return;
  const stop = appState.stops.find(s => s.id === stopId);
  if (!stop) return;

  document.getElementById("stop-edit-id").value = stop.id;
  document.getElementById("modal-stop-title").textContent = `Rediger ${stop.city}`;
  document.getElementById("modal-stop-btn-text").textContent = "Oppdater stoppested";

  document.getElementById("stop-city").value = stop.city;
  document.getElementById("stop-country").value = stop.country;
  document.getElementById("stop-arrival").value = stop.arrival;
  document.getElementById("stop-departure").value = stop.departure;
  document.getElementById("stop-lat").value = stop.lat;
  document.getElementById("stop-lng").value = stop.lng;
  stopCoordsCity = stop.city || "";
  document.getElementById("stop-accom-status").value = stop.accommodationStatus;
  document.getElementById("stop-accom-note").value = stop.accommodationNote || "";

  document.getElementById("stop-preset-select").value = "";
  document.getElementById("stop-search-input").value = "";
  document.getElementById("search-results-dropdown").classList.add("hidden");

  const coords = document.getElementById("stop-coords-details");
  if (coords) coords.open = false;
  updateStopMapStatus();
  openModal('modal-add-stop');
}

export function handleSaveStop(e) {
  e.preventDefault();
  if (!requireEditPermission()) return;
  const editId = document.getElementById("stop-edit-id").value;
  const city = document.getElementById("stop-city").value.trim();
  const country = document.getElementById("stop-country").value.trim();
  const arrival = document.getElementById("stop-arrival").value;
  const departure = document.getElementById("stop-departure").value;
  let lat = parseFloat(document.getElementById("stop-lat").value);
  let lng = parseFloat(document.getElementById("stop-lng").value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    // Skrevet inn for hånd: finn byen i stasjonslisten, ellers ingen kartposisjon (ikke en falsk en)
    const st = findStationByName(city);
    lat = st ? st.lat : null;
    lng = st ? st.lng : null;
  }
  const accomStatus = document.getElementById("stop-accom-status").value;
  const accomNote = document.getElementById("stop-accom-note").value.trim();

  if (editId) {
    const stop = appState.stops.find(s => s.id === editId);
    if (stop) {
      stop.city = city;
      stop.country = country;
      stop.arrival = arrival;
      stop.departure = departure;
      stop.lat = lat;
      stop.lng = lng;
      stop.accommodationStatus = accomStatus;
      stop.accommodationNote = accomNote;
    }
  } else {
    const newStop = {
      id: "stop-" + Date.now(),
      city,
      country,
      arrival,
      departure,
      accommodationStatus: accomStatus,
      accommodationNote: accomNote,
      lat,
      lng,
      order: appState.stops.length + 1
    };
    appState.stops.push(newStop);
  }

  persistState(editId ? `Oppdaterte stoppested: ${city}` : `La til stoppested: ${city}`);
  updateMapLayers();
  renderAll();
  closeModal('modal-add-stop');
  document.getElementById("form-add-stop").reset();
}

export function deleteStop(id) {
  if (!requireEditPermission()) return;
  const stop = appState.stops.find(s => s.id === id);
  appState.stops = appState.stops.filter(s => s.id !== id);
  appState.stops.forEach((s, idx) => { s.order = idx + 1; });
  persistState(stop ? `Fjernet stoppested: ${stop.city}` : null);
  updateMapLayers();
  renderAll();
}


// --- Vinduet «Mitt pass» ---------------------------------------------------
function passPresetValue(p) { return `${p.travelDays || 0}:${p.periodDays || 0}:${p.periodMonths || 0}`; }

export function openPassModal(forceKind) {
  const t = getActiveTripObject();
  if (!t) return;
  const p = getMyPass(t);
  const kind = forceKind || (p ? p.kind : "none");
  const form = document.getElementById("form-pass");
  if (!form) return;
  form.querySelectorAll('input[name="pass-kind"]').forEach(r => { r.checked = r.value === kind; });
  const flexi = document.getElementById("pass-flexi-preset");
  const cont = document.getElementById("pass-continuous-preset");
  flexi.value = p && p.kind === "flexi" && PASS_FLEXI_PRESETS.some(x => passPresetValue({ ...x }) === passPresetValue(p)) ? passPresetValue(p) : "7:0:1";
  cont.value = p && p.kind === "continuous" ? passPresetValue(p) : "0:0:1";
  if (![...cont.options].some(o => o.value === cont.value)) cont.value = "0:0:1";
  const custom = p && (p.kind === "custom" || (p.kind === "flexi" && flexi.value !== passPresetValue(p))) ? p : null;
  document.getElementById("pass-custom-days").value = custom && custom.travelDays ? custom.travelDays : "";
  document.getElementById("pass-custom-period").value = custom ? (custom.periodMonths || custom.periodDays || "") : "";
  document.getElementById("pass-custom-unit").value = custom && custom.periodMonths ? "months" : "days";
  if (custom && p.kind === "flexi") form.querySelectorAll('input[name="pass-kind"]').forEach(r => { r.checked = r.value === "custom"; });
  document.getElementById("pass-start-date").value = (p && p.startDate) || (t.trip && t.trip.startDate) || "";
  renderPassGroupList(t);
  updatePassForm();
  openModal("modal-pass");
}

function readPassForm() {
  const form = document.getElementById("form-pass");
  const kindEl = form.querySelector('input[name="pass-kind"]:checked');
  const kind = kindEl ? kindEl.value : "none";
  const startDate = document.getElementById("pass-start-date").value;
  const fromPreset = (v) => { const [travelDays, periodDays, periodMonths] = String(v).split(":").map(Number); return { travelDays, periodDays, periodMonths }; };
  if (kind === "flexi") return normalizePass({ kind, ...fromPreset(document.getElementById("pass-flexi-preset").value), startDate });
  if (kind === "continuous") return normalizePass({ kind, ...fromPreset(document.getElementById("pass-continuous-preset").value), startDate });
  if (kind === "custom") {
    const n = parseInt(document.getElementById("pass-custom-period").value, 10) || 0;
    const months = document.getElementById("pass-custom-unit").value === "months";
    return normalizePass({ kind, travelDays: parseInt(document.getElementById("pass-custom-days").value, 10) || 0, periodDays: months ? 0 : n, periodMonths: months ? n : 0, startDate });
  }
  return null;
}

export function updatePassForm() {
  const form = document.getElementById("form-pass");
  if (!form) return;
  const kindEl = form.querySelector('input[name="pass-kind"]:checked');
  const kind = kindEl ? kindEl.value : "none";
  document.getElementById("pass-flexi-fields").classList.toggle("hidden", kind !== "flexi");
  document.getElementById("pass-continuous-fields").classList.toggle("hidden", kind !== "continuous");
  document.getElementById("pass-custom-fields").classList.toggle("hidden", kind !== "custom");
  document.getElementById("pass-start-field").classList.toggle("hidden", kind === "none");
  const preview = document.getElementById("pass-preview");
  const t = getActiveTripObject();
  const p = readPassForm();
  if (!preview) return;
  if (!p) {
    preview.innerHTML = kind === "none"
      ? `<p class="text-slate-600">Ingen pass registrert. Togene telles fortsatt, men uten grense.</p>`
      : `<p class="text-amber-800">Fyll ut passet for å se hvor lenge det gjelder.</p>`;
    return;
  }
  const s = computePassStatus(p, appState.trains, t ? t.trip : {});
  const d = passDisplay(s);
  const period = s.start && s.end ? `${formatDate(s.start)} – ${formatDate(s.end)} (${s.length} dager)` : (s.start ? `Fra ${formatDate(s.start)}` : "Sett en startdato");
  const lines = [
    `<p class="font-semibold text-slate-900">${escapeHtml(passLabel(p))}</p>`,
    `<p class="text-slate-600">Gyldig: ${escapeHtml(period)}</p>`,
    `<p class="text-slate-600">${s.unlimited ? `Ubegrenset med reisedager · ${plural(s.used, "reisedag", "reisedager")} planlagt` : `${s.used} av ${s.total} reisedager planlagt · ${s.remaining} igjen`}</p>`
  ];
  if (s.unlimited && s.state === "active") lines.push(`<p class="text-slate-600">${plural(s.daysLeft, "dag", "dager")} igjen av perioden</p>`);
  if (d.warn) lines.push(`<p class="text-amber-800 font-medium">${escapeHtml(d.warn)}</p>`);
  if (s.outside.length) lines.push(`<p class="text-xs text-amber-800">Utenfor: ${s.outside.map(formatDate).join(", ")}</p>`);
  preview.innerHTML = lines.join("");
}

function renderPassGroupList(t) {
  const box = document.getElementById("pass-group-list");
  if (!box) return;
  const docs = (tripBudgets[t.id]) || {};
  const myUid = myUidOrLocal();
  const others = Object.entries(docs).filter(([uid]) => uid !== myUid);
  if (!others.length) { box.innerHTML = ""; box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  box.innerHTML = `<p class="field-label">Reisefølget</p><ul class="divide-y divide-slate-100 rounded-xl border border-slate-200">${others.map(([uid, d]) => {
    const s = computePassStatus(d.pass, t.id === activeTripId ? appState.trains : t.trains, t.id === activeTripId ? appState.trip : t.trip);
    const info = passDisplay(s);
    return `<li class="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span class="font-medium text-slate-800 truncate">${escapeHtml(d.name || "Reisende")}</span><span class="text-right text-slate-600 text-xs">${escapeHtml(d.pass ? passShortLabel(d.pass) : "Ikke satt")}${d.pass ? ` · ${escapeHtml(info.main)}` : ""}</span></li>`;
  }).join("")}</ul>`;
}

export function handleSavePass(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!hasActiveTrip()) return;
  const form = document.getElementById("form-pass");
  const kindEl = form.querySelector('input[name="pass-kind"]:checked');
  const kind = kindEl ? kindEl.value : "none";
  const p = readPassForm();
  if (kind !== "none" && !p) {
    showToast("Passet mangler noe", kind === "custom" ? "Skriv inn antall reisedager eller en periode." : "Velg et pass.", "alert-triangle");
    return;
  }
  setMyPass(activeTripId, p);
  closeModal("modal-pass");
  renderAll();
  showToast("Passet er lagret", p ? passLabel(p) : "Ingen pass registrert", "check");
}


