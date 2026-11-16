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

  // Togruter lagret som lister i lister (kunne ikke lagres i skyen) gjøres om
  let migrated = false;
  allTrips.forEach(t => {
    if ((t.trains || []).some(tr => Array.isArray(tr && tr.routeGeometry) && tr.routeGeometry.some(p => Array.isArray(p)))) {
      t.trains = normalizeTrains(t.trains);
      migrated = true;
    }
  });
  // Eksempelreisen er fjernet: urørt slettes, endret beholdes som brukerens egen reise
  const untouchedCopies = allTrips.filter(t => t.id !== "eksempel-1" && isUntouchedExampleTrip(t));
  if (untouchedCopies.length) {
    migrated = true;
    allTrips = allTrips.filter(t => !untouchedCopies.includes(t));
    untouchedCopies.forEach(t => { delete personalBudgetsByTrip[t.id]; });
    savePersonalBudgetsToStorage();
  }
  const example = allTrips.find(t => t.id === "eksempel-1");
  if (example) {
    migrated = true;
    if (isUntouchedExampleTrip(example)) {
      allTrips = allTrips.filter(t => t !== example);
      delete personalBudgetsByTrip["eksempel-1"];
      savePersonalBudgetsToStorage();
      if (activeTripId === "eksempel-1") activeTripId = null;
    } else {
      const wasActive = activeTripId === "eksempel-1";
      reassignTripId(example);
      if (wasActive) activeTripId = example.id;
    }
  }
  if (!allTrips.some(t => t.id === activeTripId)) activeTripId = allTrips.length ? allTrips[0].id : null;
  if (migrated) saveAllTripsToLocalStorage();
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

