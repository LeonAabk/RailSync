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
  getDocs,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  deleteField,
  limit,
  runTransaction
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
let userProfileUnsubscribe = null;

export const EUROPEAN_INTERRAIL_COUNTRIES = [
  { name: "Norge", flag: "🇳🇴" },
  { name: "Sverige", flag: "🇸🇪" },
  { name: "Danmark", flag: "🇩🇰" },
  { name: "Finland", flag: "🇫🇮" },
  { name: "Tyskland", flag: "🇩🇪" },
  { name: "Nederland", flag: "🇳🇱" },
  { name: "Belgia", flag: "🇧🇪" },
  { name: "Luxembourg", flag: "🇱🇺" },
  { name: "Frankrike", flag: "🇫🇷" },
  { name: "Sveits", flag: "🇨🇭" },
  { name: "Østerrike", flag: "🇦🇹" },
  { name: "Italia", flag: "🇮🇹" },
  { name: "Spania", flag: "🇪🇸" },
  { name: "Portugal", flag: "🇵🇹" },
  { name: "Storbritannia", flag: "🇬🇧" },
  { name: "Irland", flag: "🇮🇪" },
  { name: "Tsjekkia", flag: "🇨🇿" },
  { name: "Polen", flag: "🇵🇱" },
  { name: "Ungarn", flag: "🇭🇺" },
  { name: "Slovakia", flag: "🇸🇰" },
  { name: "Slovenia", flag: "🇸🇮" },
  { name: "Kroatia", flag: "🇭🇷" },
  { name: "Hellas", flag: "🇬🇷" },
  { name: "Romania", flag: "🇷🇴" },
  { name: "Bulgaria", flag: "🇧🇬" },
  { name: "Serbia", flag: "🇷🇸" },
  { name: "Montenegro", flag: "🇲🇪" },
  { name: "Bosnia-Hercegovina", flag: "🇧🇦" },
  { name: "Nord-Makedonia", flag: "🇲🇰" },
  { name: "Litauen", flag: "🇱🇹" },
  { name: "Latvia", flag: "🇱🇻" },
  { name: "Estland", flag: "🇪🇪" },
  { name: "Tyrkia", flag: "🇹🇷" }
];

export function getCountryFlag(countryName) {
  if (!countryName) return "";
  const clean = String(countryName).trim().toLowerCase();
  const found = EUROPEAN_INTERRAIL_COUNTRIES.find(c => c.name.toLowerCase() === clean || clean.includes(c.name.toLowerCase()));
  if (found) return found.flag;
  return "";
}

export function cleanTagLabel(tag) {
  if (!tag) return "Prioritert reisemål";
  return String(tag)
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\s]+/gu, "")
    .trim() || "Prioritert reisemål";
}

export function getPlaceThumbnailUrl(city = "", country = "") {
  const key = `${city} ${country}`.toLowerCase();
  if (key.includes("roma") || key.includes("rome") || key.includes("colosseum")) {
    return "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("firenze") || key.includes("florence") || key.includes("toscana")) {
    return "https://images.unsplash.com/photo-1543429257-3eb0b65d9c58?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("venezia") || key.includes("venice")) {
    return "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("amalfi") || key.includes("cinque") || key.includes("napoli") || key.includes("italia")) {
    return "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("zermatt") || key.includes("bernina") || key.includes("glacier") || key.includes("interlaken") || key.includes("luzern") || key.includes("sveits")) {
    return "https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("innsbruck") || key.includes("salzburg") || key.includes("wien") || key.includes("østerrike") || key.includes("dolomitt") || key.includes("chamonix")) {
    return "https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("bled") || key.includes("ljubljana") || key.includes("slovenia")) {
    return "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("københavn") || key.includes("danmark")) {
    return "https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("berlin") || key.includes("hamburg") || key.includes("münchen") || key.includes("tyskland")) {
    return "https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("paris") || key.includes("nice") || key.includes("lyon") || key.includes("frankrike")) {
    return "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("amsterdam") || key.includes("nederland")) {
    return "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("barcelona") || key.includes("madrid") || key.includes("spania")) {
    return "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("porto") || key.includes("lisboa") || key.includes("portugal")) {
    return "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("praha") || key.includes("tsjekkia")) {
    return "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("budapest") || key.includes("ungarn")) {
    return "https://images.unsplash.com/photo-1549877452-9c387954fbc2?auto=format&fit=crop&w=300&q=80";
  }
  if (key.includes("split") || key.includes("kroatia") || key.includes("athen") || key.includes("hellas")) {
    return "https://images.unsplash.com/photo-1555990538-1e6c0c12db88?auto=format&fit=crop&w=300&q=80";
  }
  return "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=300&q=80";
}

export const DEFAULT_COMMUNITY_TRAVELERS = [
  {
    uid: "traveler_sander",
    displayName: "Sander Lindqvist",
    username: "@sander_rail",
    avatarColor: "#2563eb",
    homeStation: "Oslo S",
    defaultPassType: "Global Pass 10 dager (Ungdom)",
    bio: "Alperuter, nattog gjennom Sentral-Europa og kystbyer langs Middelhavet.",
    visitedCountries: ["Norge", "Sverige", "Danmark", "Tyskland", "Østerrike", "Tsjekkia", "Italia"],
    visitedPlaces: [
      { id: "svp1", city: "Innsbruck", country: "Østerrike", note: "2025 – Spektakulær utsikt rett fra togstasjonen" },
      { id: "svp2", city: "Praha", country: "Tsjekkia", note: "2024 – Rimelig mat og historisk gamleby" },
      { id: "svp3", city: "Firenze", country: "Italia", note: "2025 – Kunst og solnedgang fra Piazzale Michelangelo" }
    ],
    wishlistPlaces: [
      { id: "swl1", city: "Zermatt & Glacier Express", country: "Sveits", tag: "Klassisk togrute" },
      { id: "swl2", city: "Bled-sjøen", country: "Slovenia", tag: "Alper & Natur" },
      { id: "swl3", city: "Amalfikysten", country: "Italia", tag: "Prioritert reisemål" }
    ],
    isCommunityProfile: true
  },
  {
    uid: "traveler_nora",
    displayName: "Nora Berg",
    username: "@nora.europa",
    avatarColor: "#7c3aed",
    homeStation: "Bergen stasjon",
    defaultPassType: "Global Pass 7 dager (Ungdom)",
    bio: "Arkitektur, foto og hurtigtog. Planlegger sommerens rundreise til Sør-Europa.",
    visitedCountries: ["Norge", "Danmark", "Nederland", "Belgia", "Frankrike", "Spania"],
    visitedPlaces: [
      { id: "nvp1", city: "Amsterdam", country: "Nederland", note: "2024 – Kanaler og sykkelturer" },
      { id: "nvp2", city: "Paris", country: "Frankrike", note: "2025 – Eurostar fra Brussel på 1t 22m" },
      { id: "nvp3", city: "Barcelona", country: "Spania", note: "2025 – Tapas og kystlinje" }
    ],
    wishlistPlaces: [
      { id: "nwl1", city: "Cinque Terre & Roma", country: "Italia", tag: "Prioritert reisemål" },
      { id: "nwl2", city: "Porto & Lisboa", country: "Portugal", tag: "Kyst & Middelhav" },
      { id: "nwl3", city: "Interlaken", country: "Sveits", tag: "Alper & Natur" }
    ],
    isCommunityProfile: true
  },
  {
    uid: "traveler_emil",
    displayName: "Emil Solberg",
    username: "@emil_tog",
    avatarColor: "#f97316",
    homeStation: "Trondheim S",
    defaultPassType: "Global Pass 15 dager (Ungdom)",
    bio: "Togentusiast fra Trondheim. Mål om å utforske alle 33 Interrail-land innen 2027.",
    visitedCountries: ["Norge", "Sverige", "Tyskland", "Polen", "Ungarn", "Kroatia", "Slovenia"],
    visitedPlaces: [
      { id: "evp1", city: "Budapest", country: "Ungarn", note: "2025 – Termiske bad og Donau" },
      { id: "evp2", city: "Split", country: "Kroatia", note: "2024 – Adriaterhavskysten" },
      { id: "evp3", city: "Ljubljana", country: "Slovenia", note: "2024 – Europas grønneste hovedstad" }
    ],
    wishlistPlaces: [
      { id: "ewl1", city: "Bernina Express til Tirano", country: "Sveits", tag: "Klassisk togrute" },
      { id: "ewl2", city: "Athen & Meteora", country: "Hellas", tag: "Prioritert reisemål" },
      { id: "ewl3", city: "Roma & Napoli", country: "Italia", tag: "Kultur & Storby" }
    ],
    isCommunityProfile: true
  },
  {
    uid: "traveler_sofie",
    displayName: "Sofie Holm",
    username: "@sofie_vagabond",
    avatarColor: "#e11d48",
    homeStation: "Stavanger stasjon",
    defaultPassType: "Global Pass 7 dager (Ungdom)",
    bio: "Reiser lett med kun håndbagasje. Alltid klar for spontane togturer til nye byer.",
    visitedCountries: ["Norge", "Danmark", "Tyskland", "Sveits", "Italia"],
    visitedPlaces: [
      { id: "sfvp1", city: "Luzern", country: "Sveits", note: "2025 – Krystallklart vann og fjelltopper" },
      { id: "sfvp2", city: "Venezia", country: "Italia", note: "2025 – Ankomst Santa Lucia over lagunen" }
    ],
    wishlistPlaces: [
      { id: "sfwl1", city: "Wien & Salzburg", country: "Østerrike", tag: "Kultur & Storby" },
      { id: "sfwl2", city: "Nice & Côte d'Azur", country: "Frankrike", tag: "Kyst & Middelhav" },
      { id: "sfwl3", city: "Bled-sjøen", country: "Slovenia", tag: "Alper & Natur" }
    ],
    isCommunityProfile: true
  },
  {
    uid: "traveler_kasper",
    displayName: "Kasper Nygård",
    username: "@kasper_alper",
    avatarColor: "#059669",
    homeStation: "Oslo S",
    defaultPassType: "Global Pass 10 dager (Ungdom)",
    bio: "Toppturer, alpepass og panoramatog i Sveits og Østerrike.",
    visitedCountries: ["Norge", "Sverige", "Tyskland", "Sveits", "Østerrike"],
    visitedPlaces: [
      { id: "kvp1", city: "Zermatt", country: "Sveits", note: "2025 – Matterhorn i soloppgang" },
      { id: "kvp2", city: "Salzburg", country: "Østerrike", note: "2024 – Stopp mellom München og Wien" }
    ],
    wishlistPlaces: [
      { id: "kwl1", city: "Dolomittene & Bolzano", country: "Italia", tag: "Alper & Natur" },
      { id: "kwl2", city: "Chamonix", country: "Frankrike", tag: "Prioritert reisemål" }
    ],
    isCommunityProfile: true
  }
];

// Rich User Profile (persisted in localStorage, private part in Firestore users/{uid},
// public part in Firestore publicProfiles/{uid})
export let userProfile = {
  uid: "local_user",
  displayName: "Reisende",
  username: "@reisende",
  avatarColor: "#0d9488",
  homeStation: "Oslo S",
  defaultPassType: "Global Pass 7 dager (Ungdom)",
  bio: "Klar for Interrail gjennom Europa!",
  visitedCountries: [],
  visitedPlaces: [],
  wishlistPlaces: [],
  friends: [],
  incomingFriendRequests: [],
  outgoingFriendRequests: []
};

export function ensureSocialProfileFields(prof) {
  if (!prof || typeof prof !== "object") return prof;
  if (!Array.isArray(prof.visitedCountries)) prof.visitedCountries = [];
  if (!Array.isArray(prof.visitedPlaces)) prof.visitedPlaces = [];
  if (!Array.isArray(prof.wishlistPlaces)) {
    prof.wishlistPlaces = [];
  } else {
    prof.wishlistPlaces.forEach(w => {
      if (w && w.tag) w.tag = cleanTagLabel(w.tag);
    });
  }
  if (!Array.isArray(prof.friends)) prof.friends = [];
  if (!Array.isArray(prof.incomingFriendRequests)) prof.incomingFriendRequests = [];
  if (!Array.isArray(prof.outgoingFriendRequests)) prof.outgoingFriendRequests = [];
  // Eksempelprofiler (traveler_*) er ikke ekte brukere og skal ikke ligge som venner/forespørsler
  if (prof === userProfile) {
    prof.friends = prof.friends.filter(f => f && f.uid && !isExampleTravelerUid(f.uid));
    prof.incomingFriendRequests = prof.incomingFriendRequests.filter(r => r && r.uid && !isExampleTravelerUid(r.uid));
  }
  delete prof.sharedTripIds;
  return prof;
}

export function isExampleTravelerUid(uid) {
  return typeof uid === "string" && uid.startsWith("traveler_");
}

function getInitials(name) {
  if (!name) return "R";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return String(name).trim().substring(0, 2).toUpperCase();
}

function buildPublicProfilePayload(uid) {
  const str = (v, max) => String(v == null ? "" : v).slice(0, max);
  const place = (p, extraKey) => {
    const out = { id: str(p && p.id, 60), city: str(p && p.city, 80), country: str(p && p.country, 60) };
    out[extraKey] = str(p && p[extraKey], 160);
    return out;
  };
  const displayName = str(userProfile.displayName || "Reisende", 60);
  const username = str(userProfile.username || "@reisende", 30);
  return {
    uid,
    displayName,
    username,
    avatarColor: safeColor(userProfile.avatarColor, "#0d9488"),
    photo: safePhoto(userProfile.photo),
    homeStation: str(userProfile.homeStation, 80),
    bio: str(userProfile.bio, 300),
    visitedCountries: (userProfile.visitedCountries || []).slice(0, 60).map(c => str(c, 60)),
    visitedPlaces: (userProfile.visitedPlaces || []).slice(0, 100).map(p => place(p, "note")),
    wishlistPlaces: (userProfile.wishlistPlaces || []).slice(0, 100).map(p => place(p, "tag")),
    searchNameLower: displayName.toLowerCase(),
    searchUsernameLower: username.toLowerCase(),
    updatedAt: new Date().toISOString()
  };
}

function myPublicSnippet() {
  return {
    displayName: String(userProfile.displayName || "Reisende").slice(0, 60),
    username: String(userProfile.username || "@reisende").slice(0, 30),
    avatarColor: safeColor(userProfile.avatarColor, "#0d9488"),
    photo: safePhoto(userProfile.photo),
    homeStation: String(userProfile.homeStation || "").slice(0, 80)
  };
}

export async function saveUserProfileEverywhere() {
  ensureSocialProfileFields(userProfile);
  try {
    localStorage.setItem("railsync_user_profile_v1", JSON.stringify(userProfile));
  } catch (e) {}

  if (!isCloudReady()) return false;
  const uid = currentUser.uid;
  try {
    // Privat dokument: kun eieren kan lese/skrive (venneliste, passtype osv.)
    const { incomingFriendRequests, outgoingFriendRequests, ...privateProfile } = userProfile;
    await setDoc(doc(db, "users", uid), {
      ...privateProfile,
      uid,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn("Kunne ikke lagre privat profil til Firestore:", e);
  }
  try {
    // Offentlig profil: det andre innloggede reisende kan se og søke på
    await setDoc(doc(db, "publicProfiles", uid), buildPublicProfilePayload(uid));
    return true;
  } catch (e) {
    console.warn("Kunne ikke lagre offentlig profil til Firestore:", e);
    return false;
  }
}

export function loadLocalUserProfile() {
  try {
    const raw = localStorage.getItem("railsync_user_profile_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      userProfile = ensureSocialProfileFields({ ...userProfile, ...parsed });
    } else {
      userProfile.uid = "local_" + Math.random().toString(36).substring(2, 10);
      ensureSocialProfileFields(userProfile);
      localStorage.setItem("railsync_user_profile_v1", JSON.stringify(userProfile));
    }
  } catch (e) {
    console.warn("Kunne ikke lese lokal brukerprofil:", e);
  }
  updateAuthUI(currentUser);
}

// ---------------------------------------------------------------------------
// Unike brukernavn: usernames/{brukernavn} → { uid }
// ---------------------------------------------------------------------------
export function normalizeHandle(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[æ]/g, "ae").replace(/[ø]/g, "o").replace(/[å]/g, "a")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 29);
}

async function claimUsername(handle) {
  if (!handle || !isCloudReady()) return "error";
  const ref = doc(db, "usernames", handle);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data().uid === currentUser.uid ? "ok" : "taken";
    await setDoc(ref, { uid: currentUser.uid, createdAt: new Date().toISOString() });
    return "ok";
  } catch (e) {
    try {
      const again = await getDoc(ref);
      if (again.exists()) return again.data().uid === currentUser.uid ? "ok" : "taken";
    } catch (e2) {}
    console.warn("Kunne ikke reservere brukernavn:", e);
    return "error";
  }
}

async function releaseUsername(handle) {
  if (!handle || !isCloudReady()) return;
  try {
    const ref = doc(db, "usernames", handle);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().uid === currentUser.uid) await deleteDoc(ref);
  } catch (e) { /* ignorer */ }
}

// Sørger for at brukeren eier brukernavnet sitt. Er det tatt, får brukeren en ledig variant.
async function ensureOwnUsernameClaim() {
  const wanted = normalizeHandle(userProfile.username) || normalizeHandle(userProfile.displayName) || "reisende";
  for (let i = 0; i < 25; i++) {
    const candidate = i === 0 ? wanted : `${wanted.slice(0, 26)}${i + 1}`;
    const res = await claimUsername(candidate);
    if (res === "ok") {
      const before = userProfile.username;
      userProfile.username = "@" + candidate;
      if (before && normalizeHandle(before) && normalizeHandle(before) !== candidate) {
        showToast("Nytt brukernavn", `@${normalizeHandle(before)} var allerede tatt, så du har fått @${candidate}. Du kan endre det under Konto og profil.`, "at-sign");
      }
      return true;
    }
    if (res === "error") return false;
  }
  return false;
}

// Ble oppstarten mot skyen fullført? Hvis ikke (åpnet uten nett), prøves den igjen når nettet er tilbake.
let cloudBootstrapOk = false;

export async function syncUserProfileWithCloud(user) {
  stopCloudListeners();
  cloudBootstrapOk = false;
  let profileSynced = false;
  if (!user) {
    updateAuthUI(null);
    renderSocialHub();
    return;
  }

  const fallbackName = user.displayName || (user.email ? user.email.split("@")[0] : "Reisende");
  const fallbackHandle = "@" + (normalizeHandle(fallbackName) || "reisende");

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
        const { personalBudgets, ...cloudProfile } = cloudProf;
        userProfile = ensureSocialProfileFields({
          ...userProfile,
          ...cloudProfile,
          uid: user.uid
        });
      } else {
        ensureSocialProfileFields(userProfile);
      }
      await ensureOwnUsernameClaim();
      await saveUserProfileEverywhere();
      savePersonalBudgetsToStorage();
      await loadOwnCoverFromCloud(user.uid);
      profileSynced = true;
    } catch (e) {
      console.warn("Kunne ikke synkronisere brukerprofil med Firestore:", e);
    }
    // Lytterne startes også uten nett – de kobler seg på når nettet er tilbake
    startFriendRequestListeners(user.uid);
    startTripListeners(user.uid);
  }

  try {
    localStorage.setItem("railsync_user_profile_v1", JSON.stringify(userProfile));
  } catch (e) {}

  updateAuthUI(user);
  const tripsSynced = await syncAllUserTripsWithCloud(true);
  cloudBootstrapOk = profileSynced && tripsSynced === true;
  renderSocialHub();

  // Fullfør en delt lenke brukeren åpnet før innlogging
  let pendingJoin = null;
  try {
    pendingJoin = sessionStorage.getItem("railsync_pending_join");
    sessionStorage.removeItem("railsync_pending_join");
  } catch (e) {}
  if (pendingJoin) {
    await fetchAndJoinSharedTrip(pendingJoin, false);
  }
}

