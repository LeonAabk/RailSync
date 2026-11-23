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
    : "px-4 py-2 rounded-lg bg-fjord-800 hover:bg-fjord-700 text-white text-sm font-semibold transition";

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

export function newTripFromPage() {
  openNewTripPage();
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
    return `<p class="text-sm text-slate-500">Ingen stopp lagt til ennå</p>`;
  }
  const shown = list.slice(0, 4);
  const more = list.length - shown.length;
  const arrow = `<i data-lucide="arrow-right" class="w-3 h-3 text-slate-300 shrink-0"></i>`;
  return `<p class="flex items-center flex-wrap gap-x-1.5 gap-y-1 text-sm text-slate-700">${shown.map(c => `<span class="truncate max-w-[9rem]">${escapeHtml(c)}</span>`).join(arrow)}${more > 0 ? `<span class="text-slate-500">+${more}</span>` : ""}</p>`;
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
        <button type="button" onclick="${shared ? "focusJoinTripInput()" : "newTripFromPage()"}" class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg ${shared ? "border border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-fjord-800 hover:bg-fjord-700 text-white"} text-sm font-semibold transition">
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
    const myPassShort = passShortLabel(getMyPass(tripItem));
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
      `<div class="my-1 border-t border-slate-100"></div><button type="button" role="menuitem" onclick="deleteTrip(${jsArg(id)})" class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rose-600 hover:bg-rose-50"><i data-lucide="${owned ? "trash-2" : "log-out"}" class="w-4 h-4"></i><span>${owned ? "Slett reise" : "Forlat reise"}</span></button>`
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
            <div class="min-w-0"><dt class="text-[11px] text-slate-500">Mitt pass</dt><dd class="text-sm font-semibold text-slate-900 truncate">${escapeHtml(myPassShort)}</dd></div>
          </dl>
        </div>
        <div class="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <div class="flex items-center -space-x-1.5 shrink-0">${tripMemberAvatarsHtml(members)}</div>
            <span class="text-xs text-slate-500 truncate">${escapeHtml(peopleText)}</span>
          </div>
          <button type="button" onclick="openTripFromList(${jsArg(id)})" class="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${isActive ? "border border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-fjord-800 hover:bg-fjord-700 text-white"}">
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
             <button type="button" onclick="confirmRemoveTripMember(${Number(idx)})" class="hit w-9 h-9 sm:w-7 sm:h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition" aria-label="Fjern ${escapeHtml(m.name)}"><i data-lucide="x" class="w-4 h-4"></i></button>
           </div>`
        : `<span class="text-xs text-slate-500 shrink-0">${roleText}</span>`;
      return `
        <li class="flex items-center justify-between gap-3 py-2.5">
          <div class="flex items-center gap-3 min-w-0 ${!isMe && uid ? "cursor-pointer" : ""}" ${!isMe && uid ? `onclick="openTravelerProfileModal(${jsArg(uid)})"` : ""}>
            ${socialAvatarHtml(person, "w-8 h-8 text-[11px]", "#0d9488")}
            <span class="min-w-0">
              <span class="block text-sm font-medium text-slate-900 truncate">${escapeHtml(person.displayName || "Reisende")}${isMe ? ` <span class="font-normal text-slate-500">(deg)</span>` : ""}</span>
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
        ${owned ? `<button type="button" onclick="confirmRemoveTripMember(${Number(idx)})" class="hit w-9 h-9 sm:w-7 sm:h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition shrink-0" aria-label="Fjern ${escapeHtml(m.name)}"><i data-lucide="x" class="w-4 h-4"></i></button>` : ""}
      </li>`).join("");
  });

  set("share-activity-log", el => {
    const logs = Array.isArray(active.activityLog) ? active.activityLog : [];
    el.innerHTML = logs.length === 0
      ? `<li class="text-slate-500">Ingen endringer ennå.</li>`
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

