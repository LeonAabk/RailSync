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

// Firebase App Check med Fraud Defense (reCAPTCHA Enterprise): viser Firebase at forespørslene kommer fra
// RailSync-siden, så andre ikke kan bruke databasen med nøklene over. Tom nøkkel = av.
// Dette er den offentlige nettstedsnøkkelen (site key) fra Google Cloud-prosjektet RailSync.
// Registrert i Firebase-konsollen → App Check. Står i overvåkingsmodus til den håndheves der.
const APP_CHECK_SITE_KEY = "6LeUgyMuAAAAACbbsscSec-yVbdHmfxInyWGRR8o";

function startAppCheck(app) {
  if (!APP_CHECK_SITE_KEY) return;
  if (["localhost", "127.0.0.1"].includes(location.hostname)) return;
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js")
    .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
      document.documentElement.classList.add("app-check-on");
    })
    .catch(err => console.warn("App Check ble ikke startet:", err));
}

function isFirebaseConfigured() {
  return firebaseConfig.apiKey && 
         firebaseConfig.apiKey !== "YOUR_API_KEY" && 
         !firebaseConfig.apiKey.includes("YOUR_") &&
         firebaseConfig.projectId !== "YOUR_PROJECT_ID";
}

let db = null;
let auth = null;
export let currentUser = null;

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
    // eslint-disable-next-line no-misleading-character-class -- \u{FE0F} (variantvelger) skal fjernes alene, med vilje
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

// Eksempelprofiler er fjernet – bare ekte kontoer vises
export const DEFAULT_COMMUNITY_TRAVELERS = [];

export let userProfile = {
  uid: "local_user",
  displayName: "Reisende",
  username: "@reisende",
  avatarColor: "#0d9488",
  homeStation: "",
  defaultPassType: "",
  bio: "",
  visitedCountries: [],
  visitedPlaces: [],
  wishlistPlaces: [],
  friends: [],
  incomingFriendRequests: [],
  outgoingFriendRequests: []
};

// Eldre versjoner fylte profilen med standardtekst. Er bio-en fortsatt standard, er profilen aldri fylt ut.
function cleanLegacyProfileDefaults(prof) {
  if (!prof || typeof prof !== "object") return prof;
  if (prof.bio === "Klar for Interrail gjennom Europa!") {
    prof.bio = "";
    if (prof.homeStation === "Oslo S") prof.homeStation = "";
    if (prof.defaultPassType === "Global Pass 7 dager (Ungdom)") prof.defaultPassType = "";
  }
  return prof;
}

export function ensureSocialProfileFields(prof) {
  if (!prof || typeof prof !== "object") return prof;
  cleanLegacyProfileDefaults(prof);
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
          personalBudgetsByTrip = cleanLegacyBudgets({
            ...cloudProf.personalBudgets,
            ...personalBudgetsByTrip
          });
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
    startBudgetListeners();
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
  stopBudgetListeners();
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
  if (!allTrips.some(t => t.id === activeTripId)) activeTripId = allTrips.length ? allTrips[0].id : null;
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
  if (activeTripId === id) activeTripId = allTrips.length ? allTrips[0].id : null;
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
    startAppCheck(app);
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

