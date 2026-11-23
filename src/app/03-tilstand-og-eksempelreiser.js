// =============================================================================
// 2. APPLICATION STATE
// =============================================================================
// Innholdet i den gamle eksempelreisen. Brukes bare til å kjenne igjen urørte eksempelreiser
// og som forslag til pakkeliste.
export const LEGACY_EXAMPLE_TRIP_STATE = {
  trip: {
    title: "Eksempelreise: Europaturné 2026",
    startDate: "2026-07-01",
    endDate: "2026-07-15",
    totalPassDays: 7,
    totalBudget: 20000,
    currency: "NOK",
  },
  stops: [
    {
      id: "stop-1",
      city: "Oslo",
      country: "Norge",
      arrival: "2026-07-01",
      departure: "2026-07-02",
      accommodationStatus: "Hjemme / Start",
      accommodationNote: "Eksempel: Reisen starter fra Oslo S",
      lat: 59.9139,
      lng: 10.7522,
      order: 1
    },
    {
      id: "stop-2",
      city: "København",
      country: "Danmark",
      arrival: "2026-07-02",
      departure: "2026-07-06",
      accommodationStatus: "Bestilt",
      accommodationNote: "Eksempel: Sentralt hostel eller hotell",
      lat: 55.6761,
      lng: 12.5683,
      order: 2
    },
    {
      id: "stop-3",
      city: "Berlin",
      country: "Tyskland",
      arrival: "2026-07-06",
      departure: "2026-07-10",
      accommodationStatus: "Ser etter hotell",
      accommodationNote: "Eksempel: Sjekker område Mitte eller Friedrichshain",
      lat: 52.5200,
      lng: 13.4050,
      order: 3
    },
    {
      id: "stop-4",
      city: "Praha",
      country: "Tsjekkia",
      arrival: "2026-07-10",
      departure: "2026-07-15",
      accommodationStatus: "Ikke bestilt",
      accommodationNote: "Eksempel: Ønsker overnatting nær gamlebyen",
      lat: 50.0755,
      lng: 14.4378,
      order: 4
    }
  ],
  trains: [
    {
      id: "tr-1",
      fromCity: "Oslo S",
      toCity: "København H",
      date: "2026-07-02",
      departureTime: "07:30",
      arrivalTime: "15:20",
      trainType: "Vy Regional / SJ",
      trainNumber: "SJ 381",
      reservationStatus: "confirmed",
      reservationPrice: 65,
      duration: "7t 50m",
      isTravelDay: true
    },
    {
      id: "tr-2",
      fromCity: "København H",
      toCity: "Berlin Hbf",
      date: "2026-07-06",
      departureTime: "09:14",
      arrivalTime: "16:22",
      trainType: "DSB / DB Eurocity",
      trainNumber: "EC 393",
      reservationStatus: "required",
      reservationPrice: 45,
      duration: "7t 08m",
      isTravelDay: true
    },
    {
      id: "tr-3",
      fromCity: "Berlin Hbf",
      toCity: "Praha hl.n.",
      date: "2026-07-10",
      departureTime: "11:16",
      arrivalTime: "15:35",
      trainType: "České Dráhy / Eurocity",
      trainNumber: "EC 175",
      reservationStatus: "not_needed",
      reservationPrice: 0,
      duration: "4t 19m",
      isTravelDay: true
    }
  ],
  expenses: [
    { id: "exp-1", title: "Eksempel: Interrail Global Pass (7 dager)", category: "Transport", amount: 3900, date: "2026-06-01" },
    { id: "exp-2", title: "Eksempel: Hostel København", category: "Overnatting", amount: 2100, date: "2026-06-10" },
    { id: "exp-3", title: "Eksempel: Middag & street food Berlin", category: "Mat", amount: 450, date: "2026-07-07" },
    { id: "exp-4", title: "Eksempel: Kanaltur & båtbillett", category: "Aktiviteter", amount: 280, date: "2026-07-03" }
  ],
  packingList: [
    { id: "pack-1", category: "Dokumenter & Billetter", text: "Pass / Nasjonalt ID-kort", checked: false },
    { id: "pack-2", category: "Dokumenter & Billetter", text: "Interrail Rail Planner App (Pass aktivert)", checked: false },
    { id: "pack-3", category: "Dokumenter & Billetter", text: "Europeisk helsetrygdkort (Helfo) & Reiseforsikring", checked: false },

    { id: "pack-4", category: "Togkomfort & Sove", text: "Nakkepute og øyemaske til tog", checked: false },
    { id: "pack-5", category: "Togkomfort & Sove", text: "Gjenbrukbar vannflaske", checked: false },
    { id: "pack-6", category: "Togkomfort & Sove", text: "Lakenpose / silkelaken til hostel", checked: false },

    { id: "pack-7", category: "Elektronikk", text: "Powerbank (minst 10 000 mAh)", checked: false },
    { id: "pack-8", category: "Elektronikk", text: "Lader & reiseadapter", checked: false },

    { id: "pack-9", category: "Klær & Fottøy", text: "Gode gåsko / sneakers for storbyer", checked: false },
    { id: "pack-10", category: "Klær & Fottøy", text: "Regnjakke / lett jakke", checked: false },

    { id: "pack-11", category: "Toalettsaker & Apotek", text: "Solkrem & personlige toalettsaker", checked: false },
    { id: "pack-12", category: "Toalettsaker & Apotek", text: "Gnagsårplaster (Compeed)", checked: false }
  ]
};

