// =============================================================================
// PERSONAL BUDGET STORE (Private per traveler – never shared with companions)
// =============================================================================
export let personalBudgetsByTrip = {};

// Fjerner innhold som ble lagt inn automatisk i eldre versjoner (falsk passutgift og 20 000 kr som standard)
function cleanLegacyBudgets(map) {
  if (!map || typeof map !== "object") return {};
  Object.keys(map).forEach(tid => {
    const b = map[tid];
    if (!b || typeof b !== "object" || b._base || tid === "eksempel-1") return;
    const exp = (Array.isArray(b.expenses) ? b.expenses : []).filter(e => !(e && String(e.id || "").startsWith("exp-personal-") && /^Interrail Global Pass/.test(String(e.title || ""))));
    b.expenses = exp;
    if (Number(b.totalBudget) === 20000 && exp.length === 0) b.totalBudget = 0;
  });
  return map;
}

export function loadPersonalBudgetsFromStorage() {
  try {
    const raw = localStorage.getItem("railsync_personal_budgets_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        personalBudgetsByTrip = cleanLegacyBudgets(parsed);
      }
    }
  } catch (e) {
    console.warn("Kunne ikke lese personlige budsjetter:", e);
  }
}

// Budsjettene ligger i skyen per reise (trips/{id}/budgets/{uid}); her er bare kopien på enheten
export function savePersonalBudgetsToStorage() {
  if (isLoggingOut) return;
  try {
    localStorage.setItem("railsync_personal_budgets_v1", JSON.stringify(personalBudgetsByTrip));
  } catch (e) {}
}

export function getPersonalBudgetForTrip(tripObj) {
  if (!tripObj || !tripObj.id) {
    return { totalBudget: 0, expenses: [] };
  }

  const existing = personalBudgetsByTrip[tripObj.id];
  if (existing && typeof existing === "object") {
    return {
      totalBudget: Number(existing.totalBudget) || 0,
      expenses: Array.isArray(existing.expenses) ? JSON.parse(JSON.stringify(existing.expenses)) : []
    };
  }

  // Nytt budsjett starter tomt – brukeren setter rammen selv
  const initialBudget = 0;
  const initialExpenses = [];

  personalBudgetsByTrip[tripObj.id] = {
    totalBudget: initialBudget,
    expenses: JSON.parse(JSON.stringify(initialExpenses)),
    updatedAt: new Date().toISOString()
  };
  savePersonalBudgetsToStorage();

  return {
    totalBudget: initialBudget,
    expenses: initialExpenses
  };
}

export function updatePersonalBudgetForTrip(tripId, totalBudget, expenses) {
  if (!tripId) return;
  const prev = personalBudgetsByTrip[tripId] || {};
  const next = {
    totalBudget: Math.max(0, Number(totalBudget) || 0),
    expenses: JSON.parse(JSON.stringify(expenses || []))
  };
  const changed = !sameJson({ totalBudget: Number(prev.totalBudget) || 0, expenses: prev.expenses || [] }, next);
  personalBudgetsByTrip[tripId] = { ...prev, ...next, updatedAt: changed ? new Date().toISOString() : (prev.updatedAt || new Date().toISOString()) };
  savePersonalBudgetsToStorage();
  if (changed && !isApplyingRemoteBudget) pushMyBudget(tripId);
}

export function syncActiveTripToState() {
  const active = getActiveTripObject();
  if (!active) {
    activeTripId = null;
    const empty = JSON.parse(JSON.stringify(emptyTripState));
    appState.trip = empty.trip;
    appState.stops = empty.stops;
    appState.trains = empty.trains;
    appState.expenses = empty.expenses;
    appState.packingList = empty.packingList;
    appState.dayPlan = empty.dayPlan;
    stopBudgetListeners();
    return;
  }

  const myBudget = getPersonalBudgetForTrip(active);

  appState.trip = JSON.parse(JSON.stringify(active.trip || emptyTripState.trip));
  appState.trip.totalBudget = myBudget.totalBudget;
  appState.stops = JSON.parse(JSON.stringify(active.stops || []));
  appState.trains = JSON.parse(JSON.stringify(active.trains || []));
  appState.expenses = myBudget.expenses;
  appState.packingList = JSON.parse(JSON.stringify(active.packingList || []));
  appState.dayPlan = JSON.parse(JSON.stringify(active.dayPlan || []));

  active.trip.totalBudget = myBudget.totalBudget;
  active.expenses = JSON.parse(JSON.stringify(myBudget.expenses));

  subscribeToActiveSharedTrip();
  if (isCloudReady()) startBudgetListeners();
}

