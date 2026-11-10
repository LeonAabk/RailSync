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
  getDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  getDocs
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

// Rich User Profile (persisted in localStorage + Firestore users/{uid})
export let userProfile = {
  uid: "local_user",
  displayName: "Reisende",
  username: "@reisende",
  avatarColor: "#0d9488",
  homeStation: "Oslo S",
  defaultPassType: "Global Pass 7 dager (Ungdom)",
  bio: "Klar for Interrail gjennom Europa!"
};

function getInitials(name) {
  if (!name) return "R";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return String(name).trim().substring(0, 2).toUpperCase();
}

export function loadLocalUserProfile() {
  try {
    const raw = localStorage.getItem("railsync_user_profile_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      userProfile = { ...userProfile, ...parsed };
    } else {
      // Generate persistent local guest uid so ownership works even before cloud login
      userProfile.uid = "local_" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("railsync_user_profile_v1", JSON.stringify(userProfile));
    }
  } catch (e) {
    console.warn("Kunne ikke lese lokal brukerprofil:", e);
  }
  updateAuthUI(currentUser);
}

export async function syncUserProfileWithCloud(user) {
  if (!user) {
    updateAuthUI(null);
    return;
  }

  const fallbackName = user.displayName || (user.email ? user.email.split("@")[0] : "Reisende");
  const fallbackHandle = "@" + fallbackName.toLowerCase().replace(/[^a-z0-9_]/g, "");

  userProfile.uid = user.uid;
  if (userProfile.displayName === "Reisende" && fallbackName) {
    userProfile.displayName = fallbackName;
  }
  if (userProfile.username === "@reisende" && fallbackHandle) {
    userProfile.username = fallbackHandle;
  }

  if (isFirebaseConfigured() && db) {
    try {
      const userDocRef = doc(db, "users", user.uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const cloudProf = snap.data();
        if (cloudProf.personalBudgets && typeof cloudProf.personalBudgets === "object") {
          personalBudgetsByTrip = {
            ...cloudProf.personalBudgets,
            ...personalBudgetsByTrip
          };
          try {
            localStorage.setItem("railsync_personal_budgets_v1", JSON.stringify(personalBudgetsByTrip));
          } catch (e) {}
        }
        userProfile = {
          ...userProfile,
          ...cloudProf,
          uid: user.uid
        };
      } else {
        await setDoc(userDocRef, {
          ...userProfile,
          personalBudgets: personalBudgetsByTrip,
          uid: user.uid,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (e) {
      console.warn("Kunne ikke synkronisere brukerprofil med Firestore:", e);
    }
  }

  try {
    localStorage.setItem("railsync_user_profile_v1", JSON.stringify(userProfile));
  } catch (e) {}

  updateAuthUI(user);
  await syncAllUserTripsWithCloud(true);
}

if (isFirebaseConfigured()) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase Firestore og Auth initialisert vellykket.");

    // Listen to authentication state changes
    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      await syncUserProfileWithCloud(user);
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
  const displayNameEl = document.getElementById("user-display-name");
  const headerAvatarEl = document.getElementById("header-user-avatar");
  const sidebarAvatarEl = document.getElementById("sidebar-user-avatar");
  const sidebarLabelEl = document.getElementById("sidebar-user-label");

  const activeName = user
    ? (userProfile.displayName || user.displayName || (user.email ? user.email.split("@")[0] : "Bruker"))
    : (userProfile.displayName || "Min profil");

  const initials = getInitials(activeName);
  const bgColor = userProfile.avatarColor || "#0d9488";

  if (displayNameEl) displayNameEl.textContent = activeName;
  if (headerAvatarEl) {
    headerAvatarEl.textContent = initials;
    headerAvatarEl.style.backgroundColor = bgColor;
  }
  if (sidebarAvatarEl) {
    sidebarAvatarEl.textContent = initials;
    sidebarAvatarEl.style.backgroundColor = bgColor;
  }
  if (sidebarLabelEl) {
    sidebarLabelEl.textContent = user ? `${activeName} (Sky)` : `${activeName} (Profil)`;
  }

  if (user) {
    if (loginBtn) loginBtn.classList.add("hidden");
  } else {
    if (loginBtn) loginBtn.classList.remove("hidden");
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

function generateShareCode(tripIdStr) {
  const clean = String(tripIdStr || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const suffix = clean.length >= 4
    ? clean.slice(-4)
    : Math.floor(1000 + Math.random() * 9000).toString();
  return `RS-${suffix}`;
}

export function ensureTripCollaborationFields(tripObj) {
  if (!tripObj) return tripObj;
  if (!tripObj.id) tripObj.id = "trip_" + Date.now();
  if (!tripObj.shareCode) tripObj.shareCode = generateShareCode(tripObj.id);
  if (!tripObj.visibility) tripObj.visibility = "private";
  if (!tripObj.sharePermission) tripObj.sharePermission = "edit";

  const activeUid = currentUser ? currentUser.uid : (userProfile.uid || "local_user");
  const activeName = userProfile.displayName || (currentUser && currentUser.displayName) || "Meg";
  const activeColor = userProfile.avatarColor || "#0d9488";

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

// Starter Proposal: Single clean sample proposal
const starterProposal = ensureTripCollaborationFields({
  id: "eksempel-1",
  title: "Eksempelreise: Europaturné 2026",
  createdAt: new Date().toISOString(),
  visibility: "private",
  sharePermission: "edit",
  trip: JSON.parse(JSON.stringify(defaultTripState.trip)),
  stops: JSON.parse(JSON.stringify(defaultTripState.stops)),
  trains: JSON.parse(JSON.stringify(defaultTripState.trains)),
  expenses: JSON.parse(JSON.stringify(defaultTripState.expenses)),
  packingList: JSON.parse(JSON.stringify(defaultTripState.packingList))
});

export let allTrips = [starterProposal];
export let activeTripId = "eksempel-1";
export let currentTripManagerTab = "mine";
let activeTripUnsubscribe = null;
let isApplyingRemoteSnapshot = false;

// Deep clone active state container
export const appState = JSON.parse(JSON.stringify(defaultTripState));

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
    tripObj.owner.uid === "local_user"
  );
}

export function canEditActiveTrip() {
  const active = getActiveTripObject();
  if (!active) return true;
  if (active.visibility !== "shared") return true;
  if (isTripOwnedByCurrentUser(active)) return true;

  const myUid = currentUser ? currentUser.uid : userProfile.uid;
  const myMember = (active.members || []).find(
    m => m.id === myUid || m.name.toLowerCase() === (userProfile.displayName || "").toLowerCase()
  );
  if (myMember) {
    return myMember.role === "owner" || myMember.role === "editor";
  }
  return active.sharePermission !== "view";
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
  if (!active) return;
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  if (active.visibility === "shared" && active.id !== "eksempel-1") {
    const shareUrl = `${baseUrl}?trip=${active.id}`;
    window.history.replaceState({ path: shareUrl }, "", shareUrl);
  } else if (window.location.search.includes("trip=")) {
    window.history.replaceState({ path: baseUrl }, "", baseUrl);
  }
}

// =============================================================================
// PERSONAL BUDGET STORE (Private per traveler – never shared with companions)
// =============================================================================
export let personalBudgetsByTrip = {};

export function loadPersonalBudgetsFromStorage() {
  try {
    const raw = localStorage.getItem("railsync_personal_budgets_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        personalBudgetsByTrip = parsed;
      }
    }
  } catch (e) {
    console.warn("Kunne ikke lese personlige budsjetter:", e);
  }
}

export function savePersonalBudgetsToStorage() {
  try {
    localStorage.setItem("railsync_personal_budgets_v1", JSON.stringify(personalBudgetsByTrip));
  } catch (e) {}

  if (currentUser && isFirebaseConfigured() && db) {
    setDoc(doc(db, "users", currentUser.uid), {
      personalBudgets: personalBudgetsByTrip,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(() => {});
  }
}

export function getPersonalBudgetForTrip(tripObj) {
  if (!tripObj || !tripObj.id) {
    return { totalBudget: 20000, expenses: [] };
  }

  const existing = personalBudgetsByTrip[tripObj.id];
  if (existing && typeof existing === "object") {
    return {
      totalBudget: Number(existing.totalBudget) || 20000,
      expenses: Array.isArray(existing.expenses) ? JSON.parse(JSON.stringify(existing.expenses)) : []
    };
  }

  let initialBudget = 20000;
  let initialExpenses = [];

  if (tripObj.id === "eksempel-1") {
    initialBudget = defaultTripState.trip.totalBudget || 22000;
    initialExpenses = JSON.parse(JSON.stringify(defaultTripState.expenses));
  } else if (isTripOwnedByCurrentUser(tripObj)) {
    initialBudget = (tripObj.trip && Number(tripObj.trip.totalBudget)) || 20000;
    initialExpenses = Array.isArray(tripObj.expenses) ? JSON.parse(JSON.stringify(tripObj.expenses)) : [];
  } else {
    // Joining someone else's shared trip: create a separate personal budget for this traveler
    const passDays = (tripObj.trip && tripObj.trip.totalPassDays) || 7;
    initialBudget = 20000;
    initialExpenses = [
      {
        id: "exp-personal-" + Date.now(),
        title: `Interrail Global Pass ${passDays} dager`,
        category: "Transport",
        amount: 3900,
        date: (tripObj.trip && tripObj.trip.startDate) || new Date().toISOString().split("T")[0]
      }
    ];
  }

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
  personalBudgetsByTrip[tripId] = {
    totalBudget: Number(totalBudget) || 20000,
    expenses: JSON.parse(JSON.stringify(expenses || [])),
    updatedAt: new Date().toISOString()
  };
  savePersonalBudgetsToStorage();
}

export function syncActiveTripToState() {
  const active = getActiveTripObject();
  if (!active) return;

  const myBudget = getPersonalBudgetForTrip(active);

  appState.trip = JSON.parse(JSON.stringify(active.trip || defaultTripState.trip));
  appState.trip.totalBudget = myBudget.totalBudget;
  appState.stops = JSON.parse(JSON.stringify(active.stops || []));
  appState.trains = JSON.parse(JSON.stringify(active.trains || []));
  appState.expenses = myBudget.expenses;
  appState.packingList = JSON.parse(JSON.stringify(active.packingList || []));

  active.trip.totalBudget = myBudget.totalBudget;
  active.expenses = JSON.parse(JSON.stringify(myBudget.expenses));

  subscribeToActiveSharedTrip();
}

export function syncStateToActiveTrip(activityText = "") {
  let active = allTrips.find(t => t.id === activeTripId);
  if (!active) {
    active = ensureTripCollaborationFields({
      id: activeTripId || ("trip_" + Date.now()),
      title: appState.trip.title || "Min Reise",
      trip: {}, stops: [], trains: [], expenses: [], packingList: []
    });
    allTrips.push(active);
  } else {
    ensureTripCollaborationFields(active);
  }

  updatePersonalBudgetForTrip(active.id, appState.trip.totalBudget, appState.expenses);

  active.title = appState.trip.title || "Min Reise";
  active.trip = JSON.parse(JSON.stringify(appState.trip));
  active.stops = JSON.parse(JSON.stringify(appState.stops));
  active.trains = JSON.parse(JSON.stringify(appState.trains));
  active.expenses = JSON.parse(JSON.stringify(appState.expenses));
  active.packingList = JSON.parse(JSON.stringify(appState.packingList));
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

  // If this trip is shared or the user is logged into cloud, push update to Firestore in background
  if (!isApplyingRemoteSnapshot && isFirebaseConfigured() && db && (active.visibility === "shared" || currentUser)) {
    pushTripToFirestore(active);
  }
}

async function pushTripToFirestore(tripObj) {
  if (!isFirebaseConfigured() || !db || !tripObj || !tripObj.id) return;
  try {
    const docRef = doc(db, "trips", tripObj.id);
    const cloudPayload = JSON.parse(JSON.stringify(tripObj));
    // Never share personal expenses or personal totalBudget in shared trips
    if (cloudPayload.visibility === "shared") {
      delete cloudPayload.expenses;
      if (cloudPayload.trip) {
        delete cloudPayload.trip.totalBudget;
      }
    }
    await setDoc(docRef, {
      ...cloudPayload,
      savedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn("Kunne ikke synkronisere reise til Firestore:", err);
  }
}

export function subscribeToActiveSharedTrip() {
  if (activeTripUnsubscribe) {
    activeTripUnsubscribe();
    activeTripUnsubscribe = null;
  }

  const active = allTrips.find(t => t.id === activeTripId);
  if (!active || active.visibility !== "shared" || !isFirebaseConfigured() || !db) {
    return;
  }

  try {
    const docRef = doc(db, "trips", active.id);
    activeTripUnsubscribe = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) return;
      const cloudData = snap.data();
      if (!cloudData || !cloudData.trip) return;

      // Avoid overwriting if local state has identical or newer timestamp
      const currentActive = allTrips.find(t => t.id === active.id);
      if (currentActive && currentActive.updatedAt && cloudData.updatedAt && currentActive.updatedAt >= cloudData.updatedAt) {
        return;
      }

      isApplyingRemoteSnapshot = true;
      try {
        const merged = ensureTripCollaborationFields({
          ...currentActive,
          ...cloudData,
          id: active.id,
          title: cloudData.trip.title || cloudData.title || "Delt Reise"
        });

        // Always keep current traveler's own personal budget & expenses (never overwrite from shared trip)
        const myBudget = getPersonalBudgetForTrip(merged);
        if (!merged.trip) merged.trip = {};
        merged.trip.totalBudget = myBudget.totalBudget;
        merged.expenses = myBudget.expenses;

        const idx = allTrips.findIndex(t => t.id === active.id);
        if (idx !== -1) {
          allTrips[idx] = merged;
        }
        if (activeTripId === active.id) {
          appState.trip = JSON.parse(JSON.stringify(merged.trip));
          appState.stops = JSON.parse(JSON.stringify(merged.stops || []));
          appState.trains = JSON.parse(JSON.stringify(merged.trains || []));
          appState.expenses = JSON.parse(JSON.stringify(myBudget.expenses));
          appState.packingList = JSON.parse(JSON.stringify(merged.packingList || []));
          saveAllTripsToLocalStorage();
          renderAll();
          updateMapLayers();
        }
      } finally {
        isApplyingRemoteSnapshot = false;
      }
    });
  } catch (e) {
    console.warn("Sanntidslytting feilet:", e);
  }
}

export async function syncAllUserTripsWithCloud(silent = false) {
  if (!isFirebaseConfigured() || !db) {
    if (!silent) showToast("Lokal modus", "Reisene dine er lagret trygt i nettleseren.", "check");
    return;
  }

  try {
    // 1. Push any local shared trips or user-owned trips if logged in
    for (const t of allTrips) {
      ensureTripCollaborationFields(t);
      if (t.visibility === "shared" || currentUser) {
        await pushTripToFirestore(t);
      }
    }

    // 2. If logged in, fetch trips owned by this user from Firestore
    if (currentUser) {
      const q = query(collection(db, "trips"), where("owner.uid", "==", currentUser.uid));
      const snap = await getDocs(q);
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.trip) {
          const cloudTrip = ensureTripCollaborationFields({
            ...data,
            id: docSnap.id,
            title: data.trip.title || data.title || "Min Reise"
          });
          const myBudget = getPersonalBudgetForTrip(cloudTrip);
          cloudTrip.trip.totalBudget = myBudget.totalBudget;
          cloudTrip.expenses = myBudget.expenses;
          const existingIdx = allTrips.findIndex(local => local.id === docSnap.id);
          if (existingIdx === -1) {
            allTrips.push(cloudTrip);
          } else if (cloudTrip.updatedAt && (!allTrips[existingIdx].updatedAt || cloudTrip.updatedAt > allTrips[existingIdx].updatedAt)) {
            allTrips[existingIdx] = cloudTrip;
          }
        }
      });
    }

    saveAllTripsToLocalStorage();
    syncActiveTripToState();
    renderAll();
    updateMapLayers();

    if (!silent) {
      showToast("Synkronisert med skyen!", `Alle dine ${allTrips.length} reiser er oppdatert.`, "cloud");
    }
  } catch (err) {
    console.warn("Sky-synkronisering feilet:", err);
    if (!silent) {
      showToast("Synkroniseringsfeil", "Kunne ikke nå skyen akkurat nå. Endringer er lagret lokalt.", "alert-triangle");
    }
  }
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
  loadLocalUserProfile();
  loadPersonalBudgetsFromStorage();

  // First load saved trips from localStorage so we don't lose existing trips when opening a shared link
  try {
    const savedTrips = localStorage.getItem("railsync_all_trips_v3");
    if (savedTrips) {
      const parsed = JSON.parse(savedTrips);
      if (parsed && Array.isArray(parsed.allTrips) && parsed.allTrips.length > 0) {
        allTrips = parsed.allTrips.map(t => ensureTripCollaborationFields(t));
        activeTripId = parsed.activeTripId || allTrips[0].id;
      }
    }
  } catch (err) {
    console.warn("Kunne ikke lese railsync_all_trips_v3:", err);
  }

  const urlParams = new URLSearchParams(window.location.search);
  const tripId = urlParams.get("trip");

  if (tripId) {
    const joined = await fetchAndJoinSharedTrip(tripId, true);
    if (joined) return;
  }

  if (!allTrips || allTrips.length === 0) {
    allTrips = [starterProposal];
    activeTripId = "eksempel-1";
  }
  syncActiveTripToState();
}

export async function fetchAndJoinSharedTrip(tripIdOrCode, fromUrlParam = false) {
  if (!tripIdOrCode) return false;
  let cleanInput = String(tripIdOrCode).trim();

  // Extract ?trip=... if user pasted a full URL
  if (cleanInput.includes("trip=")) {
    try {
      const u = new URL(cleanInput);
      cleanInput = u.searchParams.get("trip") || cleanInput;
    } catch (e) {
      const match = cleanInput.match(/[?&]trip=([^&#]+)/);
      if (match) cleanInput = match[1];
    }
  }

  const upperCode = cleanInput.toUpperCase();
  let normalizedCode = upperCode;
  if (/^[A-Z0-9]{4}$/.test(upperCode)) {
    normalizedCode = `RS-${upperCode}`;
  } else if (/^RS[A-Z0-9]{4}$/.test(upperCode)) {
    normalizedCode = `RS-${upperCode.slice(2)}`;
  }

  // 1. Check Firestore (by doc ID or by shareCode)
  if (isFirebaseConfigured() && db) {
    try {
      let foundId = null;
      let cloudData = null;

      // Try direct document ID first
      const docRef = doc(db, "trips", cleanInput);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        foundId = docSnap.id;
        cloudData = docSnap.data();
      } else {
        // Query by 6-char shareCode (e.g. RS-4829)
        const q = query(collection(db, "trips"), where("shareCode", "==", normalizedCode));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          foundId = qSnap.docs[0].id;
          cloudData = qSnap.docs[0].data();
        }
      }

      if (foundId && cloudData && cloudData.trip) {
        const loadedTrip = ensureTripCollaborationFields({
          ...cloudData,
          id: foundId,
          visibility: "shared",
          title: cloudData.trip.title || cloudData.title || "Delt Reise"
        });

        // Ensure personal budget is kept separate from trip owner's budget
        const myBudget = getPersonalBudgetForTrip(loadedTrip);
        loadedTrip.trip.totalBudget = myBudget.totalBudget;
        loadedTrip.expenses = myBudget.expenses;

        // Automatically add current user to members if not already in the list
        const myUid = currentUser ? currentUser.uid : userProfile.uid;
        const myName = userProfile.displayName || "Gjest";
        const alreadyMember = (loadedTrip.members || []).some(
          m => m.id === myUid || m.name.toLowerCase() === myName.toLowerCase()
        );
        if (!alreadyMember && myName !== "Reisende") {
          loadedTrip.members.push({
            id: myUid,
            name: myName,
            role: loadedTrip.sharePermission === "view" ? "viewer" : "editor",
            avatarColor: userProfile.avatarColor || "#2563eb",
            joinedAt: new Date().toISOString()
          });
          loadedTrip.activityLog.unshift({
            text: `${myName} ble med i reisefølget`,
            by: myName,
            time: new Date().toISOString()
          });
          await pushTripToFirestore(loadedTrip);
        }

        const existingIdx = allTrips.findIndex(t => t.id === foundId);
        if (existingIdx !== -1) {
          allTrips[existingIdx] = loadedTrip;
        } else {
          allTrips.unshift(loadedTrip);
        }

        activeTripId = foundId;
        syncActiveTripToState();
        saveAllTripsToLocalStorage();
        renderAll();
        updateMapLayers();
        showToast("Delt reise lastet!", `Du er nå koblet til "${appState.trip.title}" i sanntid.`, "users");
        return true;
      }
    } catch (err) {
      console.warn("Feil ved henting av delt reise fra Firestore:", err);
    }
  }

  // 2. Check local trip cache / existing trips by ID or shareCode
  const localMatch = allTrips.find(t => t.id === cleanInput || (t.shareCode && (t.shareCode.toUpperCase() === upperCode || t.shareCode.toUpperCase() === normalizedCode)));
  if (localMatch) {
    activeTripId = localMatch.id;
    syncActiveTripToState();
    syncUrlWithActiveTrip();
    saveAllTripsToLocalStorage();
    renderAll();
    updateMapLayers();
    showToast("Reise åpnet", `Byttet til "${appState.trip.title}".`, "check");
    return true;
  }

  try {
    const localTrip = localStorage.getItem(`railsync_trip_${cleanInput}`);
    if (localTrip) {
      const parsed = JSON.parse(localTrip);
      const loadedTrip = ensureTripCollaborationFields({
        ...parsed,
        id: cleanInput,
        visibility: "shared",
        title: parsed.trip ? parsed.trip.title : "Delt Reise"
      });
      allTrips.unshift(loadedTrip);
      activeTripId = cleanInput;
      syncActiveTripToState();
      saveAllTripsToLocalStorage();
      renderAll();
      updateMapLayers();
      showToast("Reise lastet", `Hentet "${appState.trip.title}".`);
      return true;
    }
  } catch (e) {}

  if (!fromUrlParam) {
    showToast("Fant ikke reisen", `Ingen delt reise funnet med kode eller ID "${cleanInput}".`, "alert-circle");
  }
  return false;
}

export function persistState(activityText = "") {
  syncStateToActiveTrip(activityText);
}

/**
 * Safe multi-platform clipboard copy helper with execCommand fallback
 */
export async function copyToClipboardFallback(textToCopy) {
  if (!textToCopy) return false;

  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function" && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText feilet, prøver execCommand:", err);
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = textToCopy;
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, 99999);

    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (successful) return true;
  } catch (err) {
    console.warn("execCommand fallback feilet:", err);
  }

  return false;
}

