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
  const safe = safeColor(color, "#0b8176");
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

  const color = safeColor(userProfile.avatarColor, "#0b8176");
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
  userProfile.avatarColor = safeColor(colorInput && colorInput.value, "#0b8176");
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