export function syncStateToActiveTrip(activityText = "") {
  let active = allTrips.find(t => t.id === activeTripId);
  if (!active) {
    // Ingen reise valgt – ingenting å lagre
    saveAllTripsToLocalStorage();
    return;
  }
  ensureTripCollaborationFields(active);

  updatePersonalBudgetForTrip(active.id, appState.trip.totalBudget, appState.expenses);

  // Bare stemple og laste opp når innholdet faktisk er endret – ellers kan en utdatert
  // lokal kopi overskrive det reisefølget har endret i mellomtiden.
  const contentSignature = (title, tripData, stops, trains, packingList, dayPlan) => {
    const t = { ...(tripData || {}) };
    delete t.totalBudget;
    return JSON.stringify([title, t, stops || [], trains || [], packingList || [], dayPlan || []]);
  };
  const beforeSig = contentSignature(active.title, active.trip, active.stops, active.trains, active.packingList, active.dayPlan);

  active.title = appState.trip.title || "Min Reise";
  active.trip = JSON.parse(JSON.stringify(appState.trip));
  active.stops = JSON.parse(JSON.stringify(appState.stops));
  active.trains = JSON.parse(JSON.stringify(appState.trains));
  active.expenses = JSON.parse(JSON.stringify(appState.expenses));
  active.packingList = JSON.parse(JSON.stringify(appState.packingList));
  active.dayPlan = JSON.parse(JSON.stringify(appState.dayPlan || []));

  const contentChanged = beforeSig !== contentSignature(active.title, active.trip, active.stops, active.trains, active.packingList, active.dayPlan);
  if (!contentChanged && !activityText) {
    saveAllTripsToLocalStorage();
    return;
  }
  active.updatedAt = new Date().toISOString();
  active.lastUpdatedBy = userProfile.displayName || "Reisende";

  if (activityText) {
    if (!Array.isArray(active.activityLog)) active.activityLog = [];
    active.activityLog.unshift({
      text: activityText,
      by: userProfile.displayName || "Reisende",
      time: new Date().toISOString()
    });
    active.activityLog = active.activityLog.slice(0, 12);
  }

  saveAllTripsToLocalStorage();

  // Innlogget: last opp endringen i bakgrunnen (egne reiser og delte reiser jeg kan redigere)
  if (!isApplyingRemoteSnapshot && isCloudReady() && (isTripOwnedByCurrentUser(active) || canEditTrip(active))) {
    pushTripToFirestore(active);
  }
  updateSyncStatus();
}

// ---------------------------------------------------------------------------
// Lagringsstatus og nye forsøk
// ---------------------------------------------------------------------------
let syncStatusState = "";

export function updateSyncStatus() {
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  let state;
  if (!currentUser) state = "";
  else if (syncInFlight > 0) state = "saving";
  else if (allTrips.some(t => t._syncError && isTripDirty(t))) state = "error";
  else if (!online) state = "offline";
  else if (allTrips.some(isTripDirty) || pendingBudgetPushes.size > 0 || sharedOutbox.length > 0) state = lastSyncFailed ? "retry" : "saving";
  else state = "saved";
  updateOfflineBanner(online);
  if (state === syncStatusState) return;
  syncStatusState = state;
  const labels = {
    saving: ["Lagrer …", "bg-amber-400 animate-pulse", "Endringene sendes til kontoen din."],
    saved: ["Lagret", "bg-emerald-500", "Alt er lagret på kontoen din."],
    offline: ["Uten nett", "bg-amber-500", "Du er uten nett. Endringer lagres på denne enheten og sendes når nettet er tilbake."],
    retry: ["Prøver igjen …", "bg-amber-500", "Fikk ikke lagret med en gang. Prøver igjen automatisk."],
    error: ["Ikke lagret", "bg-rose-500", "Noe kunne ikke lagres på kontoen. Endringene ligger på denne enheten."]
  };
  document.querySelectorAll("[data-sync-status]").forEach(el => {
    if (!state) { el.classList.add("hidden"); return; }
    const [text, dot, title] = labels[state];
    el.classList.remove("hidden");
    el.title = title;
    el.setAttribute("aria-label", title);
    el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${dot}"></span><span>${text}</span>`;
  });
}

// ---------------------------------------------------------------------------
// Offline-app: banner, service worker og «Legg på hjemskjermen»
// ---------------------------------------------------------------------------
function updateOfflineBanner(online) {
  const bar = document.getElementById("offline-banner");
  if (!bar) return;
  const show = !online && !!currentUser;
  bar.classList.toggle("hidden", !show);
  bar.classList.toggle("flex", show);
}

let deferredInstallPrompt = null;

function isStandaloneApp() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch (e) { return false; }
}

function isIOSDevice() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function updateInstallItems() {
  document.querySelectorAll("[data-install-item]").forEach(el => el.classList.toggle("hidden", isStandaloneApp()));
}