/**
 * Handle Save & Share Trip:
 * Updates the SAME trip ID in Firestore (`setDoc` instead of creating duplicate `addDoc` copies),
 * promotes visibility to 'shared' on first share, starts real-time sync, and opens the Collaboration Modal.
 */
export async function handleSaveAndShareTrip() {
  const btn = document.getElementById("btn-save-share");
  const originalHtml = btn ? btn.innerHTML : "";

  if (btn) {
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span class="hidden sm:inline">Synkroniserer...</span>`;
    btn.disabled = true;
    if (window.lucide) lucide.createIcons();
  }

  try {
    let active = getActiveTripObject();
    if (!active) return;

    // If the user is sharing the default 'eksempel-1' ID, assign a unique persistent cloud ID once so users don't collide on 'eksempel-1'
    if (active.id === "eksempel-1") {
      active.id = "trip_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      active.shareCode = generateShareCode(active.id);
      activeTripId = active.id;
    }

    // Promote to shared on first share
    if (active.visibility !== "shared") {
      active.visibility = "shared";
      active.activityLog.unshift({
        text: "Delt reise og sanntidssamarbeid ble aktivert",
        by: userProfile.displayName || "Eier",
        time: new Date().toISOString()
      });
    }

    syncStateToActiveTrip();

    if (isFirebaseConfigured() && db) {
      await pushTripToFirestore(active);
      subscribeToActiveSharedTrip();
    } else {
      localStorage.setItem(`railsync_trip_${active.id}`, JSON.stringify(active));
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}?trip=${active.id}`;
    window.history.replaceState({ path: shareUrl }, "", shareUrl);

    renderShareAndCollabModal();
    renderAll();
    openModal("modal-share-trip");

    const copied = await copyToClipboardFallback(shareUrl);
    const copyBtnText = document.getElementById("btn-copy-url-text");
    if (copied) {
      if (copyBtnText) copyBtnText.textContent = "Kopiert!";
      showToast("Delingslenke kopiert!", `Kode ${active.shareCode} og lenke er klar til å deles med reisefølget.`, "users");
      setTimeout(() => {
        if (copyBtnText) copyBtnText.textContent = "Kopier lenke";
      }, 3000);
    }
  } catch (error) {
    console.error("Feil ved deling av reise:", error);
    showToast("Feil ved lagring", "Kunne ikke åpne delingsinnstillinger.", "alert-circle");
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      if (window.lucide) lucide.createIcons();
    }
  }
}