// ---------------------------------------------------------------------------
// Sky-lyttere (venneforespørsler og reiser delt med meg)
// ---------------------------------------------------------------------------
let friendReqInUnsub = null;
let friendReqOutUnsub = null;
let memberTripsUnsub = null;
let ownedTripsUnsub = null;

function stopCloudListeners() {
  [friendReqInUnsub, friendReqOutUnsub, memberTripsUnsub, ownedTripsUnsub].forEach(fn => {
    if (typeof fn === "function") {
      try { fn(); } catch (e) {}
    }
  });
  friendReqInUnsub = friendReqOutUnsub = memberTripsUnsub = ownedTripsUnsub = null;
}

// ---------------------------------------------------------------------------
// Venner
// Et vennskap er et dokument i friendRequests med status "accepted".
// Begge kan slette det, så det å fjerne en venn gjelder for begge.
// ---------------------------------------------------------------------------
let friendDocsIn = new Map();
let friendDocsOut = new Map();
let friendSnapsReady = { in: false, out: false };
let legacyFriendUids = null;
let friendAutoActions = new Set();
let lastFriendProfileRefresh = 0;

function startFriendRequestListeners(uid) {
  if (!isCloudReady()) return;
  friendDocsIn = new Map();
  friendDocsOut = new Map();
  friendSnapsReady = { in: false, out: false };
  friendAutoActions = new Set();
  // Venner fra før denne modellen: bekreftes automatisk når den andre også har oppgradert
  legacyFriendUids = userProfile.friendsModelV2 ? new Set() : new Set((userProfile.friends || []).map(f => f.uid));
  try {
    const qIn = query(collection(db, "friendRequests"), where("to", "==", uid));
    friendReqInUnsub = onSnapshot(qIn, (snap) => {
      friendDocsIn = new Map(snap.docs.map(d => [d.id, d.data() || {}]));
      friendSnapsReady.in = true;
      recomputeFriendState(uid);
    }, (err) => console.warn("Lytter for venneforespørsler feilet:", err));

    const qOut = query(collection(db, "friendRequests"), where("from", "==", uid));
    friendReqOutUnsub = onSnapshot(qOut, (snap) => {
      friendDocsOut = new Map(snap.docs.map(d => [d.id, d.data() || {}]));
      friendSnapsReady.out = true;
      recomputeFriendState(uid);
    }, (err) => console.warn("Lytter for sendte forespørsler feilet:", err));
  } catch (e) {
    console.warn("Kunne ikke starte vennelyttere:", e);
  }
}

function friendFromSnippet(otherUid, p, fallbackColor) {
  const known = (userProfile.friends || []).find(f => f.uid === otherUid) || {};
  p = p || {};
  return {
    uid: otherUid,
    displayName: String(known.displayName || p.displayName || "Reisende").slice(0, 60),
    username: String(known.username || p.username || "").slice(0, 30),
    avatarColor: safeColor(known.avatarColor || p.avatarColor, fallbackColor),
    photo: safePhoto(known.photo || p.photo),
    homeStation: String(known.homeStation || p.homeStation || "").slice(0, 80),
    addedAt: known.addedAt || new Date().toISOString()
  };
}

async function recomputeFriendState(uid) {
  if (!friendSnapsReady.in || !friendSnapsReady.out || !currentUser || currentUser.uid !== uid) return;

  const incoming = [];
  const outgoingPending = [];
  const accepted = new Map();

  friendDocsIn.forEach((data, id) => {
    if (data.status === "accepted") accepted.set(data.from, friendFromSnippet(data.from, data.fromProfile, "#2563eb"));
    else if (data.status === "pending") incoming.push({ ...friendFromSnippet(data.from, data.fromProfile, "#f97316"), requestId: id });
  });
  friendDocsOut.forEach((data) => {
    if (data.status === "accepted") accepted.set(data.to, friendFromSnippet(data.to, data.toProfile, "#2563eb"));
    else if (data.status === "pending") outgoingPending.push(data.to);
  });

  // Begge har sendt forespørsel til hverandre, eller dere var venner før: godta automatisk
  for (const req of incoming) {
    const mutual = outgoingPending.includes(req.uid);
    const legacy = legacyFriendUids && legacyFriendUids.has(req.uid);
    // Har begge sendt, er det bare den med lavest ID som rydder opp – ellers kan begge slette hverandres
    if (mutual && uid > req.uid) continue;
    if ((mutual || legacy) && !accepted.has(req.uid) && !friendAutoActions.has("acc_" + req.uid)) {
      friendAutoActions.add("acc_" + req.uid);
      try {
        await updateDoc(doc(db, "friendRequests", `${req.uid}_${uid}`), {
          status: "accepted", acceptedAt: new Date().toISOString(), toProfile: myPublicSnippet()
        });
        if (mutual) await deleteDoc(doc(db, "friendRequests", `${uid}_${req.uid}`)).catch(() => {});
      } catch (e) { console.warn("Kunne ikke godta gjensidig forespørsel:", e); }
      return; // lytterne kjører på nytt med oppdatert data
    }
  }

  // Engangsoverføring av venner fra den gamle modellen: send en forespørsel som den andre godtar automatisk
  if (legacyFriendUids && legacyFriendUids.size > 0 && !userProfile.friendsModelV2) {
    for (const otherUid of legacyFriendUids) {
      if (accepted.has(otherUid) || outgoingPending.includes(otherUid) || incoming.some(r => r.uid === otherUid)) continue;
      if (friendAutoActions.has("req_" + otherUid) || isExampleTravelerUid(otherUid)) continue;
      friendAutoActions.add("req_" + otherUid);
      try {
        await setDoc(doc(db, "friendRequests", `${uid}_${otherUid}`), {
          from: uid, to: otherUid, status: "pending", createdAt: new Date().toISOString(), fromProfile: myPublicSnippet()
        });
      } catch (e) { /* finnes allerede eller ikke tilgang */ }
    }
  }

  const previousFriendUids = new Set((userProfile.friends || []).map(f => f.uid));
  const previousOutgoing = new Set(userProfile.outgoingFriendRequests || []);
  const friends = [...accepted.values()];
  // Behold gamle venner som venter på bekreftelse, så listen ikke tømmes mens overføringen pågår
  if (!userProfile.friendsModelV2 && legacyFriendUids) {
    (userProfile.friends || []).forEach(f => {
      if (legacyFriendUids.has(f.uid) && !accepted.has(f.uid)) friends.push(f);
    });
  }

  friends.forEach(f => {
    if (!previousFriendUids.has(f.uid) && previousOutgoing.has(f.uid)) {
      showToast("Venneforespørsel godtatt", `${f.displayName} er nå reisevennen din.`, "users");
    }
  });

  const changed = JSON.stringify(friends.map(f => f.uid).sort()) !== JSON.stringify([...previousFriendUids].sort());
  userProfile.friends = friends;
  userProfile.incomingFriendRequests = incoming;
  userProfile.outgoingFriendRequests = outgoingPending;

  let flagChanged = false;
  if (!userProfile.friendsModelV2 && legacyFriendUids && [...legacyFriendUids].every(u => accepted.has(u))) {
    userProfile.friendsModelV2 = true;
    flagChanged = true;
  }
  if (changed || flagChanged) saveUserProfileEverywhere();
  renderSocialHub();
  renderShareAndCollabModal();
  refreshFriendProfiles(changed);
}

// Henter navn, brukernavn og bilde på nytt, så vennelisten ikke viser gamle opplysninger
export async function refreshFriendProfiles(force = false) {
  if (!isCloudReady()) return;
  const now = Date.now();
  if (!force && now - lastFriendProfileRefresh < 60000) return;
  lastFriendProfileRefresh = now;
  const list = userProfile.friends || [];
  let changed = false;
  await Promise.all(list.map(async f => {
    if (!f || !f.uid || isExampleTravelerUid(f.uid)) return;
    try {
      const snap = await getDoc(doc(db, "publicProfiles", f.uid));
      if (!snap.exists()) return;
      const p = snap.data() || {};
      const fresh = {
        displayName: String(p.displayName || f.displayName || "Reisende").slice(0, 60),
        username: String(p.username || f.username || "").slice(0, 30),
        avatarColor: safeColor(p.avatarColor, f.avatarColor || "#2563eb"),
        photo: safePhoto(p.photo),
        homeStation: String(p.homeStation || "").slice(0, 80)
      };
      if (Object.keys(fresh).some(k => fresh[k] !== f[k])) { Object.assign(f, fresh); changed = true; }
    } catch (e) { /* ignorer */ }
  }));
  if (changed) {
    try { localStorage.setItem("railsync_user_profile_v1", JSON.stringify(userProfile)); } catch (e) {}
    renderSocialHub();
    renderShareAndCollabModal();
  }
}

// Lytter på alle reiser brukeren eier eller er med på, så endringer fra andre
// (og fra dine egne andre enheter) vises med en gang.
function startTripListeners(uid) {
  if (!isCloudReady()) return;
  const handle = (label) => (snap) => {
    let touched = false;
    let newShared = 0;
    const toPush = [];
    snap.docChanges().forEach(change => {
      if (change.type === "removed") {
        handleRemoteTripRemoval(change.doc.id);
        return;
      }
      const res = applyRemoteTripData(change.doc.id, change.doc.data());
      if (!res) return;
      if (res.changed) touched = true;
      if (res.isNew && label === "member" && !isTripOwnedByCurrentUser(allTrips.find(t => t.id === change.doc.id))) newShared++;
      if (res.needsPush) toPush.push(change.doc.id);
    });
    if (touched) afterRemoteTripChanges();
    if (newShared > 0 && tripListenersReady[label]) {
      showToast("Ny delt reise", "En reisevenn har delt en reise med deg. Du finner den under Reiser.", "share-2");
    }
    tripListenersReady[label] = true;
    toPush.forEach(id => {
      const t = allTrips.find(x => x.id === id);
      if (t && canEditTrip(t)) pushTripToFirestore(t);
    });
    updateSyncStatus();
  };
  const onErr = (err) => { console.warn("Lytter for reiser feilet:", err); updateSyncStatus(); };
  try {
    tripListenersReady = { owned: false, member: false };
    ownedTripsUnsub = onSnapshot(query(collection(db, "trips"), where("ownerUid", "==", uid)), handle("owned"), onErr);
    memberTripsUnsub = onSnapshot(query(collection(db, "trips"), where("memberUids", "array-contains", uid)), handle("member"), onErr);
  } catch (e) {
    console.warn("Kunne ikke starte lyttere for reiser:", e);
  }
}
let tripListenersReady = { owned: false, member: false };

function afterRemoteTripChanges() {
  saveAllTripsToLocalStorage();
  if (!allTrips.some(t => t.id === activeTripId) && allTrips.length > 0) activeTripId = allTrips[0].id;
  syncActiveTripToState();
  renderAll();
  updateMapLayers();
  renderShareAndCollabModal();
}

// En reise forsvant fra lytteren: sjekk om den er slettet eller om du er fjernet
async function handleRemoteTripRemoval(id) {
  if (!isCloudReady()) return;
  const uid = currentUser.uid;
  try {
    const snap = await getDoc(doc(db, "trips", id));
    if (snap.exists()) {
      const d = snap.data() || {};
      if (d.ownerUid === uid || (Array.isArray(d.memberUids) && d.memberUids.includes(uid))) return;
    }
  } catch (e) {
    if (!e || e.code !== "permission-denied") return; // nettfeil: ikke fjern noe
  }
  removeLocalTrip(id, true);
}

function removeLocalTrip(id, notify) {
  const t = allTrips.find(x => x.id === id);
  if (!t) return;
  allTrips = allTrips.filter(x => x.id !== id);
  if (allTrips.length === 0) {
    createNewTrip();
  } else if (activeTripId === id) {
    activeTripId = allTrips[0].id;
  }
  saveAllTripsToLocalStorage();
  syncActiveTripToState();
  renderAll();
  updateMapLayers();
  if (notify) {
    showToast("Reisen er ikke lenger tilgjengelig", `«${t.title || "Reisen"}» er slettet, eller du er ikke lenger med i reisefølget.`, "info");
  }
}