export async function openInstallHelp() {
  if (isStandaloneApp()) {
    showToast("Allerede på hjemskjermen", "Du bruker RailSync som app.", "check");
    return;
  }
  if (deferredInstallPrompt) {
    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    try {
      promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (e) {}
    return;
  }
  const message = isIOSDevice()
    ? "1. Trykk på Del-knappen (firkanten med pil opp) i Safari.\n2. Velg «Legg til på Hjem-skjerm».\n3. Trykk «Legg til».\n\nDa åpnes RailSync som en egen app, og den virker også uten nett."
    : "Åpne nettleserens meny (⋮ eller ⋯) og velg «Installer app» eller «Legg til på startskjermen».\n\nDa åpnes RailSync som en egen app, og den virker også uten nett.";
  await showAppDialog({ title: "Legg RailSync på hjemskjermen", message, confirmLabel: "Skjønner" });
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    updateInstallItems();
    showToast("RailSync er lagt til", "Du finner appen på hjemskjermen.", "check");
  });
  window.addEventListener("online", () => updateSyncStatus());
  window.addEventListener("offline", () => updateSyncStatus());
  // Service worker: lar appen åpnes uten nett. Bare på https (og localhost under utvikling).
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(err => console.warn("Service worker ble ikke registrert:", err));
    });
  }
}

function retryDirtyTrips() {
  if (!isCloudReady() || syncInFlight > 0) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) { updateSyncStatus(); return; }
  allTrips.filter(isTripDirty).forEach(t => {
    if (isTripOwnedByCurrentUser(t) || canEditTrip(t)) pushTripToFirestore(t);
  });
  [...pendingBudgetPushes].forEach(tid => pushMyBudget(tid));
  if (sharedOutbox.length > 0) flushSharedOutbox();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    lastSyncFailed = false;
    updateSyncStatus();
    if (currentUser && !cloudBootstrapOk && !isLoggingOut) syncUserProfileWithCloud(currentUser);
    else retryDirtyTrips();
  });
  window.addEventListener("offline", () => updateSyncStatus());
  // Alt lagres i nettleseren med en gang det endres, så det trengs ingen lagring når siden lukkes
  // (det kunne overskrive nyere data fra en annen fane).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (currentUser && !cloudBootstrapOk && !isLoggingOut && navigator.onLine !== false) syncUserProfileWithCloud(currentUser);
    else retryDirtyTrips();
  });
  setInterval(retryDirtyTrips, 15000);
}

// ---------------------------------------------------------------------------
// Ny versjon av siden: faner som har stått åpne lenge skal ikke kjøre gammel kode
// ---------------------------------------------------------------------------
export const APP_VERSION = "dev" /* settes automatisk ved publisering (deploy.yml) */;
let newVersionAvailable = false;

async function checkForNewVersion() {
  if (newVersionAvailable || typeof fetch !== "function") return;
  try {
    const res = await fetch(`${location.pathname}?versjon=${Date.now()}`, { cache: "no-store" });
    const text = await res.text();
    const m = text.match(/app\.js\?v=([0-9A-Za-z.-]+)/);
    if (!m || m[1] === APP_VERSION) return;
    newVersionAvailable = true;
    const nothingPending = !allTrips.some(isTripDirty) && pendingBudgetPushes.size === 0 && sharedOutbox.length === 0;
    if (document.visibilityState === "hidden" && nothingPending) {
      location.reload();
      return;
    }
    const bar = document.getElementById("update-banner");
    if (bar) bar.classList.remove("hidden");
  } catch (e) { /* uten nett: prøv senere */ }
}

if (typeof window !== "undefined") {
  setInterval(checkForNewVersion, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkForNewVersion(); });
}

function isCloudReady() {
  return Boolean(isFirebaseConfigured() && db && currentUser);
}

const PROTECTED_TRIP_KEYS = ["ownerUid", "owner", "memberUids", "editorUids", "members", "visibility", "sharePermission", "shareCode"];

function isRealUid(id) {
  return typeof id === "string" && id.length > 0 && !id.startsWith("mem_") && !id.startsWith("local") && !isExampleTravelerUid(id);
}

function computeMembership(tripObj) {
  const ownerUid = tripObj.owner && tripObj.owner.uid;
  const members = Array.isArray(tripObj.members) ? tripObj.members : [];
  const memberUids = new Set([ownerUid]);
  const editorUids = new Set([ownerUid]);
  members.forEach(m => {
    const id = m.uid || m.id;
    if (!isRealUid(id)) return;
    memberUids.add(id);
    if (m.role === "owner" || m.role === "editor") editorUids.add(id);
  });
  return {
    ownerUid,
    memberUids: Array.from(memberUids).filter(Boolean),
    editorUids: Array.from(editorUids).filter(Boolean)
  };
}

