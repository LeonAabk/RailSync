/**
 * RailSync - Interrail Planlegger
 * Modular JavaScript Application with Firebase Firestore Cloud Sync
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// =============================================================================
// 1. FIREBASE CONFIGURATION & AUTH
// =============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyB0t6N-BGLL5pWg7FiOtHPe0MkHtndJKS8",
  authDomain: "railsync-41279.firebaseapp.com",
  projectId: "railsync-41279",
  storageBucket: "railsync-41279.firebasestorage.app",
  messagingSenderId: "608711815759",
  appId: "1:608711815759:web:a18449c1dd8aca0f3d303a"
};

function isFirebaseConfigured() {
  return firebaseConfig.apiKey && 
         firebaseConfig.apiKey !== "YOUR_API_KEY" && 
         !firebaseConfig.apiKey.includes("YOUR_") &&
         firebaseConfig.projectId !== "YOUR_PROJECT_ID";
}

let db = null;
let auth = null;
export let currentUser = null;

if (isFirebaseConfigured()) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase Firestore og Auth initialisert vellykket.");

    // Listen to authentication state changes
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      updateAuthUI(user);
    });
  } catch (err) {
    console.warn("Kunne ikke koble til Firebase:", err);
  }
} else {
  console.info("RailSync kjører med lokal lagring. Fyll inn dine egne Firebase-nøkler i toppen av app.js for full Firestore-skylagring.");
}

// =============================================================================
// AUTHENTICATION UTILITIES & HANDLERS
// =============================================================================
export function updateAuthUI(user) {
  const loginBtn = document.getElementById("btn-open-login");
  const profilePill = document.getElementById("user-profile-pill");
  const displayNameEl = document.getElementById("user-display-name");

  if (user) {
    if (loginBtn) loginBtn.classList.add("hidden");
    if (profilePill) profilePill.classList.remove("hidden");
    if (displayNameEl) {
      displayNameEl.textContent = user.displayName || (user.email ? user.email.split("@")[0] : "Bruker");
    }
  } else {
    if (loginBtn) loginBtn.classList.remove("hidden");
    if (profilePill) profilePill.classList.add("hidden");
  }
}

export function openAuthModal() {
  openModal("modal-auth");
}

export async function handleGoogleSignIn() {
  if (!auth) {
    showToast("Firebase Auth ikke aktiv", "Sjekk at Firebase-nøklene i app.js er gyldige.", "alert-triangle");
    return;
  }
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    closeModal("modal-auth");
    showToast("Velkommen!", `Logget inn som ${user.displayName || user.email}`);
  } catch (err) {
    console.error("Google innlogging feilet:", err);
    showToast("Innlogging feilet", err.message || "Kunne ikke logge inn med Google.", "alert-triangle");
  }
}

export async function handleUsernameAuth(e) {
  e.preventDefault();
  if (!auth) {
    showToast("Firebase Auth ikke aktiv", "Sjekk at Firebase-nøklene i app.js er gyldige.", "alert-triangle");
    return;
  }

  const rawInput = (document.getElementById("auth-username") || document.getElementById("auth-email")).value.trim();
  const password = document.getElementById("auth-password").value;
  const isNewUser = document.getElementById("auth-is-new-user").checked;

  if (!rawInput) return;

  // 1. SMART GMAIL DETECTION:
  // If the user typed their gmail or googlemail address, advise them to click Google login!
  if (rawInput.toLowerCase().includes("@gmail.") || rawInput.toLowerCase().includes("@googlemail.")) {
    showToast(
      "Bruk Google-knappen!", 
      "For din Google-konto logger du inn direkte med 'Fortsett med Google'-knappen ovenfor uten passord.", 
      "info"
    );
    const googleBtn = document.getElementById("btn-google-auth");
    if (googleBtn) {
      googleBtn.classList.add("ring-2", "ring-brand-500", "ring-offset-2");
      setTimeout(() => googleBtn.classList.remove("ring-2", "ring-brand-500", "ring-offset-2"), 3000);
    }
    return;
  }

  // 2. Format username into internal email if no @ present
  let authEmail = rawInput;
  let username = rawInput;

  if (!rawInput.includes("@")) {
    const cleanUsername = rawInput.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (cleanUsername.length < 3) {
      showToast("For kort brukernavn", "Brukernavnet må ha minst 3 tegn.", "alert-triangle");
      return;
    }
    authEmail = `${cleanUsername}@railsync.user`;
    username = rawInput;
  } else {
    username = rawInput.split("@")[0];
  }

  const btn = document.getElementById("btn-auth-submit");
  if (btn) {
    btn.disabled = true;
    btn.textContent = isNewUser ? "Oppretter bruker..." : "Logger inn...";
  }

  try {
    if (isNewUser) {
      const res = await createUserWithEmailAndPassword(auth, authEmail, password);
      try {
        await updateProfile(res.user, { displayName: username });
      } catch (profErr) {
        console.warn("Kunne ikke sette visningsnavn:", profErr);
      }
      showToast("Bruker opprettet!", `Velkommen, ${username}!`);
    } else {
      const res = await signInWithEmailAndPassword(auth, authEmail, password);
      showToast("Velkommen tilbake!", `Logget inn som ${res.user.displayName || username}`);
    }
    closeModal("modal-auth");
    const form = document.getElementById("form-auth");
    if (form) form.reset();
  } catch (err) {
    console.error("Innlogging feilet:", err);
    let msg = "Kunne ikke gjennomføre innlogging.";
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
      msg = "Feil brukernavn eller passord.";
    } else if (err.code === "auth/email-already-in-use") {
      msg = `Brukernavnet "${username}" er allerede opptatt. Fjern haken for "ny konto" for å logge inn, eller velg et annet brukernavn.`;
    } else if (err.code === "auth/weak-password") {
      msg = "Passordet må ha minst 6 tegn.";
    } else if (err.code === "auth/user-not-found") {
      msg = "Fant ingen bruker med dette brukernavnet. Huk av for 'Jeg vil opprette en ny bruker'.";
    }
    showToast("Innlogging feilet", msg, "alert-triangle");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = isNewUser ? "Opprett ny bruker" : "Logg inn med brukernavn";
    }
  }
}

export const handleEmailAuth = handleUsernameAuth;

export async function handleLogout() {
  if (!auth) return;
  try {
    await signOut(auth);
    showToast("Logget ut", "Du er nå logget ut.");
  } catch (err) {
    console.error("Utlogging feilet:", err);
  }
}

// =============================================================================
// 2. APPLICATION STATE
// =============================================================================
const defaultTripState = {
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

// Starter Proposal: Single clean sample proposal
const starterProposal = {
  id: "eksempel-1",
  title: "Eksempelreise: Europaturné 2026",
  createdAt: new Date().toISOString(),
  trip: JSON.parse(JSON.stringify(defaultTripState.trip)),
  stops: JSON.parse(JSON.stringify(defaultTripState.stops)),
  trains: JSON.parse(JSON.stringify(defaultTripState.trains)),
  expenses: JSON.parse(JSON.stringify(defaultTripState.expenses)),
  packingList: JSON.parse(JSON.stringify(defaultTripState.packingList))
};

export let allTrips = [starterProposal];
export let activeTripId = "eksempel-1";

// Deep clone active state container
export const appState = JSON.parse(JSON.stringify(defaultTripState));

export function syncActiveTripToState() {
  let active = allTrips.find(t => t.id === activeTripId);
  if (!active && allTrips.length > 0) {
    active = allTrips[0];
    activeTripId = active.id;
  }
  if (!active) return;

  appState.trip = JSON.parse(JSON.stringify(active.trip));
  appState.stops = JSON.parse(JSON.stringify(active.stops));
  appState.trains = JSON.parse(JSON.stringify(active.trains));
  appState.expenses = JSON.parse(JSON.stringify(active.expenses));
  appState.packingList = JSON.parse(JSON.stringify(active.packingList));
}

export function syncStateToActiveTrip() {
  let active = allTrips.find(t => t.id === activeTripId);
  if (!active) {
    active = {
      id: activeTripId || ("trip_" + Date.now()),
      title: appState.trip.title || "Min Reise",
      trip: {}, stops: [], trains: [], expenses: [], packingList: []
    };
    allTrips.push(active);
  }

  active.title = appState.trip.title || "Min Reise";
  active.trip = JSON.parse(JSON.stringify(appState.trip));
  active.stops = JSON.parse(JSON.stringify(appState.stops));
  active.trains = JSON.parse(JSON.stringify(appState.trains));
  active.expenses = JSON.parse(JSON.stringify(appState.expenses));
  active.packingList = JSON.parse(JSON.stringify(appState.packingList));

  saveAllTripsToLocalStorage();
}

export function saveAllTripsToLocalStorage() {
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

// =============================================================================
// 3. PERSISTENCE & CLOUD SYNC (Firestore + LocalStorage)
// =============================================================================
export async function loadAppState() {
  const urlParams = new URLSearchParams(window.location.search);
  const tripId = urlParams.get("trip");

  if (tripId) {
    // 1. Fetch shared trip from Firestore if configured
    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, "trips", tripId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const cloudData = docSnap.data();
          if (cloudData.trip && cloudData.stops) {
            const loadedTrip = {
              id: tripId,
              title: cloudData.trip.title || "Delt Reise",
              trip: cloudData.trip,
              stops: cloudData.stops || [],
              trains: cloudData.trains || [],
              expenses: cloudData.expenses || [],
              packingList: cloudData.packingList || []
            };

            const existingIdx = allTrips.findIndex(t => t.id === tripId);
            if (existingIdx !== -1) {
              allTrips[existingIdx] = loadedTrip;
            } else {
              allTrips.unshift(loadedTrip);
            }
            activeTripId = tripId;
            syncActiveTripToState();
            saveAllTripsToLocalStorage();
            showToast("Reise lastet", `Hentet "${appState.trip.title}" fra skyen!`);
            return;
          }
        }
      } catch (err) {
        console.warn("Feil ved lasting fra Firestore:", err);
      }
    }

    // 2. Fallback: Check local trip cache
    try {
      const localTrip = localStorage.getItem(`railsync_trip_${tripId}`);
      if (localTrip) {
        const parsed = JSON.parse(localTrip);
        const loadedTrip = {
          id: tripId,
          title: parsed.trip ? parsed.trip.title : "Delt Reise",
          trip: parsed.trip || {},
          stops: parsed.stops || [],
          trains: parsed.trains || [],
          expenses: parsed.expenses || [],
          packingList: parsed.packingList || []
        };
        const existingIdx = allTrips.findIndex(t => t.id === tripId);
        if (existingIdx !== -1) {
          allTrips[existingIdx] = loadedTrip;
        } else {
          allTrips.unshift(loadedTrip);
        }
        activeTripId = tripId;
        syncActiveTripToState();
        saveAllTripsToLocalStorage();
        showToast("Reise lastet", `Hentet "${appState.trip.title}" fra lokalt minne.`);
        return;
      }
    } catch (e) {
      console.warn("Kunne ikke lese lokal trip cache:", e);
    }
  }

  // 3. Load from railsync_all_trips_v3
  try {
    const savedTrips = localStorage.getItem("railsync_all_trips_v3");
    if (savedTrips) {
      const parsed = JSON.parse(savedTrips);
      if (parsed && Array.isArray(parsed.allTrips) && parsed.allTrips.length > 0) {
        allTrips = parsed.allTrips;
        activeTripId = parsed.activeTripId || allTrips[0].id;
        syncActiveTripToState();
        return;
      }
    }
  } catch (err) {
    console.warn("Kunne ikke lese railsync_all_trips_v3:", err);
  }

  // 4. Default starter proposal
  allTrips = [starterProposal];
  activeTripId = "eksempel-1";
  syncActiveTripToState();
}

export function persistState() {
  syncStateToActiveTrip();
}

/**
 * Handle Save & Share Trip:
 * Saves the entire appState to Firestore 'trips' collection, updates URL with ?trip=ID,
 * and copies the link to the clipboard with toast feedback.
 */
