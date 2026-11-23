// =============================================================================
// 8. MODAL UTILITIES
// =============================================================================
// Mobil: følg det synlige området, som krymper når tastaturet åpnes. Bunnarkene (CSS i index.html)
// bruker --vv-height/--vv-top, så skjemaet og «Lagre»-knappen holder seg over tastaturet.
if (typeof window !== "undefined" && window.visualViewport) {
  const vv = window.visualViewport;
  const syncViewport = () => {
    const root = document.documentElement.style;
    root.setProperty("--vv-height", `${Math.round(vv.height)}px`);
    root.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
  };
  vv.addEventListener("resize", syncViewport);
  vv.addEventListener("scroll", syncViewport);
  syncViewport();
}

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
  const today = todayISO();
  if (dateEl && appState.trip && appState.trip.startDate && appState.trip.endDate && today >= appState.trip.startDate && today <= appState.trip.endDate) dateEl.value = today;
  const errEl = document.getElementById("expense-error");
  if (errEl) errEl.classList.add("hidden");
  setupFxFields("expense", null);
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

// Trygg verdi for inline-handlere: data-onclick="fn(${jsArg(id)})"
// JSON-strengen gir en gyldig JS-streng, og escapeHtml hindrer at den bryter ut av attributtet.
function jsArg(value) {
  return escapeHtml(JSON.stringify(value == null ? "" : String(value)));
}

// Bare #RRGGBB godtas i style-attributter (hindrer CSS-injeksjon fra andres profiler)
function safeColor(color, fallback = "#0b8176") {
  return typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

// Avatarfarger: tidligere valg (teal, oransje, grønn) vises som en litt mørkere variant av samme farge,
// så hvite initialer får nok kontrast (WCAG 4.5:1). Brukerens lagrede valg endres ikke.
const AVATAR_COLOR_UPGRADE = { "#0d9488": "#0b8176", "#f97316": "#c2410c", "#059669": "#047857" };

function avatarColor(color, fallback = "#0b8176") {
  const c = safeColor(color, fallback).toLowerCase();
  return AVATAR_COLOR_UPGRADE[c] || c;
}

// Tekstfarge for initialer på en bakgrunnsfarge: hvit der den gir minst 4.5:1, ellers mørk
function avatarInk(background) {
  const hex = safeColor(background, "#0b8176");
  const lum = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
  return 1.05 / (l + 0.05) >= 4.5 ? "#ffffff" : "#0f172a";
}

// ---------------------------------------------------------------------------
// Profilbilde og bakgrunnsbilde
// Bildene beskjæres og komprimeres i nettleseren og lagres som JPEG-data-URL.
// Profilbildet ligger i publicProfiles/{uid}.photo, bakgrunnen i profileMedia/{uid}.cover.
// ---------------------------------------------------------------------------
const PHOTO_PREFIX = "data:image/jpeg;base64,";
const MAX_PHOTO_CHARS = 60000;   // ca. 45 kB
const MAX_COVER_CHARS = 320000;  // ca. 240 kB
const DEFAULT_COVER_URL = "./assets/img/forside.webp";
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
function paintAvatar(el, person, fallback = "#0b8176") {
  if (!el) return;
  const name = (person && person.displayName) || "Reisende";
  const bg = avatarColor(person && person.avatarColor, fallback);
  el.style.backgroundColor = bg;
  el.style.color = avatarInk(bg);
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