// Når en innlogget bruker eier en reise som ble laget lokalt, tar vi eierskap med ekte uid
function claimLocalOwnership(tripObj) {
  if (!currentUser || !isTripOwnedByCurrentUser(tripObj)) return;
  const uid = currentUser.uid;
  if (tripObj.owner.uid !== uid) {
    const oldUid = tripObj.owner.uid;
    tripObj.owner.uid = uid;
    (tripObj.members || []).forEach(m => {
      if (m.role === "owner" || m.id === oldUid) {
        m.id = uid;
        m.uid = uid;
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Samtidig redigering
// Hver reise husker siste versjon fra skyen (_base). Har både du og en annen
// endret noe, slås endringene sammen per stopp/tog/pakkeliste-punkt i stedet
// for at den siste som lagrer overskriver den andre.
// ---------------------------------------------------------------------------
// Firestore godtar ikke lister inne i lister. Togruter lagres derfor som [{ lat, lng }, ...].
export function normalizeGeometry(g) {
  if (!Array.isArray(g)) return [];
  return g.map(p => {
    if (Array.isArray(p)) return { lat: Number(p[0]), lng: Number(p[1]) };
    if (p && typeof p === "object") return { lat: Number(p.lat), lng: Number(p.lng) };
    return null;
  }).filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

function normalizeTrains(trains) {
  return (Array.isArray(trains) ? trains : []).map(t => (t && typeof t === "object" && "routeGeometry" in t)
    ? { ...t, routeGeometry: normalizeGeometry(t.routeGeometry) }
    : t);
}

// Gjør en verdi trygg å lagre i Firestore: ingen lister i lister, ingen undefined eller NaN
export function firestoreSafe(v, inArray = false) {
  if (v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (Array.isArray(v)) {
    const arr = v.map(x => firestoreSafe(x, true));
    if (!inArray) return arr;
    // liste inne i liste: gjør om til objekt
    if (v.length === 2 && v.every(x => typeof x === "number")) return { lat: v[0], lng: v[1] };
    return { items: arr.map(x => (Array.isArray(x) ? { items: x } : x)) };
  }
  if (v && typeof v === "object") {
    const o = {};
    Object.keys(v).forEach(k => { if (v[k] !== undefined) o[k] = firestoreSafe(v[k], false); });
    return o;
  }
  return v;
}

const sameJson = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

function tripContentOf(t) {
  const src = t || {};
  const trip = { ...(src.trip && typeof src.trip === "object" ? src.trip : {}) };
  delete trip.totalBudget;
  const title = String(trip.title || src.title || "");
  trip.title = title;
  return JSON.parse(JSON.stringify({
    title,
    trip,
    stops: Array.isArray(src.stops) ? src.stops : [],
    trains: normalizeTrains(src.trains),
    packingList: Array.isArray(src.packingList) ? src.packingList : [],
    dayPlan: Array.isArray(src.dayPlan) ? src.dayPlan : []
  }));
}

function mergeObjectFields(base, local, remote) {
  const out = {};
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(local || {}), ...Object.keys(remote || {})]);
  keys.forEach(k => {
    const v = !sameJson((local || {})[k], (base || {})[k]) ? (local || {})[k] : (remote || {})[k];
    if (v !== undefined) out[k] = v;
  });
  return out;
}

function mergeItemList(base, local, remote) {
  const key = x => (x && x.id != null ? String(x.id) : null);
  const B = new Map(base.map(x => [key(x), x]));
  const L = new Map(local.map(x => [key(x), x]));
  const R = new Map(remote.map(x => [key(x), x]));
  const pick = k => {
    const inB = B.has(k), inL = L.has(k), inR = R.has(k);
    if (inL && inR) return !inB ? L.get(k) : (!sameJson(L.get(k), B.get(k)) ? L.get(k) : R.get(k));
    if (inL) return !inB ? L.get(k) : (!sameJson(L.get(k), B.get(k)) ? L.get(k) : null);
    if (inR) return !inB ? R.get(k) : (!sameJson(R.get(k), B.get(k)) ? R.get(k) : null);
    return null;
  };
  const relOrder = (list, other) => list.map(key).filter(k => other.has(k));
  const localReordered = !sameJson(relOrder(base, L), relOrder(local, B));
  const skeleton = localReordered ? local : remote;
  const other = localReordered ? remote : local;
  const out = [];
  const seen = new Set();
  skeleton.forEach(x => {
    const k = key(x);
    if (k === null) { out.push(x); return; }
    if (seen.has(k)) return;
    seen.add(k);
    const v = pick(k);
    if (v) out.push(v);
  });
  other.forEach((x, i) => {
    const k = key(x);
    if (k === null || seen.has(k)) return;
    seen.add(k);
    const v = pick(k);
    if (!v) return;
    let pos = i === 0 ? 0 : out.length;
    for (let j = i - 1; j >= 0; j--) {
      const at = out.findIndex(o => key(o) === key(other[j]));
      if (at !== -1) { pos = at + 1; break; }
    }
    out.splice(pos, 0, v);
  });
  return out;
}

function mergeTripContent(base, local, remote) {
  if (!base) return local;
  const title = !sameJson(local.title, base.title) ? local.title : remote.title;
  const trip = mergeObjectFields(base.trip, local.trip, remote.trip);
  trip.title = title;
  const stops = mergeItemList(base.stops, local.stops, remote.stops).map((st, i) => ({ ...st, order: i + 1 }));
  return {
    title,
    trip,
    stops,
    trains: mergeItemList(base.trains, local.trains, remote.trains),
    packingList: mergeItemList(base.packingList, local.packingList, remote.packingList),
    dayPlan: mergeItemList(base.dayPlan || [], local.dayPlan || [], remote.dayPlan || [])
  };
}

function mergeActivityLogs(a, b) {
  const all = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
  const seen = new Set();
  return all
    .filter(x => { const k = `${x && x.time}|${x && x.text}|${x && x.by}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => String(y.time || "").localeCompare(String(x.time || "")))
    .slice(0, 12);
}

// Legger sammenslått innhold inn i den lokale reisen (og skjermen hvis den er åpen)
function applyContentToTrip(tripObj, content) {
  const myBudget = getPersonalBudgetForTrip(tripObj);
  tripObj.title = content.title || tripObj.title;
  tripObj.trip = { ...JSON.parse(JSON.stringify(content.trip)), totalBudget: myBudget.totalBudget };
  tripObj.stops = JSON.parse(JSON.stringify(content.stops));
  tripObj.trains = JSON.parse(JSON.stringify(content.trains));
  tripObj.packingList = JSON.parse(JSON.stringify(content.packingList));
  tripObj.dayPlan = JSON.parse(JSON.stringify(content.dayPlan || []));
  if (tripObj.id === activeTripId) {
    isApplyingRemoteSnapshot = true;
    try {
      appState.trip = JSON.parse(JSON.stringify(tripObj.trip));
      appState.stops = JSON.parse(JSON.stringify(tripObj.stops));
      appState.trains = JSON.parse(JSON.stringify(tripObj.trains));
      appState.packingList = JSON.parse(JSON.stringify(tripObj.packingList));
      appState.dayPlan = JSON.parse(JSON.stringify(tripObj.dayPlan));
      renderAll();
      updateMapLayers();
    } finally {
      isApplyingRemoteSnapshot = false;
    }
  }
}

function buildTripContentPayload(tripObj) {
  const clone = JSON.parse(JSON.stringify(tripObj));
  const trip = clone.trip && typeof clone.trip === "object" ? clone.trip : {};
  delete trip.totalBudget;
  return {
    title: clone.title || (trip.title) || "Min Reise",
    // Personlige budsjetter og utgifter lagres aldri på reisen – kun privat i users/{uid}
    trip: { ...trip, totalBudget: deleteField() },
    expenses: deleteField(),
    stops: firestoreSafe(Array.isArray(clone.stops) ? clone.stops : []),
    trains: firestoreSafe(normalizeTrains(clone.trains)),
    packingList: firestoreSafe(Array.isArray(clone.packingList) ? clone.packingList : []),
    dayPlan: firestoreSafe(Array.isArray(clone.dayPlan) ? clone.dayPlan : []),
    activityLog: firestoreSafe(Array.isArray(clone.activityLog) ? clone.activityLog.slice(0, 12) : []),
    createdAt: clone.createdAt || new Date().toISOString(),
    updatedAt: clone.updatedAt || new Date().toISOString(),
    lastUpdatedBy: clone.lastUpdatedBy || "Reisende",
    savedAt: new Date().toISOString()
  };
}

function buildTripMembershipPayload(tripObj) {
  const { ownerUid, memberUids, editorUids } = computeMembership(tripObj);
  return {
    ownerUid,
    owner: tripObj.owner,
    members: firestoreSafe(JSON.parse(JSON.stringify(tripObj.members || []))),
    memberUids,
    editorUids,
    visibility: tripObj.visibility === "shared" ? "shared" : "private",
    sharePermission: tripObj.sharePermission === "view" ? "view" : "edit",
    shareCode: tripObj.shareCode
  };
}

async function ensureShareCodeDoc(tripObj) {
  if (!isCloudReady() || !tripObj || tripObj.visibility !== "shared") return;
  if (!isTripOwnedByCurrentUser(tripObj) || !isModernShareCode(tripObj.shareCode)) return;
  if (tripObj._shareCodeSynced === tripObj.shareCode) return;
  try {
    await setDoc(doc(db, "shareCodes", tripObj.shareCode), {
      tripId: tripObj.id,
      ownerUid: currentUser.uid,
      createdAt: new Date().toISOString()
    });
    tripObj._shareCodeSynced = tripObj.shareCode;
    saveAllTripsToLocalStorage();
  } catch (e) {
    console.warn("Kunne ikke registrere delingskode:", e);
  }
}

const tripPushQueue = new Map();

// Lagringer av samme reise kjøres etter hverandre, så de ikke tråkker på hverandre
function pushTripToFirestore(tripObj, _retried = false) {
  if (!tripObj || !tripObj.id) return Promise.resolve(false);
  const key = tripObj.id;
  const prev = tripPushQueue.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(() => pushTripToFirestoreNow(tripObj, _retried));
  tripPushQueue.set(key, next);
  next.finally(() => { if (tripPushQueue.get(key) === next) tripPushQueue.delete(key); });
  return next;
}

let syncInFlight = 0;
const reportedSyncErrors = new Set();

// Feil som ikke går over av seg selv ved å prøve igjen (ugyldige data, manglende tilgang)
function isPermanentSyncError(err) {
  const code = err && err.code;
  if (["invalid-argument", "permission-denied", "out-of-range", "unimplemented"].includes(code)) return true;
  return !code && /invalid data|not supported|Unsupported field/i.test(String(err && err.message));
}

function reportSyncError(tripObj, err) {
  tripObj._syncError = String((err && (err.code || err.message)) || "ukjent").slice(0, 200);
  if (reportedSyncErrors.has(tripObj.id)) return;
  reportedSyncErrors.add(tripObj.id);
  reportAppError("synk", err, "reise " + tripObj.id);
  showToast("Kunne ikke lagre i skyen", `«${tripObj.title || "Reisen"}» er lagret på denne enheten, men ikke på kontoen. Last inn siden på nytt, og si fra hvis det fortsetter.`, "alert-triangle");
}
let lastSyncFailed = false;

async function pushTripToFirestoreNow(tripObj, _retried = false) {
  if (!isCloudReady() || !tripObj || !tripObj.id) return false;
  syncInFlight++;
  updateSyncStatus();
  try {
    const ok = await pushTripToFirestoreInner(tripObj, _retried);
    lastSyncFailed = !ok;
    return ok;
  } finally {
    syncInFlight = Math.max(0, syncInFlight - 1);
    updateSyncStatus();
  }
}

async function pushTripToFirestoreInner(tripObj, _retried = false) {
  ensureTripCollaborationFields(tripObj);
  const owned = isTripOwnedByCurrentUser(tripObj);

  // Eksempelreisen har lik ID for alle – gi den en egen ID før den lagres i skyen
  if (tripObj.id === "eksempel-1") {
    if (!owned) return false;
    reassignTripId(tripObj);
  }
  if (owned) claimLocalOwnership(tripObj);

  try {
    const ref = doc(db, "trips", tripObj.id);
    if (owned && !tripObj._cloudCreated) {
      // Ny reise: opprett med medlemmer og innhold
      const payload = buildTripContentPayload(tripObj);
      Object.assign(payload, buildTripMembershipPayload(tripObj));
      await setDoc(ref, payload, { merge: true });
      tripObj._base = tripContentOf(tripObj);
      tripObj._metaBase = ownerMetaOf(payload);
      delete tripObj._syncError;
    } else {
      let merged = null;
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          const local = tripContentOf(tripObj);
          let content = local;
          let remoteLog = [];
          if (snap.exists()) {
            const remoteData = snap.data() || {};
            remoteLog = remoteData.activityLog;
            const remote = tripContentOf(remoteData);
            if (tripObj._base && !sameJson(remote, tripObj._base)) {
              content = mergeTripContent(tripObj._base, local, remote);
            }
          }
          const payload = buildTripContentPayload({ ...tripObj, ...content, trip: { ...content.trip } });
          payload.activityLog = mergeActivityLogs(remoteLog, payload.activityLog);
          tx.set(ref, payload, { merge: true });
          merged = { content, local, activityLog: payload.activityLog };
        });
      } catch (txErr) {
        // Uten nett: endringen ligger trygt på enheten og sendes (slått sammen) når nettet er tilbake
        throw txErr;
      }
      if (merged) {
        delete tripObj._syncError;
        tripObj._base = merged.content;
        tripObj.activityLog = mergeActivityLogs(tripObj.activityLog, merged.activityLog);
        if (!sameJson(merged.content, merged.local)) {
          // Ta vare på endringer du gjorde mens lagringen pågikk
          const current = tripContentOf(tripObj);
          const next = sameJson(current, merged.local) ? merged.content : mergeTripContent(merged.local, current, merged.content);
          if (!sameJson(next, current)) applyContentToTrip(tripObj, next);
        }
      }
    }
    if (owned) {
      tripObj._cloudCreated = true;
      await ensureShareCodeDoc(tripObj);
    }
    saveAllTripsToLocalStorage();
    if (tripObj.id === activeTripId) startBudgetListeners();
    return true;
  } catch (err) {
    const code = err && err.code;
    if (code === "permission-denied") {
      if (tripObj._base) {
        // Reisen var synket før: den er slettet eller du er fjernet – ikke lag den på nytt
        removeLocalTrip(tripObj.id, true);
        return false;
      }
      // Reiser i eldre format (uten eier) kan ikke oppdateres – lagre dem på nytt med ny ID
      if (owned && !_retried) {
        reassignTripId(tripObj);
        tripObj._cloudCreated = false;
        syncUrlWithActiveTrip();
        return pushTripToFirestoreInner(tripObj, true);
      }
    }
    if (isPermanentSyncError(err)) {
      reportSyncError(tripObj, err);
    }
    console.warn("Kunne ikke synkronisere reise til Firestore:", err);
    return false;
  }
}

// Kun eieren: lagrer medlemmer, roller og delingsinnstillinger
async function pushTripMembershipToFirestore(tripObj) {
  if (!isCloudReady() || !tripObj || !isTripOwnedByCurrentUser(tripObj)) return false;
  if (!tripObj._cloudCreated) return pushTripToFirestore(tripObj);
  try {
    const payload = buildTripMembershipPayload(tripObj);
    await setDoc(doc(db, "trips", tripObj.id), {
      ...payload,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    tripObj._metaBase = ownerMetaOf(payload);
    await ensureShareCodeDoc(tripObj);
    return true;
  } catch (err) {
    console.warn("Kunne ikke oppdatere medlemmer i Firestore:", err);
    return false;
  }
}

function requireCloudLogin(actionText) {
  if (isCloudReady()) return true;
  if (!isFirebaseConfigured()) {
    showToast("Ikke tilgjengelig", "Deling er ikke tilgjengelig akkurat nå. Prøv igjen senere.", "alert-triangle");
    return false;
  }
  showToast("Logg inn først", `Du må være logget inn for å ${actionText}.`, "log-in");
  openAuthModal();
  return false;
}

function requireTripOwner(tripObj) {
  if (isTripOwnedByCurrentUser(tripObj)) return true;
  showToast("Bare eieren kan gjøre dette", "Det er eieren av reisen som styrer deling og medlemmer.", "shield");
  return false;
}

// Alle reiser har nå egne lyttere (startTripListeners). Beholdt for eldre kall.
export function subscribeToActiveSharedTrip() {
  if (activeTripUnsubscribe) {
    activeTripUnsubscribe();
    activeTripUnsubscribe = null;
  }
}

// Legger en reise fra skyen inn lokalt. Har du endringer som ikke er sendt ennå,
// slås de sammen med versjonen fra skyen i stedet for at noe overskrives.
const TRIP_META_KEYS = ["ownerUid", "owner", "memberUids", "editorUids", "members", "visibility", "sharePermission",
  "shareCode", "updatedAt", "lastUpdatedBy", "createdAt"];
// Innstillinger bare eieren endrer. Eierens endringer som ikke er sendt ennå, beholdes.
const OWNER_META_KEYS = ["owner", "members", "visibility", "sharePermission", "shareCode"];
function ownerMetaOf(t) {
  const o = {};
  OWNER_META_KEYS.forEach(k => { o[k] = t && t[k] !== undefined ? JSON.parse(JSON.stringify(t[k])) : null; });
  return o;
}

function applyRemoteTripData(id, raw) {
  if (!raw || !raw.trip) return null;
  const data = { ...raw };
  delete data.expenses;
  const remoteContent = tripContentOf(data);
  const idx = allTrips.findIndex(t => t.id === id);

  if (idx === -1) {
    const trip = ensureTripCollaborationFields({ ...data, id, title: remoteContent.title || "Min reise" });
    trip._base = remoteContent;
    trip._metaBase = ownerMetaOf(data);
    if (isTripOwnedByCurrentUser(trip)) trip._cloudCreated = true;
    const myBudget = getPersonalBudgetForTrip(trip);
    trip.trip = { ...remoteContent.trip, totalBudget: myBudget.totalBudget };
    trip.expenses = myBudget.expenses;
    allTrips.push(trip);
    return { isNew: true, changed: true, needsPush: false };
  }

  const local = allTrips[idx];
  const localContent = tripContentOf(local);
  const beforeSig = JSON.stringify([localContent, TRIP_META_KEYS.map(k => local[k]), local.activityLog]);

  let content = remoteContent;
  let needsPush = false;
  // Den som bare kan se, får alltid versjonen fra skyen
  const mayEdit = isTripOwnedByCurrentUser({ ...local, ...data }) || canEditTrip({ ...local, ...data });
  const localDirty = mayEdit && local._base ? !sameJson(localContent, local._base) : false;
  if (localDirty && !sameJson(localContent, remoteContent)) {
    content = mergeTripContent(local._base, localContent, remoteContent);
    needsPush = !sameJson(content, remoteContent);
  }

  const ownsTrip = isTripOwnedByCurrentUser({ ...local, ...data });
  const localMeta = ownerMetaOf(local);
  const remoteMeta = ownerMetaOf(data);
  const metaDirty = ownsTrip && local._metaBase && !sameJson(localMeta, local._metaBase) && !sameJson(localMeta, remoteMeta);
  TRIP_META_KEYS.forEach(k => { if (k in data) local[k] = data[k]; });
  if (metaDirty) {
    const mergedMeta = mergeObjectFields(local._metaBase, localMeta, remoteMeta);
    Object.assign(local, mergedMeta);
    if (!sameJson(mergedMeta, remoteMeta)) {
      const tripRef = local;
      setTimeout(() => pushTripMembershipToFirestore(tripRef), 0);
    }
  }
  local._metaBase = remoteMeta;
  local.activityLog = localDirty ? mergeActivityLogs(local.activityLog, data.activityLog) : (data.activityLog || []);
  local._base = remoteContent;
  if (isTripOwnedByCurrentUser(local)) local._cloudCreated = true;
  ensureTripCollaborationFields(local);
  setTripContent(local, content);

  const afterSig = JSON.stringify([tripContentOf(local), TRIP_META_KEYS.map(k => local[k]), local.activityLog]);
  return { isNew: false, changed: beforeSig !== afterSig, needsPush };
}

// Brukes av eldre kall
function mergeCloudTripDoc(docSnap) {
  if (!docSnap || !docSnap.exists()) return;
  applyRemoteTripData(docSnap.id, docSnap.data());
}

function setTripContent(tripObj, content) {
  const myBudget = getPersonalBudgetForTrip(tripObj);
  tripObj.title = content.title || tripObj.title;
  tripObj.trip = { ...JSON.parse(JSON.stringify(content.trip)), totalBudget: myBudget.totalBudget };
  tripObj.stops = JSON.parse(JSON.stringify(content.stops));
  tripObj.trains = JSON.parse(JSON.stringify(content.trains));
  tripObj.packingList = JSON.parse(JSON.stringify(content.packingList));
  tripObj.dayPlan = JSON.parse(JSON.stringify(content.dayPlan || []));
}

// Har reisen endringer som ikke er lagret i skyen ennå?
function isTripDirty(t) {
  if (!t || t.id === "eksempel-1") return false;
  if (isTripOwnedByCurrentUser(t) && !t._cloudCreated) return true;
  if (!isTripOwnedByCurrentUser(t) && !canEditTrip(t)) return false;
  if (!t._base) return false;
  return !sameJson(tripContentOf(t), t._base);
}

export async function syncAllUserTripsWithCloud(silent = false) {
  if (!isCloudReady()) {
    if (!silent) showToast("Ikke logget inn", "Logg inn for å hente reisene dine.", "log-in");
    return;
  }

  try {
    const uid = currentUser.uid;

    // 1. Hent det nyeste fra skyen først – skyen er fasiten
    const [snapOwned, snapMember] = await Promise.all([
      getDocs(query(collection(db, "trips"), where("ownerUid", "==", uid))),
      getDocs(query(collection(db, "trips"), where("memberUids", "array-contains", uid)))
    ]);
    const seen = new Set();
    const toPush = new Set();
    [...snapOwned.docs, ...snapMember.docs].forEach(d => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      const res = applyRemoteTripData(d.id, d.data());
      if (res && res.needsPush) toPush.add(d.id);
    });

    // 2. Lokale reiser som ikke finnes i skyen
    for (const t of [...allTrips]) {
      ensureTripCollaborationFields(t);
      if (seen.has(t.id) || t.id === "eksempel-1") continue;
      if (isTripOwnedByCurrentUser(t) && !t._cloudCreated) {
        toPush.add(t.id); // ny reise laget før innlogging eller uten nett
      } else {
        // Slettet eller fjernet fra reisefølget mens du var borte
        allTrips = allTrips.filter(x => x.id !== t.id);
      }
    }
    if (!allTrips.some(t => t.id === activeTripId)) activeTripId = allTrips.length ? allTrips[0].id : null;

    saveAllTripsToLocalStorage();
    syncActiveTripToState();
    renderAll();
    updateMapLayers();

    // 3. Send det som ikke er lagret i skyen ennå
    for (const id of toPush) {
      const t = allTrips.find(x => x.id === id);
      if (t && (isTripOwnedByCurrentUser(t) || canEditTrip(t))) await pushTripToFirestore(t);
    }
    updateSyncStatus();

    if (!silent) {
      showToast("Reisene er oppdatert", `${allTrips.length} ${allTrips.length === 1 ? "reise" : "reiser"} er hentet fra kontoen din.`, "check");
    }
    return true;
  } catch (err) {
    console.warn("Sky-synkronisering feilet:", err);
    updateSyncStatus();
    if (!silent) {
      showToast("Kunne ikke oppdatere", "Fikk ikke kontakt med serveren. Endringene dine er lagret på denne enheten og sendes når nettet er tilbake.", "alert-triangle");
    }
    return false;
  }
}

let isLoggingOut = false;

export function saveAllTripsToLocalStorage() {
  if (isLoggingOut) return;
  try {
    const payload = {
      activeTripId,
      allTrips
    };
    localStorage.setItem("railsync_all_trips_v3", JSON.stringify(payload));
    localStorage.setItem("railsync_state_v1", JSON.stringify(appState));
  } catch (e) {
    console.warn("Feil ved lagring av alle reiser til localStorage:", e);
  }
}