export async function handleSaveAndShareTrip() {
  const btn = document.getElementById("btn-save-share");
  const originalHtml = btn ? btn.innerHTML : "";

  if (btn) {
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span class="hidden sm:inline">Lagrer...</span>`;
    btn.disabled = true;
    if (window.lucide) lucide.createIcons();
  }

  let tripId = null;

  try {
    if (isFirebaseConfigured() && db) {
      try {
        const docRef = await addDoc(collection(db, "trips"), {
          ...appState,
          savedAt: new Date().toISOString()
        });
        tripId = docRef.id;
      } catch (fsError) {
        console.warn("Firestore lagring feilet (sjekk Security Rules):", fsError);
        // Fallback to local trip saving so user experience is not blocked
        tripId = "trip_" + Math.random().toString(36).substring(2, 9);
        localStorage.setItem(`railsync_trip_${tripId}`, JSON.stringify(appState));
        persistState();

        showToast(
          "Merk: Firestore tilgang sperret", 
          "Husk å tillate read/write i Security Rules i Firebase Console. Reisen er lagret lokalt.",
          "alert-triangle"
        );
      }
    } else {
      // Local demo mode
      tripId = "trip_" + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(`railsync_trip_${tripId}`, JSON.stringify(appState));
      persistState();
    }

    // Update URL query parameter without page reload
    const shareUrl = `${window.location.origin}${window.location.pathname}?trip=${tripId}`;
    window.history.replaceState({ path: shareUrl }, "", shareUrl);

    // Copy URL to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      if (tripId && !tripId.startsWith("trip_")) {
        showToast(
          "Lenke kopiert!", 
          "Reisen er lagret i skyen og delingslenken er kopiert!", 
          "check"
        );
      }
    } catch (clipErr) {
      // Clipboard fallback
      showToast(
        "Reise lagret!", 
        `Lenke: ${shareUrl}`, 
        "share-2"
      );
    }

  } catch (error) {
    console.error("Feil ved lagring av reise:", error);
    showToast("Feil ved lagring", "Kunne ikke lagre reisen. Prøv igjen.", "alert-circle");
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      if (window.lucide) lucide.createIcons();
    }
  }
}

// Toast notification helper
export function showToast(title, message, iconName = "check") {
  const toast = document.getElementById("toast");
  const toastTitle = document.getElementById("toast-title");
  const toastMsg = document.getElementById("toast-message");
  const iconContainer = document.getElementById("toast-icon-container");
  if (!toast) return;

  if (toastTitle) toastTitle.textContent = title;
  if (toastMsg) toastMsg.textContent = message;
  if (iconContainer) {
    iconContainer.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i>`;
    if (window.lucide) lucide.createIcons();
  }

  toast.classList.remove("translate-y-20", "opacity-0", "pointer-events-none");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-20", "opacity-0", "pointer-events-none");
  }, 4000);
}