if (isFirebaseConfigured()) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase Firestore og Auth initialisert vellykket.");

    // Listen to authentication state changes
    onAuthStateChanged(auth, async (user) => {
      authStateResolved = true;
      currentUser = user;
      if (!user) {
        await syncUserProfileWithCloud(null);
        showAuthScreen();
        return;
      }

      // Ny konto i denne nettleseren: fjern forrige brukers data før noe vises
      const previousUid = safeLocalGet("railsync_account_uid");
      if (previousUid && previousUid !== user.uid) {
        clearLocalAppData();
        safeLocalSet("railsync_account_uid", user.uid);
        location.reload();
        return;
      }
      safeLocalSet("railsync_account_uid", user.uid);

      setAuthState("in");
      await syncUserProfileWithCloud(user);
      if (map) {
        setTimeout(() => {
          map.invalidateSize();
          resetMapView();
        }, 150);
      }
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
let authStateResolved = false;
let authMode = "login";

function safeLocalGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function safeLocalSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

// Fjerner alt RailSync har lagret i nettleseren (brukes ved utlogging og kontobytte)
function clearLocalAppData() {
  try {
    Object.keys(localStorage).filter(k => k.toLowerCase().startsWith("railsync")).forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

function setAuthState(state) {
  document.body.dataset.auth = state;
}

function showAuthScreen() {
  setAuthState("out");
  const notice = document.getElementById("auth-notice");
  let pending = null;
  try { pending = sessionStorage.getItem("railsync_pending_join"); } catch (e) {}
  if (notice) {
    if (pending) {
      notice.textContent = "Logg inn for å åpne reisen som er delt med deg. Den åpnes automatisk etterpå.";
      notice.classList.remove("hidden");
    } else {
      notice.classList.add("hidden");
    }
  }
  if (window.lucide) lucide.createIcons();
}

// Vis innloggingssiden hvis innloggingen ikke er avklart etter noen sekunder (f.eks. uten nett)
setTimeout(() => {
  if (!authStateResolved && document.body.dataset.auth === "pending") {
    showAuthScreen();
    if (!auth) showAuthError("Innlogging er ikke tilgjengelig akkurat nå. Prøv å laste siden på nytt.");
  }
}, 8000);

function showAuthError(message) {
  const el = document.getElementById("auth-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "login";
  const isSignup = authMode === "signup";
  const checkbox = document.getElementById("auth-is-new-user");
  if (checkbox) checkbox.checked = isSignup;

  const loginTab = document.getElementById("auth-mode-login");
  const signupTab = document.getElementById("auth-mode-signup");
  const activeCls = "py-2 rounded-md font-semibold bg-white text-slate-900 shadow-sm transition";
  const idleCls = "py-2 rounded-md font-medium text-slate-500 hover:text-slate-800 transition";
  if (loginTab) { loginTab.className = isSignup ? idleCls : activeCls; loginTab.setAttribute("aria-selected", String(!isSignup)); }
  if (signupTab) { signupTab.className = isSignup ? activeCls : idleCls; signupTab.setAttribute("aria-selected", String(isSignup)); }

  const title = document.getElementById("auth-title");
  const subtitle = document.getElementById("auth-subtitle");
  const submit = document.getElementById("btn-auth-submit");
  const pw = document.getElementById("auth-password");
  const hint = document.getElementById("auth-password-hint");
  if (title) title.textContent = isSignup ? "Opprett konto" : "Logg inn";
  if (subtitle) subtitle.textContent = isSignup
    ? "Lag en gratis konto for å planlegge og dele reiser."
    : "Velkommen tilbake. Logg inn for å se reisene dine.";
  if (submit) submit.textContent = isSignup ? "Opprett konto" : "Logg inn";
  if (pw) pw.setAttribute("autocomplete", isSignup ? "new-password" : "current-password");
  if (hint) hint.classList.toggle("hidden", !isSignup);
  showAuthError("");
}

export function togglePasswordVisibility() {
  const pw = document.getElementById("auth-password");
  const btn = document.getElementById("btn-toggle-password");
  if (!pw) return;
  const show = pw.type === "password";
  pw.type = show ? "text" : "password";
  if (btn) btn.textContent = show ? "Skjul" : "Vis";
}

export function toggleAccountMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById("account-menu");
  const pill = document.getElementById("user-profile-pill");
  if (!menu) return;
  const open = menu.classList.contains("hidden");
  menu.classList.toggle("hidden", !open);
  if (pill) pill.setAttribute("aria-expanded", String(open));
}

export function closeAccountMenu() {
  const menu = document.getElementById("account-menu");
  const pill = document.getElementById("user-profile-pill");
  if (menu) menu.classList.add("hidden");
  if (pill) pill.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", (e) => {
  const container = document.getElementById("auth-header-container");
  if (container && !container.contains(e.target)) closeAccountMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAccountMenu();
});

function describeLogin(user) {
  if (!user) return { id: "–", method: "–" };
  const providers = (user.providerData || []).map(p => p.providerId);
  const email = user.email || "";
  if (email.endsWith("@railsync.user")) {
    return { id: "@" + email.split("@")[0], method: "Brukernavn og passord" };
  }
  return { id: email || user.displayName || "–", method: providers.includes("google.com") ? "Google" : "E-post og passord" };
}

export function updateAuthUI(user) {
  const activeName = userProfile.displayName || (user && (user.displayName || (user.email ? user.email.split("@")[0] : ""))) || "Min profil";
  const handle = userProfile.username || "";
  const initials = getInitials(activeName);
  const bgColor = safeColor(userProfile.avatarColor, "#0d9488");
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  setText("user-display-name", activeName);
  setText("sidebar-user-label", activeName);
  setText("sidebar-user-sublabel", handle);
  setText("account-menu-name", activeName);
  setText("account-menu-handle", handle);

  ["header-user-avatar", "sidebar-user-avatar"].forEach(id => {
    paintAvatar(document.getElementById(id), { displayName: activeName, avatarColor: bgColor, photo: userProfile.photo });
  });

  const login = describeLogin(user);
  setText("account-login-id", login.id);
  setText("account-login-method", login.method);
}

export function openAuthModal() {
  if (currentUser) return;
  showAuthScreen();
  const input = document.getElementById("auth-username");
  if (input) setTimeout(() => input.focus(), 50);
}

export async function handleGoogleSignIn() {
  showAuthError("");
  if (!auth) {
    showAuthError("Innlogging er ikke tilgjengelig akkurat nå. Prøv å laste siden på nytt.");
    return;
  }
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err && (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request")) return;
    console.error("Google-innlogging feilet:", err);
    showAuthError(err && err.code === "auth/popup-blocked"
      ? "Nettleseren blokkerte innloggingsvinduet. Tillat popup-vinduer for denne siden og prøv igjen."
      : "Kunne ikke logge inn med Google. Prøv igjen.");
  }
}

export async function handleUsernameAuth(e) {
  if (e && e.preventDefault) e.preventDefault();
  showAuthError("");
  if (!auth) {
    showAuthError("Innlogging er ikke tilgjengelig akkurat nå. Prøv å laste siden på nytt.");
    return;
  }

  const usernameInput = document.getElementById("auth-username");
  const passwordInput = document.getElementById("auth-password");
  const rawInput = (usernameInput && usernameInput.value || "").trim().replace(/^@/, "");
  const password = (passwordInput && passwordInput.value) || "";
  const checkbox = document.getElementById("auth-is-new-user");
  const isNewUser = checkbox ? checkbox.checked : authMode === "signup";

  if (!rawInput) {
    showAuthError("Skriv inn brukernavnet ditt.");
    if (usernameInput) usernameInput.focus();
    return;
  }
  if (/@(gmail|googlemail)\./i.test(rawInput)) {
    showAuthError("Har du en Google-konto, bruker du «Fortsett med Google» i stedet.");
    return;
  }
  if (password.length < 6) {
    showAuthError("Passordet må ha minst 6 tegn.");
    if (passwordInput) passwordInput.focus();
    return;
  }

  let authEmail = rawInput;
  let username = rawInput;
  if (!rawInput.includes("@")) {
    const cleanUsername = rawInput.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (cleanUsername.length < 3) {
      showAuthError("Brukernavnet må ha minst 3 tegn (bokstaver, tall, punktum, bindestrek eller understrek).");
      return;
    }
    authEmail = `${cleanUsername}@railsync.user`;
    username = cleanUsername;
  } else {
    username = rawInput.split("@")[0];
  }

  const btn = document.getElementById("btn-auth-submit");
  if (btn) {
    btn.disabled = true;
    btn.textContent = isNewUser ? "Oppretter konto …" : "Logger inn …";
  }

  try {
    if (isNewUser && !rawInput.includes("@") && db) {
      try {
        const taken = await getDoc(doc(db, "usernames", normalizeHandle(username)));
        if (taken.exists()) {
          showAuthError(`Brukernavnet «${username}» er allerede tatt. Velg et annet, eller logg inn.`);
          return;
        }
      } catch (e) { /* sjekkes igjen etter innlogging */ }
    }
    if (isNewUser) {
      const res = await createUserWithEmailAndPassword(auth, authEmail, password);
      try {
        await updateProfile(res.user, { displayName: username });
      } catch (profErr) {
        console.warn("Kunne ikke sette visningsnavn:", profErr);
      }
    } else {
      await signInWithEmailAndPassword(auth, authEmail, password);
    }
    const form = document.getElementById("form-auth");
    if (form) form.reset();
    setAuthMode("login");
  } catch (err) {
    console.error("Innlogging feilet:", err);
    const code = err && err.code;
    let msg = "Noe gikk galt. Prøv igjen.";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-login-credentials") {
      msg = "Feil brukernavn eller passord.";
    } else if (code === "auth/email-already-in-use") {
      msg = `Brukernavnet «${username}» er allerede tatt. Velg et annet, eller logg inn.`;
    } else if (code === "auth/weak-password") {
      msg = "Passordet må ha minst 6 tegn.";
    } else if (code === "auth/too-many-requests") {
      msg = "For mange forsøk. Vent litt og prøv igjen.";
    } else if (code === "auth/network-request-failed") {
      msg = "Ingen nettforbindelse. Sjekk tilkoblingen og prøv igjen.";
    }
    showAuthError(msg);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = authMode === "signup" ? "Opprett konto" : "Logg inn";
    }
  }
}

export const handleEmailAuth = handleUsernameAuth;

export async function handleLogout() {
  isLoggingOut = true;
  try {
    stopCloudListeners();
    syncStatusState = "";
    if (activeTripUnsubscribe) {
      activeTripUnsubscribe();
      activeTripUnsubscribe = null;
    }
    if (auth) await signOut(auth);
  } catch (err) {
    console.error("Utlogging feilet:", err);
  }
  // Fjern reiser, profil og budsjetter fra nettleseren – de ligger på kontoen
  clearLocalAppData();
  try {
    Object.keys(sessionStorage).filter(k => k.toLowerCase().startsWith("railsync")).forEach(k => sessionStorage.removeItem(k));
  } catch (e) {}
  location.replace(location.pathname);
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
export let currentTripManagerTab = "all";
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
const EDIT_ACTIONS = /\b(openAddStopModal|openEditStopModal|deleteStop|moveStopOrder|openAddTrainModal|openEditTrainModal|deleteTrain|openAddPackingItemModal|deletePackingItem|handleQuickAddPacking|openTripSettingsModal|importLiveJourneyToTrip|addWishlistPlaceToActiveTrip|handleSaveStop|handleSaveTrain|handleSavePackingItem)\(/;
const LOCK_ACTIONS = /\b(togglePackingItem|toggleTrainReservation)\(/;

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
      id: activeTripId || newTripId(),
      title: appState.trip.title || "Min Reise",
      trip: {}, stops: [], trains: [], expenses: [], packingList: []
    });
    allTrips.push(active);
  } else {
    ensureTripCollaborationFields(active);
  }

  updatePersonalBudgetForTrip(active.id, appState.trip.totalBudget, appState.expenses);

  // Bare stemple og laste opp når innholdet faktisk er endret – ellers kan en utdatert
  // lokal kopi overskrive det reisefølget har endret i mellomtiden.
  const contentSignature = (title, tripData, stops, trains, packingList) => {
    const t = { ...(tripData || {}) };
    delete t.totalBudget;
    return JSON.stringify([title, t, stops || [], trains || [], packingList || []]);
  };
  const beforeSig = contentSignature(active.title, active.trip, active.stops, active.trains, active.packingList);

  active.title = appState.trip.title || "Min Reise";
  active.trip = JSON.parse(JSON.stringify(appState.trip));
  active.stops = JSON.parse(JSON.stringify(appState.stops));
  active.trains = JSON.parse(JSON.stringify(appState.trains));
  active.expenses = JSON.parse(JSON.stringify(appState.expenses));
  active.packingList = JSON.parse(JSON.stringify(appState.packingList));

  const contentChanged = beforeSig !== contentSignature(active.title, active.trip, active.stops, active.trains, active.packingList);
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
  else if (allTrips.some(isTripDirty)) state = online ? (lastSyncFailed ? "retry" : "saving") : "offline";
  else state = "saved";
  if (state === syncStatusState) return;
  syncStatusState = state;
  const labels = {
    saving: ["Lagrer …", "bg-amber-400 animate-pulse", "Endringene sendes til kontoen din."],
    saved: ["Lagret", "bg-emerald-500", "Alt er lagret på kontoen din."],
    offline: ["Ikke på nett", "bg-slate-400", "Endringene er lagret på denne enheten og sendes når nettet er tilbake."],
    retry: ["Prøver igjen …", "bg-amber-500", "Fikk ikke lagret med en gang. Prøver igjen automatisk."]
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

function retryDirtyTrips() {
  if (!isCloudReady() || syncInFlight > 0) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) { updateSyncStatus(); return; }
  allTrips.filter(isTripDirty).forEach(t => {
    if (isTripOwnedByCurrentUser(t) || canEditTrip(t)) pushTripToFirestore(t);
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    lastSyncFailed = false;
    updateSyncStatus();
    if (currentUser && !cloudBootstrapOk && !isLoggingOut) syncUserProfileWithCloud(currentUser);
    else retryDirtyTrips();
  });
  window.addEventListener("offline", () => updateSyncStatus());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveAllTripsToLocalStorage();
    else if (currentUser && !cloudBootstrapOk && !isLoggingOut && navigator.onLine !== false) syncUserProfileWithCloud(currentUser);
    else retryDirtyTrips();
  });
  window.addEventListener("pagehide", () => saveAllTripsToLocalStorage());
  setInterval(retryDirtyTrips, 15000);
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
    trains: Array.isArray(src.trains) ? src.trains : [],
    packingList: Array.isArray(src.packingList) ? src.packingList : []
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
    packingList: mergeItemList(base.packingList, local.packingList, remote.packingList)
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
  if (tripObj.id === activeTripId) {
    isApplyingRemoteSnapshot = true;
    try {
      appState.trip = JSON.parse(JSON.stringify(tripObj.trip));
      appState.stops = JSON.parse(JSON.stringify(tripObj.stops));
      appState.trains = JSON.parse(JSON.stringify(tripObj.trains));
      appState.packingList = JSON.parse(JSON.stringify(tripObj.packingList));
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
    stops: Array.isArray(clone.stops) ? clone.stops : [],
    trains: Array.isArray(clone.trains) ? clone.trains : [],
    packingList: Array.isArray(clone.packingList) ? clone.packingList : [],
    activityLog: Array.isArray(clone.activityLog) ? clone.activityLog.slice(0, 12) : [],
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
    members: JSON.parse(JSON.stringify(tripObj.members || [])),
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
    return true;
  } catch (err) {
    // Reiser i eldre format (uten eier) kan ikke oppdateres – lagre dem på nytt med ny ID
    if (owned && !_retried && err && err.code === "permission-denied") {
      reassignTripId(tripObj);
      tripObj._cloudCreated = false;
      syncUrlWithActiveTrip();
      return pushTripToFirestoreInner(tripObj, true);
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
    if (allTrips.length === 0) createNewTrip();
    if (!allTrips.some(t => t.id === activeTripId)) activeTripId = allTrips[0].id;

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

  // Hent ?trip=... hvis brukeren limte inn hele lenken
  if (cleanInput.includes("trip=")) {
    try {
      const u = new URL(cleanInput);
      cleanInput = u.searchParams.get("trip") || cleanInput;
    } catch (e) {
      const match = cleanInput.match(/[?&]trip=([^&#]+)/);
      if (match) cleanInput = decodeURIComponent(match[1]);
    }
  }
  cleanInput = cleanInput.slice(0, 120);
  const shareCode = normalizeShareCodeInput(cleanInput);

  // 1. Finnes reisen allerede lokalt?
  const localMatch = allTrips.find(t => t.id === cleanInput || (shareCode && t.shareCode === shareCode));
  if (localMatch && (!isCloudReady() || isTripOwnedByCurrentUser(localMatch))) {
    activeTripId = localMatch.id;
    syncActiveTripToState();
    syncUrlWithActiveTrip();
    saveAllTripsToLocalStorage();
    renderAll();
    updateMapLayers();
    showToast("Reise åpnet", `Byttet til "${appState.trip.title}".`, "check");
    return true;
  }

  // 2. Delte reiser krever innlogging
  if (!isCloudReady()) {
    if (isFirebaseConfigured()) {
      try { sessionStorage.setItem("railsync_pending_join", cleanInput); } catch (e) {}
      if (authStateResolved) showAuthScreen();
    } else if (!fromUrlParam) {
      showToast("Fant ikke reisen", "Skylagring er ikke aktiv, så delte reiser kan ikke hentes.", "alert-circle");
    }
    return false;
  }

  try {
    let tripId = cleanInput;
    if (shareCode) {
      const codeSnap = await getDoc(doc(db, "shareCodes", shareCode));
      if (!codeSnap.exists()) {
        showToast("Fant ikke reisen", `Ingen delt reise med koden ${shareCode}.`, "alert-circle");
        return false;
      }
      tripId = String(codeSnap.data().tripId || "");
    }
    if (!/^[A-Za-z0-9_-]{3,120}$/.test(tripId)) {
      if (!fromUrlParam) showToast("Ugyldig kode", "Sjekk at koden eller lenken er riktig.", "alert-circle");
      return false;
    }

    const tripRef = doc(db, "trips", tripId);
    let snap = await getDoc(tripRef);
    if (!snap.exists()) {
      if (!fromUrlParam) showToast("Fant ikke reisen", "Reisen finnes ikke lenger.", "alert-circle");
      return false;
    }
    let cloudData = snap.data();
    const uid = currentUser.uid;
    const isMember = Array.isArray(cloudData.memberUids) && cloudData.memberUids.includes(uid);

    if (!isMember && cloudData.ownerUid !== uid) {
      if (cloudData.visibility !== "shared") {
        showToast("Reisen er privat", "Eieren har ikke delt denne reisen.", "lock");
        return false;
      }
      const role = cloudData.sharePermission === "view" ? "viewer" : "editor";
      const myName = String(userProfile.displayName || "Reisende").slice(0, 60);
      const joinUpdate = {
        memberUids: arrayUnion(uid),
        members: arrayUnion({
          id: uid,
          uid,
          username: String(userProfile.username || "").slice(0, 30),
          name: myName,
          role,
          avatarColor: safeColor(userProfile.avatarColor, "#2563eb"),
          joinedAt: new Date().toISOString()
        }),
        updatedAt: new Date().toISOString()
      };
      if (role === "editor") joinUpdate.editorUids = arrayUnion(uid);
      await updateDoc(tripRef, joinUpdate);
      snap = await getDoc(tripRef);
      cloudData = snap.data();
    }

    delete cloudData.expenses;
    const loadedTrip = ensureTripCollaborationFields({
      ...cloudData,
      id: tripId,
      title: cloudData.trip ? (cloudData.trip.title || cloudData.title) : (cloudData.title || "Delt Reise")
    });
    if (!loadedTrip.trip) loadedTrip.trip = {};
    loadedTrip._base = tripContentOf(loadedTrip);
    const myBudget = getPersonalBudgetForTrip(loadedTrip);
    loadedTrip.trip.totalBudget = myBudget.totalBudget;
    loadedTrip.expenses = myBudget.expenses;

    const existingIdx = allTrips.findIndex(t => t.id === tripId);
    if (existingIdx !== -1) {
      allTrips[existingIdx] = loadedTrip;
    } else {
      allTrips.unshift(loadedTrip);
    }

    activeTripId = tripId;
    syncActiveTripToState();
    syncUrlWithActiveTrip();
    saveAllTripsToLocalStorage();
    renderAll();
    updateMapLayers();
    showToast("Delt reise lastet!", `Du er nå koblet til "${appState.trip.title}" i sanntid.`, "users");
    return true;
  } catch (err) {
    console.warn("Feil ved henting av delt reise fra Firestore:", err);
    if (!fromUrlParam || err.code === "permission-denied") {
      showToast("Fikk ikke åpnet reisen", "Reisen er privat, eller lenken er ikke lenger gyldig.", "alert-circle");
    }
    return false;
  }
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
    if (!requireCloudLogin("dele reiser")) return;
    if (!isTripOwnedByCurrentUser(active)) {
      renderShareAndCollabModal();
      openModal("modal-share-trip");
      return;
    }

    // Eksempelreisen har samme ID for alle – gi den en egen ID før deling
    if (active.id === "eksempel-1") {
      reassignTripId(active);
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
    await pushTripToFirestore(active);
    await pushTripMembershipToFirestore(active);
    subscribeToActiveSharedTrip();

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
  const uniqueCountries = new Set(appState.stops.map(s => String(s.country || "").trim()).filter(Boolean));
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
    const accStatus = String(stop.accommodationStatus || "");
    if (accStatus.includes("Bestilt")) {
      badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
    } else if (accStatus.includes("Ser etter")) {
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
                <h3 class="font-extrabold text-slate-900 text-sm sm:text-base hover:text-brand-600 cursor-pointer leading-snug" onclick="centerMapOnStop(${Number(stop.lat)}, ${Number(stop.lng)})">
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
                onclick="moveStopOrder(${jsArg(stop.id)}, -1)" 
                class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 bg-white border border-slate-200/80 shadow-2xs transition ${isStart ? 'opacity-25 cursor-not-allowed' : ''}"
                ${isStart ? 'disabled' : ''}
              >
                <i data-lucide="chevron-up" class="w-3.5 h-3.5"></i>
              </button>

              <button 
                title="Flytt ned i reiseruten" 
                onclick="moveStopOrder(${jsArg(stop.id)}, 1)" 
                class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 bg-white border border-slate-200/80 shadow-2xs transition ${isEnd ? 'opacity-25 cursor-not-allowed' : ''}"
                ${isEnd ? 'disabled' : ''}
              >
                <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
              </button>

              <button title="Rediger stoppested" onclick="openEditStopModal(${jsArg(stop.id)})" class="px-2 h-7 flex items-center gap-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-brand-600 bg-white border border-slate-200/80 shadow-2xs transition">
                <i data-lucide="pencil" class="w-3 h-3"></i>
                <span>Endre</span>
              </button>

              <button title="Vis på kartet" onclick="centerMapOnStop(${Number(stop.lat)}, ${Number(stop.lng)})" class="px-2 h-7 flex items-center gap-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-brand-600 bg-white border border-slate-200/80 shadow-2xs transition">
                <i data-lucide="map-pin" class="w-3 h-3 text-brand-600"></i>
                <span>Kart</span>
              </button>

              <button title="Fjern stoppested" onclick="deleteStop(${jsArg(stop.id)})" class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 bg-white border border-slate-200/80 shadow-2xs transition">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            ${!isEnd ? `
              <button 
                onclick="quickSearchBetweenStops(${Number(idx)}, ${Number(idx + 1)})" 
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
              <button onclick="focusTrainTrackOnMap(${jsArg(train.id)})" class="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition flex items-center gap-1">
                <i data-lucide="map-pin" class="w-3.5 h-3.5"></i> Vis i kart
              </button>
            ` : `
              <button onclick="fetchRealTrackForSingleTrain(${jsArg(train.id)})" class="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition flex items-center gap-1">
                <i data-lucide="zap" class="w-3.5 h-3.5"></i> Hent spor
              </button>
            `}
            ${train.reservationStatus === 'required' ? `
              <button onclick="toggleTrainReservation(${jsArg(train.id)})" class="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition">
                Merk bestilt
              </button>
            ` : `
              <button onclick="toggleTrainReservation(${jsArg(train.id)})" class="text-xs font-medium text-slate-400 hover:text-slate-600 px-2 py-1">
                Status
              </button>
            `}
            <button onclick="deleteTrain(${jsArg(train.id)})" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-50 transition" title="Slett togreise">
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
              <button onclick="deleteExpense(${jsArg(exp.id)})" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg bg-slate-50 transition" title="Slett utgift">
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
            <button onclick="deleteExpense(${jsArg(exp.id)})" class="text-slate-400 hover:text-rose-600 p-1 rounded transition" title="Slett utgift">
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
                    onchange="togglePackingItem(${jsArg(item.id)})"
                    class="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 transition cursor-pointer"
                  >
                  <span class="text-xs sm:text-sm font-medium ${item.checked ? 'line-through text-slate-400' : 'text-slate-700'}">
                    ${escapeHtml(item.text)}
                  </span>
                </label>
                <button onclick="deletePackingItem(${jsArg(item.id)})" class="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded transition" title="Slett">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="mt-2 pt-2 border-t border-slate-100">
          <form onsubmit="handleQuickAddPacking(event, ${jsArg(categoryName)})" class="flex items-center gap-1.5">
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
  applyEditMode(isEditable);
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
      style="background-color: ${safeColor(m.avatarColor, '#0d9488')}"
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
  renderSocialHub();
  updateAuthUI(currentUser);
  applyEditMode();
  if (window.lucide) lucide.createIcons();
}

// =============================================================================
// 6.5 MULTI-TRIP MANAGER, SHARED TRIPS & USER PROFILE FUNCTIONS
// =============================================================================
// ---------------------------------------------------------------------------
// Egen dialog i stedet for nettleserens confirm()/prompt()
// ---------------------------------------------------------------------------
let appDialogResolve = null;

export function showAppDialog({ title = "Bekreft", message = "", confirmLabel = "OK", danger = false, input = null } = {}) {
  const modal = document.getElementById("modal-app-dialog");
  if (!modal) return Promise.resolve(input ? null : false);
  if (appDialogResolve) appDialogResolve(input ? null : false);

  document.getElementById("app-dialog-title").textContent = title;
  document.getElementById("app-dialog-message").textContent = message;
  const msgEl = document.getElementById("app-dialog-message");
  msgEl.classList.toggle("hidden", !message);
  const confirmBtn = document.getElementById("app-dialog-confirm");
  confirmBtn.textContent = confirmLabel;
  confirmBtn.className = danger
    ? "px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition"
    : "px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition";

  const wrap = document.getElementById("app-dialog-input-wrap");
  const field = document.getElementById("app-dialog-input");
  wrap.classList.toggle("hidden", !input);
  if (input) {
    document.getElementById("app-dialog-input-label").textContent = input.label || "Navn";
    field.value = input.value || "";
    field.maxLength = input.maxLength || 80;
  }

  openModal("modal-app-dialog");
  setTimeout(() => { (input ? field : confirmBtn).focus(); if (input) field.select(); }, 30);

  return new Promise(resolve => {
    appDialogResolve = (value) => {
      appDialogResolve = null;
      closeModal("modal-app-dialog");
      resolve(value);
    };
  });
}

function initAppDialog() {
  const form = document.getElementById("app-dialog-form");
  if (!form || form.dataset.ready) return;
  form.dataset.ready = "1";
  const isInput = () => !document.getElementById("app-dialog-input-wrap").classList.contains("hidden");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!appDialogResolve) return;
    if (isInput()) {
      const v = document.getElementById("app-dialog-input").value.trim();
      if (!v) { document.getElementById("app-dialog-input").focus(); return; }
      appDialogResolve(v);
    } else {
      appDialogResolve(true);
    }
  });
  document.getElementById("app-dialog-cancel").addEventListener("click", () => {
    if (appDialogResolve) appDialogResolve(isInput() ? null : false);
  });
  document.getElementById("modal-app-dialog").addEventListener("click", (e) => {
    if (e.target.id === "modal-app-dialog" && appDialogResolve) appDialogResolve(isInput() ? null : false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && appDialogResolve) appDialogResolve(isInput() ? null : false);
  });
}
initAppDialog();

// ---------------------------------------------------------------------------
// Reiser-siden
// ---------------------------------------------------------------------------
// Beholdt navn for eldre kall: åpner nå Reiser-siden
export function openTripManagerModal(initialTab = "all") {
  switchTab("trips");
  switchTripManagerTab(initialTab === "join" ? "all" : initialTab);
  if (initialTab === "join") focusJoinTripInput();
}

export function focusJoinTripInput() {
  const card = document.getElementById("join-trip-card");
  const input = document.getElementById("join-trip-code-input");
  if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  if (input) setTimeout(() => input.focus(), 250);
}

export async function refreshTripsFromCloud() {
  const btn = document.getElementById("btn-refresh-trips");
  if (btn) btn.classList.add("opacity-50", "pointer-events-none");
  try {
    await syncAllUserTripsWithCloud(false);
  } finally {
    if (btn) btn.classList.remove("opacity-50", "pointer-events-none");
    renderTripManagerList();
  }
}

export function canEditTrip(tripObj) {
  if (!tripObj) return false;
  if (isTripOwnedByCurrentUser(tripObj)) return true;
  const myUid = currentUser ? currentUser.uid : userProfile.uid;
  if (Array.isArray(tripObj.editorUids) && tripObj.editorUids.includes(myUid)) return true;
  const myMember = (tripObj.members || []).find(m => (m.uid || m.id) === myUid);
  if (myMember) return myMember.role === "owner" || myMember.role === "editor";
  return tripObj.visibility === "shared" && tripObj.sharePermission !== "view";
}

let openTripMenuId = null;

export function toggleTripCardMenu(tripId, event) {
  if (event) event.stopPropagation();
  openTripMenuId = openTripMenuId === tripId ? null : tripId;
  document.querySelectorAll("[data-trip-menu]").forEach(menu => {
    const isOpen = menu.dataset.tripMenu === openTripMenuId;
    menu.classList.toggle("hidden", !isOpen);
    const btn = menu.previousElementSibling;
    if (btn) btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}

export function closeTripCardMenus() {
  if (openTripMenuId === null) return;
  openTripMenuId = null;
  document.querySelectorAll("[data-trip-menu]").forEach(menu => menu.classList.add("hidden"));
}

document.addEventListener("click", (e) => {
  if (!e.target.closest || !e.target.closest("[data-trip-menu]")) closeTripCardMenus();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeTripCardMenus(); });

export function openTripFromList(tripId) {
  closeTripCardMenus();
  if (tripId !== activeTripId) switchActiveTrip(tripId);
  switchTab("overview");
}

export async function newTripFromPage() {
  const name = await showAppDialog({
    title: "Ny reise",
    message: "Gi reisen et navn. Du kan endre datoer og passdager etterpå.",
    confirmLabel: "Opprett reise",
    input: { label: "Navn på reisen", value: "", maxLength: 80 }
  });
  if (!name) return;
  createNewTrip();
  const clean = name.trim().slice(0, 80);
  if (clean) {
    appState.trip.title = clean;
    persistState(`Opprettet «${clean}»`);
    renderAll();
  }
  switchTab("overview");
}

export function shareTripFromList(tripId) {
  closeTripCardMenus();
  if (tripId !== activeTripId) switchActiveTrip(tripId);
  handleSaveAndShareTrip();
}

function tripDateRangeText(tripData) {
  const t = tripData || {};
  if (!t.startDate || !t.endDate) return "Ingen datoer valgt";
  const start = new Date(t.startDate);
  const end = new Date(t.endDate);
  const days = Math.max(1, Math.round((end - start) / 86400000));
  const year = /^\d{4}/.test(String(t.endDate)) ? ` ${String(t.endDate).slice(0, 4)}` : "";
  return `${formatDate(t.startDate)} – ${formatDate(t.endDate)}${year} · ${Number.isFinite(days) ? days : "?"} dager`;
}

function tripRouteHtml(stops) {
  const list = (Array.isArray(stops) ? stops : [])
    .slice()
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map(st => String((st && st.city) || "").trim())
    .filter(Boolean);
  if (list.length === 0) {
    return `<p class="text-sm text-slate-400">Ingen stopp lagt til ennå</p>`;
  }
  const shown = list.slice(0, 4);
  const more = list.length - shown.length;
  const arrow = `<i data-lucide="arrow-right" class="w-3 h-3 text-slate-300 shrink-0"></i>`;
  return `<p class="flex items-center flex-wrap gap-x-1.5 gap-y-1 text-sm text-slate-700">${shown.map(c => `<span class="truncate max-w-[9rem]">${escapeHtml(c)}</span>`).join(arrow)}${more > 0 ? `<span class="text-slate-400">+${more}</span>` : ""}</p>`;
}

function tripMemberAvatarsHtml(members) {
  const known = getAllKnownTravelers();
  return members.slice(0, 4).map(m => {
    const uid = m.uid || m.id;
    const fresh = known.find(t => t.uid === uid) || (currentUser && uid === currentUser.uid ? userProfile : null);
    const person = { displayName: m.name, avatarColor: m.avatarColor, photo: fresh ? fresh.photo : "" };
    return `<span class="ring-2 ring-white rounded-full" title="${escapeHtml(m.name || "Reisende")}">${socialAvatarHtml(person, "w-6 h-6 text-[9px]", "#0d9488")}</span>`;
  }).join("");
}

export function switchTripManagerTab(tabName) {
  currentTripManagerTab = ["all", "mine", "shared"].includes(tabName) ? tabName : "all";
  document.querySelectorAll(".trip-filter-tab").forEach(btn => {
    const active = btn.id === `trip-tab-btn-${currentTripManagerTab}`;
    btn.classList.toggle("border-slate-900", active);
    btn.classList.toggle("text-slate-900", active);
    btn.classList.toggle("border-transparent", !active);
    btn.classList.toggle("text-slate-500", !active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  renderTripManagerList();
}

export function renderTripManagerList() {
  allTrips.forEach(t => ensureTripCollaborationFields(t));

  const mineTrips = allTrips.filter(t => isTripOwnedByCurrentUser(t));
  const sharedTrips = allTrips.filter(t => !isTripOwnedByCurrentUser(t));

  [["sidebar-trips-count-badge", allTrips.length], ["header-trip-count-badge", allTrips.length],
   ["header-trip-count-badge-mobile", allTrips.length], ["trip-tab-count-all", allTrips.length],
   ["trip-tab-count-mine", mineTrips.length], ["trip-tab-count-shared", sharedTrips.length]
  ].forEach(([id, n]) => { const el = document.getElementById(id); if (el) el.textContent = n; });

  const container = document.getElementById("trip-manager-list");
  if (!container) return;

  const displayList = currentTripManagerTab === "shared" ? sharedTrips
    : currentTripManagerTab === "mine" ? mineTrips
    : allTrips.slice().sort((a, b) => (b.id === activeTripId) - (a.id === activeTripId));

  if (displayList.length === 0) {
    const shared = currentTripManagerTab === "shared";
    container.innerHTML = `
      <div class="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <div class="mx-auto w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
          <i data-lucide="${shared ? "users" : "map"}" class="w-5 h-5"></i>
        </div>
        <p class="text-sm font-semibold text-slate-900">${shared ? "Ingen har delt en reise med deg ennå" : "Du har ingen egne reiser ennå"}</p>
        <p class="text-sm text-slate-500 mt-1 max-w-sm mx-auto">${shared
          ? "Når noen deler en reise med deg, eller du blir med via en kode, dukker den opp her."
          : "Start en ny reise for å planlegge stopp, tog og pakkeliste."}</p>
        <button type="button" onclick="${shared ? "focusJoinTripInput()" : "newTripFromPage()"}" class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg ${shared ? "border border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-slate-900 hover:bg-slate-800 text-white"} text-sm font-semibold transition">
          ${shared ? "Bli med via kode" : "Ny reise"}
        </button>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const myUid = currentUser ? currentUser.uid : userProfile.uid;
  container.innerHTML = displayList.map((tripItem) => {
    const id = tripItem.id;
    const isActive = id === activeTripId;
    const owned = isTripOwnedByCurrentUser(tripItem);
    const editable = canEditTrip(tripItem);
    const isShared = tripItem.visibility === "shared";
    const members = Array.isArray(tripItem.members) ? tripItem.members : [];
    const stopsCount = Array.isArray(tripItem.stops) ? tripItem.stops.length : 0;
    const trainsCount = Array.isArray(tripItem.trains) ? tripItem.trains.length : 0;
    const passDays = Number(tripItem.trip && tripItem.trip.totalPassDays) || 0;
    const ownerName = (tripItem.owner && tripItem.owner.name) || "Ukjent";
    const others = members.filter(m => (m.uid || m.id) !== myUid).length;

    let status;
    if (!owned) {
      status = `<i data-lucide="users" class="w-3.5 h-3.5"></i><span>Delt av ${escapeHtml(ownerName)}${editable ? "" : " · kun visning"}</span>`;
    } else if (isShared) {
      status = `<i data-lucide="users" class="w-3.5 h-3.5"></i><span>Delt${tripItem.sharePermission === "view" ? " · kun visning" : ""}</span>`;
    } else {
      status = `<i data-lucide="lock" class="w-3.5 h-3.5"></i><span>Privat</span>`;
    }

    const peopleText = !owned
      ? (members.length > 1 ? `${members.length} i reisefølget` : "")
      : others > 0 ? `Du og ${others} til` : "Bare deg";

    const menuItems = [
      editable ? `<button type="button" role="menuitem" onclick="renameTripInManager(${jsArg(id)})" class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50"><i data-lucide="pencil" class="w-4 h-4 text-slate-400"></i><span>Endre navn</span></button>` : "",
      owned ? `<button type="button" role="menuitem" onclick="shareTripFromList(${jsArg(id)})" class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50"><i data-lucide="share-2" class="w-4 h-4 text-slate-400"></i><span>Del og tilgang</span></button>` : "",
      `<button type="button" role="menuitem" onclick="closeTripCardMenus(); duplicateTrip(${jsArg(id)})" class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50"><i data-lucide="copy" class="w-4 h-4 text-slate-400"></i><span>Lag en kopi</span></button>`,
      allTrips.length > 1 ? `<div class="my-1 border-t border-slate-100"></div><button type="button" role="menuitem" onclick="deleteTrip(${jsArg(id)})" class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rose-600 hover:bg-rose-50"><i data-lucide="${owned ? "trash-2" : "log-out"}" class="w-4 h-4"></i><span>${owned ? "Slett reise" : "Forlat reise"}</span></button>` : ""
    ].join("");

    return `
      <article class="relative bg-white rounded-2xl border ${isActive ? "border-brand-600/60 ring-1 ring-brand-600/20" : "border-slate-200/90 hover:border-slate-300"} shadow-2xs transition flex flex-col min-w-0">
        <div class="p-5 flex-1 space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-1">
              <div class="flex items-center gap-2 text-xs text-slate-500">
                ${isActive ? `<span class="inline-flex items-center gap-1.5 font-semibold text-brand-700"><span class="w-1.5 h-1.5 rounded-full bg-brand-600"></span>Aktiv reise</span><span class="text-slate-300">·</span>` : ""}
                <span class="inline-flex items-center gap-1 min-w-0 truncate">${status}</span>
              </div>
              <h3 class="text-base font-semibold text-slate-900 leading-snug break-words">${escapeHtml(tripItem.title || "Uten navn")}</h3>
              <p class="text-sm text-slate-500">${escapeHtml(tripDateRangeText(tripItem.trip))}</p>
            </div>
            <div class="relative shrink-0">
              <button type="button" onclick="toggleTripCardMenu(${jsArg(id)}, event)" aria-haspopup="menu" aria-expanded="false" aria-label="Flere valg for ${escapeHtml(tripItem.title || "reisen")}" class="w-8 h-8 -mr-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition">
                <i data-lucide="more-horizontal" class="w-4 h-4"></i>
              </button>
              <div data-trip-menu="${escapeHtml(id)}" role="menu" class="${openTripMenuId === id ? "" : "hidden "}absolute right-0 top-9 w-52 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-30">${menuItems}</div>
            </div>
          </div>
          ${tripRouteHtml(tripItem.stops)}
          <dl class="grid grid-cols-3 gap-2 text-center rounded-xl bg-slate-50 py-2.5">
            <div><dt class="text-[11px] text-slate-500">Stopp</dt><dd class="text-sm font-semibold text-slate-900">${stopsCount}</dd></div>
            <div><dt class="text-[11px] text-slate-500">Togreiser</dt><dd class="text-sm font-semibold text-slate-900">${trainsCount}</dd></div>
            <div><dt class="text-[11px] text-slate-500">Passdager</dt><dd class="text-sm font-semibold text-slate-900">${passDays || "–"}</dd></div>
          </dl>
        </div>
        <div class="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <div class="flex items-center -space-x-1.5 shrink-0">${tripMemberAvatarsHtml(members)}</div>
            <span class="text-xs text-slate-500 truncate">${escapeHtml(peopleText)}</span>
          </div>
          <button type="button" onclick="openTripFromList(${jsArg(id)})" class="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${isActive ? "border border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-slate-900 hover:bg-slate-800 text-white"}">
            <span>${isActive ? "Gå til reisen" : "Åpne"}</span><i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </article>`;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

export async function handleJoinSharedTripByCode(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById("join-trip-code-input");
  const btn = document.getElementById("btn-join-trip-submit");
  const err = document.getElementById("join-trip-error");
  if (!input || !input.value.trim()) return;
  if (err) err.classList.add("hidden");

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Kobler til …";
  }

  try {
    const ok = await fetchAndJoinSharedTrip(input.value.trim(), false);
    if (ok) {
      input.value = "";
      switchTab("overview");
    } else if (err) {
      err.textContent = "Fant ingen reise med den koden, eller du har ikke tilgang. Sjekk koden og prøv igjen.";
      err.classList.remove("hidden");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Bli med";
    }
  }
}

export function renderShareAndCollabModal() {
  const active = getActiveTripObject();
  if (!active) return;
  ensureTripCollaborationFields(active);
  const owned = isTripOwnedByCurrentUser(active);
  const isShared = active.visibility === "shared";

  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set("share-modal-trip-title", el => { el.textContent = active.title || "reisen"; });
  set("share-visibility-select", el => { el.value = isShared ? "shared" : "private"; el.disabled = !owned; });
  set("share-permission-select", el => { el.value = active.sharePermission === "view" ? "view" : "edit"; el.disabled = !owned || !isShared; });
  set("share-code-badge", el => { el.textContent = active.shareCode || "–"; });
  set("share-url-input", el => { el.value = `${window.location.origin}${window.location.pathname}?trip=${active.id}`; });
  set("share-modal-live-pill", el => {
    el.textContent = isShared ? "Delt" : "Privat";
    el.className = isShared
      ? "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700"
      : "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600";
  });
  document.querySelectorAll("[data-share-owner-only]").forEach(el => el.classList.toggle("hidden", !owned));
  document.querySelectorAll("[data-share-when-shared]").forEach(el => el.classList.toggle("hidden", !isShared));
  set("share-not-owner-note", el => {
    el.classList.toggle("hidden", owned);
    el.textContent = owned ? "" : `Det er ${(active.owner && active.owner.name) || "eieren"} som styrer deling og tilgang for denne reisen.`;
  });
  set("native-share-container", el => el.classList.toggle("hidden", typeof navigator.share !== "function" || !isShared));

  const members = Array.isArray(active.members) ? active.members : [];
  const myUid = currentUser ? currentUser.uid : userProfile.uid;
  const known = getAllKnownTravelers();
  const personOf = (m) => {
    const uid = m.uid || m.id;
    const fresh = (userProfile.friends || []).find(f => f.uid === uid) || known.find(t => t.uid === uid) || (uid === myUid ? userProfile : null);
    return {
      displayName: (fresh && fresh.displayName) || m.name,
      username: (fresh && fresh.username) || m.username || "",
      avatarColor: (fresh && fresh.avatarColor) || m.avatarColor,
      photo: fresh ? fresh.photo : ""
    };
  };

  set("share-modal-friends-picker", el => {
    const friendsList = Array.isArray(userProfile.friends) ? userProfile.friends : [];
    if (friendsList.length === 0) {
      el.innerHTML = `<p class="text-sm text-slate-500">Du har ingen venner på RailSync ennå. <button type="button" onclick="closeModal('modal-share-trip'); switchTab('social'); switchSocialSubTab('discover')" class="font-medium text-slate-900 underline underline-offset-2">Finn reisende</button></p>`;
      return;
    }
    el.innerHTML = friendsList.map(friend => {
      const onTrip = members.some(m => (m.uid || m.id) === friend.uid);
      return `
        <li class="flex items-center justify-between gap-3 py-2.5">
          <button type="button" onclick="openTravelerProfileModal(${jsArg(friend.uid)})" class="flex items-center gap-3 min-w-0 text-left">
            ${socialAvatarHtml(friend, "w-8 h-8 text-[11px]")}
            <span class="min-w-0">
              <span class="block text-sm font-medium text-slate-900 truncate">${escapeHtml(friend.displayName || "Reisende")}</span>
              <span class="block text-xs text-slate-500 truncate">${escapeHtml(friend.username || "")}</span>
            </span>
          </button>
          ${onTrip
            ? `<span class="text-xs text-slate-500 shrink-0">Med på reisen</span>`
            : `<button type="button" onclick="shareActiveTripWithFriend(${jsArg(friend.uid)})" class="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">Legg til</button>`}
        </li>`;
    }).join("");
  });

  set("share-members-list", el => {
    const accountMembers = [];
    members.forEach((m, idx) => { if (m.role === "owner" || isRealUid(m.uid || m.id)) accountMembers.push([m, idx]); });
    el.innerHTML = accountMembers.map(([m, idx]) => {
      const isOwnerRow = m.role === "owner";
      const isMe = (m.uid || m.id) === myUid;
      const uid = m.uid || m.id;
      const roleText = isOwnerRow ? "Eier" : (m.role === "viewer" ? "Kan se" : "Kan redigere");
      const person = personOf(m);
      const control = owned && !isOwnerRow
        ? `<div class="flex items-center gap-1 shrink-0">
             <label class="sr-only" for="member-role-${Number(idx)}">Tilgang for ${escapeHtml(person.displayName || m.name)}</label>
             <select id="member-role-${Number(idx)}" onchange="setTripMemberRole(${Number(idx)}, this.value)" class="text-xs bg-white border border-slate-200 rounded-lg pl-2 pr-7 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600/20">
               <option value="editor" ${m.role !== "viewer" ? "selected" : ""}>Kan redigere</option>
               <option value="viewer" ${m.role === "viewer" ? "selected" : ""}>Kan se</option>
             </select>
             <button type="button" onclick="confirmRemoveTripMember(${Number(idx)})" class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition" aria-label="Fjern ${escapeHtml(m.name)}"><i data-lucide="x" class="w-4 h-4"></i></button>
           </div>`
        : `<span class="text-xs text-slate-500 shrink-0">${roleText}</span>`;
      return `
        <li class="flex items-center justify-between gap-3 py-2.5">
          <div class="flex items-center gap-3 min-w-0 ${!isMe && uid ? "cursor-pointer" : ""}" ${!isMe && uid ? `onclick="openTravelerProfileModal(${jsArg(uid)})"` : ""}>
            ${socialAvatarHtml(person, "w-8 h-8 text-[11px]", "#0d9488")}
            <span class="min-w-0">
              <span class="block text-sm font-medium text-slate-900 truncate">${escapeHtml(person.displayName || "Reisende")}${isMe ? ` <span class="font-normal text-slate-400">(deg)</span>` : ""}</span>
              ${person.username ? `<span class="block text-xs text-slate-500 truncate">${escapeHtml(person.username)}</span>` : ""}
            </span>
          </div>
          ${control}
        </li>`;
    }).join("");
  });

  set("share-guests-list", el => {
    const guests = [];
    members.forEach((m, idx) => { if (m.role !== "owner" && !isRealUid(m.uid || m.id)) guests.push([m, idx]); });
    set("share-guests-empty", e => e.classList.toggle("hidden", guests.length > 0));
    el.innerHTML = guests.map(([m, idx]) => `
      <li class="flex items-center justify-between gap-3 py-2">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-8 h-8 rounded-full border border-dashed border-slate-300 text-slate-500 text-[11px] font-semibold flex items-center justify-center shrink-0">${escapeHtml(getInitials(m.name || "?"))}</span>
          <span class="text-sm text-slate-700 truncate">${escapeHtml(m.name || "Uten navn")}</span>
        </div>
        ${owned ? `<button type="button" onclick="confirmRemoveTripMember(${Number(idx)})" class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition shrink-0" aria-label="Fjern ${escapeHtml(m.name)}"><i data-lucide="x" class="w-4 h-4"></i></button>` : ""}
      </li>`).join("");
  });

  set("share-activity-log", el => {
    const logs = Array.isArray(active.activityLog) ? active.activityLog : [];
    el.innerHTML = logs.length === 0
      ? `<li class="text-slate-400">Ingen endringer ennå.</li>`
      : logs.slice(0, 8).map(item => `<li><span class="font-medium text-slate-700">${escapeHtml(item.by || "Reisende")}</span> ${escapeHtml(item.text || "")}</li>`).join("");
  });

  if (window.lucide) lucide.createIcons();
}

export async function handleUpdateTripSharingSettings() {
  const active = getActiveTripObject();
  if (!active) return;
  if (!requireTripOwner(active)) {
    renderShareAndCollabModal();
    return;
  }

  const visSelect = document.getElementById("share-visibility-select");
  const permSelect = document.getElementById("share-permission-select");

  const previousPermission = active.sharePermission;
  if (visSelect) active.visibility = visSelect.value;
  if (permSelect) active.sharePermission = permSelect.value;
  // «Alle i reisefølget kan …» gjelder alle som er med nå, ikke bare nye
  if (active.sharePermission !== previousPermission) {
    (active.members || []).forEach(m => {
      if (m.role !== "owner") m.role = active.sharePermission === "view" ? "viewer" : "editor";
    });
  }

  persistState(`Endret delingsinnstillinger (${active.visibility === 'shared' ? 'Delt' : 'Privat'}, ${active.sharePermission === 'edit' ? 'Kan redigere' : 'Kun visning'})`);
  await pushTripMembershipToFirestore(active);
  if (active.visibility === "shared") {
    subscribeToActiveSharedTrip();
  }
  renderShareAndCollabModal();
  renderAll();
  showToast("Tilgang oppdatert", active.visibility === "shared"
    ? (active.sharePermission === "view" ? "Reisefølget kan se reisen, men ikke endre den." : "Reisefølget kan se og endre reisen.")
    : "Reisen er privat. Bare du ser den.", "shield-check");
}

export async function copyShareCodeOnly() {
  const active = getActiveTripObject();
  if (!active) return;
  const code = active.shareCode;
  await copyToClipboardFallback(code);
  showToast("Reisekode kopiert!", `Koden ${code} kan limes inn under «Bli med (Kode)».`, "check");
}

export function handleAddTripMember(e) {
  if (e && e.preventDefault) e.preventDefault();
  const active = getActiveTripObject();
  if (!active) return;
  if (!requireTripOwner(active)) return;

  const nameInput = document.getElementById("new-member-name");
  const roleSelect = document.getElementById("new-member-role");
  if (!nameInput || !nameInput.value.trim()) return;

  const name = nameInput.value.trim().slice(0, 60);
  const role = "guest";
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
  pushTripMembershipToFirestore(active);
  renderShareAndCollabModal();
  renderAll();
  showToast("Navn lagt til", `${name} står nå i reisefølget. Legg til som venn for å gi tilgang til selve reisen.`, "users");
}

export function setTripMemberRole(idx, role) {
  const active = getActiveTripObject();
  if (!active || !Array.isArray(active.members) || !active.members[idx]) return;
  if (!requireTripOwner(active)) return;
  const member = active.members[idx];
  if (member.role === "owner") return;
  member.role = role === "viewer" ? "viewer" : "editor";
  persistState(`Endret tilgang for ${member.name}`);
  pushTripMembershipToFirestore(active);
  renderShareAndCollabModal();
  renderAll();
}

export async function confirmRemoveTripMember(idx) {
  const active = getActiveTripObject();
  if (!active || !Array.isArray(active.members) || !active.members[idx]) return;
  const m = active.members[idx];
  const hasAccount = isRealUid(m.uid || m.id);
  const ok = await showAppDialog({
    title: `Fjerne ${m.name} fra reisen?`,
    message: hasAccount ? `${m.name} mister tilgangen til reisen.` : "Navnet fjernes fra reisefølget.",
    confirmLabel: "Fjern",
    danger: true
  });
  if (ok) removeTripMember(idx);
}

export function toggleTripMemberRole(idx) {
  const active = getActiveTripObject();
  if (!active || !Array.isArray(active.members) || !active.members[idx]) return;
  if (!requireTripOwner(active)) return;
  const member = active.members[idx];
  if (member.role === "owner") return;
  member.role = member.role === "viewer" ? "editor" : "viewer";
  persistState(`Endret tilgang for ${member.name}`);
  pushTripMembershipToFirestore(active);
  renderShareAndCollabModal();
  renderAll();
}

export function removeTripMember(idx) {
  const active = getActiveTripObject();
  if (!active || !Array.isArray(active.members) || !active.members[idx]) return;
  if (!requireTripOwner(active)) return;
  if (active.members[idx].role === "owner") return;
  const removed = active.members.splice(idx, 1)[0];
  persistState(`Fjernet ${removed.name} fra reisefølget`);
  pushTripMembershipToFirestore(active);
  renderShareAndCollabModal();
  renderAll();
}

// =============================================================================
// USER PROFILE MODAL HANDLERS
// =============================================================================
async function loadOwnCoverFromCloud(uid) {
  if (!isCloudReady()) return;
  try {
    const snap = await getDoc(doc(db, "profileMedia", uid));
    const cover = snap.exists() ? snap.data().cover : "";
    userCover = isSafePhotoDataUrl(cover, MAX_COVER_CHARS) ? cover : "";
    try {
      if (userCover) localStorage.setItem("railsync_cover_v1", userCover);
      else localStorage.removeItem("railsync_cover_v1");
    } catch (e) {}
  } catch (e) {
    console.warn("Kunne ikke hente bakgrunnsbilde:", e);
  }
}

async function fetchCoverForUser(uid) {
  if (!uid || !isCloudReady() || isExampleTravelerUid(uid)) return "";
  if (currentUser && uid === currentUser.uid) return userCover;
  try {
    const snap = await getDoc(doc(db, "profileMedia", uid));
    const cover = snap.exists() ? snap.data().cover : "";
    return isSafePhotoDataUrl(cover, MAX_COVER_CHARS) ? cover : "";
  } catch (e) {
    return "";
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type || "")) return reject(new Error("type"));
    if (file.size > 20 * 1024 * 1024) return reject(new Error("size"));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, release: () => URL.revokeObjectURL(url) });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
    img.src = url;
  });
}

// Beskjærer midt i bildet til ønsket format og komprimerer til JPEG under maks størrelse
function renderCroppedJpeg(img, outW, outH, maxChars) {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) throw new Error("decode");
  const ratio = outW / outH;
  let sw = srcW, sh = srcH, sx = 0, sy = 0;
  if (srcW / srcH > ratio) { sw = srcH * ratio; sx = (srcW - sw) / 2; }
  else { sh = srcW / ratio; sy = (srcH - sh) / 2; }

  let width = Math.max(1, Math.round(Math.min(outW, sw)));
  for (let attempt = 0; attempt < 4; attempt++) {
    const height = Math.max(1, Math.round(width / ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
    for (const q of [0.86, 0.78, 0.7, 0.6, 0.5]) {
      const data = canvas.toDataURL("image/jpeg", q);
      if (data.length <= maxChars) return data;
    }
    width = Math.round(width * 0.75);
  }
  throw new Error("too-big");
}

function setProfileMediaStatus(text) {
  const el = document.getElementById("profile-media-status");
  if (el) el.textContent = text || "";
}

export function triggerProfileImagePicker(kind) {
  const input = document.getElementById(kind === "cover" ? "profile-cover-input" : "profile-photo-input");
  if (input) input.click();
}

async function saveProfileCover(dataUrl) {
  userCover = dataUrl || "";
  try {
    if (userCover) localStorage.setItem("railsync_cover_v1", userCover);
    else localStorage.removeItem("railsync_cover_v1");
  } catch (e) {}
  if (!isCloudReady()) return false;
  try {
    await setDoc(doc(db, "profileMedia", currentUser.uid), { cover: userCover, updatedAt: new Date().toISOString() });
    return true;
  } catch (e) {
    console.warn("Kunne ikke lagre bakgrunnsbilde:", e);
    return false;
  }
}

function refreshProfileMediaEverywhere() {
  renderProfileMediaPreviews();
  updateAuthUI(currentUser);
  renderSocialHub();
}

export async function handleProfileImageSelected(kind, input) {
  const file = input && input.files && input.files[0];
  if (input) input.value = "";
  if (!file) return;
  const isCover = kind === "cover";
  setProfileMediaStatus(isCover ? "Behandler bakgrunnsbildet …" : "Behandler profilbildet …");

  let dataUrl;
  try {
    const { img, release } = await loadImageFromFile(file);
    try {
      dataUrl = isCover
        ? renderCroppedJpeg(img, 1500, 500, MAX_COVER_CHARS)
        : renderCroppedJpeg(img, 320, 320, MAX_PHOTO_CHARS);
    } finally {
      release();
    }
  } catch (err) {
    const reason = err && err.message;
    const msg = reason === "type" ? "Velg en bildefil, for eksempel JPG, PNG eller WebP."
      : reason === "size" ? "Bildet er for stort. Velg et bilde under 20 MB."
      : "Kunne ikke lese bildet. Prøv et annet bilde, for eksempel i JPG-format.";
    setProfileMediaStatus("");
    showToast("Bildet ble ikke lagt til", msg, "alert-triangle");
    return;
  }

  let saved;
  if (isCover) {
    saved = await saveProfileCover(dataUrl);
  } else {
    userProfile.photo = dataUrl;
    saved = await saveUserProfileEverywhere();
  }
  refreshProfileMediaEverywhere();
  setProfileMediaStatus("");
  if (saved) {
    showToast(isCover ? "Bakgrunnsbildet er oppdatert" : "Profilbildet er oppdatert", "Endringen vises nå for andre reisende.", "check");
  } else {
    showToast("Kunne ikke lagre bildet", "Bildet vises her, men ble ikke lagret på kontoen. Prøv igjen om litt.", "alert-triangle");
  }
}

export async function removeProfileImage(kind) {
  let saved;
  if (kind === "cover") {
    saved = await saveProfileCover("");
  } else {
    userProfile.photo = "";
    saved = await saveUserProfileEverywhere();
  }
  refreshProfileMediaEverywhere();
  showToast(kind === "cover" ? "Bakgrunnsbildet er fjernet" : "Profilbildet er fjernet", saved ? "Profilen viser standardvisningen igjen." : "Endringen er ikke lagret på kontoen ennå.", saved ? "check" : "alert-triangle");
}

function renderProfileMediaPreviews() {
  const preview = document.getElementById("profile-modal-avatar-preview");
  const colorInput = document.getElementById("profile-avatar-color");
  paintAvatar(preview, {
    displayName: userProfile.displayName || "Reisende",
    avatarColor: (colorInput && colorInput.value) || userProfile.avatarColor,
    photo: userProfile.photo
  });
  const hasPhoto = Boolean(safePhoto(userProfile.photo));
  const removePhoto = document.getElementById("btn-remove-profile-photo");
  if (removePhoto) removePhoto.classList.toggle("hidden", !hasPhoto);
  const colorRow = document.getElementById("profile-color-row");
  if (colorRow) colorRow.classList.toggle("opacity-50", hasPhoto);

  const coverImg = document.getElementById("profile-cover-preview");
  const coverEmpty = document.getElementById("profile-cover-empty");
  const removeCover = document.getElementById("btn-remove-profile-cover");
  const hasCover = isSafePhotoDataUrl(userCover, MAX_COVER_CHARS);
  if (coverImg) {
    if (hasCover) coverImg.src = userCover;
    coverImg.classList.toggle("hidden", !hasCover);
  }
  if (coverEmpty) coverEmpty.classList.toggle("hidden", hasCover);
  if (removeCover) removeCover.classList.toggle("hidden", !hasCover);
}

export function openUserProfileModal() {
  renderUserProfileModal();
  switchTab("account");
}

export function selectProfileColor(color) {
  const safe = safeColor(color, "#0d9488");
  const colorInput = document.getElementById("profile-avatar-color");
  const preview = document.getElementById("profile-modal-avatar-preview");
  if (colorInput) colorInput.value = safe;
  if (preview && !safePhoto(userProfile.photo)) preview.style.backgroundColor = safe;
  document.querySelectorAll("[data-profile-color]").forEach(btn => {
    const selected = btn.getAttribute("data-profile-color") === safe;
    btn.classList.toggle("ring-2", selected);
    btn.classList.toggle("ring-offset-2", selected);
    btn.classList.toggle("ring-slate-900", selected);
    btn.setAttribute("aria-pressed", String(selected));
  });
}

export function updateBioCounter() {
  const bio = document.getElementById("profile-bio");
  const counter = document.getElementById("profile-bio-count");
  if (bio && counter) counter.textContent = `${bio.value.length} / 300`;
}

export function renderUserProfileModal() {
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  setVal("profile-display-name", userProfile.displayName || "");
  setVal("profile-username", String(userProfile.username || "").replace(/^@/, ""));
  setVal("profile-home-station", userProfile.homeStation || "");
  setVal("profile-bio", userProfile.bio || "");
  const passSelect = document.getElementById("profile-pass-type");
  if (passSelect && userProfile.defaultPassType) passSelect.value = userProfile.defaultPassType;

  const color = safeColor(userProfile.avatarColor, "#0d9488");
  selectProfileColor(color);
  renderProfileMediaPreviews();

  updateBioCounter();
  const status = document.getElementById("profile-save-status");
  if (status) status.textContent = "";
  updateAuthUI(currentUser);
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

  const newName = ((nameInput && nameInput.value.trim()) || "Reisende").slice(0, 60);
  let newHandle = normalizeHandle((userInput && userInput.value.trim()) || newName);
  const statusEl = document.getElementById("profile-save-status");
  if (newHandle.length < 2) {
    if (statusEl) { statusEl.textContent = "Brukernavnet må ha minst 2 tegn."; statusEl.className = "text-xs text-rose-600"; }
    if (userInput) userInput.focus();
    return;
  }
  const oldHandle = normalizeHandle(userProfile.username);
  if (newHandle !== oldHandle && isCloudReady()) {
    const claim = await claimUsername(newHandle);
    if (claim !== "ok") {
      if (statusEl) {
        statusEl.textContent = claim === "taken" ? `@${newHandle} er allerede tatt. Velg et annet brukernavn.` : "Kunne ikke sjekke brukernavnet. Prøv igjen.";
        statusEl.className = "text-xs text-rose-600";
      }
      if (userInput) userInput.focus();
      return;
    }
  }
  const releaseOld = newHandle !== oldHandle ? oldHandle : "";
  newHandle = "@" + newHandle;

  userProfile.displayName = newName;
  userProfile.username = newHandle;
  userProfile.homeStation = ((stationInput && stationInput.value.trim()) || "").slice(0, 80);
  userProfile.defaultPassType = passSelect ? passSelect.value : userProfile.defaultPassType;
  userProfile.avatarColor = safeColor(colorInput && colorInput.value, "#0d9488");
  userProfile.bio = ((bioInput && bioInput.value.trim()) || "").slice(0, 300);

  // Update owner/member entry on user's owned trips so their new name & avatar color show everywhere
  allTrips.forEach(t => {
    ensureTripCollaborationFields(t);
    if (isTripOwnedByCurrentUser(t)) {
      t.owner.name = userProfile.displayName;
      t.owner.avatarColor = userProfile.avatarColor;
      const ownerRow = (t.members || []).find(m => m.role === "owner") || (t.members || [])[0];
      if (ownerRow) {
        ownerRow.name = userProfile.displayName;
        ownerRow.avatarColor = userProfile.avatarColor;
        ownerRow.username = userProfile.username;
      }
      if (t._cloudCreated) pushTripMembershipToFirestore(t);
    }
  });

  try {
    localStorage.setItem("railsync_user_profile_v1", JSON.stringify(userProfile));
  } catch (err) {}

  if (currentUser && isFirebaseConfigured()) {
    try {
      await updateProfile(currentUser, { displayName: userProfile.displayName });
    } catch (err) {}
  }

  const publicSaved = await saveUserProfileEverywhere();
  if (publicSaved && releaseOld) releaseUsername(releaseOld);
  saveAllTripsToLocalStorage();
  updateAuthUI(currentUser);
  renderAll();
  renderUserProfileModal();
  const status = document.getElementById("profile-save-status");
  if (status) status.textContent = "Endringene er lagret.";
  showToast("Profilen er lagret", "Endringene vises nå for reisefølget ditt.", "check");
}

// =============================================================================
// 6.6 SOCIAL HUB: REISEPASS, ØNSKELISTE, VENNER & PROFILSØK
// =============================================================================
let currentSocialSubTab = "passport";
let socialDiscoverSearchQuery = "";
let socialDiscoverFilter = "all";
let cloudDirectoryTravelers = [];


export function toggleCountryPickerGrid() {
  const container = document.getElementById("country-picker-grid-container");
  const btnText = document.getElementById("btn-toggle-country-picker-text");
  if (!container) return;
  const isHidden = container.classList.contains("hidden");
  if (isHidden) {
    container.classList.remove("hidden");
    if (btnText) btnText.textContent = "Skjul Europa-liste";
  } else {
    container.classList.add("hidden");
    if (btnText) btnText.textContent = "Velg land fra Europa-liste";
  }
}

export async function toggleVisitedCountry(countryName) {
  ensureSocialProfileFields(userProfile);
  const idx = userProfile.visitedCountries.findIndex(c => c.toLowerCase() === countryName.toLowerCase());
  if (idx !== -1) {
    userProfile.visitedCountries.splice(idx, 1);
    showToast("Land fjernet", `Fjernet ${countryName} fra besøkte land.`, "globe");
  } else {
    userProfile.visitedCountries.push(countryName);
    showToast("Land lagt til!", `${getCountryFlag(countryName)} ${countryName} er nå i reisepasset ditt.`, "check");
  }
  await saveUserProfileEverywhere();
  renderSocialHub();
}

export async function handleAddVisitedPlace(e) {
  if (e && e.preventDefault) e.preventDefault();
  ensureSocialProfileFields(userProfile);

  const cityEl = document.getElementById("visited-place-city");
  const countryEl = document.getElementById("visited-place-country");
  const noteEl = document.getElementById("visited-place-note");
  if (!cityEl || !countryEl) return;

  const city = cityEl.value.trim();
  const country = countryEl.value.trim();
  const note = noteEl ? noteEl.value.trim() : "";
  if (!city || !country) return;

  userProfile.visitedPlaces.unshift({
    id: "vp_" + Date.now(),
    city,
    country,
    note,
    addedAt: new Date().toISOString()
  });

  if (!userProfile.visitedCountries.some(c => c.toLowerCase() === country.toLowerCase())) {
    userProfile.visitedCountries.push(country);
  }

  cityEl.value = "";
  countryEl.value = "";
  if (noteEl) noteEl.value = "";

  await saveUserProfileEverywhere();
  renderSocialHub();
  showToast("Sted lagt til på profilen!", `${getCountryFlag(country)} ${city}, ${country} er lagret i reisepasset ditt.`, "map-pin-check");
}

export async function deleteVisitedPlace(placeId) {
  ensureSocialProfileFields(userProfile);
  userProfile.visitedPlaces = userProfile.visitedPlaces.filter(p => p.id !== placeId);
  await saveUserProfileEverywhere();
  renderSocialHub();
}

export async function handleAddWishlistPlace(e) {
  if (e && e.preventDefault) e.preventDefault();
  ensureSocialProfileFields(userProfile);

  const cityEl = document.getElementById("wishlist-place-city");
  const countryEl = document.getElementById("wishlist-place-country");
  const tagEl = document.getElementById("wishlist-place-tag");
  if (!cityEl || !countryEl) return;

  const city = cityEl.value.trim();
  const country = countryEl.value.trim();
  const tag = tagEl ? tagEl.value : "🔥 Øverst på ønskelista";
  if (!city || !country) return;

  userProfile.wishlistPlaces.unshift({
    id: "wl_" + Date.now(),
    city,
    country,
    tag,
    addedAt: new Date().toISOString()
  });

  cityEl.value = "";
  countryEl.value = "";

  await saveUserProfileEverywhere();
  renderSocialHub();
  showToast("Lagt til ønskelisten!", `✨ ${city}, ${country} vises nå som et drømmemål på profilen din.`, "sparkles");
}

export async function deleteWishlistPlace(placeId) {
  ensureSocialProfileFields(userProfile);
  userProfile.wishlistPlaces = userProfile.wishlistPlaces.filter(p => p.id !== placeId);
  await saveUserProfileEverywhere();
  renderSocialHub();
}

export async function markWishlistPlaceVisited(placeId) {
  ensureSocialProfileFields(userProfile);
  const idx = userProfile.wishlistPlaces.findIndex(p => p.id === placeId);
  if (idx === -1) return;

  const [item] = userProfile.wishlistPlaces.splice(idx, 1);
  userProfile.visitedPlaces.unshift({
    id: "vp_" + Date.now(),
    city: item.city,
    country: item.country,
    note: `${new Date().getFullYear()} – Fullført fra ønskelisten! (${item.tag || 'Drømmemål'})`,
    addedAt: new Date().toISOString()
  });

  if (item.country && !userProfile.visitedCountries.some(c => c.toLowerCase() === item.country.toLowerCase())) {
    userProfile.visitedCountries.push(item.country);
  }

  await saveUserProfileEverywhere();
  renderSocialHub();
  showToast("Flyttet til besøkte steder! 🎉", `${item.city}, ${item.country} er nå stemplet inn i reisepasset ditt.`, "check");
}

export async function addWishlistPlaceToActiveTrip(placeId) {
  if (!requireEditPermission()) return;
  ensureSocialProfileFields(userProfile);
  const item = userProfile.wishlistPlaces.find(p => p.id === placeId);
  if (!item) return;

  // Try matching coordinates from station directory or Nominatim
  const cleanCity = item.city.split(/[,&]/)[0].trim();
  let lat = 47.3769;
  let lng = 8.5417;

  const matchedHub = EUROPEAN_RAIL_STATIONS.find(
    st => st.city.toLowerCase() === cleanCity.toLowerCase() || st.name.toLowerCase().includes(cleanCity.toLowerCase())
  );
  if (matchedHub) {
    lat = matchedHub.lat;
    lng = matchedHub.lng;
  } else {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanCity + ", " + item.country)}&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        lat = parseFloat(data[0].lat);
        lng = parseFloat(data[0].lon);
      }
    } catch (e) {}
  }

  const lastStop = appState.stops[appState.stops.length - 1];
  let arrival = "2026-07-18";
  let departure = "2026-07-21";
  if (lastStop && lastStop.departure) {
    arrival = lastStop.departure;
    const d = new Date(arrival);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 3);
      departure = d.toISOString().split("T")[0];
    }
  }

  appState.stops.push({
    id: "stop-" + Date.now(),
    city: cleanCity,
    country: item.country,
    arrival,
    departure,
    accommodationStatus: "Ser etter hotell",
    accommodationNote: `Hentet fra ønskelisten (${item.tag || 'Drømmemål'})`,
    lat,
    lng,
    order: appState.stops.length + 1
  });

  persistState(`La til drømmemålet ${cleanCity} (${item.country}) i reiseruten`);
  renderAll();
  updateMapLayers();
  showToast("Drømmemål lagt i reiseruten!", `${cleanCity}, ${item.country} er nå lagt til som stopp på "${appState.trip.title}".`, "map-pin");
}

export async function fetchCloudTravelerDirectory() {
  if (!isCloudReady()) return;
  try {
    const snap = await getDocs(query(collection(db, "publicProfiles"), limit(200)));
    const fetched = [];
    const myUid = currentUser.uid;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (!data) return;
      const uid = docSnap.id;
      if (uid === myUid) return;
      if ((data.displayName === "Reisende" || !data.displayName) && (data.username === "@reisende" || !data.username)) {
        return;
      }
      fetched.push(ensureSocialProfileFields({
        ...data,
        avatarColor: safeColor(data.avatarColor, "#2563eb"),
        photo: safePhoto(data.photo),
        uid,
        isCloudUser: true
      }));
    });
    cloudDirectoryTravelers = fetched;
    renderSocialHub();
  } catch (e) {
    console.warn("Kunne ikke hente brukerkatalog fra Firestore:", e);
  }
}

export async function refreshCloudDirectorySearch() {
  if (!requireCloudLogin("søke etter andre reisende")) return;
  await saveUserProfileEverywhere();
  await fetchCloudTravelerDirectory();
  showToast("Brukerkatalog oppdatert", "Profilene er oppdatert.", "users");
}

export function getAllKnownTravelers() {
  const myUid = currentUser ? currentUser.uid : userProfile.uid;
  const myHandle = (userProfile.username || "").toLowerCase();
  const mapByUid = new Map();

  DEFAULT_COMMUNITY_TRAVELERS.forEach(t => {
    mapByUid.set(t.uid, t);
  });

  (userProfile.friends || []).forEach(f => {
    if (f && f.uid && !mapByUid.has(f.uid)) {
      mapByUid.set(f.uid, ensureSocialProfileFields({ ...f }));
    }
  });

  (userProfile.incomingFriendRequests || []).forEach(r => {
    if (r && r.uid && !mapByUid.has(r.uid)) {
      mapByUid.set(r.uid, ensureSocialProfileFields({ ...r }));
    }
  });

  cloudDirectoryTravelers.forEach(c => {
    if (c && c.uid && c.uid !== myUid && (c.username || "").toLowerCase() !== myHandle) {
      mapByUid.set(c.uid, c);
    }
  });

  return Array.from(mapByUid.values());
}

export function getCommonCountriesWithUser(traveler) {
  ensureSocialProfileFields(userProfile);
  const myWishlistCountries = new Set((userProfile.wishlistPlaces || []).map(w => (w.country || "").toLowerCase()).filter(Boolean));
  const myVisitedCountries = new Set((userProfile.visitedCountries || []).map(c => c.toLowerCase()).filter(Boolean));

  const theirWishlist = (traveler.wishlistPlaces || []).map(w => w.country).filter(Boolean);
  const theirVisited = (traveler.visitedCountries || []).filter(Boolean);

  const sharedDreams = Array.from(new Set(theirWishlist.filter(c => myWishlistCountries.has(c.toLowerCase()))));
  const sharedVisited = Array.from(new Set(theirVisited.filter(c => myVisitedCountries.has(c.toLowerCase()))));

  return { sharedDreams, sharedVisited };
}

export function handleSearchTravelersInput(val) {
  socialDiscoverSearchQuery = (val || "").trim();
  renderSocialDiscoverGrid();
}


export function isTravelerFriend(targetUid) {
  ensureSocialProfileFields(userProfile);
  return (userProfile.friends || []).some(f => f.uid === targetUid);
}

export function friendActionLabel(traveler) {
  if (!traveler) return "Legg til venn";
  if (traveler.isCommunityProfile) return "Eksempelprofil";
  if ((userProfile.incomingFriendRequests || []).some(r => r.uid === traveler.uid)) return "Godta venneforespørsel";
  if ((userProfile.outgoingFriendRequests || []).includes(traveler.uid)) return "Forespørsel sendt";
  return "Legg til venn";
}

export async function cancelFriendRequest(targetUid) {
  if (!requireCloudLogin("trekke tilbake forespørsler")) return;
  const myUid = currentUser.uid;
  userProfile.outgoingFriendRequests = (userProfile.outgoingFriendRequests || []).filter(u => u !== targetUid);
  try {
    await deleteDoc(doc(db, "friendRequests", `${myUid}_${targetUid}`));
    showToast("Forespørselen er trukket tilbake", "Den andre ser den ikke lenger.", "undo-2");
  } catch (e) {
    console.warn("Kunne ikke trekke tilbake forespørsel:", e);
    showToast("Noe gikk galt", "Kunne ikke trekke tilbake forespørselen. Prøv igjen.", "alert-triangle");
  }
  renderSocialHub();
  const modalEl = document.getElementById("modal-traveler-profile");
  if (modalEl && !modalEl.classList.contains("hidden")) openTravelerProfileModal(targetUid);
}

export async function addOrAcceptFriend(targetUid) {
  ensureSocialProfileFields(userProfile);
  const allKnown = getAllKnownTravelers();
  const target = allKnown.find(t => t.uid === targetUid) || (userProfile.incomingFriendRequests || []).find(r => r.uid === targetUid);
  if (!target) return;

  if (target.isCommunityProfile || isExampleTravelerUid(target.uid)) {
    showToast("Eksempelprofil", "Dette er en eksempelprofil som viser hvordan RailSync fungerer. Søk opp ekte reisende for å legge til venner.", "info");
    return;
  }
  if (!requireCloudLogin("legge til venner")) return;
  if (isTravelerFriend(target.uid)) return;

  const myUid = currentUser.uid;
  if (target.uid === myUid) return;
  const incoming = (userProfile.incomingFriendRequests || []).find(r => r.uid === target.uid);

  try {
    if (incoming) {
      // Godta: marker forespørselen som godtatt, så avsenderen også får oss som venn
      await updateDoc(doc(db, "friendRequests", `${target.uid}_${myUid}`), {
        status: "accepted",
        acceptedAt: new Date().toISOString(),
        toProfile: myPublicSnippet()
      });
      deleteDoc(doc(db, "friendRequests", `${myUid}_${target.uid}`)).catch(() => {});
      userProfile.incomingFriendRequests = userProfile.incomingFriendRequests.filter(r => r.uid !== target.uid);
      userProfile.friends.unshift({
        uid: target.uid,
        displayName: target.displayName || "Reisende",
        username: target.username || "",
        avatarColor: safeColor(target.avatarColor, "#2563eb"),
        photo: safePhoto(target.photo),
        homeStation: target.homeStation || "",
        addedAt: new Date().toISOString()
      });
      await saveUserProfileEverywhere();
      showToast("Dere er nå venner", `Du og ${target.displayName} kan dele reiser med hverandre.`, "users");
    } else {
      if ((userProfile.outgoingFriendRequests || []).includes(target.uid)) {
        showToast("Allerede sendt", `Venter på at ${target.displayName} godtar forespørselen.`, "clock");
        return;
      }
      await setDoc(doc(db, "friendRequests", `${myUid}_${target.uid}`), {
        from: myUid,
        to: target.uid,
        status: "pending",
        createdAt: new Date().toISOString(),
        fromProfile: myPublicSnippet()
      });
      userProfile.outgoingFriendRequests = [...(userProfile.outgoingFriendRequests || []), target.uid];
      showToast("Venneforespørsel sendt", `${target.displayName} får beskjed og kan godta forespørselen.`, "send");
    }
  } catch (e) {
    console.warn("Venneforespørsel feilet:", e);
    showToast("Noe gikk galt", "Kunne ikke sende venneforespørselen. Prøv igjen.", "alert-triangle");
    return;
  }

  renderSocialHub();
  renderShareAndCollabModal();
  const modalEl = document.getElementById("modal-traveler-profile");
  if (modalEl && !modalEl.classList.contains("hidden")) {
    openTravelerProfileModal(target.uid);
  }
}

export async function declineFriendRequest(targetUid) {
  ensureSocialProfileFields(userProfile);
  userProfile.incomingFriendRequests = (userProfile.incomingFriendRequests || []).filter(r => r.uid !== targetUid);
  if (isCloudReady()) {
    try {
      await deleteDoc(doc(db, "friendRequests", `${targetUid}_${currentUser.uid}`));
    } catch (e) {
      console.warn("Kunne ikke slette venneforespørsel:", e);
    }
  }
  renderSocialHub();
  showToast("Forespørsel fjernet", "Venneforespørselen ble fjernet.", "x");
}

export async function removeFriend(targetUid) {
  ensureSocialProfileFields(userProfile);
  const friend = (userProfile.friends || []).find(f => f.uid === targetUid);
  if (!friend) return;
  const ok = await showAppDialog({
    title: `Fjerne ${friend.displayName} som venn?`,
    message: "Dere blir fjernet fra hverandres vennelister. Reiser dere allerede deler, påvirkes ikke.",
    confirmLabel: "Fjern venn",
    danger: true
  });
  if (!ok) return;

  if (isCloudReady()) {
    const myUid = currentUser.uid;
    await Promise.all([
      deleteDoc(doc(db, "friendRequests", `${myUid}_${targetUid}`)).catch(() => {}),
      deleteDoc(doc(db, "friendRequests", `${targetUid}_${myUid}`)).catch(() => {})
    ]);
  }
  if (legacyFriendUids) legacyFriendUids.delete(targetUid);
  userProfile.friends = (userProfile.friends || []).filter(f => f.uid !== targetUid);
  await saveUserProfileEverywhere();
  renderSocialHub();
  renderShareAndCollabModal();
  const modalEl = document.getElementById("modal-traveler-profile");
  if (modalEl && !modalEl.classList.contains("hidden")) closeModal("modal-traveler-profile");
  showToast("Venn fjernet", `${friend.displayName} er ikke lenger på vennelisten din.`, "user-minus");
}

export async function shareActiveTripWithFriend(friendUid, role = "editor") {
  let active = getActiveTripObject();
  if (!active) return;

  const allKnown = getAllKnownTravelers();
  const friend = (userProfile.friends || []).find(f => f.uid === friendUid) || allKnown.find(t => t.uid === friendUid);
  if (!friend) return;

  if (friend.isCommunityProfile || isExampleTravelerUid(friend.uid)) {
    showToast("Eksempelprofil", "Du kan bare dele reiser med ekte reisevenner.", "info");
    return;
  }
  if (!requireCloudLogin("dele reiser")) return;
  if (!isTravelerFriend(friend.uid)) {
    showToast("Bli venner først", `Send en venneforespørsel til ${friend.displayName}, så kan dere dele reiser når den er godtatt.`, "user-plus");
    return;
  }
  if (!requireTripOwner(active)) return;

  // Eksempelreisen har samme ID for alle – gi den en egen ID før deling
  if (active.id === "eksempel-1") {
    reassignTripId(active);
  }

  active.visibility = "shared";
  if (!Array.isArray(active.members)) active.members = [];

  const alreadyMember = active.members.some(m => (m.uid || m.id) === friend.uid);
  if (!alreadyMember) {
    active.members.push({
      id: friend.uid,
      uid: friend.uid,
      username: friend.username || "",
      name: friend.displayName,
      role: (role === "viewer" || active.sharePermission === "view") ? "viewer" : "editor",
      avatarColor: safeColor(friend.avatarColor, "#2563eb"),
      joinedAt: new Date().toISOString()
    });
  }

  persistState(`Delte reisen med vennen ${friend.displayName} (${friend.username || ''})`);
  await pushTripToFirestore(active);
  await pushTripMembershipToFirestore(active);
  subscribeToActiveSharedTrip();

  renderAll();
  renderShareAndCollabModal();
  const modalEl = document.getElementById("modal-traveler-profile");
  if (modalEl && !modalEl.classList.contains("hidden")) {
    openTravelerProfileModal(friend.uid);
  }
  showToast("Reisen er delt", `${friend.displayName} er lagt til på «${active.title}» og finner den under Reiser.`, "share-2");
}



// ---------------------------------------------------------------------------
// Sosialt: felles hjelpere for profilvisningen (redaksjonelt 2-kolonnedesign)
// All tekst går gjennom escapeHtml, handler-argumenter gjennom jsArg,
// farger gjennom safeColor. Bilder kommer bare fra getPlaceThumbnailUrl.
// ---------------------------------------------------------------------------
function socialAvatarHtml(person, sizeClass = "w-11 h-11 text-sm", fallback = "#2563eb") {
  const name = (person && person.displayName) || "Reisende";
  const photo = safePhoto(person && person.photo);
  if (photo) {
    return `<div class="${sizeClass} rounded-full overflow-hidden shrink-0 bg-slate-100"><img src="${escapeHtml(photo)}" alt="" loading="lazy" class="w-full h-full object-cover"></div>`;
  }
  return `<div class="${sizeClass} rounded-full text-white font-semibold flex items-center justify-center shrink-0" style="background-color: ${safeColor(person && person.avatarColor, fallback)}">${escapeHtml(getInitials(name))}</div>`;
}

function placeThumbHtml(city, country, sizeClass = "w-12 h-12") {
  return `<img src="${escapeHtml(getPlaceThumbnailUrl(city || "", country || ""))}" alt="" loading="lazy" referrerpolicy="no-referrer" class="${sizeClass} rounded-lg object-cover bg-slate-100 shrink-0">`;
}

function isUidOnActiveTrip(uid) {
  const active = getActiveTripObject();
  return Boolean(active && Array.isArray(active.members) && active.members.some(m => (m.uid || m.id) === uid));
}

function firstName(name) {
  return String(name || "Reisende").split(" ")[0];
}

function friendActionButtonHtml(traveler, extraClass = "") {
  if (traveler.isCommunityProfile) {
    return `<span class="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 font-medium text-xs ${extraClass}">Eksempelprofil</span>`;
  }
  const label = friendActionLabel(traveler);
  const pending = label === "Forespørsel sendt";
  if (pending) {
    return `
    <button type="button" onclick="cancelFriendRequest(${jsArg(traveler.uid)})" title="Trekk tilbake forespørselen"
      class="group px-3.5 py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 ${extraClass} border border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600">
      <i data-lucide="clock" class="w-3.5 h-3.5 group-hover:hidden"></i><i data-lucide="x" class="w-3.5 h-3.5 hidden group-hover:block"></i>
      <span class="group-hover:hidden">Forespørsel sendt</span><span class="hidden group-hover:inline">Trekk tilbake</span>
    </button>`;
  }
  return `
    <button type="button" onclick="addOrAcceptFriend(${jsArg(traveler.uid)})"
      class="px-3.5 py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 ${extraClass} bg-slate-900 hover:bg-slate-800 text-white">
      <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
      <span>${escapeHtml(label)}</span>
    </button>`;
}

function shareWithFriendButtonHtml(traveler, extraClass = "") {
  if (isUidOnActiveTrip(traveler.uid)) {
    return `<span class="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-xs flex items-center gap-1.5 ${extraClass}">
      <i data-lucide="check" class="w-3.5 h-3.5"></i><span>Med på aktiv reise</span></span>`;
  }
  return `<button type="button" onclick="shareActiveTripWithFriend(${jsArg(traveler.uid)}, 'editor')" class="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition flex items-center gap-1.5 ${extraClass}">
      <i data-lucide="share-2" class="w-3.5 h-3.5"></i><span>Del aktiv reise</span></button>`;
}

export function handleTopBarTravelerSearch(value) {
  const v = String(value || "");
  const input = document.getElementById("social-user-search-input");
  if (input && input.value !== v) input.value = v;
  socialDiscoverSearchQuery = v.trim();
  if (currentSocialSubTab !== "discover") {
    switchSocialSubTab("discover");
  } else {
    renderSocialDiscoverGrid();
  }
}

export function switchSocialSubTab(subTab) {
  currentSocialSubTab = ["passport", "friends", "discover"].includes(subTab) ? subTab : "passport";
  ["passport", "friends", "discover"].forEach(t => {
    const btn = document.getElementById(`social-subtab-btn-${t}`);
    const panel = document.getElementById(`social-panel-${t}`);
    const isActive = t === currentSocialSubTab;
    if (btn) {
      btn.className = isActive
        ? "py-3.5 text-xs sm:text-sm font-semibold border-b-2 border-brand-600 text-slate-900 transition flex items-center gap-2 whitespace-nowrap"
        : "py-3.5 text-xs sm:text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center gap-2 whitespace-nowrap";
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    }
    if (panel) panel.classList.toggle("hidden", !isActive);
  });

  if (currentSocialSubTab === "discover") {
    fetchCloudTravelerDirectory();
  }
  renderSocialHub();
}

export function setSocialDiscoverFilter(filterType) {
  socialDiscoverFilter = ["all", "match", "cloud"].includes(filterType) ? filterType : "all";
  ["all", "match", "cloud"].forEach(f => {
    const btn = document.getElementById(`discover-filter-${f}`);
    if (!btn) return;
    btn.className = f === socialDiscoverFilter
      ? "px-3 py-1.5 rounded-lg font-semibold bg-slate-900 text-white transition"
      : "px-3 py-1.5 rounded-lg font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition";
  });
  renderSocialDiscoverGrid();
}

export function renderSocialHub() {
  ensureSocialProfileFields(userProfile);
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  const name = userProfile.displayName || "Reisende";
  const username = userProfile.username || "@reisende";
  const station = userProfile.homeStation || "Oslo S";
  const active = getActiveTripObject();

  // 1. Identitet (venstre kort + høyre topp + detaljgrid)
  paintAvatar(document.getElementById("social-hero-avatar"), userProfile, "#0d9488");
  const heroCover = document.getElementById("social-hero-cover");
  if (heroCover) {
    const wanted = isSafePhotoDataUrl(userCover, MAX_COVER_CHARS) ? userCover : DEFAULT_COVER_URL;
    if (heroCover.getAttribute("src") !== wanted) heroCover.setAttribute("src", wanted);
  }
  setText("social-hero-name", name);
  setText("social-detail-name", name);
  setText("social-hero-station", station);
  setText("social-detail-location", station);
  setText("social-hero-username", username);
  setText("spec-username", username);
  setText("spec-home-station", station);
  setText("social-hero-bio", userProfile.bio || "Planlegger togreiser gjennom Europa.");
  setText("social-hero-pass", userProfile.defaultPassType || "Global Pass 7 dager");
  setText("spec-active-trip", active ? (active.title || "Min reise") : "Ingen aktiv reise");

  const heroStatus = document.getElementById("social-hero-status");
  if (heroStatus) {
    heroStatus.textContent = "Synlig for andre reisende";
    heroStatus.className = currentUser ? "text-xs font-medium text-emerald-700" : "text-xs font-medium text-slate-500";
  }

  // 2. Tall og merker
  const visitedCountries = Array.from(new Set(userProfile.visitedCountries || []));
  const visitedPlaces = userProfile.visitedPlaces || [];
  const wishlist = userProfile.wishlistPlaces || [];
  const friends = userProfile.friends || [];
  const requests = userProfile.incomingFriendRequests || [];
  const countryCount = visitedCountries.length;
  const friendsCount = friends.length;
  const pendingReqCount = requests.length;

  setText("social-stat-visited-countries", String(countryCount));
  setText("social-stat-visited-places", String(visitedPlaces.length));
  setText("social-stat-friends", String(friendsCount));
  setText("social-stat-wishlist", `${wishlist.length} reisemål`);
  setText("social-top-friends-count", String(friendsCount));
  setText("social-subtab-friends-badge", pendingReqCount > 0 ? `${friendsCount} · ${pendingReqCount} ny` : String(friendsCount));
  setText("sidebar-social-badge", pendingReqCount > 0 ? `${friendsCount} (+${pendingReqCount})` : `${friendsCount} venner`);
  const mobileReqDot = document.getElementById("mobile-social-req-dot");
  if (mobileReqDot) mobileReqDot.classList.toggle("hidden", pendingReqCount === 0);

  // 3. Venneavatarer på forsidekortet
  const friendAvatars = document.getElementById("social-hero-friend-avatars");
  if (friendAvatars) {
    if (friendsCount === 0) {
      friendAvatars.innerHTML = `<button type="button" onclick="switchSocialSubTab('discover')" class="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-[11px] font-medium transition">Finn reisevenner</button>`;
    } else {
      const known = getAllKnownTravelers();
      friendAvatars.innerHTML = friends.slice(0, 4).map(f => {
        const fresh = known.find(t => t.uid === f.uid) || f;
        const photo = safePhoto(fresh.photo);
        return `
        <button type="button" onclick="openTravelerProfileModal(${jsArg(f.uid)})" title="${escapeHtml(fresh.displayName || "Reisende")}"
          class="w-8 h-8 rounded-full ring-2 ring-white overflow-hidden text-white text-[11px] font-semibold flex items-center justify-center hover:-translate-y-0.5 transition"
          style="background-color: ${safeColor(fresh.avatarColor, "#2563eb")}">${photo ? `<img src="${escapeHtml(photo)}" alt="" class="w-full h-full object-cover">` : escapeHtml(getInitials(fresh.displayName || "Reisende"))}</button>`;
      }).join("") + (friendsCount > 4
        ? `<span class="w-8 h-8 rounded-full ring-2 ring-white bg-white text-slate-800 text-[11px] font-semibold flex items-center justify-center">+${Number(friendsCount - 4)}</span>`
        : "");
    }
  }

  // 4. Venstre kolonne: tidligere steder og ønskeliste
  const leftVisited = document.getElementById("social-left-visited-summary");
  if (leftVisited) {
    leftVisited.innerHTML = visitedPlaces.length === 0
      ? `<p class="text-xs text-slate-400">Ingen steder registrert ennå.</p>`
      : visitedPlaces.slice(0, 3).map(vp => `
        <div class="flex items-center gap-3 min-w-0">
          ${placeThumbHtml(vp.city, vp.country, "w-10 h-10")}
          <div class="min-w-0">
            <p class="text-xs font-semibold text-slate-900 truncate">${escapeHtml(vp.city)}</p>
            <p class="text-[11px] text-slate-500 truncate">${escapeHtml(vp.country)}${vp.note ? ` · ${escapeHtml(vp.note)}` : ""}</p>
          </div>
        </div>`).join("");
  }

  const leftWishlist = document.getElementById("social-left-wishlist-summary");
  if (leftWishlist) {
    leftWishlist.innerHTML = wishlist.length === 0
      ? `<p class="text-xs text-slate-400">Ønskelisten er tom.</p>`
      : wishlist.slice(0, 5).map(w => `
        <div class="flex items-center justify-between gap-3 text-xs">
          <span class="font-medium text-slate-800 truncate">${escapeHtml(w.city)}</span>
          <span class="text-slate-400 shrink-0">${escapeHtml(cleanTagLabel(w.tag))}</span>
        </div>`).join("");
  }

  // 5. Europa-dekning og land
  const pctEurope = Math.min(100, Math.round((countryCount / 33) * 100));
  setText("visited-countries-meter-label", `${countryCount} av 33 land (${pctEurope}%)`);
  const meterBar = document.getElementById("visited-countries-meter-bar");
  if (meterBar) meterBar.style.width = `${pctEurope}%`;

  const chipsContainer = document.getElementById("visited-countries-chips");
  if (chipsContainer) {
    chipsContainer.innerHTML = countryCount === 0
      ? `<p class="text-xs text-slate-400">Ingen land registrert ennå. Trykk «Rediger landliste» for å velge land du har besøkt.</p>`
      : visitedCountries.map(cName => `
        <span class="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-md bg-slate-100 text-slate-800 text-xs font-medium">
          <span>${escapeHtml(cName)}</span>
          <button type="button" onclick="toggleVisitedCountry(${jsArg(cName)})" class="w-5 h-5 rounded text-slate-400 hover:text-rose-600 hover:bg-white transition" title="Fjern ${escapeHtml(cName)}" aria-label="Fjern ${escapeHtml(cName)}">×</button>
        </span>`).join("");
  }

  const pickerGrid = document.getElementById("country-picker-grid");
  if (pickerGrid) {
    pickerGrid.innerHTML = EUROPEAN_INTERRAIL_COUNTRIES.map(c => {
      const isSelected = visitedCountries.some(vc => vc.toLowerCase() === c.name.toLowerCase());
      return `
        <button type="button" onclick="toggleVisitedCountry(${jsArg(c.name)})" aria-pressed="${isSelected ? "true" : "false"}"
          class="px-3 py-2 rounded-lg text-xs font-medium border text-left flex items-center justify-between gap-1.5 transition ${isSelected ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"}">
          <span class="truncate">${escapeHtml(c.name)}</span>
          ${isSelected ? `<i data-lucide="check" class="w-3.5 h-3.5 shrink-0"></i>` : ""}
        </button>`;
    }).join("");
  }

  // 6. Steder jeg har vært og ønskeliste (kort med bilde)
  setText("visited-places-count-badge", String(visitedPlaces.length));
  const vpList = document.getElementById("visited-places-list");
  if (vpList) {
    vpList.innerHTML = visitedPlaces.length === 0
      ? `<p class="text-xs text-slate-400 py-6 text-center">Ingen steder ennå. Legg til byer og stasjoner du har besøkt under.</p>`
      : visitedPlaces.map(vp => `
        <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition">
          ${placeThumbHtml(vp.city, vp.country, "w-14 h-14")}
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-slate-900 truncate">${escapeHtml(vp.city)}</p>
            <p class="text-xs text-slate-500 truncate">${escapeHtml(vp.country)}${vp.note ? ` · ${escapeHtml(vp.note)}` : ""}</p>
          </div>
          <button type="button" onclick="deleteVisitedPlace(${jsArg(vp.id)})" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition shrink-0" title="Fjern sted" aria-label="Fjern ${escapeHtml(vp.city)}">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>`).join("");
  }

  setText("wishlist-places-count-badge", String(wishlist.length));
  const wlList = document.getElementById("wishlist-places-list");
  if (wlList) {
    wlList.innerHTML = wishlist.length === 0
      ? `<p class="text-xs text-slate-400 py-6 text-center">Ønskelisten er tom. Legg til steder og togruter du vil oppleve.</p>`
      : wishlist.map(wl => `
        <div class="p-2 rounded-xl hover:bg-slate-50 transition">
          <div class="flex items-center gap-3">
            ${placeThumbHtml(wl.city, wl.country, "w-14 h-14")}
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-slate-900 truncate">${escapeHtml(wl.city)}</p>
              <p class="text-xs text-slate-500 truncate">${escapeHtml(wl.country)} · ${escapeHtml(cleanTagLabel(wl.tag))}</p>
            </div>
            <button type="button" onclick="deleteWishlistPlace(${jsArg(wl.id)})" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition shrink-0" title="Fjern fra ønskelisten" aria-label="Fjern ${escapeHtml(wl.city)}">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <div class="flex items-center gap-3 pl-[68px] pt-1 text-[11px] font-semibold">
            <button type="button" onclick="addWishlistPlaceToActiveTrip(${jsArg(wl.id)})" class="text-brand-600 hover:text-brand-700">Legg til i aktiv reise</button>
            <span class="text-slate-200">|</span>
            <button type="button" onclick="markWishlistPlaceVisited(${jsArg(wl.id)})" class="text-slate-500 hover:text-slate-800">Merk som besøkt</button>
          </div>
        </div>`).join("");
  }

  // 7. Kontaktforespørsler
  const reqSection = document.getElementById("social-friend-requests-section");
  const reqList = document.getElementById("social-friend-requests-list");
  if (reqSection && reqList) {
    reqSection.classList.toggle("hidden", pendingReqCount === 0);
    setText("social-friend-requests-count", String(pendingReqCount));
    reqList.innerHTML = requests.map(req => `
      <div class="rounded-xl p-3.5 border border-slate-200 flex items-center justify-between gap-3">
        <button type="button" onclick="openTravelerProfileModal(${jsArg(req.uid)})" class="flex items-center gap-3 min-w-0 text-left group">
          ${socialAvatarHtml(req, "w-10 h-10 text-sm", "#f97316")}
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-900 group-hover:text-brand-600 truncate">${escapeHtml(req.displayName || "Reisende")}</p>
            <p class="text-xs text-slate-500 truncate">${escapeHtml(req.username || "")}${req.homeStation ? ` · ${escapeHtml(req.homeStation)}` : ""}</p>
          </div>
        </button>
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" onclick="addOrAcceptFriend(${jsArg(req.uid)})" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition">Godta</button>
          <button type="button" onclick="declineFriendRequest(${jsArg(req.uid)})" class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs transition">Avslå</button>
        </div>
      </div>`).join("");
  }

  // 8. Mine kontakter
  const friendsListEl = document.getElementById("social-friends-list");
  if (friendsListEl) {
    if (friendsCount === 0) {
      friendsListEl.innerHTML = `
        <div class="col-span-full rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-3">
          <p class="text-sm font-semibold text-slate-800">Ingen reisevenner ennå</p>
          <p class="text-xs text-slate-500 max-w-md mx-auto">Søk opp venner på navn eller @brukernavn og send en forespørsel. Når den er godtatt, kan dere dele reiser.</p>
          <button type="button" onclick="switchSocialSubTab('discover')" class="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition">Finn reisende</button>
        </div>`;
    } else {
      const allKnown = getAllKnownTravelers();
      friendsListEl.innerHTML = friends.map(friendItem => {
        const enriched = allKnown.find(t => t.uid === friendItem.uid) || ensureSocialProfileFields({ ...friendItem });
        const { sharedDreams } = getCommonCountriesWithUser(enriched);
        const visitedCount = (enriched.visitedCountries || []).length;
        const wishPreview = (enriched.wishlistPlaces || []).slice(0, 2).map(w => escapeHtml(w.city)).join(", ");
        return `
          <div class="rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 hover:border-slate-300 transition">
            <div class="flex items-start justify-between gap-2">
              <button type="button" onclick="openTravelerProfileModal(${jsArg(enriched.uid)})" class="flex items-center gap-3 min-w-0 text-left group">
                ${socialAvatarHtml(enriched)}
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-900 group-hover:text-brand-600 truncate">${escapeHtml(enriched.displayName || "Reisende")}</p>
                  <p class="text-xs text-slate-500 truncate">${escapeHtml(enriched.username || "")}${enriched.homeStation ? ` · ${escapeHtml(enriched.homeStation)}` : ""}</p>
                </div>
              </button>
              <button type="button" onclick="removeFriend(${jsArg(enriched.uid)})" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition shrink-0" title="Fjern kontakt" aria-label="Fjern ${escapeHtml(enriched.displayName || "kontakt")}">
                <i data-lucide="user-minus" class="w-3.5 h-3.5"></i>
              </button>
            </div>
            <div class="text-xs text-slate-600 space-y-1 border-t border-slate-100 pt-2.5">
              <p class="truncate"><span class="text-slate-400">Besøkt:</span> ${Number(visitedCount)} land</p>
              <p class="truncate"><span class="text-slate-400">Vil til:</span> ${wishPreview || "Ikke oppgitt"}</p>
              ${sharedDreams.length > 0 ? `<p class="truncate text-brand-700"><span class="text-slate-400">Felles ønskemål:</span> ${sharedDreams.map(c => escapeHtml(c)).join(", ")}</p>` : ""}
            </div>
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <button type="button" onclick="openTravelerProfileModal(${jsArg(enriched.uid)})" class="text-xs font-semibold text-slate-600 hover:text-slate-900">Se profil</button>
              ${shareWithFriendButtonHtml(enriched)}
            </div>
          </div>`;
      }).join("");
    }
  }

  // 9. Finn reisende
  renderSocialDiscoverGrid();

  if (window.lucide) lucide.createIcons();
}

export function renderSocialDiscoverGrid() {
  const container = document.getElementById("social-discover-results");
  if (!container) return;

  const q = (socialDiscoverSearchQuery || "").toLowerCase();
  const filtered = getAllKnownTravelers().filter(t => {
    if (socialDiscoverFilter === "cloud" && t.isCommunityProfile) return false;
    const { sharedDreams, sharedVisited } = getCommonCountriesWithUser(t);
    if (socialDiscoverFilter === "match" && sharedDreams.length === 0 && sharedVisited.length === 0) return false;
    if (!q) return true;
    const hay = [
      t.displayName || "", t.username || "", t.homeStation || "", t.bio || "",
      ...(t.visitedCountries || []),
      ...(t.visitedPlaces || []).map(p => `${p.city} ${p.country}`),
      ...(t.wishlistPlaces || []).map(w => `${w.city} ${w.country}`)
    ].join(" ").toLowerCase();
    return hay.includes(q);
  });

  if (filtered.length === 0) {
    const loginHint = !currentUser && socialDiscoverFilter === "cloud";
    container.innerHTML = `
      <div class="col-span-full bg-white rounded-2xl border border-slate-200/90 p-8 text-center space-y-2">
        <p class="text-sm font-semibold text-slate-800">${loginHint ? "Logg inn for å se registrerte reisende" : (q ? `Ingen treff på «${escapeHtml(socialDiscoverSearchQuery)}»` : "Ingen profiler å vise")}</p>
        <p class="text-xs text-slate-500">${loginHint ? "Profiler fra andre brukere vises bare for innloggede." : "Prøv et annet navn, @brukernavn eller land."}</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(t => {
    const isFriend = isTravelerFriend(t.uid);
    const { sharedDreams } = getCommonCountriesWithUser(t);
    const visitedPreview = (t.visitedCountries || []).slice(0, 4).map(c => escapeHtml(c)).join(", ");
    const wishlistPreview = (t.wishlistPlaces || []).slice(0, 3).map(w => escapeHtml(w.city)).join(", ");
    return `
      <div class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition">
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <button type="button" onclick="openTravelerProfileModal(${jsArg(t.uid)})" class="flex items-center gap-3 min-w-0 text-left group">
              ${socialAvatarHtml(t, "w-12 h-12 text-base")}
              <div class="min-w-0">
                <div class="flex items-center flex-wrap gap-1.5">
                  <p class="font-semibold text-slate-900 text-sm sm:text-base group-hover:text-brand-600 transition truncate">${escapeHtml(t.displayName || "Reisende")}</p>
                  ${t.isCommunityProfile ? `<span class="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Eksempel</span>` : ""}
                </div>
                <p class="text-xs text-slate-500 truncate">${escapeHtml(t.username || "@reisende")}${t.homeStation ? ` · ${escapeHtml(t.homeStation)}` : ""}</p>
              </div>
            </button>
            ${isFriend ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">Kontakt</span>` : ""}
          </div>
          <p class="text-xs text-slate-600 line-clamp-2">${escapeHtml(t.bio || "Planlegger togreiser gjennom Europa.")}</p>
          <div class="text-xs text-slate-600 space-y-1 border-t border-slate-100 pt-2.5">
            <p class="truncate"><span class="text-slate-400">Besøkt (${Number((t.visitedCountries || []).length)}):</span> ${visitedPreview || "Ingen registrert"}</p>
            <p class="truncate"><span class="text-slate-400">Vil til:</span> ${wishlistPreview || "Ikke oppgitt"}</p>
            ${sharedDreams.length > 0 ? `<p class="truncate text-brand-700"><span class="text-slate-400">Felles ønskemål:</span> ${sharedDreams.map(c => escapeHtml(c)).join(", ")}</p>` : ""}
          </div>
        </div>
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <button type="button" onclick="openTravelerProfileModal(${jsArg(t.uid)})" class="text-xs font-semibold text-slate-600 hover:text-slate-900">Se profil</button>
          ${isFriend ? shareWithFriendButtonHtml(t) : friendActionButtonHtml(t)}
        </div>
      </div>`;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

export function openTravelerProfileModal(targetUid) {
  const container = document.getElementById("traveler-profile-modal-content");
  if (!container) return;

  const traveler = getAllKnownTravelers().find(t => t.uid === targetUid)
    || (userProfile.friends || []).find(f => f.uid === targetUid)
    || (userProfile.incomingFriendRequests || []).find(r => r.uid === targetUid);
  if (!traveler) {
    showToast("Profil", "Fant ikke profilen til denne reisende ennå.", "user");
    return;
  }

  ensureSocialProfileFields(traveler);
  const isFriend = isTravelerFriend(traveler.uid);
  const first = firstName(traveler.displayName);
  const { sharedDreams, sharedVisited } = getCommonCountriesWithUser(traveler);
  const visitedCountries = traveler.visitedCountries || [];
  const visitedPlaces = traveler.visitedPlaces || [];
  const wishlist = traveler.wishlistPlaces || [];

  container.innerHTML = `
    <div class="relative h-32 sm:h-36 bg-slate-200 overflow-hidden">
      <img id="traveler-modal-cover" src="${escapeHtml(DEFAULT_COVER_URL)}" alt="" class="w-full h-full object-cover">
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950/30 to-transparent"></div>
      <button type="button" onclick="closeModal('modal-traveler-profile')" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-700 flex items-center justify-center transition" aria-label="Lukk">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>
    <div class="px-5 sm:px-6 pb-5 border-b border-slate-100 relative">
      <div class="-mt-9 mb-3 inline-block rounded-full ring-4 ring-white bg-white">
        ${socialAvatarHtml(traveler, "w-[72px] h-[72px] text-xl")}
      </div>
      <div class="flex items-center gap-4">
        <div class="min-w-0 space-y-0.5">
          <div class="flex items-center flex-wrap gap-2">
            <h3 id="traveler-modal-name" class="text-lg sm:text-xl font-bold text-slate-900 truncate">${escapeHtml(traveler.displayName || "Reisende")}</h3>
            ${traveler.isCommunityProfile ? `<span class="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Eksempelprofil</span>` : ""}
            ${isFriend ? `<span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Kontakt</span>` : ""}
          </div>
          <p class="text-xs font-semibold text-brand-600">${escapeHtml(traveler.username || "@reisende")}${traveler.homeStation ? `<span class="text-slate-400 font-medium"> · ${escapeHtml(traveler.homeStation)}</span>` : ""}</p>
          <p class="text-xs sm:text-sm text-slate-600 pt-1">${escapeHtml(traveler.bio || "Planlegger togreiser gjennom Europa.")}</p>
        </div>
      </div>
    </div>

    <div class="p-5 sm:p-6 space-y-5">
      ${(sharedDreams.length > 0 || sharedVisited.length > 0) ? `
        <div class="rounded-xl bg-brand-50/60 border border-brand-100 p-3.5 text-xs space-y-1">
          ${sharedDreams.length > 0 ? `<p class="text-slate-700"><span class="font-semibold text-slate-900">Dere vil begge til:</span> ${sharedDreams.map(c => escapeHtml(c)).join(", ")}</p>` : ""}
          ${sharedVisited.length > 0 ? `<p class="text-slate-600"><span class="font-semibold text-slate-900">Begge har vært i:</span> ${sharedVisited.map(c => escapeHtml(c)).join(", ")}</p>` : ""}
        </div>` : ""}

      <div class="space-y-2.5">
        <div class="flex items-center gap-3">
          <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">Besøkte land (${Number(visitedCountries.length)})</span>
          <div class="h-px bg-slate-100 flex-1"></div>
        </div>
        ${visitedCountries.length === 0 ? `<p class="text-xs text-slate-400">Ingen land registrert.</p>` : `
          <div class="flex flex-wrap gap-1.5">
            ${visitedCountries.map(c => `<span class="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 text-xs font-medium">${escapeHtml(c)}</span>`).join("")}
          </div>`}
        ${visitedPlaces.length > 0 ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            ${visitedPlaces.map(vp => `
              <div class="flex items-center gap-2.5 min-w-0">
                ${placeThumbHtml(vp.city, vp.country, "w-10 h-10")}
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-slate-900 truncate">${escapeHtml(vp.city)}, ${escapeHtml(vp.country)}</p>
                  ${vp.note ? `<p class="text-[11px] text-slate-500 truncate">${escapeHtml(vp.note)}</p>` : ""}
                </div>
              </div>`).join("")}
          </div>` : ""}
      </div>

      <div class="space-y-2.5">
        <div class="flex items-center gap-3">
          <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">Ønskeliste</span>
          <div class="h-px bg-slate-100 flex-1"></div>
        </div>
        ${wishlist.length === 0 ? `<p class="text-xs text-slate-400">Ingen steder på ønskelisten.</p>` : `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${wishlist.map(wl => `
              <div class="flex items-center gap-2.5 min-w-0">
                ${placeThumbHtml(wl.city, wl.country, "w-10 h-10")}
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-slate-900 truncate">${escapeHtml(wl.city)}, ${escapeHtml(wl.country)}</p>
                  <p class="text-[11px] text-slate-500 truncate">${escapeHtml(cleanTagLabel(wl.tag))}</p>
                </div>
              </div>`).join("")}
          </div>`}
      </div>

      <div class="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        ${isFriend
          ? `<span class="text-xs font-semibold text-emerald-700 flex items-center gap-1.5"><i data-lucide="user-check" class="w-4 h-4"></i>Dere er reisevenner</span>`
          : friendActionButtonHtml(traveler)}
        ${isFriend ? shareWithFriendButtonHtml(traveler, "ml-auto") : ""}
      </div>
      ${isFriend ? "" : `<p class="text-[11px] text-slate-400">Når ${escapeHtml(first)} har godtatt forespørselen, kan dere dele reiser.</p>`}
    </div>`;

  openModal("modal-traveler-profile");
  if (window.lucide) lucide.createIcons();

  // Hent bakgrunnsbildet etter at vinduet er åpnet
  fetchCoverForUser(traveler.uid).then(cover => {
    const img = document.getElementById("traveler-modal-cover");
    if (img && cover && document.getElementById("traveler-modal-name")) img.src = cover;
  });
}

export function switchActiveTrip(tripId) {
  if (tripId === activeTripId) return;
  syncStateToActiveTrip();
  activeTripId = tripId;
  syncActiveTripToState();
  syncUrlWithActiveTrip();
  saveAllTripsToLocalStorage();
  subscribeToActiveSharedTrip();
  renderAll();
  updateMapLayers();
  renderTripManagerList();
  showToast("Endret reise", `Byttet til "${appState.trip.title}"`);
}

export function duplicateActiveTripAndCloseModal() {
  closeModal('modal-share-trip');
  closeModal('modal-trip-settings');
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

  const newId = newTripId();
  const baseTitle = source.title ? source.title.replace(/\s*\(Kopi(?:\s*\d+)?\)$/i, "") : "Reise";
  
  // Count how many trips have this base title to number smoothly
  const existingCopies = allTrips.filter(t => t.title && t.title.startsWith(baseTitle)).length;
  const newTitle = existingCopies > 1 ? `${baseTitle} (Kopi ${existingCopies})` : `${baseTitle} (Kopi)`;

  const newTrip = JSON.parse(JSON.stringify(source));
  newTrip.id = newId;
  newTrip.title = newTitle;
  newTrip.visibility = "private";
  newTrip.sharePermission = "edit";
  newTrip.shareCode = generateShareCode();
  delete newTrip._cloudCreated;
  delete newTrip._shareCodeSynced;
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
  closeModal('modal-share-trip');
  closeModal('modal-trip-settings');

  showToast("Kopi laget", `«${newTitle}» er nå den aktive reisen.`, "check");
}

export function createNewTrip() {
  syncStateToActiveTrip();
  const newId = newTripId();
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
    shareCode: generateShareCode(),
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

export async function deleteTrip(tripId) {
  closeTripCardMenus();
  if (allTrips.length <= 1) {
    showToast("Kunne ikke slette", "Du må ha minst én lagret reise.");
    return;
  }

  const target = allTrips.find(t => t.id === tripId);
  const targetTitle = target ? target.title : "denne reisen";

  const ownsTarget = target ? isTripOwnedByCurrentUser(target) : true;
  const sharedWithOthers = ownsTarget && target && (target.memberUids || []).length > 1;
  const ok = await showAppDialog(ownsTarget ? {
    title: `Slette «${targetTitle}»?`,
    message: sharedWithOthers
      ? "Reisen slettes for deg og alle i reisefølget. Dette kan ikke angres."
      : "Reisen slettes fra kontoen din. Dette kan ikke angres.",
    confirmLabel: "Slett reise",
    danger: true
  } : {
    title: `Forlate «${targetTitle}»?`,
    message: "Reisen fjernes fra listen din. Du kan bli med igjen senere hvis du får koden på nytt.",
    confirmLabel: "Forlat reise",
    danger: true
  });
  if (!ok) return;

  if (target && isCloudReady() && target._cloudCreated !== false) {
    removeTripFromCloud(target, ownsTarget);
  }

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
  showToast(ownsTarget ? "Reisen er slettet" : "Du har forlatt reisen", `«${targetTitle}» er fjernet fra listen din.`, "check");
}

async function removeTripFromCloud(tripObj, ownsTrip) {
  try {
    const ref = doc(db, "trips", tripObj.id);
    if (ownsTrip) {
      if (!tripObj._cloudCreated) return;
      await deleteDoc(ref);
      if (tripObj._shareCodeSynced) {
        try { await deleteDoc(doc(db, "shareCodes", tripObj._shareCodeSynced)); } catch (e) {}
      }
    } else {
      const uid = currentUser.uid;
      const remaining = (tripObj.members || []).filter(m => (m.uid || m.id) !== uid);
      await updateDoc(ref, {
        memberUids: arrayRemove(uid),
        editorUids: arrayRemove(uid),
        members: remaining,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn("Kunne ikke fjerne reisen i skyen:", e);
  }
}

export async function renameTripInManager(tripId) {
  closeTripCardMenus();
  const target = allTrips.find(t => t.id === tripId);
  if (!target) return;
  if (!canEditTrip(target)) {
    showToast("Kun lesevisning", "Du kan ikke endre navnet på denne reisen.", "eye");
    return;
  }

  const newTitle = await showAppDialog({
    title: "Endre navn på reisen",
    confirmLabel: "Lagre",
    input: { label: "Navn på reisen", value: target.title || "", maxLength: 80 }
  });
  if (!newTitle) return;
  const clean = newTitle.trim().slice(0, 80);
  if (!clean || clean === target.title) return;

  if (tripId === activeTripId) {
    appState.trip.title = clean;
    persistState(`Endret navn til «${clean}»`);
  } else {
    // Reisen er ikke åpen – lagre den direkte så navnet også kommer på kontoen
    target.title = clean;
    if (!target.trip) target.trip = {};
    target.trip.title = clean;
    target.updatedAt = new Date().toISOString();
    target.lastUpdatedBy = userProfile.displayName || "Reisende";
    saveAllTripsToLocalStorage();
    pushTripToFirestore(target);
  }

  renderAll();
  showToast("Navn oppdatert", `Reisen heter nå «${clean}».`, "check");
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
              onclick="selectSearchResult(${jsArg(cityName)}, ${jsArg(countryName)}, ${Number(lat)}, ${Number(lon)})"
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
  return escapeHtml(String(dateStr));
}

// Trygg verdi for inline-handlere: onclick="fn(${jsArg(id)})"
// JSON-strengen gir en gyldig JS-streng, og escapeHtml hindrer at den bryter ut av attributtet.
function jsArg(value) {
  return escapeHtml(JSON.stringify(value == null ? "" : String(value)));
}

// Bare #RRGGBB godtas i style-attributter (hindrer CSS-injeksjon fra andres profiler)
function safeColor(color, fallback = "#0d9488") {
  return typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

// ---------------------------------------------------------------------------
// Profilbilde og bakgrunnsbilde
// Bildene beskjæres og komprimeres i nettleseren og lagres som JPEG-data-URL.
// Profilbildet ligger i publicProfiles/{uid}.photo, bakgrunnen i profileMedia/{uid}.cover.
// ---------------------------------------------------------------------------
const PHOTO_PREFIX = "data:image/jpeg;base64,";
const MAX_PHOTO_CHARS = 60000;   // ca. 45 kB
const MAX_COVER_CHARS = 320000;  // ca. 240 kB
const DEFAULT_COVER_URL = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80";
let userCover = "";
try { userCover = localStorage.getItem("railsync_cover_v1") || ""; } catch (e) {}

function isSafePhotoDataUrl(value, maxChars = MAX_COVER_CHARS) {
  return typeof value === "string"
    && value.length > PHOTO_PREFIX.length
    && value.length <= maxChars
    && value.startsWith(PHOTO_PREFIX)
    && /^[A-Za-z0-9+/]+={0,2}$/.test(value.slice(PHOTO_PREFIX.length));
}

function safePhoto(value) {
  return isSafePhotoDataUrl(value, MAX_PHOTO_CHARS) ? value : "";
}

// Fyller et avatar-element med profilbilde eller initialer
function paintAvatar(el, person, fallback = "#0d9488") {
  if (!el) return;
  const name = (person && person.displayName) || "Reisende";
  el.style.backgroundColor = safeColor(person && person.avatarColor, fallback);
  el.classList.add("overflow-hidden");
  const photo = safePhoto(person && person.photo);
  if (photo) {
    el.innerHTML = `<img src="${escapeHtml(photo)}" alt="" class="w-full h-full object-cover">`;
  } else {
    el.textContent = getInitials(name);
  }
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
window.focusJoinTripInput = focusJoinTripInput;
window.refreshTripsFromCloud = refreshTripsFromCloud;
window.toggleTripCardMenu = toggleTripCardMenu;
window.closeTripCardMenus = closeTripCardMenus;
window.openTripFromList = openTripFromList;
window.shareTripFromList = shareTripFromList;
window.showAppDialog = showAppDialog;
window.cancelFriendRequest = cancelFriendRequest;
window.setTripMemberRole = setTripMemberRole;
window.confirmRemoveTripMember = confirmRemoveTripMember;
window.applyEditMode = applyEditMode;
window.updateSyncStatus = updateSyncStatus;
window.newTripFromPage = newTripFromPage;
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
window.switchSocialSubTab = switchSocialSubTab;
window.toggleCountryPickerGrid = toggleCountryPickerGrid;
window.toggleVisitedCountry = toggleVisitedCountry;
window.handleAddVisitedPlace = handleAddVisitedPlace;
window.deleteVisitedPlace = deleteVisitedPlace;
window.handleAddWishlistPlace = handleAddWishlistPlace;
window.deleteWishlistPlace = deleteWishlistPlace;
window.markWishlistPlaceVisited = markWishlistPlaceVisited;
window.addWishlistPlaceToActiveTrip = addWishlistPlaceToActiveTrip;
window.fetchCloudTravelerDirectory = fetchCloudTravelerDirectory;
window.refreshCloudDirectorySearch = refreshCloudDirectorySearch;
window.handleSearchTravelersInput = handleSearchTravelersInput;
window.setAuthMode = setAuthMode;
window.togglePasswordVisibility = togglePasswordVisibility;
window.toggleAccountMenu = toggleAccountMenu;
window.closeAccountMenu = closeAccountMenu;
window.updateBioCounter = updateBioCounter;
window.renderUserProfileModal = renderUserProfileModal;
window.triggerProfileImagePicker = triggerProfileImagePicker;
window.handleProfileImageSelected = handleProfileImageSelected;
window.removeProfileImage = removeProfileImage;
window.handleTopBarTravelerSearch = handleTopBarTravelerSearch;
window.setSocialDiscoverFilter = setSocialDiscoverFilter;
window.addOrAcceptFriend = addOrAcceptFriend;
window.declineFriendRequest = declineFriendRequest;
window.removeFriend = removeFriend;
window.shareActiveTripWithFriend = shareActiveTripWithFriend;
window.openTravelerProfileModal = openTravelerProfileModal;
window.renderSocialHub = renderSocialHub;
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
