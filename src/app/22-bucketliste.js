// =============================================================================
// BUCKETLISTE – felles liste over ting reisefølget vil rekke på turen
// =============================================================================
// Ett dokument per punkt: trips/{id}/bucket/{punktId}
//   { id, text, place, createdBy, createdByName, createdAt, updatedAt, done, doneBy, doneByName, doneAt }
// Alle i reisefølget (også «Kun visning») kan legge til og hake av – sjekket av firestore.rules.
// Bare den som la til punktet (eller reiseeieren) kan slette det.
// Skrivinger går gjennom utboksen for felles utgifter (sharedOutbox i 10-budsjett.js, col: "bucket"),
// så de tåler at man er uten nett. Lytteren startes sammen med budsjettlytterne.
// Funksjonene her skal IKKE stå i EDIT_ACTIONS – lesere skal kunne bruke dem.

const BUCKET_MAX_ITEMS = 200;
const BUCKET_TEXT_MAX = 140;
let bucketByTrip = {};          // tripId -> [punkter fra skyen]
let bucketShowDone = true;

function newBucketItemId() {
  const rand = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, "").slice(0, 20) : Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
  return "bk_" + rand;
}

// Bare feltene reglene godtar (fjerner f.eks. _pending fra visningen)
function cleanBucketItem(item) {
  const i = item || {};
  const out = {
    id: String(i.id || ""),
    text: String(i.text || "").trim().slice(0, BUCKET_TEXT_MAX),
    createdBy: String(i.createdBy || ""),
    createdAt: String(i.createdAt || ""),
    done: Boolean(i.done)
  };
  if (i.place) out.place = String(i.place).slice(0, 80);
  if (i.createdByName) out.createdByName = String(i.createdByName).slice(0, 60);
  if (i.updatedAt) out.updatedAt = String(i.updatedAt).slice(0, 40);
  if (i.done) {
    if (i.doneBy) out.doneBy = String(i.doneBy).slice(0, 128);
    if (i.doneByName) out.doneByName = String(i.doneByName).slice(0, 60);
    if (i.doneAt) out.doneAt = String(i.doneAt).slice(0, 40);
  }
  return out;
}

// Ikke gjort først (eldst øverst, i den rekkefølgen de ble lagt til), så gjort (sist gjort øverst)
function sortBucketItems(items) {
  return [...(items || [])].sort((a, b) => {
    if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1;
    if (a.done) return String(b.doneAt || "").localeCompare(String(a.doneAt || ""));
    return String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || String(a.id).localeCompare(String(b.id));
  });
}

function bucketProgress(items) {
  const list = items || [];
  return { done: list.filter(i => i.done).length, total: list.length };
}

// Samme regel som firestore.rules: den som la til, eller reiseeieren
function canDeleteBucketItem(item, uid, ownsTrip) {
  return Boolean(item && uid && (item.createdBy === uid || ownsTrip));
}

// Punkt med ny avhaking (eller fjernet avhaking)
function toggledBucketItem(item, uid, name, nowIso) {
  const next = cleanBucketItem({ ...item, done: !item.done, updatedAt: nowIso });
  if (next.done) {
    next.doneBy = uid;
    if (name) next.doneByName = String(name).slice(0, 60);
    next.doneAt = nowIso;
  }
  return next;
}

// Punktene for en reise: skyen + det som venter i utboksen
function bucketItemsFor(tid) {
  const map = new Map((bucketByTrip[tid] || []).map(i => [i.id, i]));
  (typeof sharedOutbox !== "undefined" ? sharedOutbox : []).filter(o => o.tripId === tid && o.col === "bucket").forEach(o => {
    if (o.op === "delete") map.delete(o.id);
    else map.set(o.id, { ...o.data, _pending: true });
  });
  return sortBucketItems([...map.values()]);
}

