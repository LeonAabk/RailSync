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
  if (!active) {
    showToast("Ingen reise valgt", "Lag eller velg en reise først, så kan du dele den.", "info");
    return;
  }
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
    return `<span class="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 font-medium text-xs ${extraClass}">Eksempelprofil</span>`;
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
      class="px-3.5 py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 ${extraClass} bg-fjord-800 hover:bg-fjord-700 text-white">
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
      ? "px-3 py-1.5 rounded-lg font-semibold bg-fjord-800 text-white transition"
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
  const station = userProfile.homeStation || "Ingen hjemstasjon valgt";
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
  setText("social-hero-bio", userProfile.bio || "");
  const bioEl = document.getElementById("social-hero-bio");
  if (bioEl) bioEl.classList.toggle("hidden", !userProfile.bio);
  setText("social-hero-pass", userProfile.defaultPassType || "Ikke valgt");
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
  setText("sidebar-social-badge", pendingReqCount > 0 ? `${friendsCount} (+${pendingReqCount})` : `${friendsCount} ${friendsCount === 1 ? "venn" : "venner"}`);
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
      ? `<p class="text-xs text-slate-500">Ingen steder registrert ennå.</p>`
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
      ? `<p class="text-xs text-slate-500">Ønskelisten er tom.</p>`
      : wishlist.slice(0, 5).map(w => `
        <div class="flex items-center justify-between gap-3 text-xs">
          <span class="font-medium text-slate-800 truncate">${escapeHtml(w.city)}</span>
          <span class="text-slate-500 shrink-0">${escapeHtml(cleanTagLabel(w.tag))}</span>
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
      ? `<p class="text-xs text-slate-500">Ingen land registrert ennå. Trykk «Rediger landliste» for å velge land du har besøkt.</p>`
      : visitedCountries.map(cName => `
        <span class="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-md bg-slate-100 text-slate-800 text-xs font-medium">
          <span>${escapeHtml(cName)}</span>
          <button type="button" onclick="toggleVisitedCountry(${jsArg(cName)})" class="hit w-6 h-6 rounded text-slate-400 hover:text-rose-600 hover:bg-white transition" title="Fjern ${escapeHtml(cName)}" aria-label="Fjern ${escapeHtml(cName)}">×</button>
        </span>`).join("");
  }

  const pickerGrid = document.getElementById("country-picker-grid");
  if (pickerGrid) {
    pickerGrid.innerHTML = EUROPEAN_INTERRAIL_COUNTRIES.map(c => {
      const isSelected = visitedCountries.some(vc => vc.toLowerCase() === c.name.toLowerCase());
      return `
        <button type="button" onclick="toggleVisitedCountry(${jsArg(c.name)})" aria-pressed="${isSelected ? "true" : "false"}"
          class="px-3 py-2 rounded-lg text-xs font-medium border text-left flex items-center justify-between gap-1.5 transition ${isSelected ? "bg-fjord-800 text-white border-fjord-800" : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"}">
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
      ? `<p class="text-xs text-slate-500 py-6 text-center">Ingen steder ennå. Legg til byer og stasjoner du har besøkt under.</p>`
      : visitedPlaces.map(vp => `
        <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition">
          ${placeThumbHtml(vp.city, vp.country, "w-14 h-14")}
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-slate-900 truncate">${escapeHtml(vp.city)}</p>
            <p class="text-xs text-slate-500 truncate">${escapeHtml(vp.country)}${vp.note ? ` · ${escapeHtml(vp.note)}` : ""}</p>
          </div>
          <button type="button" onclick="deleteVisitedPlace(${jsArg(vp.id)})" class="hit p-2 sm:p-1.5 text-slate-500 hover:text-rose-600 rounded-lg transition shrink-0" title="Fjern sted" aria-label="Fjern ${escapeHtml(vp.city)}">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>`).join("");
  }

  setText("wishlist-places-count-badge", String(wishlist.length));
  const wlList = document.getElementById("wishlist-places-list");
  if (wlList) {
    wlList.innerHTML = wishlist.length === 0
      ? `<p class="text-xs text-slate-500 py-6 text-center">Ønskelisten er tom. Legg til steder og togruter du vil oppleve.</p>`
      : wishlist.map(wl => `
        <div class="p-2 rounded-xl hover:bg-slate-50 transition">
          <div class="flex items-center gap-3">
            ${placeThumbHtml(wl.city, wl.country, "w-14 h-14")}
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-slate-900 truncate">${escapeHtml(wl.city)}</p>
              <p class="text-xs text-slate-500 truncate">${escapeHtml(wl.country)} · ${escapeHtml(cleanTagLabel(wl.tag))}</p>
            </div>
            <button type="button" onclick="deleteWishlistPlace(${jsArg(wl.id)})" class="hit p-2 sm:p-1.5 text-slate-500 hover:text-rose-600 rounded-lg transition shrink-0" title="Fjern fra ønskelisten" aria-label="Fjern ${escapeHtml(wl.city)}">
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
          <button type="button" onclick="addOrAcceptFriend(${jsArg(req.uid)})" class="px-3 py-1.5 rounded-lg bg-fjord-800 hover:bg-fjord-700 text-white font-semibold text-xs transition">Godta</button>
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
          <button type="button" onclick="switchSocialSubTab('discover')" class="px-4 py-2 rounded-lg bg-fjord-800 hover:bg-fjord-700 text-white font-semibold text-xs transition">Finn reisende</button>
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
              <button type="button" onclick="removeFriend(${jsArg(enriched.uid)})" class="hit p-2 sm:p-1.5 text-slate-500 hover:text-rose-600 rounded-lg transition shrink-0" title="Fjern kontakt" aria-label="Fjern ${escapeHtml(enriched.displayName || "kontakt")}">
                <i data-lucide="user-minus" class="w-3.5 h-3.5"></i>
              </button>
            </div>
            <div class="text-xs text-slate-600 space-y-1 border-t border-slate-100 pt-2.5">
              <p class="truncate"><span class="text-slate-500">Besøkt:</span> ${Number(visitedCount)} land</p>
              <p class="truncate"><span class="text-slate-500">Vil til:</span> ${wishPreview || "Ikke oppgitt"}</p>
              ${sharedDreams.length > 0 ? `<p class="truncate text-brand-700"><span class="text-slate-500">Felles ønskemål:</span> ${sharedDreams.map(c => escapeHtml(c)).join(", ")}</p>` : ""}
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
            <p class="truncate"><span class="text-slate-500">Besøkt (${Number((t.visitedCountries || []).length)}):</span> ${visitedPreview || "Ingen registrert"}</p>
            <p class="truncate"><span class="text-slate-500">Vil til:</span> ${wishlistPreview || "Ikke oppgitt"}</p>
            ${sharedDreams.length > 0 ? `<p class="truncate text-brand-700"><span class="text-slate-500">Felles ønskemål:</span> ${sharedDreams.map(c => escapeHtml(c)).join(", ")}</p>` : ""}
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
          <p class="text-xs font-semibold text-brand-600">${escapeHtml(traveler.username || "@reisende")}${traveler.homeStation ? `<span class="text-slate-500 font-medium"> · ${escapeHtml(traveler.homeStation)}</span>` : ""}</p>
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
          <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">Besøkte land (${Number(visitedCountries.length)})</span>
          <div class="h-px bg-slate-100 flex-1"></div>
        </div>
        ${visitedCountries.length === 0 ? `<p class="text-xs text-slate-500">Ingen land registrert.</p>` : `
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
          <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">Ønskeliste</span>
          <div class="h-px bg-slate-100 flex-1"></div>
        </div>
        ${wishlist.length === 0 ? `<p class="text-xs text-slate-500">Ingen steder på ønskelisten.</p>` : `
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
      ${isFriend ? "" : `<p class="text-[11px] text-slate-500">Når ${escapeHtml(first)} har godtatt forespørselen, kan dere dele reiser.</p>`}
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

export function createNewTrip(options = {}) {
  syncStateToActiveTrip();
  const newId = newTripId();
  const title = String(options.title || "Ny reise").slice(0, 80);
  const stops = [];
  if (options.startStation) {
    const st = options.startStation;
    stops.push({
      id: "stop-" + Date.now().toString(36),
      city: st.city,
      country: st.country,
      arrival: options.startDate || "",
      departure: options.startDate || "",
      accommodationStatus: "Hjemme / Start",
      accommodationNote: `Starter fra ${st.name}`,
      lat: st.lat,
      lng: st.lng,
      order: 1
    });
  }
  const newTrip = ensureTripCollaborationFields({
    id: newId,
    title,
    visibility: "private",
    sharePermission: "edit",
    shareCode: generateShareCode(),
    createdAt: new Date().toISOString(),
    trip: {
      title,
      startDate: options.startDate || "",
      endDate: options.endDate || "",
      totalPassDays: Math.max(0, Math.min(90, Number(options.passDays) || 0)),
      totalBudget: 0,
      currency: "NOK"
    },
    stops,
    trains: [],
    expenses: [],
    packingList: [],
    dayPlan: []
  });
  allTrips.push(newTrip);
  activeTripId = newId;
  syncActiveTripToState();
  saveAllTripsToLocalStorage();
  if (isCloudReady()) pushTripToFirestore(newTrip);
  renderAll();
  updateMapLayers();
  syncUrlWithActiveTrip();
  return newTrip;
}

export async function deleteTrip(tripId) {
  closeTripCardMenus();

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
    activeTripId = allTrips.length ? allTrips[0].id : null;
  }
  syncActiveTripToState();
  syncUrlWithActiveTrip();
  saveAllTripsToLocalStorage();
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
      // Rydd budsjetter og felles utgifter før selve reisen slettes
      for (const sub of ["budgets", "sharedExpenses"]) {
        try {
          const snap = await getDocs(collection(db, "trips", tripObj.id, sub));
          await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "trips", tripObj.id, sub, d.id)).catch(() => {})));
        } catch (e) { /* ignorer */ }
      }
      await deleteDoc(ref);
      if (tripObj._shareCodeSynced) {
        try { await deleteDoc(doc(db, "shareCodes", tripObj._shareCodeSynced)); } catch (e) {}
      }
    } else {
      const uid = currentUser.uid;
      try { await deleteDoc(doc(db, "trips", tripObj.id, "budgets", uid)); } catch (e) { /* ignorer */ }
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