// =============================================================================
// 4. LEAFLET MAP CONTROLLER
// =============================================================================
let map = null;
let mapMarkers = [];
let routePolyline = null;

export function initMap() {
  const mapContainer = document.getElementById("rail-map");
  if (!mapContainer) return;

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

  const validStops = appState.stops.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number');
  if (validStops.length === 0) return;

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

    let statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">${escapeHtml(stop.accommodationStatus)}</span>`;
    if (stop.accommodationStatus.includes("Bestilt")) {
      statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">✓ Overnatting bestilt</span>`;
    } else if (stop.accommodationStatus.includes("Ser etter")) {
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
          <button onclick="openEditStopModal('${stop.id}')" class="text-xs text-brand-600 hover:text-brand-800 font-semibold px-2 py-1 rounded hover:bg-brand-50 transition">
            Rediger
          </button>
          <button onclick="deleteStop('${stop.id}')" class="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition">
            Fjern stopp
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, { minWidth: 240, maxWidth: 310 });
    mapMarkers.push(marker);
    latlngs.push([stop.lat, stop.lng]);
  });

  if (latlngs.length > 1) {
    routePolyline = L.polyline(latlngs, {
      color: '#0d9488',
      weight: 4,
      opacity: 0.85,
      dashArray: '8, 8',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
  } else if (latlngs.length === 1) {
    map.setView(latlngs[0], 7);
  }
}

export function resetMapView() {
  if (routePolyline && map) {
    map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
  }
}

export function centerMapOnStop(lat, lng) {
  if (map) {
    map.flyTo([lat, lng], 8, { duration: 1.2 });
  }
}

// =============================================================================
// 5. NAVIGATION & TAB SWITCHING
// =============================================================================
export function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));

  const target = document.getElementById(`tab-${tabId}`);
  if (target) {
    target.classList.remove("hidden");
  }

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.remove("text-white", "bg-slate-800", "shadow-sm", "border-slate-700/60");
    btn.classList.add("text-slate-300", "hover:bg-slate-800/60");
  });
  const activeNavBtn = document.getElementById(`nav-btn-${tabId}`);
  if (activeNavBtn) {
    activeNavBtn.classList.add("text-white", "bg-slate-800", "shadow-sm", "border-slate-700/60");
    activeNavBtn.classList.remove("text-slate-300");
  }

  document.querySelectorAll(".mobile-nav-btn").forEach(btn => {
    btn.classList.remove("text-brand-600", "font-bold");
    btn.classList.add("text-slate-400", "font-medium");
  });
  const activeMobileBtn = document.getElementById(`mobile-tab-${tabId}`);
  if (activeMobileBtn) {
    activeMobileBtn.classList.add("text-brand-600", "font-bold");
    activeMobileBtn.classList.remove("text-slate-400", "font-medium");
  }

  if (tabId === "overview" && map) {
    setTimeout(() => {
      map.invalidateSize();
      resetMapView();
    }, 150);
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// =============================================================================
// 6. RENDER FUNCTIONS
// =============================================================================
export function renderOverview() {
  const trip = appState.trip;
  const titleEl = document.getElementById("header-trip-title");
  if (titleEl) titleEl.textContent = trip.title;
  
  let durationDays = 22;
  if (trip.startDate && trip.endDate) {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (diff > 0) durationDays = diff;
  }
  
  const datesEl = document.getElementById("header-trip-dates");
  if (datesEl) {
    datesEl.textContent = `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)} • ${durationDays} dager på skinner`;
  }
  
  const totalDaysStat = document.getElementById("stat-total-days");
  if (totalDaysStat) totalDaysStat.textContent = `${durationDays} dager`;

  const totalDaysSub = document.getElementById("stat-total-days-sub");
  if (totalDaysSub) totalDaysSub.textContent = `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`;

  const dailySub = document.getElementById("budget-daily-days-sub");
  if (dailySub) dailySub.textContent = `For de ${durationDays} planlagte dagene`;

  // Unique countries
  const uniqueCountries = new Set(appState.stops.map(s => s.country.trim()));
  const countriesCount = uniqueCountries.size;
  const countriesList = Array.from(uniqueCountries).slice(0, 5).join(", ") + (countriesCount > 5 ? '...' : '');

  const statCountries = document.getElementById("stat-countries-count");
  if (statCountries) statCountries.textContent = `${countriesCount} land`;

  const statCountriesSub = document.getElementById("stat-countries-sub");
  if (statCountriesSub) statCountriesSub.textContent = countriesList || "Ingen land registrert";

  // Pass days
  const usedPassDays = appState.trains.filter(t => t.isTravelDay).length;
  const totalPassDays = appState.trip.totalPassDays || 7;
  const passPct = Math.min(100, Math.round((usedPassDays / totalPassDays) * 100));

  const statPassDays = document.getElementById("stat-pass-days");
  if (statPassDays) statPassDays.textContent = `${usedPassDays} / ${totalPassDays} dager`;

  const statPassBar = document.getElementById("stat-pass-bar");
  if (statPassBar) statPassBar.style.width = `${passPct}%`;

  const sidebarPassText = document.getElementById("sidebar-pass-days-text");
  if (sidebarPassText) sidebarPassText.textContent = `${usedPassDays} av ${totalPassDays}`;

  const sidebarPassBar = document.getElementById("sidebar-pass-progress-bar");
  if (sidebarPassBar) sidebarPassBar.style.width = `${passPct}%`;

  const sidebarPassRemaining = document.getElementById("sidebar-pass-remaining");
  if (sidebarPassRemaining) sidebarPassRemaining.textContent = `${Math.max(0, totalPassDays - usedPassDays)} dager`;

  const mobilePassEl = document.getElementById("mobile-subbar-pass");
  if (mobilePassEl) mobilePassEl.textContent = `${usedPassDays} / ${totalPassDays} dager brukt`;

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
      <div class="text-center py-8 text-slate-400">
        <p class="text-sm">Ingen stoppesteder registrert ennå.</p>
        <button onclick="openAddStopModal()" class="mt-2 text-xs text-brand-600 font-semibold underline">Legg til første by</button>
      </div>
    `;
    return;
  }

  container.innerHTML = appState.stops.map((stop, idx) => {
    const isStart = idx === 0;
    const isEnd = idx === appState.stops.length - 1;

    let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
    if (stop.accommodationStatus.includes("Bestilt")) {
      badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
    } else if (stop.accommodationStatus.includes("Ser etter")) {
      badgeStyle = "bg-amber-50 text-amber-700 border-amber-200/80";
    }

    return `
      <div class="relative pl-7 pb-4 group">
        ${!isEnd ? '<div class="absolute left-3 top-3.5 bottom-0 w-0.5 bg-slate-200 group-hover:bg-brand-300 transition-colors"></div>' : ''}
        
        <div class="absolute left-0 top-1 w-6 h-6 rounded-full ${isStart ? 'bg-slate-900' : (isEnd ? 'bg-rail-accent' : 'bg-brand-600')} text-white flex items-center justify-center text-xs font-bold shadow-xs">
          ${idx + 1}
        </div>

        <div class="bg-slate-50 hover:bg-slate-100/90 rounded-xl p-3 border border-slate-200/70 transition-all flex flex-col gap-2 shadow-2xs w-full min-w-0 overflow-hidden">
          <div class="flex items-start justify-between gap-2 min-w-0">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
                <h3 class="font-bold text-slate-900 text-sm hover:text-brand-600 cursor-pointer truncate max-w-[130px] sm:max-w-none" onclick="centerMapOnStop(${stop.lat}, ${stop.lng})">
                  ${escapeHtml(stop.city)}
                </h3>
                <span class="text-xs text-slate-500 font-medium truncate max-w-[100px] sm:max-w-none">${escapeHtml(stop.country)}</span>
              </div>
              <p class="text-[11px] text-slate-400">
                ${formatDate(stop.arrival)} – ${formatDate(stop.departure)}
              </p>
            </div>
            
            <div class="flex items-center gap-1 shrink-0">
              <button 
                title="Flytt opp i reiseruten" 
                onclick="moveStopOrder('${stop.id}', -1)" 
                class="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 bg-white border border-slate-200/80 shadow-2xs transition ${isStart ? 'opacity-20 cursor-not-allowed' : ''}"
                ${isStart ? 'disabled' : ''}
              >
                <i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>
              </button>

              <button 
                title="Flytt ned i reiseruten" 
                onclick="moveStopOrder('${stop.id}', 1)" 
                class="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 bg-white border border-slate-200/80 shadow-2xs transition ${isEnd ? 'opacity-20 cursor-not-allowed' : ''}"
                ${isEnd ? 'disabled' : ''}
              >
                <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
              </button>

              <button title="Rediger stoppested" onclick="openEditStopModal('${stop.id}')" class="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 bg-white border border-slate-200/80 shadow-2xs transition">
                <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              </button>

              <button title="Sentrér i kartet" onclick="centerMapOnStop(${stop.lat}, ${stop.lng})" class="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-brand-600 bg-white border border-slate-200/80 shadow-2xs transition">
                <i data-lucide="crosshair" class="w-3.5 h-3.5"></i>
              </button>

              <button title="Fjern stoppested" onclick="deleteStop('${stop.id}')" class="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 bg-white border border-slate-200/80 shadow-2xs transition">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          <div class="flex items-center flex-wrap gap-2 text-xs pt-1 border-t border-slate-200/40">
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyle}">
              ${escapeHtml(stop.accommodationStatus)}
            </span>
            ${stop.accommodationNote ? `<span class="text-[11px] text-slate-500 truncate max-w-[200px]" title="${escapeHtml(stop.accommodationNote)}">${escapeHtml(stop.accommodationNote)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

export function renderTrains() {
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
    let resBadge = '';
    if (train.reservationStatus === "confirmed") {
      resBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
          Plassreservasjon bekreftet
        </span>
      `;
    } else if (train.reservationStatus === "required") {
      resBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i>
          Må reserveres (obligatorisk)
        </span>
      `;
    } else {
      resBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          Plassreservasjon valgfri
        </span>
      `;
    }

    const travelDayBadge = train.isTravelDay 
      ? `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200">Reisedag på pass</span>`
      : `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500">Lokal / nattog</span>`;

    return `
      <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 hover:border-slate-300 transition space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <span class="font-extrabold text-sm sm:text-base text-slate-900">${escapeHtml(train.trainType)}</span>
            <span class="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">${escapeHtml(train.trainNumber)}</span>
            ${travelDayBadge}
          </div>
          <div class="text-xs text-slate-500 font-medium flex items-center gap-1">
            <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
            ${formatDate(train.date)}
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          <div class="sm:col-span-4">
            <p class="text-xl font-extrabold text-slate-900 tracking-tight">${train.departureTime}</p>
            <p class="text-sm font-semibold text-slate-700">${escapeHtml(train.fromCity)}</p>
            <p class="text-xs text-slate-400">Avgangsstasjon</p>
          </div>

          <div class="sm:col-span-4 flex flex-col items-center justify-center text-center">
            <span class="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
              ${train.duration}
            </span>
            <div class="w-full flex items-center justify-center gap-2">
              <div class="h-0.5 flex-1 bg-slate-200"></div>
              <div class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
              </div>
              <div class="h-0.5 flex-1 bg-slate-200"></div>
            </div>
            <span class="text-[11px] text-brand-600 font-medium mt-1">Direktetog</span>
          </div>

          <div class="sm:col-span-4 sm:text-right">
            <p class="text-xl font-extrabold text-slate-900 tracking-tight">${train.arrivalTime}</p>
            <p class="text-sm font-semibold text-slate-700">${escapeHtml(train.toCity)}</p>
            <p class="text-xs text-slate-400">Ankomststasjon</p>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            ${resBadge}
            ${train.reservationPrice > 0 ? `<span class="text-xs text-slate-500 font-medium">Pris: ${train.reservationPrice} kr</span>` : ''}
          </div>

          <div class="flex items-center gap-2">
            ${train.reservationStatus === 'required' ? `
              <button onclick="toggleTrainReservation('${train.id}')" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition">
                Merk som bestilt
              </button>
            ` : `
              <button onclick="toggleTrainReservation('${train.id}')" class="text-xs font-medium text-slate-400 hover:text-slate-600 px-2 py-1">
                Endre status
              </button>
            `}
            <button onclick="deleteTrain('${train.id}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-50 transition" title="Slett togreise">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

export function renderBudget() {
  const totalBudget = appState.trip.totalBudget || 22000;
  const totalSpent = appState.expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const remaining = totalBudget - totalSpent;
  const spentPct = Math.round((totalSpent / totalBudget) * 100);

  const budgetTotalEl = document.getElementById("budget-total-val");
  if (budgetTotalEl) budgetTotalEl.textContent = `${formatNumber(totalBudget)} kr`;

  const budgetSpentEl = document.getElementById("budget-spent-val");
  if (budgetSpentEl) budgetSpentEl.textContent = `${formatNumber(totalSpent)} kr`;

  const budgetSpentPct = document.getElementById("budget-spent-pct");
  if (budgetSpentPct) budgetSpentPct.textContent = `${spentPct}% av budsjettet brukt`;

  const budgetRemEl = document.getElementById("budget-remaining-val");
  if (budgetRemEl) budgetRemEl.textContent = `${formatNumber(remaining)} kr`;

  let durationDays = 22;
  if (appState.trip.startDate && appState.trip.endDate) {
    const start = new Date(appState.trip.startDate);
    const end = new Date(appState.trip.endDate);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (diff > 0) durationDays = diff;
  }
  const dailyAvg = Math.round(totalSpent / durationDays);
  const dailyAvgEl = document.getElementById("budget-daily-avg");
  if (dailyAvgEl) dailyAvgEl.textContent = `${formatNumber(dailyAvg)} kr / dag`;

  const categories = [
    { name: "Overnatting", icon: "bed", color: "from-blue-500 to-indigo-600", bgLight: "bg-blue-50 text-blue-700" },
    { name: "Transport", icon: "train", color: "from-teal-500 to-emerald-600", bgLight: "bg-teal-50 text-teal-700" },
    { name: "Mat", icon: "utensils", color: "from-amber-500 to-orange-600", bgLight: "bg-amber-50 text-amber-700" },
    { name: "Aktiviteter", icon: "ticket", color: "from-rose-500 to-pink-600", bgLight: "bg-rose-50 text-rose-700" }
  ];

  const catContainer = document.getElementById("budget-categories-container");
  if (catContainer) {
    catContainer.innerHTML = categories.map(cat => {
      const catSum = appState.expenses
        .filter(e => e.category === cat.name)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const catPct = totalSpent > 0 ? Math.round((catSum / totalSpent) * 100) : 0;

      return `
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-700 flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg ${cat.bgLight} flex items-center justify-center">
                <i data-lucide="${cat.icon}" class="w-3.5 h-3.5"></i>
              </span>
              ${cat.name}
            </span>
            <span class="text-xs font-extrabold text-slate-900">${formatNumber(catSum)} kr (${catPct}%)</span>
          </div>
          <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div class="bg-gradient-to-r ${cat.color} h-2 rounded-full" style="width: ${catPct}%"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  const tbody = document.getElementById("expenses-table-body");
  const countBadge = document.getElementById("expenses-count-badge");
  if (countBadge) countBadge.textContent = `${appState.expenses.length} poster`;

  if (tbody) {
    if (appState.expenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">Ingen utgifter registrert.</td></tr>`;
    } else {
      tbody.innerHTML = appState.expenses.map(exp => `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="py-3 px-4 sm:px-6 font-semibold text-slate-900">${escapeHtml(exp.title)}</td>
          <td class="py-3 px-4">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              ${escapeHtml(exp.category)}
            </span>
          </td>
          <td class="py-3 px-4 text-slate-500 text-xs">${formatDate(exp.date)}</td>
          <td class="py-3 px-4 text-right font-extrabold text-slate-900">${formatNumber(exp.amount)} kr</td>
          <td class="py-3 px-4 text-right">
            <button onclick="deleteExpense('${exp.id}')" class="text-slate-400 hover:text-rose-600 p-1 rounded transition" title="Slett utgift">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `).join("");
    }
  }

  if (window.lucide) lucide.createIcons();
}

