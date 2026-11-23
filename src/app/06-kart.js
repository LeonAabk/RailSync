// =============================================================================
// 4. LEAFLET MAP CONTROLLER
// =============================================================================
let map = null;
let mapMarkers = [];
let routePolyline = null;
let realTrackPolylines = [];
let previewTrackPolyline = null;

// Leaflet lastes først når kartet trengs (etter innlogging), ikke på innloggingssiden.
// Samme låste versjon og integritetssjekk som før; service workeren lagrer filene for bruk uten nett.
const LEAFLET_JS = { src: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", integrity: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" };
const LEAFLET_CSS = { href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", integrity: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" };
let leafletPromise = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  // Vent på både stilark og skript, så kartet ikke tegnes uten stiler. Feiler stilarket, tegnes kartet likevel.
  const cssReady = new Promise((resolve) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = LEAFLET_CSS.href;
    css.integrity = LEAFLET_CSS.integrity;
    css.crossOrigin = "";
    css.onload = css.onerror = () => resolve();
    // Først i <head>: appens egne .leaflet-*-stiler i index.html skal fortsatt overstyre Leaflets standard
    document.head.prepend(css);
  });
  const jsReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LEAFLET_JS.src;
    script.integrity = LEAFLET_JS.integrity;
    script.crossOrigin = "";
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); reject(new Error("Kartet kunne ikke lastes")); };
    document.head.appendChild(script);
  });
  leafletPromise = Promise.all([cssReady, jsReady])
    .then(() => window.L)
    .catch((err) => { leafletPromise = null; throw err; });
  return leafletPromise;
}

// Lager kartet hvis det ikke finnes ennå. Kalles når brukeren er logget inn.
export function ensureMap() {
  if (map) return Promise.resolve(map);
  return loadLeaflet()
    .then(() => {
      initMap();
      if (map) {
        // Kartet kan ha blitt laget mens beholderen var skjult; mål på nytt når det vises
        setTimeout(() => { map.invalidateSize(); resetMapView(); }, 150);
      }
      return map;
    })
    .catch(err => { console.warn("Kartet ble ikke startet:", err); return null; });
}

export function initMap() {
  if (map) return;
  const mapContainer = document.getElementById("rail-map");
  if (!mapContainer || !window.L) return;

  map = L.map("rail-map", {
    center: [51.5, 12.0],
    zoom: 4,
    zoomControl: true,
    scrollWheelZoom: true,
    tapHold: true,
    touchZoom: true,
    bounceAtZoomLimits: false
  });

  // OpenStreetMap standard tiles (reliable, clean, no API key required)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  updateMapLayers();
}