function queueBucketOp(op) {
  sharedOutbox = sharedOutbox.filter(o => !(o.tripId === op.tripId && o.id === op.id));
  sharedOutbox.push({ ...op, col: "bucket" });
  saveSharedOutbox();
  refreshBucketViews();
  flushSharedOutbox();
}

// Kalles av lytteren i 10-budsjett.js
function applyRemoteBucket(tid, items) {
  bucketByTrip[tid] = items;
  if (tid === activeTripId) refreshBucketViews();
}

function refreshBucketViews() {
  renderBucketList();
  renderOverviewBucketCard();
  if (typeof window !== "undefined" && window.lucide) lucide.createIcons();
}

function myBucketName() {
  return String((userProfile && userProfile.displayName) || "").slice(0, 60);
}

// ---------------------------------------------------------------- handlinger

export function openBucketList() {
  switchTab("bucket");
}

export function handleAddBucketItem(e) {
  if (e && e.preventDefault) e.preventDefault();
  const active = getActiveTripObject();
  if (!active || !currentUser) return;
  // Reisen må finnes i skyen (eller tilhøre en annen), ellers avviser databasen punktet
  if (!active._cloudCreated && isTripOwnedByCurrentUser(active)) {
    showToast("Ikke lagret ennå", "Reisen er ikke lagret i skyen ennå. Prøv igjen om litt.", "alert-triangle");
    return;
  }
  const form = e && e.target;
  const input = document.getElementById("bucket-text");
  const placeEl = document.getElementById("bucket-place");
  const text = String(input && input.value || "").trim().slice(0, BUCKET_TEXT_MAX);
  if (!text) { if (input) input.focus(); return; }
  if (bucketItemsFor(active.id).length >= BUCKET_MAX_ITEMS) {
    showToast("Listen er full", `En reise kan ha opptil ${BUCKET_MAX_ITEMS} punkter. Slett noen som ikke er aktuelle lenger.`, "alert-triangle");
    return;
  }
  const now = new Date().toISOString();
  const id = newBucketItemId();
  const data = cleanBucketItem({
    id, text,
    place: placeEl ? placeEl.value : "",
    createdBy: currentUser.uid,
    createdByName: myBucketName(),
    createdAt: now,
    updatedAt: now,
    done: false
  });
  if (form && form.reset) form.reset();
  queueBucketOp({ tripId: active.id, id, op: "set", data });
  const again = document.getElementById("bucket-text");
  if (again) again.focus();
}

export function toggleBucketItem(id) {
  const active = getActiveTripObject();
  if (!active || !currentUser) return;
  const item = bucketItemsFor(active.id).find(i => i.id === id);
  if (!item) return;
  queueBucketOp({ tripId: active.id, id, op: "set", data: toggledBucketItem(item, currentUser.uid, myBucketName(), new Date().toISOString()) });
}

export function deleteBucketItem(id) {
  const active = getActiveTripObject();
  if (!active || !currentUser) return;
  const item = bucketItemsFor(active.id).find(i => i.id === id);
  if (!item || !canDeleteBucketItem(item, currentUser.uid, isTripOwnedByCurrentUser(active))) return;
  queueBucketOp({ tripId: active.id, id, op: "delete" });
  showToast("Slettet", `«${item.text}» er fjernet fra bucketlisten.`, "check");
}

export function toggleBucketShowDone() {
  bucketShowDone = !bucketShowDone;
  refreshBucketViews();
}

// ---------------------------------------------------------------- visning

function bucketDoneDate(iso) {
  const d = String(iso || "").slice(0, 10);
  return isIsoDate(d) ? planDateLabel(d, false) : "";
}