export function renderPacking() {
  const items = appState.packingList;
  const totalCount = items.length;
  const packedCount = items.filter(i => i.checked).length;
  const pct = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  const pctLabel = document.getElementById("packing-percentage-label");
  if (pctLabel) pctLabel.textContent = `${packedCount} av ${totalCount} pakket (${pct}%)`;

  const pBar = document.getElementById("packing-progress-bar");
  if (pBar) pBar.style.width = `${pct}%`;

  const sProgress = document.getElementById("sidebar-packing-progress");
  if (sProgress) sProgress.textContent = `${packedCount}/${totalCount}`;

  const categoryOrder = [
    "Dokumenter & Billetter",
    "Togkomfort & Sove",
    "Elektronikk",
    "Klær & Fottøy",
    "Toalettsaker & Apotek"
  ];

  const groups = {};
  categoryOrder.forEach(c => { groups[c] = []; });
  items.forEach(item => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  });

  const container = document.getElementById("packing-groups-container");
  if (!container) return;

  container.innerHTML = Object.keys(groups).map(categoryName => {
    const catItems = groups[categoryName] || [];
    const catPacked = catItems.filter(i => i.checked).length;

    return `
      <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 class="font-bold text-slate-900 text-sm flex items-center gap-2">
              <i data-lucide="tag" class="w-3.5 h-3.5 text-brand-600"></i>
              ${escapeHtml(categoryName)}
            </h3>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              ${catPacked}/${catItems.length}
            </span>
          </div>

          <div class="space-y-1.5 pt-2">
            ${catItems.length === 0 ? '<p class="text-xs text-slate-400 italic py-1">Ingen gjenstander i denne kategorien.</p>' : ''}
            ${catItems.map(item => `
              <div class="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition group">
                <label class="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0 pr-2">
                  <input 
                    type="checkbox" 
                    ${item.checked ? 'checked' : ''} 
                    onchange="togglePackingItem('${item.id}')"
                    class="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 transition cursor-pointer"
                  >
                  <span class="text-xs sm:text-sm font-medium ${item.checked ? 'line-through text-slate-400' : 'text-slate-700'}">
                    ${escapeHtml(item.text)}
                  </span>
                </label>
                <button onclick="deletePackingItem('${item.id}')" class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded transition" title="Slett">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="mt-2 pt-2 border-t border-slate-100">
          <form onsubmit="handleQuickAddPacking(event, '${escapeHtml(categoryName)}')" class="flex items-center gap-1.5">
            <input 
              type="text" 
              name="quickItemText"
              placeholder="+ Legg til i ${escapeHtml(categoryName)}..." 
              required 
              class="flex-1 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-brand-500 focus:outline-none"
            >
            <button type="submit" class="text-xs bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 font-semibold px-2.5 py-1 rounded-lg transition shrink-0">
              Legg til
            </button>
          </form>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

export function renderAll() {
  renderOverview();
  renderTrains();
  renderBudget();
  renderPacking();
  renderTripManagerList();
  if (window.lucide) lucide.createIcons();
}

// =============================================================================
// 6.5 MULTI-TRIP MANAGER FUNCTIONS
// =============================================================================
export function openTripManagerModal() {
  renderTripManagerList();
  openModal('modal-trip-manager');
}

export function renderTripManagerList() {
  const container = document.getElementById("trip-manager-list");
  if (!container) return;

  const countBadge = document.getElementById("sidebar-trips-count-badge");
  if (countBadge) countBadge.textContent = allTrips.length;

  const headerBadge = document.getElementById("header-trip-count-badge");
  if (headerBadge) headerBadge.textContent = allTrips.length;

  const mobileHeaderBadge = document.getElementById("header-trip-count-badge-mobile");
  if (mobileHeaderBadge) mobileHeaderBadge.textContent = allTrips.length;

  const modalCountText = document.getElementById("modal-trips-count-text");
  if (modalCountText) modalCountText.textContent = `${allTrips.length} forslag`;

  container.innerHTML = allTrips.map((tripItem) => {
    const isActive = tripItem.id === activeTripId;
    const stopsCount = tripItem.stops ? tripItem.stops.length : 0;
    const daysCount = tripItem.trip ? (tripItem.trip.totalPassDays || 7) : 7;
    const budgetVal = tripItem.trip ? (tripItem.trip.totalBudget || 22000) : 22000;

    return `
      <div class="p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isActive 
          ? 'bg-brand-50/60 border-brand-300 ring-2 ring-brand-500/20 shadow-xs' 
          : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60'
      }">
        <div class="space-y-1 min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h4 class="font-bold text-slate-900 text-sm sm:text-base leading-tight">${escapeHtml(tripItem.title)}</h4>
            ${isActive ? `
              <span class="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-600 text-white shadow-2xs">
                <i data-lucide="check" class="w-3 h-3"></i>
                Aktiv nå
              </span>
            ` : ''}
          </div>
          <p class="text-xs text-slate-500 font-medium">
            📍 ${stopsCount} stoppesteder • 🎫 ${daysCount} reisedager på pass • 💰 ${formatNumber(budgetVal)} kr
          </p>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          ${!isActive ? `
            <button onclick="switchActiveTrip('${tripItem.id}')" class="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition shadow-xs">
              Velg reise
            </button>
          ` : ''}
          <button onclick="renameTripInManager('${tripItem.id}')" class="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition" title="Endre navn">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="duplicateTrip('${tripItem.id}')" class="p-2 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition" title="Dupliser forslag">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          </button>
          ${allTrips.length > 1 ? `
            <button onclick="deleteTrip('${tripItem.id}')" class="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="Slett forslag">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

export function switchActiveTrip(tripId) {
  if (tripId === activeTripId) return;
  syncStateToActiveTrip();
  activeTripId = tripId;
  syncActiveTripToState();
  persistState();
  renderAll();
  updateMapLayers();
  renderTripManagerList();
  showToast("Endret reise", `Byttet til "${appState.trip.title}"`);
}

export function duplicateActiveTrip() {
  duplicateTrip(activeTripId);
}

export function duplicateTrip(tripId) {
  syncStateToActiveTrip();
  const source = allTrips.find(t => t.id === tripId) || allTrips[0];
  if (!source) return;

  const newId = "trip_" + Date.now();
  const newTitle = `${source.title} (Kopi)`;

  const newTrip = JSON.parse(JSON.stringify(source));
  newTrip.id = newId;
  newTrip.title = newTitle;
  newTrip.trip.title = newTitle;

  allTrips.push(newTrip);
  activeTripId = newId;
  syncActiveTripToState();
  persistState();
  renderAll();
  updateMapLayers();
  renderTripManagerList();
  showToast("Reise duplisert", `Opprettet "${newTitle}"`);
}

export function createNewTrip() {
  syncStateToActiveTrip();
  const newId = "trip_" + Date.now();
  const proposalNumber = allTrips.length + 1;
  const newTitle = `Forslag ${proposalNumber} for Europaturné 2026`;

  const newTrip = {
    id: newId,
    title: newTitle,
    createdAt: new Date().toISOString(),
    trip: {
      title: newTitle,
      startDate: "2026-07-01",
      endDate: "2026-07-15",
      totalPassDays: 7,
      totalBudget: 20000,
      currency: "NOK",
    },
    stops: [
      {
        id: "stop-new-1",
        city: "Oslo",
        country: "Norge",
        arrival: "2026-07-01",
        departure: "2026-07-02",
        accommodationStatus: "Hjemme / Start",
        accommodationNote: "Startreise fra Oslo S",
        lat: 59.9139,
        lng: 10.7522,
        order: 1
      },
      {
        id: "stop-new-2",
        city: "København",
        country: "Danmark",
        arrival: "2026-07-02",
        departure: "2026-07-05",
        accommodationStatus: "Ser etter hotell",
        accommodationNote: "Nær Hovedbanegården",
        lat: 55.6761,
        lng: 12.5683,
        order: 2
      }
    ],
    trains: [
      {
        id: "tr-new-1",
        fromCity: "Oslo S",
        toCity: "København H",
        date: "2026-07-02",
        departureTime: "07:30",
        arrivalTime: "15:20",
        trainType: "Vy Regional / SJ",
        trainNumber: "SJ 381",
        reservationStatus: "required",
        reservationPrice: 65,
        duration: "7t 50m",
        isTravelDay: true
      }
    ],
    expenses: [
      { id: "exp-new-1", title: "Interrail Global Pass 7 dager", category: "Transport", amount: 3900, date: "2026-06-01" }
    ],
    packingList: JSON.parse(JSON.stringify(defaultTripState.packingList))
  };

  allTrips.push(newTrip);
  activeTripId = newId;
  syncActiveTripToState();
  persistState();
  renderAll();
  updateMapLayers();
  renderTripManagerList();
  showToast("Ny reise opprettet", `Gjør deg klar til å planlegge "${newTitle}"`);
}

export function deleteTrip(tripId) {
  if (allTrips.length <= 1) {
    showToast("Kunne ikke slette", "Du må ha minst én lagret reise.");
    return;
  }

  const target = allTrips.find(t => t.id === tripId);
  const targetTitle = target ? target.title : "denne reisen";

  if (!confirm(`Er du sikker på at du vil slette "${targetTitle}"?`)) return;

  allTrips = allTrips.filter(t => t.id !== tripId);
  if (activeTripId === tripId) {
    activeTripId = allTrips[0].id;
  }
  syncActiveTripToState();
  persistState();
  renderAll();
  updateMapLayers();
  renderTripManagerList();
  showToast("Reise slettet", `Fjernet "${targetTitle}"`);
}

export function renameTripInManager(tripId) {
  const target = allTrips.find(t => t.id === tripId);
  if (!target) return;

  const newTitle = prompt("Skriv inn nytt navn på reiseforslaget:", target.title);
  if (!newTitle || !newTitle.trim()) return;

  target.title = newTitle.trim();
  target.trip.title = newTitle.trim();

  if (tripId === activeTripId) {
    appState.trip.title = newTitle.trim();
  }

  persistState();
  renderAll();
  renderTripManagerList();
  showToast("Navn oppdatert", `Endret navn til "${newTitle.trim()}"`);
}

// =============================================================================
// 7. ACTIONS & MUTATIONS
// =============================================================================

export function moveStopOrder(stopId, direction) {
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
}

let searchDebounceTimer = null;

export function setupNominatimSearch() {
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
          dropdown.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">Ingen byer funnet for "${escapeHtml(query)}"</div>`;
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
              onclick="selectSearchResult('${escapeHtml(cityName)}', '${escapeHtml(countryName)}', ${lat}, ${lon})"
              class="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between text-xs transition">
              <div class="min-w-0 pr-2">
                <p class="font-bold text-slate-800">${escapeHtml(cityName)}</p>
                <p class="text-slate-400 text-[11px] truncate">${escapeHtml(item.display_name)}</p>
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
}

export function openAddStopModal() {
  document.getElementById("stop-edit-id").value = "";
  document.getElementById("modal-stop-title").textContent = "Legg til stoppested";
  document.getElementById("modal-stop-btn-text").textContent = "Lagre stoppested";
  document.getElementById("form-add-stop").reset();
  document.getElementById("stop-preset-select").value = "";
  document.getElementById("stop-search-input").value = "";
  document.getElementById("search-results-dropdown").classList.add("hidden");
  openModal('modal-add-stop');
}

export function openEditStopModal(stopId) {
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
  document.getElementById("stop-accom-status").value = stop.accommodationStatus;
  document.getElementById("stop-accom-note").value = stop.accommodationNote || "";

  document.getElementById("stop-preset-select").value = "";
  document.getElementById("stop-search-input").value = "";
  document.getElementById("search-results-dropdown").classList.add("hidden");

  openModal('modal-add-stop');
}

export function handleSaveStop(e) {
  e.preventDefault();
  const editId = document.getElementById("stop-edit-id").value;
  const city = document.getElementById("stop-city").value.trim();
  const country = document.getElementById("stop-country").value.trim();
  const arrival = document.getElementById("stop-arrival").value;
  const departure = document.getElementById("stop-departure").value;
  const lat = parseFloat(document.getElementById("stop-lat").value) || 48.0;
  const lng = parseFloat(document.getElementById("stop-lng").value) || 12.0;
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

  persistState();
  updateMapLayers();
  renderAll();
  closeModal('modal-add-stop');
  document.getElementById("form-add-stop").reset();
}

export function deleteStop(id) {
  appState.stops = appState.stops.filter(s => s.id !== id);
  appState.stops.forEach((s, idx) => { s.order = idx + 1; });
  persistState();
  updateMapLayers();
  renderAll();
}

export function openTripSettingsModal() {
  const trip = appState.trip;
  document.getElementById("settings-title").value = trip.title;
  document.getElementById("settings-start-date").value = trip.startDate;
  document.getElementById("settings-end-date").value = trip.endDate;
  document.getElementById("settings-pass-days").value = trip.totalPassDays;
  document.getElementById("settings-total-budget").value = trip.totalBudget;
  openModal('modal-trip-settings');
}

export function setPresetPassDays(days) {
  document.getElementById("settings-pass-days").value = days;
}

export function handleSaveTripSettings(e) {
  e.preventDefault();
  appState.trip.title = document.getElementById("settings-title").value.trim() || "Sommerens Europaturné";
  appState.trip.startDate = document.getElementById("settings-start-date").value;
  appState.trip.endDate = document.getElementById("settings-end-date").value;
  appState.trip.totalPassDays = parseInt(document.getElementById("settings-pass-days").value, 10) || 7;
  appState.trip.totalBudget = parseFloat(document.getElementById("settings-total-budget").value) || 20000;

  persistState();
  renderAll();
  closeModal('modal-trip-settings');
}

export function handleSaveTrain(e) {
  e.preventDefault();
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
  persistState();
  renderAll();
  closeModal('modal-add-train');
  document.getElementById("form-add-train").reset();
}

export function toggleTrainReservation(trainId) {
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
  appState.trains = appState.trains.filter(t => t.id !== id);
  persistState();
  renderAll();
}

export function handleSaveExpense(e) {
  e.preventDefault();
  const title = document.getElementById("expense-title").value.trim();
  const category = document.getElementById("expense-category").value;
  const amount = parseFloat(document.getElementById("expense-amount").value) || 0;
  const date = document.getElementById("expense-date").value;

  const newExp = {
    id: "exp-" + Date.now(),
    title,
    category,
    amount,
    date
  };

  appState.expenses.push(newExp);
  persistState();
  renderAll();
  closeModal('modal-add-expense');
  document.getElementById("form-add-expense").reset();
}

export function deleteExpense(id) {
  appState.expenses = appState.expenses.filter(e => e.id !== id);
  persistState();
  renderAll();
}

export function togglePackingItem(id) {
  const item = appState.packingList.find(i => i.id === id);
  if (item) {
    item.checked = !item.checked;
    persistState();
    renderPacking();
  }
}

export function handleSavePackingItem(e) {
  e.preventDefault();
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
  appState.packingList = appState.packingList.filter(i => i.id !== id);
  persistState();
  renderPacking();
}

// =============================================================================
// 8. MODAL UTILITIES
// =============================================================================
export function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("hidden");
    document.body.style.overflow = "auto";
  }
}

export function openAddTrainModal() { openModal('modal-add-train'); }
export function openAddExpenseModal() { openModal('modal-add-expense'); }
export function openAddPackingItemModal() { openModal('modal-add-packing'); }

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll("[id^='modal-']").forEach(m => closeModal(m.id));
  }
});