export async function copyShareTripUrl() {
  const shareInput = document.getElementById("share-url-input");
  const url = shareInput ? shareInput.value : window.location.href;
  if (shareInput) {
    shareInput.select();
    shareInput.setSelectionRange(0, 99999);
  }

  const copied = await copyToClipboardFallback(url);
  const copyBtn = document.getElementById("btn-copy-url");
  const copyBtnText = document.getElementById("btn-copy-url-text");

  if (copied) {
    if (copyBtn) {
      copyBtn.classList.remove("bg-rail-accent", "hover:bg-rail-accentHover");
      copyBtn.classList.add("bg-emerald-600", "hover:bg-emerald-500");
    }
    if (copyBtnText) copyBtnText.textContent = "Kopiert!";
    showToast("Lenke kopiert!", "Delingslenken er klar til å limes inn.", "check");
    setTimeout(() => {
      if (copyBtn) {
        copyBtn.classList.add("bg-rail-accent", "hover:bg-rail-accentHover");
        copyBtn.classList.remove("bg-emerald-600", "hover:bg-emerald-500");
      }
      if (copyBtnText) copyBtnText.textContent = "Kopier lenke";
    }, 2500);
  } else {
    showToast("Lenke merket", "Trykk Kopier i nettleseren din.", "share-2");
  }
}

export async function triggerNativeShare() {
  const shareInput = document.getElementById("share-url-input");
  const url = shareInput ? shareInput.value : window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({
        title: appState.trip.title || "RailSync Interrail-reise",
        text: `Se min interrail-plan: ${appState.trip.title || "Europaturné 2026"}`,
        url: url
      });
    } catch (err) {
      console.log("Deling avbrutt:", err);
    }
  }
}