function bucketRowHtml(item, uid, ownsTrip) {
  const who = item.createdBy === uid ? "deg" : (item.createdByName || "noen i reisefølget");
  const meta = [];
  if (item.place) meta.push(`<span class="inline-flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3 text-slate-400" aria-hidden="true"></i>${escapeHtml(item.place)}</span>`);
  if (item.done) {
    const by = item.doneBy === uid ? "deg" : (item.doneByName || "");
    const when = bucketDoneDate(item.doneAt);
    meta.push(`Gjort${by ? ` av ${escapeHtml(by)}` : ""}${when ? ` ${escapeHtml(when)}` : ""}`);
  } else {
    meta.push(`Lagt til av ${escapeHtml(who)}`);
  }
  if (item._pending) meta.push("Venter på nett");
  const canDelete = canDeleteBucketItem(item, uid, ownsTrip);
  return `
    <li class="flex items-start gap-3 py-3" data-bucket-id="${escapeHtml(item.id)}">
      <button type="button" data-onclick="toggleBucketItem(${jsArg(item.id)})" role="checkbox" aria-checked="${item.done ? "true" : "false"}" aria-label="${escapeHtml(item.text)}"
        class="hit mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${item.done ? "bg-brand-600 border-brand-600 text-white" : "border-slate-300 hover:border-brand-500 bg-white"}">
        ${item.done ? `<i data-lucide="check" class="w-4 h-4" aria-hidden="true"></i>` : ""}
      </button>
      <div class="min-w-0 flex-1">
        <p class="text-sm sm:text-[15px] break-words ${item.done ? "text-slate-500 line-through" : "text-slate-900"}">${escapeHtml(item.text)}</p>
        <p class="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">${meta.join(`<span aria-hidden="true">·</span>`)}</p>
      </div>
      ${canDelete ? `<button type="button" data-onclick="deleteBucketItem(${jsArg(item.id)})" class="hit w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0 transition" aria-label="Slett ${escapeHtml(item.text)}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ""}
    </li>`;
}

export function renderBucketList() {
  const root = document.getElementById("bucket-list");
  if (!root) return;
  const active = getActiveTripObject();
  const subtitle = document.getElementById("bucket-subtitle");
  const sidebar = document.getElementById("sidebar-bucket-progress");
  if (!active) { root.innerHTML = ""; if (sidebar) sidebar.textContent = ""; return; }
  const uid = currentUser ? currentUser.uid : "";
  const ownsTrip = isTripOwnedByCurrentUser(active);
  const items = bucketItemsFor(active.id);
  const { done, total } = bucketProgress(items);
  if (sidebar) sidebar.textContent = total ? `${done}/${total}` : "";
  if (subtitle) subtitle.textContent = total ? `${done} av ${total} gjort · alle på reisen kan legge til` : "Ting dere vil rekke på turen. Alle på reisen kan legge til.";

  updateBucketPlaceOptions();
  if (!total) {
    root.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs px-5 py-10 text-center">
        <span class="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto" aria-hidden="true"><i data-lucide="flag" class="w-5 h-5"></i></span>
        <p class="text-sm font-medium text-slate-900 mt-3">Bucketlisten er tom</p>
        <p class="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Skriv opp det dere drømmer om å gjøre på turen: en utsikt, en rett dere må smake, en konsert. Alle på reisen ser listen og kan hake av.</p>
      </div>`;
    return;
  }
  const open = items.filter(i => !i.done);
  const doneItems = items.filter(i => i.done);
  const pct = Math.round(done / total * 100);
  root.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs px-4 sm:px-5 py-2">
      <div class="py-3 border-b border-slate-100">
        <div class="flex items-center justify-between text-xs font-semibold text-slate-600">
          <span>${done} av ${total} gjort</span><span class="tabular-nums">${pct} %</span>
        </div>
        <div class="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Andel gjort">
          <div class="h-full rounded-full bg-brand-600" style="width:${pct}%"></div>
        </div>
      </div>
      ${open.length ? `<ul class="divide-y divide-slate-100">${open.map(i => bucketRowHtml(i, uid, ownsTrip)).join("")}</ul>`
        : `<p class="py-4 text-sm text-slate-600">Alt på listen er gjort. Legg til mer, eller nyt resten av turen.</p>`}
      ${doneItems.length ? `
        <div class="border-t border-slate-100">
          <button type="button" data-onclick="toggleBucketShowDone()" aria-expanded="${bucketShowDone ? "true" : "false"}" class="w-full flex items-center justify-between py-3 text-sm font-semibold text-slate-700">
            <span>Gjort (${doneItems.length})</span>
            <i data-lucide="${bucketShowDone ? "chevron-up" : "chevron-down"}" class="w-4 h-4 text-slate-400" aria-hidden="true"></i>
          </button>
          ${bucketShowDone ? `<ul class="divide-y divide-slate-100 border-t border-slate-100">${doneItems.map(i => bucketRowHtml(i, uid, ownsTrip)).join("")}</ul>` : ""}
        </div>` : ""}
    </div>`;
}

// Stedene på ruten i «Sted (valgfritt)». Byttes bare når ruten er endret, så valget ikke nullstilles.
function updateBucketPlaceOptions() {
  const sel = document.getElementById("bucket-place");
  if (!sel) return;
  const places = [];
  (appState.stops || []).forEach(s => { const c = String(s.city || "").trim().slice(0, 80); if (c && !places.includes(c)) places.push(c); });
  const sig = JSON.stringify(places);
  if (sel.dataset.places === sig) return;
  const chosen = sel.value;
  sel.dataset.places = sig;
  sel.innerHTML = `<option value="">Sted (valgfritt)</option>` + places.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  sel.value = places.includes(chosen) ? chosen : "";
  sel.classList.toggle("hidden", places.length === 0);
}

// Snarvei på oversikten (mobilmenyen har ingen egen fane for bucketlisten)
export function renderOverviewBucketCard() {
  const el = document.getElementById("overview-bucket-card");
  if (!el) return;
  const active = getActiveTripObject();
  if (!active) { el.classList.add("hidden"); el.innerHTML = ""; return; }
  el.classList.remove("hidden");
  const items = bucketItemsFor(active.id);
  const { done, total } = bucketProgress(items);
  const open = items.filter(i => !i.done);
  const icon = `<span class="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0" aria-hidden="true"><i data-lucide="flag" class="w-5 h-5"></i></span>`;
  if (!total) {
    el.innerHTML = `
      <button type="button" data-onclick="openBucketList()" class="w-full flex items-center justify-between gap-3 text-left">
        <span class="flex items-center gap-3 min-w-0">
          ${icon}
          <span class="min-w-0">
            <span class="block text-sm sm:text-base font-bold text-slate-900">Bucketliste</span>
            <span class="block text-xs text-slate-500 truncate">Samle det dere vil rekke på turen</span>
          </span>
        </span>
        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 shrink-0"></i>
      </button>`;
    return;
  }
  const next = open.slice(0, 3).map(i => `
    <li class="flex items-center gap-2 min-w-0">
      <span class="w-4 h-4 rounded border-2 border-slate-300 shrink-0" aria-hidden="true"></span>
      <span class="text-sm text-slate-900 truncate">${escapeHtml(i.text)}</span>
      ${i.place ? `<span class="text-xs text-slate-500 shrink-0">${escapeHtml(i.place)}</span>` : ""}
    </li>`).join("");
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        ${icon}
        <div class="min-w-0">
          <h2 class="text-sm sm:text-base font-bold text-slate-900">Bucketliste</h2>
          <p class="text-xs text-slate-500">${done} av ${total} gjort</p>
        </div>
      </div>
      <button type="button" data-onclick="openBucketList()" class="shrink-0 text-xs font-semibold text-slate-700 bg-sand-200 hover:bg-sand-300 px-3 py-1.5 rounded-lg transition">Åpne</button>
    </div>
    ${next ? `<ul class="mt-3 space-y-2">${next}</ul>${open.length > 3 ? `<p class="text-xs text-slate-500 mt-2">+ ${open.length - 3} til</p>` : ""}`
      : `<p class="text-sm text-slate-600 mt-3">Alt på listen er gjort.</p>`}`;
}