// Formatters
function formatNumber(num) {
  return Number(num || 0).toLocaleString("no-NO");
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const monthNames = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
      const day = parseInt(parts[2], 10);
      const month = monthNames[parseInt(parts[1], 10) - 1];
      return `${day}. ${month}`;
    }
  } catch (e) {
    // fallback
  }
  return dateStr;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =============================================================================
// 9. ATTACH TO WINDOW SCOPE (For HTML onclick handlers)
// =============================================================================
window.switchTab = switchTab;
window.openTripSettingsModal = openTripSettingsModal;
window.setPresetPassDays = setPresetPassDays;
window.handleSaveTripSettings = handleSaveTripSettings;
window.openAddStopModal = openAddStopModal;
window.openEditStopModal = openEditStopModal;
window.handleSaveStop = handleSaveStop;
window.deleteStop = deleteStop;
window.moveStopOrder = moveStopOrder;
window.centerMapOnStop = centerMapOnStop;
window.resetMapView = resetMapView;
window.openAddTrainModal = openAddTrainModal;
window.handleSaveTrain = handleSaveTrain;
window.toggleTrainReservation = toggleTrainReservation;
window.deleteTrain = deleteTrain;
window.renderTrains = renderTrains;
window.openAddExpenseModal = openAddExpenseModal;
window.handleSaveExpense = handleSaveExpense;
window.deleteExpense = deleteExpense;
window.openAddPackingItemModal = openAddPackingItemModal;
window.handleSavePackingItem = handleSavePackingItem;
window.handleQuickAddPacking = handleQuickAddPacking;
window.deletePackingItem = deletePackingItem;
window.togglePackingItem = togglePackingItem;
window.openModal = openModal;
window.closeModal = closeModal;
window.handlePresetCitySelect = handlePresetCitySelect;
window.selectSearchResult = selectSearchResult;
window.handleSaveAndShareTrip = handleSaveAndShareTrip;
window.openTripManagerModal = openTripManagerModal;
window.switchActiveTrip = switchActiveTrip;
window.duplicateActiveTrip = duplicateActiveTrip;
window.duplicateTrip = duplicateTrip;
window.createNewTrip = createNewTrip;
window.deleteTrip = deleteTrip;
window.renameTripInManager = renameTripInManager;
window.openAuthModal = openAuthModal;
window.handleGoogleSignIn = handleGoogleSignIn;
window.handleEmailAuth = handleEmailAuth;
window.handleUsernameAuth = handleUsernameAuth;
window.handleLogout = handleLogout;

// =============================================================================
// 10. INITIALIZATION
// =============================================================================
async function initializeApplet() {
  await loadAppState();
  initMap();
  renderAll();
  setupNominatimSearch();
  if (window.lucide) {
    lucide.createIcons();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApplet);
} else {
  initializeApplet();
}