export function updateMapLayers() {
  if (!map) return;

  mapMarkers.forEach(m => map.removeLayer(m));
  mapMarkers = [];
  if (routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }
  realTrackPolylines.forEach(p => map.removeLayer(p));
  realTrackPolylines = [];
  if (previewTrackPolyline) {
    map.removeLayer(previewTrackPolyline);
    previewTrackPolyline = null;
  }

  const validStops = appState.stops.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number');

  const latlngs = [];

  validStops.forEach((stop, index) => {
    const isStart = index === 0;
    const isLast = index === validStops.length - 1;
    const pinClass = isStart ? 'start' : (isLast ? 'current' : '');

    const customIcon = L.divIcon({
      className: 'custom-rail-icon',
      html: `<div class="rail-marker-pin ${pinClass}">${index + 1}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });

    const marker = L.marker([stop.lat, stop.lng], { icon: customIcon }).addTo(map);

    let statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">${escapeHtml(stop.accommodationStatus || "")}</span>`;
    const accText = String(stop.accommodationStatus || "");
    if (accText.includes("Bestilt")) {
      statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">✓ Overnatting bestilt</span>`;
    } else if (accText.includes("Ser etter")) {
      statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">⚡ Søker overnatting</span>`;
    }

    // Roomy popup container with generous padding and no right-side cutoff
    const popupContent = `
      <div class="p-4 space-y-2.5 min-w-[240px] max-w-[280px] box-border">
        <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 pr-4">
          <div>
            <span class="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Stopp #${index + 1}</span>
            <h4 class="font-bold text-slate-900 text-base leading-tight">${escapeHtml(stop.city)}</h4>
            <p class="text-xs text-slate-500 font-medium">${escapeHtml(stop.country)}</p>
          </div>
        </div>
        <div class="text-xs text-slate-600 space-y-1.5 pt-0.5">
          <div class="flex items-center gap-1.5 font-medium text-slate-700">
            <span>📅</span> ${formatDate(stop.arrival)} – ${formatDate(stop.departure)}
          </div>
          <div class="pt-0.5">${statusBadge}</div>
          ${stop.accommodationNote ? `<div class="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 italic break-words">${escapeHtml(stop.accommodationNote)}</div>` : ''}
        </div>
        <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <button onclick="openEditStopModal(${jsArg(stop.id)})" class="text-xs text-brand-600 hover:text-brand-800 font-semibold px-2 py-1 rounded hover:bg-brand-50 transition">
            Rediger
          </button>
          <button onclick="deleteStop(${jsArg(stop.id)})" class="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition">
            Fjern stopp
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, { minWidth: 240, maxWidth: 310 });
    mapMarkers.push(marker);
    latlngs.push([stop.lat, stop.lng]);
  });

  // Render real railway tracks from appState.trains (if available)
  const trainsWithGeometry = (appState.trains || []).filter(t => Array.isArray(t.routeGeometry) && t.routeGeometry.length > 1);

  if (latlngs.length > 1) {
    routePolyline = L.polyline(latlngs, {
      color: trainsWithGeometry.length > 0 ? '#94a3b8' : '#0b8176',
      weight: trainsWithGeometry.length > 0 ? 2.5 : 4,
      opacity: trainsWithGeometry.length > 0 ? 0.5 : 0.85,
      dashArray: '8, 8',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
  }

  trainsWithGeometry.forEach((train) => {
    const poly = L.polyline(train.routeGeometry, {
      color: '#0b8176',
      weight: 4.5,
      opacity: 0.92,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    const trackPopup = `
      <div class="p-3.5 space-y-1.5 min-w-[210px]">
        <div class="flex items-center gap-1.5">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">${escapeHtml(train.trainNumber || train.trainType)}</span>
          <span class="text-[11px] font-semibold text-slate-500">${escapeHtml(train.duration || '')}</span>
        </div>
        <p class="font-bold text-slate-900 text-sm">${escapeHtml(train.fromCity)} → ${escapeHtml(train.toCity)}</p>
        <p class="text-xs text-slate-600">Avgang <strong>${escapeHtml(train.departureTime)}</strong> – Ankomst <strong>${escapeHtml(train.arrivalTime)}</strong></p>
        <p class="text-[10px] text-emerald-700 font-semibold">✓ Faktisk jernbanespor fra rutetabell</p>
      </div>
    `;
    poly.bindPopup(trackPopup);
    realTrackPolylines.push(poly);
  });

  // Update map header button label
  const btnLabel = document.getElementById("btn-fetch-all-tracks-label");
  if (btnLabel) {
    const totalTrains = (appState.trains || []).length;
    if (totalTrains > 0 && trainsWithGeometry.length === totalTrains) {
      btnLabel.textContent = `Ekte spor lastet (${trainsWithGeometry.length}/${totalTrains})`;
    } else if (trainsWithGeometry.length > 0) {
      btnLabel.textContent = `Last resten av sporene (${trainsWithGeometry.length}/${totalTrains})`;
    } else {
      btnLabel.textContent = `Last ekte jernbanespor`;
    }
  }

  if (realTrackPolylines.length > 0) {
    const group = L.featureGroup([...realTrackPolylines, ...(routePolyline ? [routePolyline] : [])]);
    map.fitBounds(group.getBounds(), { padding: [50, 50] });
  } else if (routePolyline) {
    map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
  } else if (latlngs.length === 1) {
    map.setView(latlngs[0], 7);
  }
}

export function resetMapView() {
  if (!map) return;
  if (realTrackPolylines.length > 0) {
    const group = L.featureGroup([...realTrackPolylines, ...(routePolyline ? [routePolyline] : [])]);
    map.fitBounds(group.getBounds(), { padding: [50, 50] });
  } else if (routePolyline) {
    map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
  }
}

export function centerMapOnStop(lat, lng) {
  if (!map) return;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || (Number(lat) === 0 && Number(lng) === 0)) {
    showToast("Ukjent posisjon", "Stoppet har ingen plass på kartet. Endre stoppet og velg byen fra listen.", "map-pin");
    return;
  }
  if (window.innerWidth < 1024) setOverviewView("map", { keepMap: true });
  map.flyTo([lat, lng], 8, { duration: 1.0 });
  const targetMarker = mapMarkers.find(m => {
    const pos = m.getLatLng();
    return Math.abs(pos.lat - lat) < 0.001 && Math.abs(pos.lng - lng) < 0.001;
  });
  if (targetMarker) {
    setTimeout(() => targetMarker.openPopup(), 450);
  }
}