// Toast notification helper
let toastTimeout = null;
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

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
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
let realTrackPolylines = [];
let previewTrackPolyline = null;

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

  // Render real railway tracks from appState.trains (if available)
  const trainsWithGeometry = (appState.trains || []).filter(t => Array.isArray(t.routeGeometry) && t.routeGeometry.length > 1);

  if (latlngs.length > 1) {
    routePolyline = L.polyline(latlngs, {
      color: trainsWithGeometry.length > 0 ? '#94a3b8' : '#0d9488',
      weight: trainsWithGeometry.length > 0 ? 2.5 : 4,
      opacity: trainsWithGeometry.length > 0 ? 0.5 : 0.85,
      dashArray: '8, 8',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
  }

  trainsWithGeometry.forEach((train) => {
    const poly = L.polyline(train.routeGeometry, {
      color: '#0d9488',
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
  if (window.innerWidth < 1024) {
    const mapEl = document.getElementById("rail-map");
    if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  map.flyTo([lat, lng], 8, { duration: 1.0 });
  const targetMarker = mapMarkers.find(m => {
    const pos = m.getLatLng();
    return Math.abs(pos.lat - lat) < 0.001 && Math.abs(pos.lng - lng) < 0.001;
  });
  if (targetMarker) {
    setTimeout(() => targetMarker.openPopup(), 450);
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
    btn.classList.remove("text-brand-600", "font-bold", "bg-brand-50/70");
    btn.classList.add("text-slate-400", "font-medium");
  });
  const activeMobileBtn = document.getElementById(`mobile-tab-${tabId}`);
  if (activeMobileBtn) {
    activeMobileBtn.classList.add("text-brand-600", "font-bold", "bg-brand-50/70");
    activeMobileBtn.classList.remove("text-slate-400", "font-medium");
  }

  // On mobile, scroll smoothly to the top when switching main tabs
  if (window.innerWidth < 768) {
    window.scrollTo({ top: 0, behavior: "smooth" });
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
  if (mobilePassEl) mobilePassEl.textContent = `${usedPassDays}/${totalPassDays} dgr`;

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
      <div class="relative pl-7 pb-3 group">
        ${!isEnd ? '<div class="absolute left-3 top-3.5 bottom-0 w-0.5 bg-slate-200 group-hover:bg-brand-300 transition-colors"></div>' : ''}
        
        <div class="absolute left-0 top-1.5 w-6 h-6 rounded-full ${isStart ? 'bg-slate-900' : (isEnd ? 'bg-rail-accent' : 'bg-brand-600')} text-white flex items-center justify-center text-xs font-bold shadow-xs">
          ${idx + 1}
        </div>

        <div class="bg-slate-50 hover:bg-slate-100/90 rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 transition-all flex flex-col gap-2 shadow-2xs w-full min-w-0">
          <!-- Row 1: City, Country & Dates + Status Badge (Full width, never squished by 5 buttons) -->
          <div class="flex items-start justify-between gap-2 min-w-0">
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline gap-1.5 flex-wrap">
                <h3 class="font-extrabold text-slate-900 text-sm sm:text-base hover:text-brand-600 cursor-pointer leading-snug" onclick="centerMapOnStop(${stop.lat}, ${stop.lng})">
                  ${escapeHtml(stop.city)}
                </h3>
                <span class="text-xs text-slate-500 font-medium">${escapeHtml(stop.country)}</span>
              </div>
              <p class="text-[11px] text-slate-500 font-medium mt-0.5">
                ${formatDate(stop.arrival)} – ${formatDate(stop.departure)}
              </p>
              ${stop.accommodationNote ? `<p class="text-[11px] text-slate-400 truncate mt-0.5" title="${escapeHtml(stop.accommodationNote)}">${escapeHtml(stop.accommodationNote)}</p>` : ''}
            </div>
            
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${badgeStyle}">
              ${escapeHtml(stop.accommodationStatus)}
            </span>
          </div>

          <!-- Row 2: Clean Action Toolbar & Next Leg Train Search -->
          <div class="flex items-center justify-between flex-wrap gap-1.5 pt-2 border-t border-slate-200/50">
            <div class="flex items-center gap-1">
              <button 
                title="Flytt opp i reiseruten" 
                onclick="moveStopOrder('${stop.id}', -1)" 
                class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 bg-white border border-slate-200/80 shadow-2xs transition ${isStart ? 'opacity-25 cursor-not-allowed' : ''}"
                ${isStart ? 'disabled' : ''}
              >
                <i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>
              </button>

              <button 
                title="Flytt ned i reiseruten" 
                onclick="moveStopOrder('${stop.id}', 1)" 
                class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 bg-white border border-slate-200/80 shadow-2xs transition ${isEnd ? 'opacity-25 cursor-not-allowed' : ''}"
                ${isEnd ? 'disabled' : ''}
              >
                <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
              </button>

              <button title="Rediger stoppested" onclick="openEditStopModal('${stop.id}')" class="px-2 h-7 flex items-center gap-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-brand-600 bg-white border border-slate-200/80 shadow-2xs transition">
                <i data-lucide="pencil" class="w-3 h-3"></i>
                <span>Endre</span>
              </button>

              <button title="Vis på kartet" onclick="centerMapOnStop(${stop.lat}, ${stop.lng})" class="px-2 h-7 flex items-center gap-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-brand-600 bg-white border border-slate-200/80 shadow-2xs transition">
                <i data-lucide="map-pin" class="w-3 h-3 text-brand-600"></i>
                <span>Kart</span>
              </button>

              <button title="Fjern stoppested" onclick="deleteStop('${stop.id}')" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 bg-white border border-slate-200/80 shadow-2xs transition">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            ${!isEnd ? `
              <button 
                onclick="quickSearchBetweenStops(${idx}, ${idx + 1})" 
                class="text-[11px] font-bold text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200/80 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                title="Søk reelle togtider fra ${escapeHtml(stop.city)} til ${escapeHtml(appState.stops[idx + 1].city)}"
              >
                <i data-lucide="train" class="w-3 h-3 text-brand-600 shrink-0"></i>
                <span class="truncate max-w-[130px] sm:max-w-none">Tog → ${escapeHtml(appState.stops[idx + 1].city)}</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

export function renderTrains() {
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
    let resBadge = '';
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

    const travelDayBadge = train.isTravelDay 
      ? `<span class="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200">Reisedag</span>`
      : `<span class="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium bg-slate-100 text-slate-500">Lokal</span>`;

    const hasTrack = Array.isArray(train.routeGeometry) && train.routeGeometry.length > 1;
    const transfersCount = typeof train.transfers === 'number' ? train.transfers : 0;
    const transferLabel = transfersCount === 0
      ? 'Direktetog'
      : `${transfersCount} bytte${transfersCount > 1 ? 'r' : ''}`;

    const legsHtml = Array.isArray(train.legsSummary) && train.legsSummary.length > 1
      ? `
        <div class="pt-2 flex items-center flex-wrap gap-1 text-[11px] text-slate-600">
          <span class="text-slate-400 font-semibold">Etapper:</span>
          ${train.legsSummary.map((leg, i) => `
            <span class="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 font-medium text-slate-700">
              <strong>${escapeHtml(leg.line)}</strong> ${escapeHtml(leg.from)} (${escapeHtml(leg.dep)}) → ${escapeHtml(leg.to)} (${escapeHtml(leg.arr)})
            </span>
            ${i < train.legsSummary.length - 1 ? '<span class="text-slate-300">→</span>' : ''}
          `).join('')}
        </div>
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
            <p class="text-[10px] sm:text-xs text-slate-400 truncate">${train.platform ? `Spor ${escapeHtml(train.platform)}` : 'Avgang'}</p>
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
            <p class="text-[10px] sm:text-xs text-slate-400 truncate">${train.arrivalPlatform ? `Spor ${escapeHtml(train.arrivalPlatform)}` : 'Ankomst'}</p>
          </div>
        </div>

        ${legsHtml}

        <div class="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            ${resBadge}
            ${train.reservationPrice > 0 ? `<span class="text-xs text-slate-500 font-semibold">~${train.reservationPrice} kr</span>` : ''}
          </div>

          <div class="flex items-center gap-1.5 flex-wrap ml-auto">
            ${hasTrack ? `
              <button onclick="focusTrainTrackOnMap('${train.id}')" class="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition flex items-center gap-1">
                <i data-lucide="map-pin" class="w-3.5 h-3.5"></i> Vis i kart
              </button>
            ` : `
              <button onclick="fetchRealTrackForSingleTrain('${train.id}')" class="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition flex items-center gap-1">
                <i data-lucide="zap" class="w-3.5 h-3.5"></i> Hent spor
              </button>
            `}
            ${train.reservationStatus === 'required' ? `
              <button onclick="toggleTrainReservation('${train.id}')" class="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition">
                Merk bestilt
              </button>
            ` : `
              <button onclick="toggleTrainReservation('${train.id}')" class="text-xs font-medium text-slate-400 hover:text-slate-600 px-2 py-1">
                Status
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
  const mobileList = document.getElementById("expenses-mobile-list");
  const countBadge = document.getElementById("expenses-count-badge");
  if (countBadge) countBadge.textContent = `${appState.expenses.length} poster`;

  if (mobileList) {
    if (appState.expenses.length === 0) {
      mobileList.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Ingen personlige utgifter registrert ennå.</div>`;
    } else {
      mobileList.innerHTML = appState.expenses.map(exp => {
        return `
          <div class="p-3.5 flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1 space-y-1">
              <p class="font-bold text-slate-900 text-xs truncate">${escapeHtml(exp.title)}</p>
              <div class="flex items-center flex-wrap gap-1.5 text-[11px]">
                <span class="px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700">${escapeHtml(exp.category)}</span>
                <span class="text-slate-400">${formatDate(exp.date)}</span>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-extrabold text-slate-900 text-sm">${formatNumber(exp.amount)} kr</span>
              <button onclick="deleteExpense('${exp.id}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg bg-slate-50 transition" title="Slett utgift">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  if (tbody) {
    if (appState.expenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">Ingen personlige utgifter registrert.</td></tr>`;
    } else {
      tbody.innerHTML = appState.expenses.map(exp => {
        return `
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
      `;
      }).join("");
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
                <button onclick="deletePackingItem('${item.id}')" class="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded transition" title="Slett">
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

export function renderHeaderCollaborationBar() {
  const active = getActiveTripObject();
  if (!active) return;

  const visBadge = document.getElementById("header-visibility-badge");
  const mobileVisBadge = document.getElementById("header-visibility-badge-mobile");
  const avatarsContainer = document.getElementById("header-members-avatars");
  const mobileAvatarsContainer = document.getElementById("mobile-members-avatars");
  const countLabel = document.getElementById("header-members-count-label");
  const readonlyBanner = document.getElementById("readonly-trip-banner");

  const isEditable = canEditActiveTrip();
  if (readonlyBanner) {
    if (!isEditable) {
      readonlyBanner.classList.remove("hidden");
    } else {
      readonlyBanner.classList.add("hidden");
    }
  }

  if (visBadge) {
    if (!isEditable) {
      visBadge.className = "hidden sm:inline-flex cursor-pointer items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 transition shrink-0";
      visBadge.innerHTML = `👁️ Kun visning`;
    } else if (active.visibility === "shared") {
      visBadge.className = "hidden sm:inline-flex cursor-pointer items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 transition shrink-0";
      visBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Delt reise (${escapeHtml(active.shareCode || 'Live')})`;
    } else {
      visBadge.className = "hidden sm:inline-flex cursor-pointer items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 hover:border-brand-300 transition shrink-0";
      visBadge.innerHTML = `🔒 Privat reise`;
    }
  }

  if (mobileVisBadge) {
    if (!isEditable) {
      mobileVisBadge.className = "cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0";
      mobileVisBadge.innerHTML = `👁️ Kun visning`;
    } else if (active.visibility === "shared") {
      mobileVisBadge.className = "cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0";
      mobileVisBadge.innerHTML = `🌍 Delt (${escapeHtml(active.shareCode || 'Live')})`;
    } else {
      mobileVisBadge.className = "cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0";
      mobileVisBadge.innerHTML = `🔒 Privat`;
    }
  }

  const members = Array.isArray(active.members) ? active.members : [];
  const avatarsHtml = members.slice(0, 5).map(m => `
    <span 
      title="${escapeHtml(m.name)} (${m.role === 'owner' ? 'Eier' : (m.role === 'viewer' ? 'Kun visning' : 'Kan redigere')})"
      class="w-6 h-6 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white shadow-2xs"
      style="background-color: ${escapeHtml(m.avatarColor || '#0d9488')}"
    >
      ${escapeHtml(getInitials(m.name))}
    </span>
  `).join("");

  if (avatarsContainer) avatarsContainer.innerHTML = avatarsHtml;
  if (mobileAvatarsContainer) mobileAvatarsContainer.innerHTML = avatarsHtml;

  if (countLabel) {
    countLabel.textContent = members.length > 1 ? `${members.length} på turen` : `Reisefølge`;
  }
}

export function renderAll() {
  renderHeaderCollaborationBar();
  renderOverview();
  renderTrains();
  renderBudget();
  renderPacking();
  renderTripManagerList();
  updateAuthUI(currentUser);
  if (window.lucide) lucide.createIcons();
}

// =============================================================================
// 6.5 MULTI-TRIP MANAGER, SHARED TRIPS & USER PROFILE FUNCTIONS
// =============================================================================
export function openTripManagerModal(initialTab = "mine") {
  switchTripManagerTab(initialTab);
  openModal('modal-trip-manager');
}

export function switchTripManagerTab(tabName) {
  currentTripManagerTab = tabName || "mine";

  const tabs = ["mine", "shared", "join"];
  tabs.forEach(t => {
    const btn = document.getElementById(`trip-tab-btn-${t}`);
    if (!btn) return;
    if (t === currentTripManagerTab) {
      btn.className = "py-2 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 bg-white text-slate-900 shadow-2xs min-w-0";
    } else {
      btn.className = "py-2 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-semibold transition flex items-center justify-center gap-1 text-slate-600 hover:text-slate-900 min-w-0";
    }
  });

  const listPanel = document.getElementById("trip-manager-panel-list");
  const joinPanel = document.getElementById("trip-manager-panel-join");

  if (currentTripManagerTab === "join") {
    if (listPanel) listPanel.classList.add("hidden");
    if (joinPanel) joinPanel.classList.remove("hidden");
  } else {
    if (listPanel) listPanel.classList.remove("hidden");
    if (joinPanel) joinPanel.classList.add("hidden");
    renderTripManagerList();
  }

  if (window.lucide) lucide.createIcons();
}

export function renderTripManagerList() {
  const container = document.getElementById("trip-manager-list");
  if (!container) return;

  allTrips.forEach(t => ensureTripCollaborationFields(t));

  const mineTrips = allTrips.filter(t => isTripOwnedByCurrentUser(t));
  const sharedTrips = allTrips.filter(t => t.visibility === "shared" || (Array.isArray(t.members) && t.members.length > 1) || !isTripOwnedByCurrentUser(t));

  const countBadge = document.getElementById("sidebar-trips-count-badge");
  if (countBadge) countBadge.textContent = allTrips.length;

  const headerBadge = document.getElementById("header-trip-count-badge");
  if (headerBadge) headerBadge.textContent = allTrips.length;

  const mobileHeaderBadge = document.getElementById("header-trip-count-badge-mobile");
  if (mobileHeaderBadge) mobileHeaderBadge.textContent = allTrips.length;

  const tabCountMine = document.getElementById("trip-tab-count-mine");
  if (tabCountMine) tabCountMine.textContent = mineTrips.length;

  const tabCountShared = document.getElementById("trip-tab-count-shared");
  if (tabCountShared) tabCountShared.textContent = sharedTrips.length;

  const displayList = currentTripManagerTab === "shared" ? sharedTrips : mineTrips;

  const headingEl = document.getElementById("trip-manager-section-heading");
  if (headingEl) {
    headingEl.textContent = currentTripManagerTab === "shared"
      ? "Delte reiser med reisefølge"
      : "Dine egne reiser (Privat & Eier)";
  }

  const modalCountText = document.getElementById("modal-trips-count-text");
  if (modalCountText) modalCountText.textContent = `${displayList.length} reise${displayList.length === 1 ? '' : 'r'}`;

  if (displayList.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-50 rounded-2xl border border-slate-200/80 p-6 text-center space-y-2">
        <p class="text-sm font-bold text-slate-800">
          ${currentTripManagerTab === "shared" ? "Ingen delte reiser ennå" : "Ingen egne reiser funnet"}
        </p>
        <p class="text-xs text-slate-500 max-w-md mx-auto">
          ${currentTripManagerTab === "shared"
            ? "Klikk «Del & Reisefølge» på en av dine egne reiser for å invitere venner, eller gå til fanen «Bli med (Kode)» for å koble deg på en venns reise."
            : "Trykk «Ny egen reise» ovenfor for å starte planleggingen."}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = displayList.map((tripItem) => {
    const isActive = tripItem.id === activeTripId;
    const stopsCount = tripItem.stops ? tripItem.stops.length : 0;
    const daysCount = tripItem.trip ? (tripItem.trip.totalPassDays || 7) : 7;
    const myTripBudget = getPersonalBudgetForTrip(tripItem);
    const budgetVal = myTripBudget.totalBudget || 20000;
    const isShared = tripItem.visibility === "shared";
    const members = Array.isArray(tripItem.members) ? tripItem.members : [];
    const ownerName = tripItem.owner ? tripItem.owner.name : "Meg";

    const visPill = isShared
      ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">🌍 Delt (${escapeHtml(tripItem.shareCode || '')})</span>`
      : `<span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">🔒 Privat</span>`;

    const memberAvatars = members.slice(0, 4).map(m => `
      <span title="${escapeHtml(m.name)}" class="w-5 h-5 rounded-full text-white text-[9px] font-extrabold inline-flex items-center justify-center ring-1 ring-white" style="background-color: ${escapeHtml(m.avatarColor || '#0d9488')}">
        ${escapeHtml(getInitials(m.name))}
      </span>
    `).join("");

    return `
      <div class="p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isActive 
          ? 'bg-brand-50/60 border-brand-300 ring-2 ring-brand-500/20 shadow-xs' 
          : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60'
      }">
        <div class="space-y-1.5 min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h4 class="font-bold text-slate-900 text-sm sm:text-base leading-tight">${escapeHtml(tripItem.title)}</h4>
            ${visPill}
            ${isActive ? `
              <span class="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-600 text-white shadow-2xs">
                <i data-lucide="check" class="w-3 h-3"></i>
                Aktiv nå
              </span>
            ` : ''}
          </div>
          <p class="text-xs text-slate-500 font-medium">
            📍 ${stopsCount} stopp • 🎫 ${daysCount} dager • 💰 ${formatNumber(budgetVal)} kr • 👤 Eier: ${escapeHtml(ownerName)}
          </p>
          <div class="flex items-center gap-2 pt-0.5">
            <div class="flex items-center -space-x-1">${memberAvatars}</div>
            <span class="text-[11px] text-slate-400">${members.length} deltaker${members.length === 1 ? '' : 'e'}${tripItem.lastUpdatedBy ? ` • Sist endret av ${escapeHtml(tripItem.lastUpdatedBy)}` : ''}</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-1.5 sm:gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex-wrap sm:flex-nowrap">
          ${!isActive ? `
            <button onclick="switchActiveTrip('${tripItem.id}')" class="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition shadow-xs">
              Åpne
            </button>
          ` : `
            <button onclick="closeModal('modal-trip-manager'); handleSaveAndShareTrip()" class="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-rail-accent border border-orange-200 font-bold text-xs transition">
              Del / Tilgang
            </button>
          `}
          <button onclick="duplicateTrip('${tripItem.id}')" class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-brand-700 bg-slate-100 hover:bg-brand-50 border border-slate-200 transition" title="Lag en privat kopi av denne reisen">
            <i data-lucide="copy" class="w-3.5 h-3.5 text-brand-600"></i>
            <span>Kopi</span>
          </button>
          <button onclick="renameTripInManager('${tripItem.id}')" class="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition" title="Endre navn">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          </button>
          ${allTrips.length > 1 ? `
            <button onclick="deleteTrip('${tripItem.id}')" class="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="Slett eller forlat reise">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

export async function handleJoinSharedTripByCode(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById("join-trip-code-input");
  const btn = document.getElementById("btn-join-trip-submit");
  if (!input || !input.value.trim()) return;

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Kobler til...";
  }

  try {
    const ok = await fetchAndJoinSharedTrip(input.value.trim(), false);
    if (ok) {
      input.value = "";
      closeModal("modal-trip-manager");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i><span>Koble til reise</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }
}

export function renderShareAndCollabModal() {
  const active = getActiveTripObject();
  if (!active) return;

  const visSelect = document.getElementById("share-visibility-select");
  const permSelect = document.getElementById("share-permission-select");
  const livePill = document.getElementById("share-modal-live-pill");
  const codeBadge = document.getElementById("share-code-badge");
  const shareInput = document.getElementById("share-url-input");
  const membersContainer = document.getElementById("share-members-list");
  const activityContainer = document.getElementById("share-activity-log");

  if (visSelect) visSelect.value = active.visibility || "shared";
  if (permSelect) permSelect.value = active.sharePermission || "edit";
  if (codeBadge) codeBadge.textContent = active.shareCode || generateShareCode(active.id);

  if (livePill) {
    if (active.visibility === "shared") {
      livePill.className = "px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 self-start sm:self-auto";
      livePill.textContent = "🟢 Sanntids deling aktiv";
    } else {
      livePill.className = "px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700 self-start sm:self-auto";
      livePill.textContent = "🔒 Kun privat (Lokal)";
    }
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}?trip=${active.id}`;
  if (shareInput) shareInput.value = shareUrl;

  const nativeShareContainer = document.getElementById("native-share-container");
  if (nativeShareContainer) {
    if (typeof navigator.share === "function") {
      nativeShareContainer.classList.remove("hidden");
    } else {
      nativeShareContainer.classList.add("hidden");
    }
  }

  if (membersContainer) {
    const members = Array.isArray(active.members) ? active.members : [];
    membersContainer.innerHTML = members.map((m, idx) => {
      const isOwner = m.role === "owner" || idx === 0;
      return `
        <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-7 h-7 rounded-full text-white text-xs font-extrabold flex items-center justify-center shrink-0" style="background-color: ${escapeHtml(m.avatarColor || '#0d9488')}">
              ${escapeHtml(getInitials(m.name))}
            </span>
            <div class="min-w-0">
              <p class="text-xs sm:text-sm font-bold text-slate-900 truncate">${escapeHtml(m.name)}</p>
              <p class="text-[10px] text-slate-500 font-semibold">${isOwner ? '👑 Eier av reisen' : (m.role === 'viewer' ? '👁️ Kun visning' : '✏️ Kan redigere')}</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            ${!isOwner ? `
              <button type="button" onclick="toggleTripMemberRole(${idx})" class="text-[11px] font-semibold px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-brand-50 transition">
                ${m.role === 'viewer' ? 'Gi redigering' : 'Sett kun visning'}
              </button>
              <button type="button" onclick="removeTripMember(${idx})" class="p-1 text-slate-400 hover:text-rose-600 rounded transition" title="Fjern fra reisefølge">
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
              </button>
            ` : `
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">Deg / Eier</span>
            `}
          </div>
        </div>
      `;
    }).join("");
  }

  if (activityContainer) {
    const logs = Array.isArray(active.activityLog) ? active.activityLog : [];
    if (logs.length === 0) {
      activityContainer.innerHTML = `<p class="text-slate-400 italic">Ingen loggførte hendelser ennå.</p>`;
    } else {
      activityContainer.innerHTML = logs.slice(0, 8).map(item => `
        <div class="flex items-center justify-between gap-2 py-0.5">
          <span class="truncate">• <strong>${escapeHtml(item.by || 'Reisende')}:</strong> ${escapeHtml(item.text)}</span>
        </div>
      `).join("");
    }
  }

  if (window.lucide) lucide.createIcons();
}

export async function handleUpdateTripSharingSettings() {
  const active = getActiveTripObject();
  if (!active) return;

  const visSelect = document.getElementById("share-visibility-select");
  const permSelect = document.getElementById("share-permission-select");

  if (visSelect) active.visibility = visSelect.value;
  if (permSelect) active.sharePermission = permSelect.value;

  persistState(`Endret delingsinnstillinger (${active.visibility === 'shared' ? 'Delt' : 'Privat'}, ${active.sharePermission === 'edit' ? 'Kan redigere' : 'Kun visning'})`);
  if (active.visibility === "shared") {
    await pushTripToFirestore(active);
    subscribeToActiveSharedTrip();
  }
  renderShareAndCollabModal();
  renderAll();
  showToast("Tilgang oppdatert", `Reisen er nå satt til ${active.visibility === 'shared' ? 'Delt' : 'Privat'}.`, "shield-check");
}

export async function copyShareCodeOnly() {
  const active = getActiveTripObject();
  if (!active) return;
  const code = active.shareCode || generateShareCode(active.id);
  await copyToClipboardFallback(code);
  showToast("Reisekode kopiert!", `Koden ${code} kan limes inn under «Bli med (Kode)».`, "check");
}

export function handleAddTripMember(e) {
  if (e && e.preventDefault) e.preventDefault();
  const active = getActiveTripObject();
  if (!active) return;

  const nameInput = document.getElementById("new-member-name");
  const roleSelect = document.getElementById("new-member-role");
  if (!nameInput || !nameInput.value.trim()) return;

  const name = nameInput.value.trim();
  const role = roleSelect ? roleSelect.value : "editor";
  const palette = ["#f97316", "#2563eb", "#7c3aed", "#e11d48", "#059669", "#0d9488"];
  const color = palette[(active.members ? active.members.length : 1) % palette.length];

  if (!Array.isArray(active.members)) active.members = [];
  active.members.push({
    id: "mem_" + Date.now(),
    name,
    role,
    avatarColor: color,
    joinedAt: new Date().toISOString()
  });

  nameInput.value = "";
  persistState(`La til ${name} i reisefølget`);
  renderShareAndCollabModal();
  renderAll();
  showToast("Lagt til i reisefølget!", `${name} er nå med på reisen.`, "users");
}

export function toggleTripMemberRole(idx) {
  const active = getActiveTripObject();
  if (!active || !Array.isArray(active.members) || !active.members[idx]) return;
  const member = active.members[idx];
  member.role = member.role === "viewer" ? "editor" : "viewer";
  persistState(`Endret tilgang for ${member.name}`);
  renderShareAndCollabModal();
  renderAll();
}

export function removeTripMember(idx) {
  const active = getActiveTripObject();
  if (!active || !Array.isArray(active.members) || !active.members[idx]) return;
  const removed = active.members.splice(idx, 1)[0];
  persistState(`Fjernet ${removed.name} fra reisefølget`);
  renderShareAndCollabModal();
  renderAll();
}

// =============================================================================
// USER PROFILE MODAL HANDLERS
// =============================================================================
export function openUserProfileModal() {
  renderUserProfileModal();
  openModal("modal-user-profile");
}

export function selectProfileColor(color) {
  const colorInput = document.getElementById("profile-avatar-color");
  const preview = document.getElementById("profile-modal-avatar-preview");
  if (colorInput) colorInput.value = color;
  if (preview) preview.style.backgroundColor = color;
  document.querySelectorAll("[data-profile-color]").forEach(btn => {
    if (btn.getAttribute("data-profile-color") === color) {
      btn.classList.add("ring-2", "ring-offset-2", "ring-slate-800");
    } else {
      btn.classList.remove("ring-2", "ring-offset-2", "ring-slate-800", "ring-slate-300");
    }
  });
}

export function renderUserProfileModal() {
  const nameInput = document.getElementById("profile-display-name");
  const userInput = document.getElementById("profile-username");
  const stationInput = document.getElementById("profile-home-station");
  const passSelect = document.getElementById("profile-pass-type");
  const colorInput = document.getElementById("profile-avatar-color");
  const bioInput = document.getElementById("profile-bio");
  const preview = document.getElementById("profile-modal-avatar-preview");
  const statusBadge = document.getElementById("profile-cloud-status-badge");
  const authActions = document.getElementById("profile-auth-actions");

  const activeColor = userProfile.avatarColor || "#0d9488";
  if (nameInput) nameInput.value = userProfile.displayName || "Reisende";
  if (userInput) userInput.value = userProfile.username || "@reisende";
  if (stationInput) stationInput.value = userProfile.homeStation || "Oslo S";
  if (passSelect && userProfile.defaultPassType) passSelect.value = userProfile.defaultPassType;
  if (colorInput) colorInput.value = activeColor;
  if (bioInput) bioInput.value = userProfile.bio || "";
  selectProfileColor(activeColor);

  if (preview) {
    preview.textContent = getInitials(userProfile.displayName || "Reisende");
    preview.style.backgroundColor = userProfile.avatarColor || "#0d9488";
  }

  if (statusBadge) {
    if (currentUser) {
      statusBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800";
      statusBadge.textContent = "☁️ Sky-konto aktiv";
    } else {
      statusBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600";
      statusBadge.textContent = "Lokal profil";
    }
  }

  // Compute personal statistics across all trips
  const mineCount = allTrips.filter(t => isTripOwnedByCurrentUser(t)).length;
  const sharedCount = allTrips.filter(t => t.visibility === "shared" || (Array.isArray(t.members) && t.members.length > 1)).length;
  const allCountries = new Set();
  let totalTrainLegs = 0;
  allTrips.forEach(t => {
    (t.stops || []).forEach(s => { if (s.country) allCountries.add(s.country.trim()); });
    totalTrainLegs += (t.trains || []).length;
  });

  const statTrips = document.getElementById("profile-stat-trips");
  const statShared = document.getElementById("profile-stat-shared");
  const statCountries = document.getElementById("profile-stat-countries");
  const statTrains = document.getElementById("profile-stat-trains");

  if (statTrips) statTrips.textContent = mineCount;
  if (statShared) statShared.textContent = sharedCount;
  if (statCountries) statCountries.textContent = allCountries.size;
  if (statTrains) statTrains.textContent = totalTrainLegs;

  if (authActions) {
    if (currentUser) {
      authActions.innerHTML = `
        <button type="button" onclick="closeModal('modal-user-profile'); handleLogout()" class="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition flex items-center gap-1.5">
          <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
          <span>Logg ut av skykonto</span>
        </button>
      `;
    } else {
      authActions.innerHTML = `
        <button type="button" onclick="closeModal('modal-user-profile'); openAuthModal()" class="px-3 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-800 font-bold text-xs border border-brand-200 transition flex items-center gap-1.5">
          <i data-lucide="cloud" class="w-3.5 h-3.5 text-brand-600"></i>
          <span>Koble til Google / Skykonto</span>
        </button>
      `;
    }
  }

  if (window.lucide) lucide.createIcons();
}

export async function handleSaveUserProfile(e) {
  if (e && e.preventDefault) e.preventDefault();

  const nameInput = document.getElementById("profile-display-name");
  const userInput = document.getElementById("profile-username");
  const stationInput = document.getElementById("profile-home-station");
  const passSelect = document.getElementById("profile-pass-type");
  const colorInput = document.getElementById("profile-avatar-color");
  const bioInput = document.getElementById("profile-bio");

  const newName = (nameInput && nameInput.value.trim()) || "Reisende";
  let newHandle = (userInput && userInput.value.trim()) || ("@" + newName.toLowerCase().replace(/[^a-z0-9_]/g, ""));
  if (!newHandle.startsWith("@")) newHandle = "@" + newHandle;

  userProfile.displayName = newName;
  userProfile.username = newHandle;
  userProfile.homeStation = (stationInput && stationInput.value.trim()) || "Oslo S";
  userProfile.defaultPassType = passSelect ? passSelect.value : userProfile.defaultPassType;
  userProfile.avatarColor = (colorInput && colorInput.value) || "#0d9488";
  userProfile.bio = (bioInput && bioInput.value.trim()) || "";

  // Update owner/member entry on user's owned trips so their new name & avatar color show everywhere
  allTrips.forEach(t => {
    ensureTripCollaborationFields(t);
    if (isTripOwnedByCurrentUser(t)) {
      t.owner.name = userProfile.displayName;
      t.owner.avatarColor = userProfile.avatarColor;
      if (t.members && t.members[0]) {
        t.members[0].name = userProfile.displayName;
        t.members[0].avatarColor = userProfile.avatarColor;
      }
    }
  });

  try {
    localStorage.setItem("railsync_user_profile_v1", JSON.stringify(userProfile));
  } catch (err) {}

  if (currentUser && isFirebaseConfigured() && db) {
    try {
      await updateProfile(currentUser, { displayName: userProfile.displayName });
      await setDoc(doc(db, "users", currentUser.uid), {
        ...userProfile,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn("Kunne ikke oppdatere profil i Firestore:", err);
    }
  }

  saveAllTripsToLocalStorage();
  updateAuthUI(currentUser);
  renderAll();
  closeModal("modal-user-profile");
  showToast("Profil lagret!", `Oppdatert profil for ${userProfile.displayName}.`, "user-check");
}

export function switchActiveTrip(tripId) {
  if (tripId === activeTripId) return;
  syncStateToActiveTrip();
  activeTripId = tripId;
  syncActiveTripToState();
  syncUrlWithActiveTrip();
  persistState();
  subscribeToActiveSharedTrip();
  renderAll();
  updateMapLayers();
  renderTripManagerList();
  showToast("Endret reise", `Byttet til "${appState.trip.title}"`);
}

export function duplicateActiveTripAndCloseModal() {
  closeModal('modal-share-trip');
  closeModal('modal-trip-settings');
  closeModal('modal-trip-manager');
  duplicateActiveTrip();
}

export function duplicateCurrentTripFromSettings() {
  closeModal('modal-trip-settings');
  duplicateActiveTrip();
}

export function duplicateActiveTrip() {
  duplicateTrip(activeTripId);
}

export function duplicateTrip(tripId) {
  syncStateToActiveTrip();
  const targetId = tripId || activeTripId;
  const sourceIndex = allTrips.findIndex(t => t.id === targetId);
  const source = sourceIndex !== -1 ? allTrips[sourceIndex] : (allTrips[0] || null);
  if (!source) return;

  const newId = "trip_" + Date.now();
  const baseTitle = source.title ? source.title.replace(/\s*\(Kopi(?:\s*\d+)?\)$/i, "") : "Reise";
  
  // Count how many trips have this base title to number smoothly
  const existingCopies = allTrips.filter(t => t.title && t.title.startsWith(baseTitle)).length;
  const newTitle = existingCopies > 1 ? `${baseTitle} (Kopi ${existingCopies})` : `${baseTitle} (Kopi)`;

  const newTrip = JSON.parse(JSON.stringify(source));
  newTrip.id = newId;
  newTrip.title = newTitle;
  newTrip.visibility = "private";
  newTrip.sharePermission = "edit";
  newTrip.shareCode = generateShareCode(newId);
  newTrip.owner = {
    uid: currentUser ? currentUser.uid : userProfile.uid,
    name: userProfile.displayName || "Reisende",
    avatarColor: userProfile.avatarColor || "#0d9488"
  };
  newTrip.members = [
    {
      id: newTrip.owner.uid,
      name: newTrip.owner.name,
      role: "owner",
      avatarColor: newTrip.owner.avatarColor
    }
  ];
  newTrip.activityLog = [
    {
      text: `Opprettet privat kopi fra «${source.title}»`,
      by: newTrip.owner.name,
      time: new Date().toISOString()
    }
  ];
  if (!newTrip.trip) newTrip.trip = {};
  newTrip.trip.title = newTitle;

  // Insert right adjacent to the source trip so the user immediately sees it
  if (sourceIndex !== -1) {
    allTrips.splice(sourceIndex + 1, 0, newTrip);
  } else {
    allTrips.unshift(newTrip);
  }

  activeTripId = newId;
  syncActiveTripToState();
  syncUrlWithActiveTrip();
  persistState();
  subscribeToActiveSharedTrip();
  renderAll();
  updateMapLayers();
  renderTripManagerList();

  // Close modals so the main screen switches directly to the copy
  closeModal('modal-trip-manager');
  closeModal('modal-share-trip');
  closeModal('modal-trip-settings');

  showToast("Reise kopiert!", `Opprettet "${newTitle}" under Mine reiser.`, "check");
}

export function createNewTrip() {
  syncStateToActiveTrip();
  const newId = "trip_" + Date.now();
  const proposalNumber = allTrips.length + 1;
  const newTitle = `Forslag ${proposalNumber} for Europaturné`;
  const passMatch = (userProfile.defaultPassType || "").match(/(\d+)\s*dager/i);
  const passDays = passMatch ? parseInt(passMatch[1], 10) : 7;
  const homeStation = userProfile.homeStation || "Oslo S";
  const matchedHub = EUROPEAN_RAIL_STATIONS.find(
    st => st.name.toLowerCase() === homeStation.toLowerCase() || st.city.toLowerCase() === homeStation.toLowerCase()
  );
  const homeCity = matchedHub ? matchedHub.city : (homeStation.replace(/\s+(S|H|Hbf|stasjon|Centralstation)$/i, "").trim() || "Oslo");
  const homeCountry = matchedHub ? matchedHub.country : "Norge";
  const homeLat = matchedHub ? matchedHub.lat : 59.9139;
  const homeLng = matchedHub ? matchedHub.lng : 10.7522;

  const newTrip = ensureTripCollaborationFields({
    id: newId,
    title: newTitle,
    visibility: "private",
    sharePermission: "edit",
    shareCode: generateShareCode(newId),
    createdAt: new Date().toISOString(),
    trip: {
      title: newTitle,
      startDate: "2026-07-01",
      endDate: "2026-07-15",
      totalPassDays: passDays,
      totalBudget: 20000,
      currency: "NOK",
    },
    stops: [
      {
        id: "stop-new-1",
        city: homeCity,
        country: homeCountry,
        arrival: "2026-07-01",
        departure: "2026-07-02",
        accommodationStatus: "Hjemme / Start",
        accommodationNote: `Startreise fra ${homeStation}`,
        lat: homeLat,
        lng: homeLng,
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
        fromCity: homeStation,
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
      {
        id: "exp-new-1",
        title: `Interrail Global Pass ${passDays} dager`,
        category: "Transport",
        amount: 3900,
        date: "2026-06-01",
        paidBy: userProfile.displayName || "Meg"
      }
    ],
    packingList: JSON.parse(JSON.stringify(defaultTripState.packingList))
  });

  allTrips.push(newTrip);
  activeTripId = newId;
  syncActiveTripToState();
  syncUrlWithActiveTrip();
  persistState();
  subscribeToActiveSharedTrip();
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
  syncUrlWithActiveTrip();
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
  if (!requireEditPermission()) return;
  document.getElementById("stop-edit-id").value = "";
  document.getElementById("modal-stop-title").textContent = "Legg til stoppested";
  document.getElementById("modal-stop-btn-text").textContent = "Lagre stoppested";
  document.getElementById("form-add-stop").reset();
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
  document.getElementById("stop-accom-status").value = stop.accommodationStatus;
  document.getElementById("stop-accom-note").value = stop.accommodationNote || "";

  document.getElementById("stop-preset-select").value = "";
  document.getElementById("stop-search-input").value = "";
  document.getElementById("search-results-dropdown").classList.add("hidden");

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
  if (!requireEditPermission()) return;
  appState.trip.title = document.getElementById("settings-title").value.trim() || "Sommerens Europaturné";
  appState.trip.startDate = document.getElementById("settings-start-date").value;
  appState.trip.endDate = document.getElementById("settings-end-date").value;
  appState.trip.totalPassDays = parseInt(document.getElementById("settings-pass-days").value, 10) || 7;
  appState.trip.totalBudget = parseFloat(document.getElementById("settings-total-budget").value) || 20000;

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

export function openEditPersonalBudgetPrompt() {
  const input = document.getElementById("personal-budget-input");
  if (input) {
    input.value = appState.trip.totalBudget || 20000;
  }
  openModal("modal-edit-budget");
}

export function handleSavePersonalBudget(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById("personal-budget-input");
  const newVal = input ? parseFloat(input.value) : 20000;
  appState.trip.totalBudget = !isNaN(newVal) && newVal >= 0 ? newVal : 20000;
  savePersonalBudgetStateOnly();
  renderAll();
  closeModal("modal-edit-budget");
  showToast("Mitt budsjett oppdatert", `Personlig totalbudsjett satt til ${formatNumber(appState.trip.totalBudget)} kr.`, "wallet");
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
  savePersonalBudgetStateOnly();
  renderAll();
  closeModal('modal-add-expense');
  document.getElementById("form-add-expense").reset();
  showToast("Utgift lagret", `Lagt til i ditt personlige budsjett (${formatNumber(amount)} kr).`, "wallet");
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
    const anyStillOpen = Array.from(document.querySelectorAll("[id^='modal-']")).some(
      m => !m.classList.contains("hidden")
    );
    if (!anyStillOpen) {
      document.body.style.overflow = "auto";
    }
  }
}

export function openAddTrainModal() {
  if (!requireEditPermission()) return;
  const dateEl = document.getElementById("train-date");
  if (dateEl && appState.trip && appState.trip.startDate) {
    dateEl.value = appState.trip.startDate;
  }
  openModal('modal-add-train');
}

export function openAddExpenseModal() {
  const dateEl = document.getElementById("expense-date");
  if (dateEl && appState.trip && appState.trip.startDate) {
    dateEl.value = appState.trip.startDate;
  }
  openModal('modal-add-expense');
}

export function openAddPackingItemModal() {
  if (!requireEditPermission()) return;
  openModal('modal-add-packing');
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll("[id^='modal-']").forEach(m => closeModal(m.id));
  }
});

// Close modal when clicking directly on the dark backdrop overlay
document.addEventListener("click", (e) => {
  const target = e.target;
  if (target && target.id && target.id.startsWith("modal-") && target.classList.contains("fixed")) {
    closeModal(target.id);
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
        onclick="selectLiveStation('${field}', ${idx})" 
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
      onclick="quickSearchRouteChip('${escapeHtml(c.fromName)}', ${c.fromLat}, ${c.fromLng}, '${escapeHtml(c.toName)}', ${c.toLat}, ${c.toLng}, '${escapeHtml(c.date)}')"
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
                <span class="px-2 py-0.5 rounded-lg bg-slate-900 text-white text-xs font-extrabold">${escapeHtml(j.trainNumber)}</span>
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
                  onclick="previewLiveRouteOnMap(${idx})" 
                  class="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <i data-lucide="map" class="w-3.5 h-3.5 text-brand-600 shrink-0"></i>
                  <span>Se på kart</span>
                </button>
                <button 
                  type="button" 
                  onclick="importLiveJourneyToTrip(${idx})" 
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
    routeGeometry: j.routeGeometry || []
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
      const mapEl = document.getElementById("rail-map");
      if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
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
      train.routeGeometry = downsampleCoords(combined, 120);
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
window.openEditPersonalBudgetPrompt = openEditPersonalBudgetPrompt;
window.handleSavePersonalBudget = handleSavePersonalBudget;
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
window.switchTripManagerTab = switchTripManagerTab;
window.syncAllUserTripsWithCloud = syncAllUserTripsWithCloud;
window.handleJoinSharedTripByCode = handleJoinSharedTripByCode;
window.handleUpdateTripSharingSettings = handleUpdateTripSharingSettings;
window.copyShareCodeOnly = copyShareCodeOnly;
window.handleAddTripMember = handleAddTripMember;
window.toggleTripMemberRole = toggleTripMemberRole;
window.removeTripMember = removeTripMember;
window.openUserProfileModal = openUserProfileModal;
window.selectProfileColor = selectProfileColor;
window.handleSaveUserProfile = handleSaveUserProfile;
window.switchActiveTrip = switchActiveTrip;
window.duplicateActiveTrip = duplicateActiveTrip;
window.duplicateTrip = duplicateTrip;
window.duplicateActiveTripAndCloseModal = duplicateActiveTripAndCloseModal;
window.duplicateCurrentTripFromSettings = duplicateCurrentTripFromSettings;
window.copyShareTripUrl = copyShareTripUrl;
window.triggerNativeShare = triggerNativeShare;
window.copyToClipboardFallback = copyToClipboardFallback;
window.createNewTrip = createNewTrip;
window.deleteTrip = deleteTrip;
window.renameTripInManager = renameTripInManager;
window.openAuthModal = openAuthModal;
window.handleGoogleSignIn = handleGoogleSignIn;
window.handleEmailAuth = handleEmailAuth;
window.handleUsernameAuth = handleUsernameAuth;
window.handleLogout = handleLogout;
window.selectLiveStation = selectLiveStation;
window.swapLiveSearchStations = swapLiveSearchStations;
window.focusLiveTrainSearch = focusLiveTrainSearch;
window.renderLiveRouteChips = renderLiveRouteChips;
window.quickSearchRouteChip = quickSearchRouteChip;
window.quickSearchBetweenStops = quickSearchBetweenStops;
window.executeLiveTrainSearch = executeLiveTrainSearch;
window.importLiveJourneyToTrip = importLiveJourneyToTrip;
window.previewLiveRouteOnMap = previewLiveRouteOnMap;
window.focusTrainTrackOnMap = focusTrainTrackOnMap;
window.fetchRealTrackForSingleTrain = fetchRealTrackForSingleTrain;
window.fetchRealTracksForAllTrains = fetchRealTracksForAllTrains;

// =============================================================================
// 10. INITIALIZATION
// =============================================================================
async function initializeApplet() {
  await loadAppState();
  initMap();
  renderAll();
  setupNominatimSearch();
  setupLiveTrainSearch();
  if (window.lucide) {
    lucide.createIcons();
  }
  // Automatically enrich any trains missing real track geometry in the background
  setTimeout(() => {
    fetchRealTracksForAllTrains(true);
  }, 800);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApplet);
} else {
  initializeApplet();
}
