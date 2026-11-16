// =============================================================================
// 8.5 PAN-EUROPEAN LIVE TRAIN TIMETABLE & TRACK ENGINE (Transitous / MOTIS 2)
// =============================================================================

const TRANSITOUS_API_BASE = "https://api.transitous.org";

// Curated European railway station hubs for instant 0ms matching & fallback
const EUROPEAN_RAIL_STATIONS = [
  { name: "Oslo S", city: "Oslo", country: "Norge", lat: 59.910357, lng: 10.753051, modes: ["LONG_DISTANCE", "REGIONAL_RAIL"] },
  { name: "Bergen stasjon", city: "Bergen", country: "Norge", lat: 60.390434, lng: 5.333511, modes: ["LONG_DISTANCE", "REGIONAL_RAIL"] },
  { name: "Trondheim S", city: "Trondheim", country: "Norge", lat: 63.436279, lng: 10.399123, modes: ["LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Stavanger stasjon", city: "Stavanger", country: "Norge", lat: 58.967028, lng: 5.731906, modes: ["LONG_DISTANCE"] },
  { name: "Göteborg Centralstation", city: "Gøteborg", country: "Sverige", lat: 57.70887, lng: 11.97347, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Stockholm Centralstation", city: "Stockholm", country: "Sverige", lat: 59.330136, lng: 18.058176, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Malmö Centralstation", city: "Malmö", country: "Sverige", lat: 55.609198, lng: 13.000737, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "København H", city: "København", country: "Danmark", lat: 55.672767, lng: 12.564928, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Aarhus H", city: "Aarhus", country: "Danmark", lat: 56.150485, lng: 10.204386, modes: ["LONG_DISTANCE"] },
  { name: "Odense St.", city: "Odense", country: "Danmark", lat: 55.40153, lng: 10.38679, modes: ["LONG_DISTANCE"] },
  { name: "Hamburg Hbf", city: "Hamburg", country: "Tyskland", lat: 53.55293, lng: 10.006614, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Berlin Hbf", city: "Berlin", country: "Tyskland", lat: 52.525084, lng: 13.369402, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "München Hbf", city: "München", country: "Tyskland", lat: 48.140232, lng: 11.558335, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Frankfurt (Main) Hbf", city: "Frankfurt", country: "Tyskland", lat: 50.107145, lng: 8.663789, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Köln Hbf", city: "Köln", country: "Tyskland", lat: 50.94303, lng: 6.958729, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Dresden Hbf", city: "Dresden", country: "Tyskland", lat: 51.040262, lng: 13.731445, modes: ["LONG_DISTANCE"] },
  { name: "Amsterdam Centraal", city: "Amsterdam", country: "Nederland", lat: 52.379128, lng: 4.900272, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Rotterdam Centraal", city: "Rotterdam", country: "Nederland", lat: 51.92434, lng: 4.46981, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Bruxelles-Midi / Brussel-Zuid", city: "Brussel", country: "Belgia", lat: 50.835707, lng: 4.336531, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Antwerpen-Centraal", city: "Antwerpen", country: "Belgia", lat: 51.2172, lng: 4.4211, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "London St Pancras International", city: "London", country: "Storbritannia", lat: 51.531427, lng: -0.126133, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Edinburgh Waverley", city: "Edinburgh", country: "Storbritannia", lat: 55.952052, lng: -3.189938, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Paris Gare du Nord", city: "Paris", country: "Frankrike", lat: 48.880948, lng: 2.355314, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Paris Gare de Lyon", city: "Paris (Lyon)", country: "Frankrike", lat: 48.844304, lng: 2.374377, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Lyon Part-Dieu", city: "Lyon", country: "Frankrike", lat: 45.760596, lng: 4.859409, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Marseille Saint-Charles", city: "Marseille", country: "Frankrike", lat: 43.302666, lng: 5.380407, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Nice-Ville", city: "Nice", country: "Frankrike", lat: 43.704556, lng: 7.261904, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Zürich HB", city: "Zürich", country: "Sveits", lat: 47.377847, lng: 8.540502, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Bern", city: "Bern", country: "Sveits", lat: 46.948832, lng: 7.439131, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Genève Cornavin", city: "Genève", country: "Sveits", lat: 46.21022, lng: 6.14244, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Interlaken Ost", city: "Interlaken", country: "Sveits", lat: 46.690548, lng: 7.869049, modes: ["LONG_DISTANCE", "REGIONAL_RAIL"] },
  { name: "Wien Hbf", city: "Wien", country: "Østerrike", lat: 48.185184, lng: 16.376413, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Salzburg Hbf", city: "Salzburg", country: "Østerrike", lat: 47.813019, lng: 13.045769, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Innsbruck Hbf", city: "Innsbruck", country: "Østerrike", lat: 47.263219, lng: 11.400975, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Praha hl.n.", city: "Praha", country: "Tsjekkia", lat: 50.083062, lng: 14.435298, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Warszawa Centralna", city: "Warszawa", country: "Polen", lat: 52.22886, lng: 21.00323, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Kraków Główny", city: "Krakow", country: "Polen", lat: 50.068482, lng: 19.947503, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Gdańsk Główny", city: "Gdansk", country: "Polen", lat: 54.3554, lng: 18.6441, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Budapest-Nyugati", city: "Budapest", country: "Ungarn", lat: 47.51053, lng: 19.05749, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Budapest-Keleti", city: "Budapest (Keleti)", country: "Ungarn", lat: 47.500408, lng: 19.083981, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Bratislava hl.st.", city: "Bratislava", country: "Slovakia", lat: 48.1586, lng: 17.1066, modes: ["LONG_DISTANCE"] },
  { name: "Ljubljana", city: "Ljubljana", country: "Slovenia", lat: 46.058195, lng: 14.512385, modes: ["LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Zagreb Glavni kolodvor", city: "Zagreb", country: "Kroatia", lat: 45.804731, lng: 15.978852, modes: ["LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Split", city: "Split", country: "Kroatia", lat: 43.5046, lng: 16.4426, modes: ["LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Milano Centrale", city: "Milano", country: "Italia", lat: 45.48622, lng: 9.204443, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Venezia Santa Lucia", city: "Venezia", country: "Italia", lat: 45.441069, lng: 12.321044, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Firenze Santa Maria Novella", city: "Firenze", country: "Italia", lat: 43.776439, lng: 11.247876, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Roma Termini", city: "Roma", country: "Italia", lat: 41.900962, lng: 12.502037, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Napoli Centrale", city: "Napoli", country: "Italia", lat: 40.852879, lng: 14.272496, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Barcelona-Sants", city: "Barcelona", country: "Spania", lat: 41.37906, lng: 2.140199, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Madrid-Puerta de Atocha", city: "Madrid", country: "Spania", lat: 40.406442, lng: -3.690886, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Sevilla-Santa Justa", city: "Sevilla", country: "Spania", lat: 37.39186, lng: -5.97523, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Lisboa Santa Apolónia", city: "Lisboa", country: "Portugal", lat: 38.7138, lng: -9.1225, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "Porto-Campanhã", city: "Porto", country: "Portugal", lat: 41.1489, lng: -8.5856, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE"] },
  { name: "București Nord", city: "Bucuresti", country: "Romania", lat: 44.4467, lng: 26.0744, modes: ["LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Helsinki Central", city: "Helsinki", country: "Finland", lat: 60.1719, lng: 24.9414, modes: ["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL"] }
];

let liveSelectedFrom = null;
let liveSelectedTo = null;
let liveDropdownResultsFrom = [];
let liveDropdownResultsTo = [];
let liveSearchJourneys = [];
let liveFromDebounce = null;
let liveToDebounce = null;

// Google Polyline decoder (Transitous MOTIS v5 uses precision = 6)
function decodePolyline(encoded, precision = 6) {
  if (!encoded || typeof encoded !== "string") return [];
  const factor = Math.pow(10, precision);
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coordinates.push([
      Number((lat / factor).toFixed(5)),
      Number((lng / factor).toFixed(5))
    ]);
  }
  return coordinates;
}

// Downsample coordinate array to keep localStorage & Firestore lightweight
function downsampleCoords(coords, maxPoints = 110) {
  if (!Array.isArray(coords) || coords.length <= maxPoints) return coords;
  const result = [coords[0]];
  const step = (coords.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  result.push(coords[coords.length - 1]);
  return result;
}

// Resolve a city/station string to coordinates (local dictionary first, then Transitous geocode)
async function resolveStationCoordinates(queryStr) {
  if (!queryStr) return null;
  const q = queryStr.trim().toLowerCase();

  // 1. Check user's itinerary stops
  const matchingStop = (appState.stops || []).find(
    s => s.city && (s.city.toLowerCase() === q || q.includes(s.city.toLowerCase()) || s.city.toLowerCase().includes(q))
  );

  // 2. Check curated European rail stations (exact station coordinates are better for rail routing)
  const hub = EUROPEAN_RAIL_STATIONS.find(
    st => st.city.toLowerCase() === q || st.name.toLowerCase() === q || st.name.toLowerCase().includes(q) || q.includes(st.city.toLowerCase())
  );
  if (hub) {
    return { name: hub.name, city: hub.city, country: hub.country, lat: hub.lat, lng: hub.lng };
  }

  // 3. Query Transitous Geocode API
  try {
    const res = await fetch(`${TRANSITOUS_API_BASE}/api/v1/geocode?text=${encodeURIComponent(queryStr)}&lang=no`);
    if (res.ok) {
      const items = await res.json();
      const railStop = items.find(i => i.type === "STOP" && Array.isArray(i.modes) && i.modes.some(m => m.includes("RAIL") || m === "LONG_DISTANCE" || m === "SUBURBAN"))
        || items.find(i => i.type === "STOP")
        || items[0];
      if (railStop && typeof railStop.lat === "number" && typeof railStop.lon === "number") {
        const countryArea = Array.isArray(railStop.areas) ? railStop.areas.find(a => a.adminLevel === 2) : null;
        return {
          name: railStop.name,
          city: railStop.name,
          country: countryArea ? countryArea.name : "",
          lat: railStop.lat,
          lng: railStop.lon
        };
      }
    }
  } catch (err) {
    console.warn("Transitous geocode fallback:", err);
  }

  if (matchingStop && typeof matchingStop.lat === "number" && typeof matchingStop.lng === "number") {
    return { name: matchingStop.city, city: matchingStop.city, country: matchingStop.country || "", lat: matchingStop.lat, lng: matchingStop.lng };
  }

  return null;
}

// Search stations for autocomplete dropdown
async function searchStationsLive(query) {
  const q = (query || "").trim().toLowerCase();
  const localMatches = EUROPEAN_RAIL_STATIONS.filter(st =>
    !q || st.name.toLowerCase().includes(q) || st.city.toLowerCase().includes(q) || st.country.toLowerCase().includes(q)
  ).slice(0, 6);

  if (q.length < 2) {
    return localMatches;
  }

  try {
    const res = await fetch(`${TRANSITOUS_API_BASE}/api/v1/geocode?text=${encodeURIComponent(query)}&lang=no`);
    if (!res.ok) return localMatches;
    const data = await res.json();

    const apiStops = (data || [])
      .filter(item => item.type === "STOP" && typeof item.lat === "number" && typeof item.lon === "number")
      .sort((a, b) => {
        const aHasRail = Array.isArray(a.modes) && a.modes.some(m => m.includes("RAIL") || m === "LONG_DISTANCE");
        const bHasRail = Array.isArray(b.modes) && b.modes.some(m => m.includes("RAIL") || m === "LONG_DISTANCE");
        if (aHasRail && !bHasRail) return -1;
        if (!aHasRail && bHasRail) return 1;
        return (b.importance || 0) - (a.importance || 0);
      })
      .slice(0, 7)
      .map(item => {
        const countryArea = Array.isArray(item.areas) ? item.areas.find(a => a.adminLevel === 2) : null;
        const cityArea = Array.isArray(item.areas) ? item.areas.find(a => a.adminLevel >= 6 && a.adminLevel <= 8) : null;
        return {
          name: item.name,
          city: cityArea ? cityArea.name : item.name,
          country: countryArea ? countryArea.name : "",
          lat: item.lat,
          lng: item.lon,
          modes: item.modes || []
        };
      });

    // Deduplicate by name
    const merged = [...localMatches];
    apiStops.forEach(st => {
      if (!merged.some(m => m.name.toLowerCase() === st.name.toLowerCase())) {
        merged.push(st);
      }
    });
    return merged.slice(0, 8);
  } catch (e) {
    return localMatches;
  }
}

function renderStationDropdown(field, results) {
  const dropdown = document.getElementById(field === "from" ? "live-from-dropdown" : "live-to-dropdown");
  if (!dropdown) return;

  if (!results || results.length === 0) {
    dropdown.classList.add("hidden");
    return;
  }

  dropdown.innerHTML = results.map((st, idx) => {
    const modes = st.modes || [];
    let modeBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">Togstasjon</span>`;
    if (modes.includes("HIGHSPEED_RAIL")) {
      modeBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">⚡ Høyhastighet</span>`;
    } else if (modes.includes("NIGHT_RAIL")) {
      modeBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">🌙 Nattog</span>`;
    } else if (modes.includes("LONG_DISTANCE")) {
      modeBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">🚆 Fjerntog</span>`;
    }

    return `
      <button 
        type="button" 
        onclick="selectLiveStation(${jsArg(field)}, ${Number(idx)})" 
        class="w-full text-left px-3.5 py-2.5 hover:bg-brand-50/70 transition flex items-center justify-between gap-2"
      >
        <div class="min-w-0">
          <p class="text-xs sm:text-sm font-bold text-slate-900 truncate">${escapeHtml(st.name)}</p>
          <p class="text-[11px] text-slate-500 truncate">${escapeHtml(st.city)}${st.country ? ` • ${escapeHtml(st.country)}` : ''}</p>
        </div>
        <div class="shrink-0">${modeBadge}</div>
      </button>
    `;
  }).join("");

  dropdown.classList.remove("hidden");
}

export function selectLiveStation(field, idx) {
  if (field === "from") {
    const st = liveDropdownResultsFrom[idx];
    if (!st) return;
    liveSelectedFrom = st;
    const input = document.getElementById("live-from-input");
    if (input) input.value = st.name;
    const dropdown = document.getElementById("live-from-dropdown");
    if (dropdown) dropdown.classList.add("hidden");
  } else {
    const st = liveDropdownResultsTo[idx];
    if (!st) return;
    liveSelectedTo = st;
    const input = document.getElementById("live-to-input");
    if (input) input.value = st.name;
    const dropdown = document.getElementById("live-to-dropdown");
    if (dropdown) dropdown.classList.add("hidden");
  }
}

export function swapLiveSearchStations() {
  const fromInput = document.getElementById("live-from-input");
  const toInput = document.getElementById("live-to-input");
  if (!fromInput || !toInput) return;

  const tmpVal = fromInput.value;
  fromInput.value = toInput.value;
  toInput.value = tmpVal;

  const tmpSt = liveSelectedFrom;
  liveSelectedFrom = liveSelectedTo;
  liveSelectedTo = tmpSt;
}

export function focusLiveTrainSearch() {
  setLiveSearchOpen(true);
  setTimeout(() => {
    const fromInput = document.getElementById("live-from-input");
    if (fromInput) {
      fromInput.focus();
      fromInput.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 150);
}

// Render quick-route chips from consecutive stops in appState.stops + popular routes
export function renderLiveRouteChips() {
  const container = document.getElementById("live-route-chips");
  if (!container) return;

  const chips = [];
  const stops = appState.stops || [];

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    chips.push({
      label: `${a.city} → ${b.city}`,
      fromName: a.city,
      fromLat: a.lat,
      fromLng: a.lng,
      toName: b.city,
      toLat: b.lat,
      toLng: b.lng,
      date: a.departure || appState.trip.startDate || "",
      isTripLeg: true
    });
  }

  // Add popular European routes if fewer than 5 chips
  const popular = [
    { label: "Oslo S → Göteborg", fromName: "Oslo S", fromLat: 59.910357, fromLng: 10.753051, toName: "Göteborg Centralstation", toLat: 57.70887, toLng: 11.97347 },
    { label: "København H → Hamburg Hbf", fromName: "København H", fromLat: 55.672767, fromLng: 12.564928, toName: "Hamburg Hbf", toLat: 53.55293, toLng: 10.006614 },
    { label: "Berlin Hbf → Praha hl.n.", fromName: "Berlin Hbf", fromLat: 52.525084, fromLng: 13.369402, toName: "Praha hl.n.", toLat: 50.083062, toLng: 14.435298 },
    { label: "Paris → Milano", fromName: "Paris Gare de Lyon", fromLat: 48.844304, fromLng: 2.374377, toName: "Milano Centrale", toLat: 45.48622, toLng: 9.204443 },
    { label: "Zürich HB → Wien Hbf", fromName: "Zürich HB", fromLat: 47.377847, fromLng: 8.540502, toName: "Wien Hbf", toLat: 48.185184, toLng: 16.376413 }
  ];

  popular.forEach(p => {
    if (!chips.some(c => c.label.toLowerCase() === p.label.toLowerCase())) {
      chips.push({ ...p, date: "", isTripLeg: false });
    }
  });

  container.innerHTML = chips.map(c => `
    <button 
      type="button"
      onclick="quickSearchRouteChip(${jsArg(c.fromName)}, ${Number(c.fromLat)}, ${Number(c.fromLng)}, ${jsArg(c.toName)}, ${Number(c.toLat)}, ${Number(c.toLng)}, ${jsArg(c.date)})"
      class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 border ${
        c.isTripLeg 
          ? 'bg-brand-50 hover:bg-brand-100 text-brand-800 border-brand-200 shadow-2xs' 
          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
      }"
    >
      <i data-lucide="${c.isTripLeg ? 'route' : 'train'}" class="w-3.5 h-3.5 ${c.isTripLeg ? 'text-brand-600' : 'text-slate-400'}"></i>
      <span>${escapeHtml(c.label)}</span>
    </button>
  `).join("");

  if (window.lucide) lucide.createIcons();
}

export async function quickSearchRouteChip(fromName, fromLat, fromLng, toName, toLat, toLng, dateStr) {
  setLiveSearchOpen(true);
  const fromInput = document.getElementById("live-from-input");
  const toInput = document.getElementById("live-to-input");
  const dateInput = document.getElementById("live-date-input");

  // Prefer exact railway station coordinates from EUROPEAN_RAIL_STATIONS if city matches
  const resolvedFrom = await resolveStationCoordinates(fromName);
  const resolvedTo = await resolveStationCoordinates(toName);

  liveSelectedFrom = resolvedFrom || { name: fromName, city: fromName, lat: Number(fromLat), lng: Number(fromLng) };
  liveSelectedTo = resolvedTo || { name: toName, city: toName, lat: Number(toLat), lng: Number(toLng) };

  if (fromInput) fromInput.value = liveSelectedFrom.name;
  if (toInput) toInput.value = liveSelectedTo.name;
  if (dateInput && dateStr) {
    dateInput.value = dateStr;
  }

  await executeLiveTrainSearch();
}

export async function quickSearchBetweenStops(fromIdx, toIdx) {
  const fromStop = appState.stops[fromIdx];
  const toStop = appState.stops[toIdx];
  if (!fromStop || !toStop) return;

  switchTab("trains");
  await quickSearchRouteChip(
    fromStop.city,
    fromStop.lat,
    fromStop.lng,
    toStop.city,
    toStop.lat,
    toStop.lng,
    fromStop.departure || ""
  );
}

// Classify Interrail seat reservation requirement & estimate price in NOK
function classifyInterrailReservation(railLegs) {
  let status = "not_needed";
  let priceNok = 0;
  const notes = [];

  for (const leg of railLegs) {
    const name = `${leg.displayName || ""} ${leg.tripShortName || ""} ${leg.routeShortName || ""} ${leg.agencyName || ""}`.toUpperCase();
    const mode = (leg.mode || "").toUpperCase();

    if (name.includes("EUROSTAR") || name.includes("THALYS")) {
      status = "required";
      priceNok = Math.max(priceNok, 350);
      notes.push("Eurostar krever obligatorisk Interrail-plassreservasjon (~30–35 €)");
    } else if (name.includes("TGV") || name.includes("OUIGO") || name.includes("LYRIA")) {
      status = "required";
      priceNok = Math.max(priceNok, 220);
      notes.push("TGV i Frankrike krever obligatorisk plassreservasjon (~10–20 €)");
    } else if (name.includes("FRECCIAROSSA") || name.includes("FRECCIARGENTO") || name.includes("FRECCIABIANCA") || name.includes("ITALO") || name.includes("LE FRECCE")) {
      status = "required";
      priceNok = Math.max(priceNok, 155);
      notes.push("Høyhastighetstog i Italia (Frecciarossa) krever plassreservasjon (~13 €)");
    } else if (name.includes("AVE") || name.includes("AVLO") || name.includes("ALVIA") || name.includes("EUROMED")) {
      status = "required";
      priceNok = Math.max(priceNok, 140);
      notes.push("Spanske høyhastighetstog (Renfe AVE/Alvia) krever plassreservasjon (~10–12 €)");
    } else if (mode === "NIGHT_RAIL" || name.includes("NIGHTJET") || name.includes(" NJ ") || name.startsWith("NJ ") || name.includes("EURONIGHT") || name.startsWith("EN ") || name.includes("SNÄLLTÅGET")) {
      status = "required";
      priceNok = Math.max(priceNok, 340);
      notes.push("Nattog krever reservasjon av sete/liggevogn (~20–35 €)");
    } else if (name.includes("SJ ") || name.includes("SNABBTÅG") || name.includes("X2000")) {
      status = "required";
      priceNok = Math.max(priceNok, 95);
      notes.push("SJ hurtigtog i Sverige krever plassreservasjon (~7–10 €)");
    } else if (name.includes("EIP") || name.includes("PENDOLINO") || name.includes("PKP")) {
      status = "required";
      priceNok = Math.max(priceNok, 60);
      notes.push("Polske InterCity/EIP-tog krever rimelig plassreservasjon (~1–6 €)");
    }
  }

  if (status === "not_needed") {
    notes.push("Plassreservasjon er valgfri (anbefales i høysesong ~55 kr / 4,90 €)");
  }

  return {
    reservationStatus: status,
    reservationPrice: priceNok,
    reservationNote: notes[0] || ""
  };
}

function formatTimeHHMM(isoStr) {
  if (!isoStr) return "--:--";
  try {
    const d = new Date(isoStr);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch (e) {
    return "--:--";
  }
}

function formatDurationSeconds(sec) {
  if (!sec || isNaN(sec)) return "";
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}t ${String(m).padStart(2, "0")}m`;
}

// Compute a date within the next 14 days that matches the same weekday if a user date is far in the future
function getFallbackNearTermDate(dateStr) {
  const now = new Date();
  const target = dateStr ? new Date(dateStr) : now;
  const targetDay = isNaN(target.getTime()) ? now.getDay() : target.getDay();

  const near = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const diffDays = (targetDay - near.getDay() + 7) % 7;
  near.setDate(near.getDate() + diffDays);

  const yyyy = near.getFullYear();
  const mm = String(near.getMonth() + 1).padStart(2, "0");
  const dd = String(near.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Core API call to Transitous /api/v5/plan
async function queryTransitousItineraries(fromSt, toSt, dateStr, timeStr) {
  const cleanDate = dateStr || getFallbackNearTermDate();
  const cleanTime = (timeStr || "08:00").slice(0, 5);
  let parsedDate = new Date(`${cleanDate}T${cleanTime}:00`);
  if (isNaN(parsedDate.getTime())) {
    parsedDate = new Date();
  }
  const isoQuery = parsedDate.toISOString();
  const railModes = "RAIL,HIGHSPEED_RAIL,LONG_DISTANCE,NIGHT_RAIL,REGIONAL_RAIL,REGIONAL_FAST_RAIL,SUBURBAN,SUBWAY,TRAM,FERRY";
  const railUrl = `${TRANSITOUS_API_BASE}/api/v5/plan?fromPlace=${fromSt.lat},${fromSt.lng}&toPlace=${toSt.lat},${toSt.lng}&time=${encodeURIComponent(isoQuery)}&transitModes=${railModes}`;

  const res = await fetch(railUrl);
  if (res.ok) {
    const data = await res.json();
    if (Array.isArray(data.itineraries) && data.itineraries.length > 0) {
      return data.itineraries;
    }
  }

  // Fallback without transitModes filter in case a connector leg is needed
  const fallbackUrl = `${TRANSITOUS_API_BASE}/api/v5/plan?fromPlace=${fromSt.lat},${fromSt.lng}&toPlace=${toSt.lat},${toSt.lng}&time=${encodeURIComponent(isoQuery)}`;
  const fallbackRes = await fetch(fallbackUrl);
  if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}`);
  const fallbackData = await fallbackRes.json();
  return fallbackData.itineraries || [];
}

export async function executeLiveTrainSearch(e) {
  if (e && e.preventDefault) e.preventDefault();

  const fromInput = document.getElementById("live-from-input");
  const toInput = document.getElementById("live-to-input");
  const dateInput = document.getElementById("live-date-input");
  const timeInput = document.getElementById("live-time-input");
  const resultsEl = document.getElementById("live-search-results");
  const submitBtn = document.getElementById("live-search-submit-btn");

  if (!fromInput || !toInput || !resultsEl) return;

  const fromQuery = fromInput.value.trim();
  const toQuery = toInput.value.trim();
  if (!fromQuery || !toQuery) {
    showToast("Mangler stasjon", "Skriv inn både avreise- og ankomststasjon.", "alert-circle");
    return;
  }

  let requestedDate = dateInput && dateInput.value ? dateInput.value : getFallbackNearTermDate();
  const requestedTime = timeInput && timeInput.value ? timeInput.value : "08:00";

  resultsEl.classList.remove("hidden");
  resultsEl.innerHTML = `
    <div class="bg-slate-50 rounded-2xl border border-slate-200/80 p-6 text-center space-y-2">
      <div class="w-8 h-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin mx-auto"></div>
      <p class="text-sm font-bold text-slate-800">Søker i europeiske togrutetabeller...</p>
      <p class="text-xs text-slate-500">Henter avganger, bytter og faktiske jernbanespor mellom ${escapeHtml(fromQuery)} og ${escapeHtml(toQuery)}</p>
    </div>
  `;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-70");
  }

  try {
    // Resolve station coordinates if the user typed free text without clicking dropdown
    if (!liveSelectedFrom || liveSelectedFrom.name.toLowerCase() !== fromQuery.toLowerCase()) {
      liveSelectedFrom = await resolveStationCoordinates(fromQuery);
    }
    if (!liveSelectedTo || liveSelectedTo.name.toLowerCase() !== toQuery.toLowerCase()) {
      liveSelectedTo = await resolveStationCoordinates(toQuery);
    }

    if (!liveSelectedFrom || !liveSelectedTo) {
      resultsEl.innerHTML = `
        <div class="bg-rose-50 rounded-xl border border-rose-200 p-4 text-xs text-rose-800 font-medium">
          Fant ikke koordinater for én av stasjonene. Prøv å velge en stasjon fra forslagslisten (f.eks. <strong>Berlin Hbf</strong> eller <strong>Praha hl.n.</strong>).
        </div>
      `;
      return;
    }

    const todayIso = new Date().toISOString().split("T")[0];
    let usedFallbackDate = false;
    let effectiveSearchDate = requestedDate;
    let rawItineraries = [];

    // If requestedDate is in the past, immediately query the matching weekday in the active timetable window
    if (requestedDate < todayIso) {
      effectiveSearchDate = getFallbackNearTermDate(requestedDate);
      usedFallbackDate = effectiveSearchDate !== requestedDate;
      rawItineraries = await queryTransitousItineraries(liveSelectedFrom, liveSelectedTo, effectiveSearchDate, requestedTime);
    } else {
      rawItineraries = await queryTransitousItineraries(liveSelectedFrom, liveSelectedTo, requestedDate, requestedTime);
      // If the user's trip is many months in the future and GTFS schedules aren't published yet, fallback to same weekday in current timetable period
      if (rawItineraries.length === 0) {
        const fallbackDate = getFallbackNearTermDate(requestedDate);
        if (fallbackDate !== requestedDate) {
          rawItineraries = await queryTransitousItineraries(liveSelectedFrom, liveSelectedTo, fallbackDate, requestedTime);
          if (rawItineraries.length > 0) {
            usedFallbackDate = true;
            effectiveSearchDate = fallbackDate;
          }
        }
      }
    }

    // Transform raw itineraries into structured RailSync journeys
    liveSearchJourneys = rawItineraries
      .map((it) => {
        const transitLegs = (it.legs || []).filter(l => l.mode && l.mode !== "WALK" && l.mode !== "BIKE" && l.mode !== "CAR");
        if (transitLegs.length === 0) return null;

        const firstLeg = transitLegs[0];
        const lastLeg = transitLegs[transitLegs.length - 1];

        // Combine decoded polylines from all legs and downsample
        let combinedCoords = [];
        (it.legs || []).forEach(leg => {
          if (leg.legGeometry && leg.legGeometry.points) {
            const pts = decodePolyline(leg.legGeometry.points, leg.legGeometry.precision || 6);
            combinedCoords.push(...pts);
          }
        });
        const routeGeometry = downsampleCoords(combinedCoords, 130);

        const primaryLines = transitLegs.map(l => l.displayName || l.tripShortName || l.routeShortName || l.mode);
        const primaryAgencies = Array.from(new Set(transitLegs.map(l => l.agencyName).filter(Boolean)));

        const legsSummary = transitLegs.map(l => ({
          line: l.displayName || l.tripShortName || l.routeShortName || "Tog",
          agency: l.agencyName || "",
          from: l.from ? l.from.name : "",
          to: l.to ? l.to.name : "",
          dep: formatTimeHHMM(l.startTime),
          arr: formatTimeHHMM(l.endTime),
          platform: l.from ? (l.from.track || "") : "",
          arrPlatform: l.to ? (l.to.track || "") : "",
          mode: l.mode || "RAIL"
        }));

        const resInfo = classifyInterrailReservation(transitLegs);
        const hasNightTrain = transitLegs.some(l => l.mode === "NIGHT_RAIL" || (l.displayName || "").toUpperCase().includes("NJ") || (l.displayName || "").toUpperCase().includes("EN"));

        return {
          fromCity: firstLeg.from ? firstLeg.from.name : liveSelectedFrom.name,
          toCity: lastLeg.to ? lastLeg.to.name : liveSelectedTo.name,
          date: requestedDate,
          effectiveSearchDate,
          departureTime: formatTimeHHMM(firstLeg.startTime),
          arrivalTime: formatTimeHHMM(lastLeg.endTime),
          duration: formatDurationSeconds(it.duration),
          durationSec: it.duration || 0,
          transfers: Math.max(0, transitLegs.length - 1),
          trainType: primaryAgencies[0] || (hasNightTrain ? "Nightjet / Nattog" : " InterCity / Lyn"),
          trainNumber: primaryLines.slice(0, 3).join(" → "),
          platform: firstLeg.from ? (firstLeg.from.track || "") : "",
          arrivalPlatform: lastLeg.to ? (lastLeg.to.track || "") : "",
          reservationStatus: resInfo.reservationStatus,
          reservationPrice: resInfo.reservationPrice,
          reservationNote: resInfo.reservationNote,
          isTravelDay: true,
          legsSummary,
          routeGeometry
        };
      })
      .filter(Boolean);

    renderLiveSearchResults(usedFallbackDate, requestedDate, effectiveSearchDate);
  } catch (err) {
    console.error("Live train search failed:", err);
    resultsEl.innerHTML = `
      <div class="bg-rose-50 rounded-xl border border-rose-200 p-4 text-xs text-rose-800 space-y-1">
        <p class="font-bold">Kunne ikke hente togruter akkurat nå</p>
        <p>Sjekk internettforbindelsen din eller prøv en annen stasjon (${escapeHtml(err.message)}).</p>
      </div>
    `;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("opacity-70");
    }
  }
}

function renderLiveSearchResults(usedFallbackDate, requestedDate, effectiveSearchDate) {
  const resultsEl = document.getElementById("live-search-results");
  if (!resultsEl) return;

  if (!liveSearchJourneys || liveSearchJourneys.length === 0) {
    resultsEl.innerHTML = `
      <div class="bg-amber-50 rounded-xl border border-amber-200 p-4 text-xs text-amber-900">
        Ingen direkte eller sammenhengende togforbindelser ble funnet mellom disse stasjonene på dette tidspunktet. Prøv et tidligere klokkeslett (f.eks. 07:00) eller søk opp en knutepunktstasjon underveis.
      </div>
    `;
    return;
  }

  const fallbackBanner = usedFallbackDate
    ? `
      <div class="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-900 flex items-start gap-2">
        <i data-lucide="calendar-clock" class="w-4 h-4 text-blue-600 shrink-0 mt-0.5"></i>
        <div>
          <strong>Sesongbasert rutetabell:</strong> Togselskapene har ikke sluppet endelige avgangstider for ${formatDate(requestedDate)} ennå. Viser reelle avgangstider fra tilsvarende ukedag (${formatDate(effectiveSearchDate)}) — ved import lagres reisen på din valgte dato (${formatDate(requestedDate)}).
        </div>
      </div>
    `
    : '';

  resultsEl.innerHTML = `
    <div class="flex items-center justify-between pt-1">
      <p class="text-xs font-bold text-slate-700">
        Fant ${liveSearchJourneys.length} reelle togforbindelser mellom <span class="text-brand-700">${escapeHtml(liveSearchJourneys[0].fromCity)}</span> og <span class="text-brand-700">${escapeHtml(liveSearchJourneys[0].toCity)}</span>
      </p>
      <button type="button" onclick="document.getElementById('live-search-results').classList.add('hidden')" class="text-xs text-slate-400 hover:text-slate-600 font-medium">
        Skjul treff ✕
      </button>
    </div>
    ${fallbackBanner}
    <div class="grid grid-cols-1 gap-3">
      ${liveSearchJourneys.map((j, idx) => {
        const isReq = j.reservationStatus === "required";
        const resPill = isReq
          ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">⚠️ Reservasjon kreves (~${j.reservationPrice} kr)</span>`
          : `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Reservasjon valgfri (0 kr)</span>`;

        const transferBadge = j.transfers === 0
          ? `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-brand-50 text-brand-700">Direktetog</span>`
          : `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">${j.transfers} bytte${j.transfers > 1 ? 'r' : ''}</span>`;

        return `
          <div class="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200/90 hover:border-brand-300 p-3.5 sm:p-4 transition space-y-2.5 shadow-2xs">
            <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/60 flex-wrap">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="px-2 py-0.5 rounded-lg bg-fjord-800 text-white text-xs font-extrabold">${escapeHtml(j.trainNumber)}</span>
                <span class="text-xs font-semibold text-slate-600">${escapeHtml(j.trainType)}</span>
                ${transferBadge}
              </div>
              <div>${resPill}</div>
            </div>

            <!-- Horizontal 3-column ticket layout on both mobile and desktop -->
            <div class="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-4 items-center py-0.5">
              <div class="min-w-0">
                <p class="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">${escapeHtml(j.departureTime)}</p>
                <p class="text-xs font-bold text-slate-700 truncate">${escapeHtml(j.fromCity)}</p>
                ${j.platform ? `<p class="text-[10px] sm:text-[11px] text-brand-600 font-semibold">Spor ${escapeHtml(j.platform)}</p>` : ''}
              </div>

              <div class="flex flex-col items-center justify-center text-center px-1 sm:px-3 min-w-[72px] sm:min-w-[110px]">
                <span class="text-[10px] sm:text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <i data-lucide="clock" class="w-3 h-3 text-brand-600"></i> ${escapeHtml(j.duration)}
                </span>
                <div class="w-full flex items-center justify-center gap-1.5">
                  <div class="h-0.5 flex-1 bg-slate-200"></div>
                  <div class="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <i data-lucide="arrow-right" class="w-3 h-3"></i>
                  </div>
                  <div class="h-0.5 flex-1 bg-slate-200"></div>
                </div>
              </div>

              <div class="text-right min-w-0">
                <p class="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">${escapeHtml(j.arrivalTime)}</p>
                <p class="text-xs font-bold text-slate-700 truncate">${escapeHtml(j.toCity)}</p>
                ${j.arrivalPlatform ? `<p class="text-[10px] sm:text-[11px] text-brand-600 font-semibold">Spor ${escapeHtml(j.arrivalPlatform)}</p>` : ''}
              </div>
            </div>

            ${j.legsSummary && j.legsSummary.length > 1 ? `
              <div class="flex flex-wrap items-center gap-1 text-[11px] text-slate-600 pt-1">
                ${j.legsSummary.map((leg, i) => `
                  <span class="px-2 py-0.5 rounded bg-white border border-slate-200 font-medium">
                    <strong>${escapeHtml(leg.line)}</strong> (${escapeHtml(leg.dep)}–${escapeHtml(leg.arr)})
                  </span>
                  ${i < j.legsSummary.length - 1 ? '<span class="text-slate-400">→</span>' : ''}
                `).join("")}
              </div>
            ` : ''}

            <div class="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p class="text-[11px] text-slate-500 italic">${escapeHtml(j.reservationNote)}</p>
              <div class="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                <button 
                  type="button" 
                  onclick="previewLiveRouteOnMap(${Number(idx)})" 
                  class="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <i data-lucide="map" class="w-3.5 h-3.5 text-brand-600 shrink-0"></i>
                  <span>Se på kart</span>
                </button>
                <button 
                  type="button" 
                  onclick="importLiveJourneyToTrip(${Number(idx)})" 
                  class="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-2xs transition flex items-center justify-center gap-1.5"
                >
                  <i data-lucide="plus-circle" class="w-3.5 h-3.5 shrink-0"></i>
                  <span>Legg til</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

export function importLiveJourneyToTrip(idx) {
  if (!requireEditPermission()) return;
  const j = liveSearchJourneys[idx];
  if (!j) return;

  const newTrain = {
    id: "tr-live-" + Date.now(),
    fromCity: j.fromCity,
    toCity: j.toCity,
    date: j.date,
    departureTime: j.departureTime,
    arrivalTime: j.arrivalTime,
    trainType: j.trainType,
    trainNumber: j.trainNumber,
    platform: j.platform || "",
    arrivalPlatform: j.arrivalPlatform || "",
    transfers: j.transfers || 0,
    reservationStatus: j.reservationStatus,
    reservationPrice: j.reservationPrice,
    reservationNote: j.reservationNote,
    duration: j.duration,
    isTravelDay: true,
    legsSummary: j.legsSummary || [],
    routeGeometry: normalizeGeometry(j.routeGeometry)
  };

  appState.trains.push(newTrain);

  // Automatically log mandatory seat reservation cost in personal budget if > 0
  if (j.reservationStatus === "required" && j.reservationPrice > 0) {
    appState.expenses.push({
      id: "exp-res-" + Date.now(),
      title: `Plassreservasjon ${j.trainNumber} (${j.fromCity} → ${j.toCity})`,
      category: "Transport",
      amount: j.reservationPrice,
      date: j.date
    });
    savePersonalBudgetStateOnly();
  }

  persistState(`Importerte togreise: ${j.fromCity} → ${j.toCity} (${j.departureTime}–${j.arrivalTime})`);
  renderAll();
  updateMapLayers();

  showToast(
    "Togreise lagt til!",
    `${j.fromCity} → ${j.toCity} (${j.departureTime}–${j.arrivalTime}) med ekte jernbanespor er lagret.`,
    "train"
  );
}

export function previewLiveRouteOnMap(idx) {
  const j = liveSearchJourneys[idx];
  if (!j || !Array.isArray(j.routeGeometry) || j.routeGeometry.length < 2) {
    showToast("Ingen sporgeometri", "Denne ruten mangler detaljert sporgeometri.", "alert-circle");
    return;
  }

  switchTab("overview");

  setTimeout(() => {
    if (!map) return;
    if (window.innerWidth < 1024) {
      const mapEl = document.getElementById("rail-map");
      if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (previewTrackPolyline) {
      map.removeLayer(previewTrackPolyline);
      previewTrackPolyline = null;
    }

    previewTrackPolyline = L.polyline(j.routeGeometry, {
      color: "#f97316",
      weight: 5,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);

    previewTrackPolyline.bindPopup(`
      <div class="p-3 space-y-1">
        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">Forhåndsvisning av togrute</span>
        <p class="font-bold text-slate-900 text-sm">${escapeHtml(j.fromCity)} → ${escapeHtml(j.toCity)}</p>
        <p class="text-xs text-slate-600">${escapeHtml(j.trainNumber)} • ${escapeHtml(j.duration)}</p>
      </div>
    `).openPopup();

    map.fitBounds(previewTrackPolyline.getBounds(), { padding: [50, 50] });
  }, 220);
}

export function focusTrainTrackOnMap(trainId) {
  const train = (appState.trains || []).find(t => t.id === trainId);
  if (!train || !Array.isArray(train.routeGeometry) || train.routeGeometry.length < 2) return;

  switchTab("overview");
  setTimeout(() => {
    if (!map) return;
    if (window.innerWidth < 1024) {
      setOverviewView("map", { keepMap: true });
    }
    const bounds = L.latLngBounds(train.routeGeometry);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, 220);
}

export async function fetchRealTrackForSingleTrain(trainId, silent = false) {
  const train = (appState.trains || []).find(t => t.id === trainId);
  if (!train) return false;

  const fromSt = await resolveStationCoordinates(train.fromCity);
  const toSt = await resolveStationCoordinates(train.toCity);
  if (!fromSt || !toSt) {
    if (!silent) showToast("Fant ikke stasjon", `Kunne ikke finne koordinater for ${train.fromCity} eller ${train.toCity}.`, "alert-circle");
    return false;
  }

  const searchDate = getFallbackNearTermDate(train.date);
  const searchTime = train.departureTime || "08:00";

  try {
    const itineraries = await queryTransitousItineraries(fromSt, toSt, searchDate, searchTime);
    if (!itineraries || itineraries.length === 0) return false;

    const best = itineraries[0];
    let combined = [];
    (best.legs || []).forEach(leg => {
      if (leg.legGeometry && leg.legGeometry.points) {
        combined.push(...decodePolyline(leg.legGeometry.points, leg.legGeometry.precision || 6));
      }
    });

    if (combined.length > 1) {
      train.routeGeometry = normalizeGeometry(downsampleCoords(combined, 120));
      const transitLegs = (best.legs || []).filter(l => l.mode && l.mode !== "WALK");
      train.transfers = Math.max(0, transitLegs.length - 1);
      if (!silent) {
        persistState();
        renderTrains();
        updateMapLayers();
        showToast("Jernbanespor lastet!", `Faktisk jernbanespor for ${train.fromCity} → ${train.toCity} vises nå i kartet.`, "map");
      }
      return true;
    }
  } catch (e) {
    console.warn("Could not fetch single train track:", e);
  }
  return false;
}

export async function fetchRealTracksForAllTrains(silent = false) {
  const trains = appState.trains || [];
  const missing = trains.filter(t => !Array.isArray(t.routeGeometry) || t.routeGeometry.length < 2);

  if (missing.length === 0) {
    if (!silent) {
      showToast("Alle spor er lastet", "Alle togreisene dine har allerede ekte jernbanespor i kartet.", "check");
    }
    return;
  }

  const btnLabel = document.getElementById("btn-fetch-all-tracks-label");
  if (btnLabel) btnLabel.textContent = `Henter ekte spor (0/${missing.length})...`;

  let updatedCount = 0;
  for (let i = 0; i < missing.length; i++) {
    if (btnLabel) btnLabel.textContent = `Henter ekte spor (${i + 1}/${missing.length})...`;
    const ok = await fetchRealTrackForSingleTrain(missing[i].id, true);
    if (ok) updatedCount++;
  }

  if (updatedCount > 0) {
    persistState();
    renderTrains();
    updateMapLayers();
    if (!silent) {
      showToast("Jernbanespor oppdatert!", `Hentet ekte jernbanespor for ${updatedCount} togreiser i Europa-kartet.`, "zap");
    }
  } else {
    updateMapLayers();
  }
}

function setupLiveTrainSearch() {
  const fromInput = document.getElementById("live-from-input");
  const toInput = document.getElementById("live-to-input");
  const dateInput = document.getElementById("live-date-input");

  if (dateInput && !dateInput.value) {
    dateInput.value = getFallbackNearTermDate(appState.trip ? appState.trip.startDate : "");
  }

  if (fromInput && !fromInput.value && userProfile && userProfile.homeStation) {
    fromInput.value = userProfile.homeStation;
  }

  if (fromInput) {
    fromInput.addEventListener("input", (e) => {
      clearTimeout(liveFromDebounce);
      const val = e.target.value;
      liveFromDebounce = setTimeout(async () => {
        liveDropdownResultsFrom = await searchStationsLive(val);
        renderStationDropdown("from", liveDropdownResultsFrom);
      }, 200);
    });
    fromInput.addEventListener("focus", async () => {
      liveDropdownResultsFrom = await searchStationsLive(fromInput.value);
      renderStationDropdown("from", liveDropdownResultsFrom);
    });
  }

  if (toInput) {
    toInput.addEventListener("input", (e) => {
      clearTimeout(liveToDebounce);
      const val = e.target.value;
      liveToDebounce = setTimeout(async () => {
        liveDropdownResultsTo = await searchStationsLive(val);
        renderStationDropdown("to", liveDropdownResultsTo);
      }, 200);
    });
    toInput.addEventListener("focus", async () => {
      liveDropdownResultsTo = await searchStationsLive(toInput.value);
      renderStationDropdown("to", liveDropdownResultsTo);
    });
  }

  document.addEventListener("click", (e) => {
    const fromDrop = document.getElementById("live-from-dropdown");
    const toDrop = document.getElementById("live-to-dropdown");
    if (fromDrop && fromInput && !fromInput.contains(e.target) && !fromDrop.contains(e.target)) {
      fromDrop.classList.add("hidden");
    }
    if (toDrop && toInput && !toInput.contains(e.target) && !toDrop.contains(e.target)) {
      toDrop.classList.add("hidden");
    }
  });

  renderLiveRouteChips();
}

