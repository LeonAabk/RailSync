// =============================================================================
// 6. RENDER FUNCTIONS
// =============================================================================
export function renderOverview() {
  const trip = appState.trip;
  const titleEl = document.getElementById("header-trip-title");
  if (titleEl) titleEl.textContent = trip.title || "Uten navn";
  
  let durationDays = 0;
  const hasDates = Boolean(trip.startDate && trip.endDate);
  if (hasDates) {
    const diff = Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24));
    if (diff > 0) durationDays = diff;
  }

  const datesEl = document.getElementById("header-trip-dates");
  if (datesEl) {
    datesEl.textContent = hasDates
      ? `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)} · ${durationDays} dager`
      : "Datoer ikke satt";
  }

  const totalDaysStat = document.getElementById("stat-total-days");
  if (totalDaysStat) totalDaysStat.textContent = hasDates ? `${durationDays} dager` : "–";

  const totalDaysSub = document.getElementById("stat-total-days-sub");
  if (totalDaysSub) totalDaysSub.textContent = hasDates ? `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}` : "Datoer ikke satt";

  // Unique countries
  const uniqueCountries = new Set(appState.stops.map(s => String(s.country || "").trim()).filter(Boolean));
  const countriesCount = uniqueCountries.size;
  const countriesList = Array.from(uniqueCountries).slice(0, 5).join(", ") + (countriesCount > 5 ? '...' : '');

  const statCountries = document.getElementById("stat-countries-count");
  if (statCountries) statCountries.textContent = `${countriesCount} land`;

  const statCountriesSub = document.getElementById("stat-countries-sub");
  if (statCountriesSub) statCountriesSub.textContent = countriesList || "Ingen land registrert";

  renderOverviewHero();

  // Mitt pass
  const passInfo = passDisplay(getMyPassStatus());
  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  setText("stat-pass-days", passInfo.main);
  setText("stat-pass-sub", passInfo.warn || passInfo.sub);
  const statPassSub = document.getElementById("stat-pass-sub");
  if (statPassSub) statPassSub.classList.toggle("text-amber-200", Boolean(passInfo.warn));
  const statPassBar = document.getElementById("stat-pass-bar");
  if (statPassBar) {
    statPassBar.style.width = `${passInfo.pct}%`;
    statPassBar.classList.toggle("bg-amber-400", Boolean(passInfo.warn));
    statPassBar.classList.toggle("bg-fjord-300", !passInfo.warn);
  }
  setText("sidebar-pass-days-text", passInfo.main);
  const sidebarPassBar = document.getElementById("sidebar-pass-progress-bar");
  if (sidebarPassBar) sidebarPassBar.style.width = `${passInfo.pct}%`;
  setText("sidebar-pass-remaining", passInfo.warn || passInfo.sub);
  setText("mobile-subbar-pass", passInfo.short);

  // Budget
  const totalSpent = appState.expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalBudget = appState.trip.totalBudget || 22000;
  const budgetPct = Math.round((totalSpent / totalBudget) * 100);

  const statBudgetSpent = document.getElementById("stat-budget-spent");
  if (statBudgetSpent) statBudgetSpent.textContent = `${formatNumber(totalSpent)} kr`;

  const statBudgetSub = document.getElementById("stat-budget-sub");
  if (statBudgetSub) statBudgetSub.textContent = `av ${formatNumber(totalBudget)} kr (${budgetPct}%)`;

  // Timeline
  const container = document.getElementById("timeline-container");
  if (!container) return;

  if (appState.stops.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-500">
        <p class="text-sm">Ingen stoppesteder registrert ennå.</p>
        <button data-onclick="openAddStopModal()" class="mt-2 text-xs text-brand-600 font-semibold underline">Legg til første by</button>
      </div>
    `;
    return;
  }

  const segCount = document.getElementById("ov-seg-stops-count");
  if (segCount) segCount.textContent = appState.stops.length ? `(${appState.stops.length})` : "";
  container.innerHTML = appState.stops.map((stop, idx) => {
    const isStart = idx === 0;
    const isEnd = idx === appState.stops.length - 1;

    let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
    const accStatus = String(stop.accommodationStatus || "");
    if (accStatus.includes("Bestilt")) {
      badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
    } else if (accStatus.includes("Ser etter")) {
      badgeStyle = "bg-amber-50 text-amber-700 border-amber-200/80";
    }

    return `
      <div class="relative pl-7 pb-3 group">
        ${!isEnd ? '<div class="absolute left-3 top-3.5 bottom-0 w-0.5 bg-slate-200 group-hover:bg-brand-300 transition-colors"></div>' : ''}
        
        <div class="absolute left-0 top-1.5 w-6 h-6 rounded-full ${isStart ? 'bg-fjord-800' : (isEnd ? 'bg-rail-accent' : 'bg-brand-600')} text-white flex items-center justify-center text-xs font-bold shadow-xs">
          ${idx + 1}
        </div>

        <div class="bg-slate-50 hover:bg-slate-100/90 rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 transition-all flex flex-col gap-2 shadow-2xs w-full min-w-0">
          <!-- Row 1: City, Country & Dates + Status Badge (Full width, never squished by 5 buttons) -->
          <div class="flex items-start justify-between gap-2 min-w-0">
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline gap-1.5 flex-wrap">
                <h3 class="font-extrabold text-slate-900 text-sm sm:text-base leading-snug">
                  ${Number.isFinite(Number(stop.lat)) && Number.isFinite(Number(stop.lng)) && stop.lat !== null && stop.lng !== null
                    ? `<button type="button" data-onclick="centerMapOnStop(${Number(stop.lat)}, ${Number(stop.lng)})" class="hit hit-tall text-left hover:text-brand-600 rounded" aria-label="Vis ${escapeHtml(stop.city)} på kartet">${escapeHtml(stop.city)}</button>`
                    : escapeHtml(stop.city)}
                </h3>
                <span class="text-xs text-slate-500 font-medium">${escapeHtml(stop.country)}</span>
              </div>
              <p class="text-[11px] text-slate-500 font-medium mt-0.5">
                ${formatDate(stop.arrival)} – ${formatDate(stop.departure)}
              </p>
              ${stop.accommodationNote ? `<p class="text-[11px] text-slate-500 truncate mt-0.5" title="${escapeHtml(stop.accommodationNote)}">${escapeHtml(stop.accommodationNote)}</p>` : ''}
            </div>
            
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${badgeStyle}">
              ${escapeHtml(stop.accommodationStatus)}
            </span>
          </div>

          <!-- Row 2: Clean Action Toolbar & Next Leg Train Search -->
          <div class="flex items-center justify-between flex-wrap gap-1.5 pt-2 border-t border-slate-200/50">
            <div class="hidden sm:flex items-center gap-1">
              <button 
                title="Flytt opp i reiseruten" 
                data-onclick="moveStopOrder(${jsArg(stop.id)}, -1)" 
                class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 bg-white border border-slate-200/80 shadow-2xs transition ${isStart ? 'opacity-25 cursor-not-allowed' : ''}"
                ${isStart ? 'disabled' : ''}
              >
                <i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>
              </button>

              <button 
                title="Flytt ned i reiseruten" 
                data-onclick="moveStopOrder(${jsArg(stop.id)}, 1)" 
                class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 bg-white border border-slate-200/80 shadow-2xs transition ${isEnd ? 'opacity-25 cursor-not-allowed' : ''}"
                ${isEnd ? 'disabled' : ''}
              >
                <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
              </button>

              <button title="Rediger stoppested" data-onclick="openEditStopModal(${jsArg(stop.id)})" class="px-2 h-7 flex items-center gap-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-brand-600 bg-white border border-slate-200/80 shadow-2xs transition">
                <i data-lucide="pencil" class="w-3 h-3"></i>
                <span>Endre</span>
              </button>

              <button title="Vis på kartet" data-onclick="centerMapOnStop(${Number(stop.lat)}, ${Number(stop.lng)})" class="px-2 h-7 flex items-center gap-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-brand-600 bg-white border border-slate-200/80 shadow-2xs transition">
                <i data-lucide="map-pin" class="w-3 h-3 text-brand-600"></i>
                <span>Kart</span>
              </button>

              <button title="Fjern stoppested" data-onclick="deleteStop(${jsArg(stop.id)})" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 bg-white border border-slate-200/80 shadow-2xs transition">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            ${!isEnd ? `
              <button 
                data-onclick="quickSearchBetweenStops(${Number(idx)}, ${Number(idx + 1)})" 
                class="text-xs sm:text-[11px] font-bold text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200/80 px-3 py-2 sm:px-2.5 sm:py-1 rounded-lg transition flex items-center gap-1"
                title="Søk reelle togtider fra ${escapeHtml(stop.city)} til ${escapeHtml(appState.stops[idx + 1].city)}"
              >
                <i data-lucide="train" class="w-3 h-3 text-brand-600 shrink-0"></i>
                <span class="truncate max-w-[170px] sm:max-w-none">Tog → ${escapeHtml(appState.stops[idx + 1].city)}</span>
              </button>
            ` : ''}
            <button type="button" data-onclick="openStopMenu(${jsArg(stop.id)})" class="hit sm:hidden ml-auto w-10 h-9 flex items-center justify-center rounded-lg text-slate-600 bg-white border border-slate-200/80 shadow-2xs" aria-label="Flere valg for ${escapeHtml(stop.city)}">
              <i data-lucide="more-horizontal" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

export function renderTrains() {
  const trainPassStatus = getMyPassStatus();
  renderLiveRouteChips();

  const filterEl = document.getElementById("train-filter");
  const filter = filterEl ? filterEl.value : "all";
  const container = document.getElementById("trains-list-container");
  if (!container) return;

  let filteredTrains = [...appState.trains];
  if (filter === "needs_reservation") {
    filteredTrains = filteredTrains.filter(t => t.reservationStatus === "required");
  } else if (filter === "confirmed") {
    filteredTrains = filteredTrains.filter(t => t.reservationStatus === "confirmed");
  } else if (filter === "travel_days") {
    filteredTrains = filteredTrains.filter(t => t.isTravelDay);
  }

  const badgeEl = document.getElementById("sidebar-train-badge");
  if (badgeEl) badgeEl.textContent = appState.trains.length;

  if (filteredTrains.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-slate-500">
        <i data-lucide="train" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
        <p class="font-medium text-sm">Ingen togreiser matcher filteret.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = filteredTrains.map(train => {
    let resBadge;
    if (train.reservationStatus === "confirmed") {
      resBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <i data-lucide="check-circle-2" class="w-3.5 h-3.5 shrink-0"></i>
          <span>Reservasjon bekreftet</span>
        </span>
      `;
    } else if (train.reservationStatus === "required") {
      resBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <i data-lucide="alert-triangle" class="w-3.5 h-3.5 shrink-0"></i>
          <span>Må reserveres</span>
        </span>
      `;
    } else {
      resBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium bg-slate-100 text-slate-600">
          Reservasjon valgfri
        </span>
      `;
    }

    const passDate = passTravelDateOfTrain(train);
    const passOutside = passDate && trainPassStatus.pass && trainPassStatus.outside.includes(passDate);
    const travelDayBadge = train.isTravelDay 
      ? (passOutside
        ? `<span class="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title="Denne reisedagen er utenfor perioden passet ditt gjelder">Utenfor passet</span>`
        : `<span class="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200"${passDate && passDate !== train.date ? ' title="Direkte nattog etter kl. 19 teller på ankomstdagen"' : ""}>Reisedag${passDate && passDate !== train.date ? ` (${formatDate(passDate)})` : ""}</span>`)
      : `<span class="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium bg-slate-100 text-slate-500">Lokal</span>`;

    const hasTrack = Array.isArray(train.routeGeometry) && train.routeGeometry.length > 1;
    const transfersCount = typeof train.transfers === 'number' ? train.transfers : 0;
    const transferLabel = transfersCount === 0
      ? 'Direktetog'
      : `${transfersCount} bytte${transfersCount > 1 ? 'r' : ''}`;

    const legsHtml = Array.isArray(train.legsSummary) && train.legsSummary.length > 1
      ? `
        <details class="group/legs pt-1">
          <summary class="hit inline-flex items-center gap-1 text-xs font-semibold text-slate-600 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden py-1">
            <i data-lucide="chevron-right" class="w-3.5 h-3.5 transition-transform group-open/legs:rotate-90"></i>
            ${train.legsSummary.length} etapper
          </summary>
          <ol class="mt-1.5 space-y-1 text-xs text-slate-700">
            ${train.legsSummary.map(leg => `
              <li class="flex items-baseline gap-2 min-w-0">
                <span class="shrink-0 px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-[11px] text-slate-700">${escapeHtml(leg.line)}</span>
                <span class="min-w-0"><span class="tabular-nums font-medium">${escapeHtml(leg.dep)}</span> ${escapeHtml(leg.from)} → <span class="tabular-nums font-medium">${escapeHtml(leg.arr)}</span> ${escapeHtml(leg.to)}</span>
              </li>
            `).join('')}
          </ol>
        </details>
      `
      : '';

    return `
      <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 hover:border-slate-300 transition space-y-3">
        <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 flex-wrap">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-extrabold text-xs sm:text-base text-slate-900">${escapeHtml(train.trainType)}</span>
            <span class="text-[11px] sm:text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">${escapeHtml(train.trainNumber)}</span>
            ${travelDayBadge}
            ${hasTrack ? `
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                <i data-lucide="map" class="w-3 h-3"></i> Spor
              </span>
            ` : ''}
          </div>
          <div class="text-xs text-slate-500 font-semibold flex items-center gap-1 shrink-0">
            <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
            ${formatDate(train.date)}
          </div>
        </div>

        <!-- Horizontal 3-column ticket layout on both mobile and desktop -->
        <div class="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-4 items-center py-1">
          <div class="min-w-0">
            <p class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">${escapeHtml(train.departureTime)}</p>
            <p class="text-xs sm:text-sm font-bold text-slate-800 truncate">${escapeHtml(train.fromCity)}</p>
            <p class="text-[10px] sm:text-xs text-slate-500 truncate">${train.platform ? `Spor ${escapeHtml(train.platform)}` : 'Avgang'}</p>
          </div>

          <div class="flex flex-col items-center justify-center text-center px-1 sm:px-3 min-w-[76px] sm:min-w-[120px]">
            <span class="text-[10px] sm:text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
              <i data-lucide="clock" class="w-3 h-3 text-slate-400"></i>
              ${escapeHtml(train.duration)}
            </span>
            <div class="w-full flex items-center justify-center gap-1.5">
              <div class="h-0.5 flex-1 bg-slate-200"></div>
              <div class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <i data-lucide="arrow-right" class="w-3 h-3 sm:w-3.5 sm:h-3.5"></i>
              </div>
              <div class="h-0.5 flex-1 bg-slate-200"></div>
            </div>
            <span class="text-[10px] sm:text-[11px] ${transfersCount === 0 ? 'text-brand-600' : 'text-amber-700'} font-semibold mt-1">${transferLabel}</span>
          </div>

          <div class="text-right min-w-0">
            <p class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">${escapeHtml(train.arrivalTime)}</p>
            <p class="text-xs sm:text-sm font-bold text-slate-800 truncate">${escapeHtml(train.toCity)}</p>
            <p class="text-[10px] sm:text-xs text-slate-500 truncate">${train.arrivalPlatform ? `Spor ${escapeHtml(train.arrivalPlatform)}` : 'Ankomst'}</p>
          </div>
        </div>

        ${legsHtml}

        <div class="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            ${resBadge}
            ${train.reservationPrice > 0 ? `<span class="text-xs text-slate-500 font-semibold">~${train.reservationPrice} kr</span>` : ''}
          </div>
          ${train.reservationStatus === "required" ? `<div class="w-full">${reservationLinksHtml(train)}</div>` : ""}

          <div class="flex items-center gap-1.5 flex-wrap ml-auto">
            ${hasTrack ? `
              <button data-onclick="focusTrainTrackOnMap(${jsArg(train.id)})" class="text-xs font-semibold px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition flex items-center gap-1">
                <i data-lucide="map-pin" class="w-3.5 h-3.5"></i> Vis i kart
              </button>
            ` : `
              <button data-onclick="fetchRealTrackForSingleTrain(${jsArg(train.id)})" class="text-xs font-semibold px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition flex items-center gap-1">
                <i data-lucide="zap" class="w-3.5 h-3.5"></i> Hent spor
              </button>
            `}
            ${train.reservationStatus === 'required' ? `
              <button data-onclick="toggleTrainReservation(${jsArg(train.id)})" class="text-xs font-semibold px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition">
                Merk bestilt
              </button>
            ` : `
              <button data-onclick="toggleTrainReservation(${jsArg(train.id)})" class="text-xs font-medium text-slate-600 hover:text-slate-800 px-2.5 py-2 sm:py-1 rounded-lg hover:bg-slate-50" title="Bytt mellom: må reserveres, reservert, ikke nødvendig">
                Endre reservasjon
              </button>
            `}
            <button data-onclick="deleteTrain(${jsArg(train.id)})" class="hit text-slate-500 hover:text-rose-600 p-2 sm:p-1.5 rounded-lg hover:bg-slate-50 transition" title="Slett togreise" aria-label="Slett togreise ${escapeHtml(train.fromCity || "")} → ${escapeHtml(train.toCity || "")}">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}