// Tilfeldige, lange koder: 8 tegn fra 31 tegn (~850 milliarder kombinasjoner)
const SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomChars(len, alphabet) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

function generateShareCode() {
  const raw = randomChars(8, SHARE_CODE_ALPHABET);
  return `RS-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function isModernShareCode(code) {
  return typeof code === "string" && /^RS-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}

// Normaliserer det brukeren limer inn ("rs-abcd-efgh", "ABCDEFGH" osv.) til RS-XXXX-XXXX
function normalizeShareCodeInput(input) {
  const compact = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = compact.startsWith("RS") && compact.length === 10 ? compact.slice(2) : compact;
  if (/^[A-Z0-9]{8}$/.test(body)) return `RS-${body.slice(0, 4)}-${body.slice(4)}`;
  return null;
}

function newTripId() {
  const rand = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : randomChars(32, "abcdefghijklmnopqrstuvwxyz0123456789"));
  return "trip_" + rand;
}

// Gir en reise ny, tilfeldig ID (brukes for eksempelreisen og gamle reiser i eldre format)
function reassignTripId(tripObj) {
  const oldId = tripObj.id;
  const newId = newTripId();
  tripObj.id = newId;
  tripObj.shareCode = generateShareCode();
  delete tripObj._cloudCreated;
  delete tripObj._shareCodeSynced;
  if (personalBudgetsByTrip[oldId]) {
    personalBudgetsByTrip[newId] = personalBudgetsByTrip[oldId];
    delete personalBudgetsByTrip[oldId];
    savePersonalBudgetsToStorage();
  }
  if (activeTripId === oldId) activeTripId = newId;
  saveAllTripsToLocalStorage();
  return newId;
}

export function ensureTripCollaborationFields(tripObj) {
  if (!tripObj) return tripObj;
  if (!tripObj.id) tripObj.id = newTripId();
  if (!isModernShareCode(tripObj.shareCode)) tripObj.shareCode = generateShareCode();
  if (!tripObj.visibility) tripObj.visibility = "private";
  if (!tripObj.sharePermission) tripObj.sharePermission = "edit";

  const activeUid = currentUser ? currentUser.uid : (userProfile.uid || "local_user");
  const activeName = userProfile.displayName || (currentUser && currentUser.displayName) || "Meg";
  const activeColor = userProfile.avatarColor || "#0b8176";

  if (!tripObj.owner || !tripObj.owner.uid) {
    tripObj.owner = {
      uid: activeUid,
      name: activeName,
      avatarColor: activeColor
    };
  }

  if (!Array.isArray(tripObj.members) || tripObj.members.length === 0) {
    tripObj.members = [
      {
        id: tripObj.owner.uid || activeUid,
        name: tripObj.owner.name || activeName,
        role: "owner",
        avatarColor: tripObj.owner.avatarColor || activeColor,
        joinedAt: tripObj.createdAt || new Date().toISOString()
      }
    ];
  }

  if (!Array.isArray(tripObj.activityLog)) {
    tripObj.activityLog = [
      {
        text: "Reiseplanen ble opprettet",
        by: tripObj.owner.name || activeName,
        time: tripObj.createdAt || new Date().toISOString()
      }
    ];
  }

  return tripObj;
}

// Tom reise – brukes når brukeren ikke har noen reiser ennå
const emptyTripState = {
  trip: { title: "", startDate: "", endDate: "", totalPassDays: 0, totalBudget: 0, currency: "NOK" },
  stops: [],
  trains: [],
  expenses: [],
  packingList: [],
  dayPlan: []
};

// Forslag til pakkeliste (legges bare til når brukeren ber om det)
export const PACKING_SUGGESTIONS = LEGACY_EXAMPLE_TRIP_STATE.packingList.map(p => ({ ...p, checked: false }));

export let allTrips = [];
export let activeTripId = null;
export let currentTripManagerTab = "all";
let activeTripUnsubscribe = null;
let isApplyingRemoteSnapshot = false;

// Deep clone active state container
export const appState = JSON.parse(JSON.stringify(emptyTripState));

// En eksempelreise som aldri er lastet opp og fortsatt har eksempelets navn og stopp
function isUntouchedExampleTrip(t) {
  if (!t) return false;
  if (t.id !== "eksempel-1" && t._cloudCreated) return false;
  const ex = LEGACY_EXAMPLE_TRIP_STATE;
  const strip = (arr) => JSON.stringify((arr || []).map(x => ({ ...x })));
  return String(t.title || (t.trip && t.trip.title) || "") === ex.trip.title
    && strip(t.stops) === strip(ex.stops);
}

export function hasActiveTrip() {
  return Boolean(activeTripId && allTrips.some(t => t.id === activeTripId));
}

export function getActiveTripObject() {
  let active = allTrips.find(t => t.id === activeTripId);
  if (!active && allTrips.length > 0) {
    active = allTrips[0];
    activeTripId = active.id;
  }
  return active ? ensureTripCollaborationFields(active) : null;
}

export function isTripOwnedByCurrentUser(tripObj) {
  if (!tripObj || !tripObj.owner) return true;
  const myUid = currentUser ? currentUser.uid : userProfile.uid;
  return (
    tripObj.owner.uid === myUid ||
    tripObj.owner.uid === userProfile.uid ||
    // Reiser laget lokalt før innlogging (local_*) finnes bare i denne nettleseren
    (typeof tripObj.owner.uid === "string" && tripObj.owner.uid.startsWith("local"))
  );
}

export function canEditActiveTrip() {
  const active = getActiveTripObject();
  if (!active) return true;
  if (isTripOwnedByCurrentUser(active)) return true;
  if (active.visibility !== "shared") return true;

  const myUid = currentUser ? currentUser.uid : userProfile.uid;
  const myMember = (active.members || []).find(m => (m.uid || m.id) === myUid);
  if (myMember) {
    return myMember.role === "owner" || myMember.role === "editor";
  }
  return active.sharePermission !== "view";
}

// Skjuler redigeringsknapper når reisen bare kan ses (i stedet for å vise feilmelding ved klikk)
const EDIT_ACTIONS = /\b(openAddStopModal|openEditStopModal|deleteStop|moveStopOrder|openAddTrainModal|openEditTrainModal|deleteTrain|openAddPackingItemModal|deletePackingItem|handleQuickAddPacking|openTripSettingsModal|importLiveJourneyToTrip|addWishlistPlaceToActiveTrip|handleSaveStop|handleSaveTrain|handleSavePackingItem|handleAddDayPlanItem|showDayPlanForm|deleteDayPlanItem|addAdapterToPacking)\(/;
const LOCK_ACTIONS = /\b(togglePackingItem|toggleTrainReservation|toggleDayPlanItem)\(/;

export function applyEditMode(isEditable = canEditActiveTrip()) {
  document.body.dataset.canEdit = isEditable ? "true" : "false";
  document.querySelectorAll("[onclick],[onsubmit],[onchange]").forEach(el => {
    const handler = (el.getAttribute("onclick") || "") + (el.getAttribute("onsubmit") || "") + (el.getAttribute("onchange") || "");
    if (EDIT_ACTIONS.test(handler)) el.setAttribute("data-edit-only", "");
    else if (LOCK_ACTIONS.test(handler)) el.setAttribute("data-edit-lock", "");
  });
}

function requireEditPermission() {
  if (!canEditActiveTrip()) {
    showToast(
      "Kun lesevisning",
      "Denne delte reisen er satt til «Kun visning». Klikk «Lag min egen kopi» for å redigere.",
      "eye"
    );
    return false;
  }
  return true;
}

function syncUrlWithActiveTrip() {
  const active = getActiveTripObject();
  if (!active) {
    if (window.location.search.includes("trip=")) window.history.replaceState({}, "", `${window.location.origin}${window.location.pathname}`);
    return;
  }
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  if (active.visibility === "shared" && active.id !== "eksempel-1") {
    const shareUrl = `${baseUrl}?trip=${active.id}`;
    window.history.replaceState({ path: shareUrl }, "", shareUrl);
  } else if (window.location.search.includes("trip=")) {
    window.history.replaceState({ path: baseUrl }, "", baseUrl);
  }
}

