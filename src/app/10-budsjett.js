// ---------------------------------------------------------------------------
// Budsjett i reisefølget
// - Hver person: trips/{id}/budgets/{uid} – alle i reisefølget kan se, bare eieren endrer
// - Felles utgifter: trips/{id}/sharedExpenses/{utgiftId} – ett dokument per utgift
// ---------------------------------------------------------------------------
export const EXPENSE_CATEGORIES = [
  { name: "Overnatting", icon: "bed", chip: "bg-violet-50 text-violet-700", bar: "bg-violet-500" },
  { name: "Transport", icon: "train-front", chip: "bg-sky-50 text-sky-700", bar: "bg-sky-500" },
  { name: "Mat", icon: "utensils", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  { name: "Aktiviteter", icon: "ticket", chip: "bg-rose-50 text-rose-700", bar: "bg-rose-500" },
  { name: "Annet", icon: "circle-dot", chip: "bg-slate-100 text-slate-600", bar: "bg-slate-400" }
];

function expenseCategory(name) {
  const n = name === "Mat & Drikke" ? "Mat" : (name || "Annet");
  return EXPENSE_CATEGORIES.find(c => c.name === n) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

function categoryChipHtml(name, size = "w-9 h-9") {
  const c = expenseCategory(name);
  return `<span class="${size} rounded-xl ${c.chip} flex items-center justify-center shrink-0" aria-hidden="true"><i data-lucide="${c.icon}" class="w-4 h-4"></i></span>`;
}

let tripBudgets = {};            // tripId -> { uid -> budsjett }
let sharedExpensesByTrip = {};   // tripId -> [utgifter]
let budgetListenTripId = null;
let budgetUnsub = null;
let sharedExpUnsub = null;
let isApplyingRemoteBudget = false;
let budgetViewMode = "personal";
let budgetViewUid = null;
const budgetPushQueue = new Map();
const pendingBudgetPushes = new Set();
// Pakkelister: egen liste (myPackingByTrip i 04) og de synlige listene til reisefølget
let tripPackingLists = {};       // tripId -> { uid -> pakkeliste } (bare de som ikke er skjult, og min egen)
let packingUnsubs = [];
let isApplyingRemotePacking = false;
let packingViewUid = null;
const packingPushQueue = new Map();
const pendingPackingPushes = new Set();
let sharedOutbox = [];
try { sharedOutbox = JSON.parse(localStorage.getItem("railsync_shared_outbox_v1") || "[]") || []; } catch (e) { sharedOutbox = []; }

function saveSharedOutbox() {
  if (isLoggingOut) return;
  try { localStorage.setItem("railsync_shared_outbox_v1", JSON.stringify(sharedOutbox)); } catch (e) {}
}

function isTripInCloud(t) {
  return Boolean(t && t.id && t.id !== "eksempel-1" && isCloudReady() && (t._cloudCreated || !isTripOwnedByCurrentUser(t)));
}

function budgetContentOf(entry) {
  const e = entry || {};
  const out = {
    totalBudget: Math.max(0, Number(e.totalBudget) || 0),
    expenses: Array.isArray(e.expenses) ? e.expenses : []
  };
  if (Object.prototype.hasOwnProperty.call(e, "pass")) out.pass = normalizePass(e.pass);
  return JSON.parse(JSON.stringify(out));
}

// Tre-veis sammenslåing av eget budsjett og pass (lokalt mot skyen, med forrige felles versjon som base)
function mergeBudgetContent(base, local, remote) {
  const out = {
    totalBudget: local.totalBudget !== base.totalBudget ? local.totalBudget : remote.totalBudget,
    expenses: mergeItemList(base.expenses, local.expenses, remote.expenses)
  };
  const pick = !sameJson(local.pass, base.pass) ? local : remote;
  if (Object.prototype.hasOwnProperty.call(pick, "pass")) out.pass = pick.pass;
  return out;
}

function myUidOrLocal() {
  return currentUser ? currentUser.uid : (userProfile.uid || "local_user");
}

// Lyttere for budsjettene og fellesutgiftene til reisen som er åpen
export function startBudgetListeners() {
  const active = getActiveTripObject();
  const wanted = isTripInCloud(active) ? active.id : null;
  if (wanted === budgetListenTripId) return;
  stopBudgetListeners();
  budgetListenTripId = wanted;
  budgetViewUid = null;
  if (!wanted) return;
  const tid = wanted;
  try {
    budgetUnsub = onSnapshot(collection(db, "trips", tid, "budgets"), (snap) => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data() || {}; });
      tripBudgets[tid] = map;
      applyMyRemoteBudget(tid, map[currentUser.uid] || null);
      if (tid === activeTripId) renderBudget();
    }, (err) => console.warn("Lytter for budsjetter feilet:", err));
    sharedExpUnsub = onSnapshot(collection(db, "trips", tid, "sharedExpenses"), (snap) => {
      sharedExpensesByTrip[tid] = snap.docs.map(d => ({ ...(d.data() || {}), id: d.id }));
      if (tid === activeTripId) renderBudget();
    }, (err) => console.warn("Lytter for felles utgifter feilet:", err));
  } catch (e) {
    console.warn("Kunne ikke starte budsjettlyttere:", e);
  }
  startPackingListeners(tid);
  flushSharedOutbox();
}

function stopBudgetListeners() {
  [budgetUnsub, sharedExpUnsub, ...packingUnsubs].forEach(fn => { if (typeof fn === "function") { try { fn(); } catch (e) {} } });
  budgetUnsub = sharedExpUnsub = null;
  packingUnsubs = [];
  packingViewUid = null;
  budgetListenTripId = null;
}

// --- Pakkelister -------------------------------------------------------------
// Min egen: ett dokument. De andre: bare de som ikke er skjult (sikkerhetsreglene krever filteret).
function startPackingListeners(tid) {
  const uid = currentUser.uid;
  const others = {};
  let mine = null;
  const publish = () => {
    tripPackingLists[tid] = { ...others };
    if (mine) tripPackingLists[tid][uid] = mine; else delete tripPackingLists[tid][uid];
    if (tid === activeTripId) renderPacking();
  };
  try {
    packingUnsubs.push(onSnapshot(doc(db, "trips", tid, "packing", uid), (snap) => {
      mine = snap.exists() ? (snap.data() || {}) : null;
      applyMyRemotePacking(tid, mine);
      publish();
    }, (err) => console.warn("Lytter for egen pakkeliste feilet:", err)));
    packingUnsubs.push(onSnapshot(query(collection(db, "trips", tid, "packing"), where("hidden", "==", false)), (snap) => {
      Object.keys(others).forEach(k => delete others[k]);
      snap.docs.forEach(d => { if (d.id !== uid) others[d.id] = d.data() || {}; });
      publish();
    }, (err) => console.warn("Lytter for reisefølgets pakkelister feilet:", err)));
  } catch (e) {
    console.warn("Kunne ikke starte lyttere for pakkelister:", e);
  }
}

function mergePackingContent(base, local, remote) {
  return {
    items: mergeItemList(base.items, local.items, remote.items),
    hidden: local.hidden !== base.hidden ? local.hidden : remote.hidden
  };
}

// Egen pakkeliste fra skyen: slås sammen med endringer på denne enheten som ikke er sendt ennå
function applyMyRemotePacking(tid, remoteDoc) {
  const t = allTrips.find(x => x.id === tid);
  const entry = myPackingByTrip[tid] || (t ? getMyPackingForTrip(t) : null);
  const local = packingContentOf(entry);
  if (!remoteDoc) {
    // Ikke i skyen ennå: last opp hvis det finnes noe (også den kopierte felles listen)
    if ((local.items.length > 0 || local.hidden) && !pendingPackingPushes.has(tid)) pushMyPacking(tid);
    return;
  }
  const remote = packingContentOf(remoteDoc);
  const base = entry && entry._base ? entry._base : null;
  let next = remote;
  let needsPush = false;
  if (base && !sameJson(local, base) && !sameJson(local, remote)) {
    next = mergePackingContent(base, local, remote);
    needsPush = !sameJson(next, remote);
  }
  myPackingByTrip[tid] = { ...(entry || {}), ...next, _base: remote, updatedAt: remoteDoc.updatedAt || new Date().toISOString() };
  saveMyPackingToStorage();
  if (tid === activeTripId && !sameJson(next.items, appState.packingList)) {
    isApplyingRemotePacking = true;
    try {
      appState.packingList = JSON.parse(JSON.stringify(next.items));
      renderPacking();
      renderOverview();
    } finally {
      isApplyingRemotePacking = false;
    }
  }
  if (needsPush) pushMyPacking(tid);
}

function pushMyPacking(tid) {
  const t = allTrips.find(x => x.id === tid);
  // Bare de som kan redigere reisen har egen pakkeliste i skyen (samme som knappene i appen)
  if (!isTripInCloud(t) || !(isTripOwnedByCurrentUser(t) || canEditTrip(t))) return Promise.resolve(false);
  const prev = packingPushQueue.get(tid) || Promise.resolve();
  const next = prev.catch(() => {}).then(() => pushMyPackingNow(tid));
  packingPushQueue.set(tid, next);
  next.finally(() => { if (packingPushQueue.get(tid) === next) packingPushQueue.delete(tid); });
  return next;
}

async function pushMyPackingNow(tid) {
  if (!isCloudReady()) { pendingPackingPushes.add(tid); updateSyncStatus(); return false; }
  const uid = currentUser.uid;
  const ref = doc(db, "trips", tid, "packing", uid);
  syncInFlight++;
  updateSyncStatus();
  try {
    let result = null;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const entry = myPackingByTrip[tid] || {};
      const local = packingContentOf(entry);
      let content = local;
      if (snap.exists()) {
        const remote = packingContentOf(snap.data());
        const base = entry._base || { items: [], hidden: false };
        if (!sameJson(remote, base)) content = mergePackingContent(base, local, remote);
      }
      tx.set(ref, {
        uid,
        name: String(userProfile.displayName || "Reisende").slice(0, 60),
        items: firestoreSafe(content.items.slice(0, 300)),
        hidden: Boolean(content.hidden),
        updatedAt: new Date().toISOString()
      });
      result = { content, local };
    });
    pendingPackingPushes.delete(tid);
    lastSyncFailed = false;
    const entry = myPackingByTrip[tid] || {};
    entry._base = result.content;
    if (!sameJson(result.content, result.local)) {
      const current = packingContentOf(entry);
      const merged = sameJson(current, result.local) ? result.content : mergePackingContent(result.local, current, result.content);
      Object.assign(entry, merged);
      if (tid === activeTripId) {
        isApplyingRemotePacking = true;
        try {
          appState.packingList = JSON.parse(JSON.stringify(merged.items));
          myPackingByTrip[tid] = entry;
          renderPacking();
        } finally { isApplyingRemotePacking = false; }
      }
    }
    myPackingByTrip[tid] = entry;
    saveMyPackingToStorage();
    return true;
  } catch (e) {
    console.warn("Kunne ikke lagre pakkelisten:", e);
    pendingPackingPushes.add(tid);
    lastSyncFailed = true;
    return false;
  } finally {
    syncInFlight = Math.max(0, syncInFlight - 1);
    updateSyncStatus();
  }
}

export function selectPackingPerson(uid) {
  packingViewUid = uid;
  renderPacking();
}

export function togglePackingHidden() {
  if (!requireEditPermission()) return;
  const active = getActiveTripObject();
  if (!active) return;
  const entry = getMyPackingForTrip(active);
  const hidden = !entry.hidden;
  updateMyPackingForTrip(active.id, appState.packingList, hidden);
  renderPacking();
  showToast(
    hidden ? "Pakkelisten er skjult" : "Pakkelisten er synlig",
    hidden ? "Reisefølget kan ikke se pakkelisten din." : "Reisefølget kan se pakkelisten din og hva du har pakket.",
    hidden ? "eye-off" : "eye"
  );
}

// Eget budsjett fra skyen: slås sammen med endringer på denne enheten som ikke er sendt ennå
function applyMyRemoteBudget(tid, remoteDoc) {
  const entry = personalBudgetsByTrip[tid] || null;
  const local = budgetContentOf(entry);
  if (!remoteDoc) {
    // Ikke i skyen ennå: last opp hvis det finnes noe (også budsjetter fra før denne versjonen)
    const meaningful = local.totalBudget > 0 || local.expenses.length > 0 || Boolean(local.pass);
    if (meaningful && !pendingBudgetPushes.has(tid)) pushMyBudget(tid);
    return;
  }
  const remote = budgetContentOf(remoteDoc);
  const base = entry && entry._base ? entry._base : null;
  let next = remote;
  let needsPush = false;
  if (base && !sameJson(local, base) && !sameJson(local, remote)) {
    next = mergeBudgetContent(base, local, remote);
    needsPush = !sameJson(next, remote);
  }
  const passBefore = entry ? budgetContentOf(entry).pass : undefined;
  personalBudgetsByTrip[tid] = { ...(entry || {}), ...next, _base: remote, updatedAt: remoteDoc.updatedAt || new Date().toISOString() };
  if (!Object.prototype.hasOwnProperty.call(next, "pass") && entry && Object.prototype.hasOwnProperty.call(entry, "pass") && !needsPush) {
    // Skyen har ikke pass, men vi har et lokalt: send det
    needsPush = true;
  }
  const passChanged = !sameJson(passBefore, personalBudgetsByTrip[tid].pass);
  savePersonalBudgetsToStorage();
  const budgetPart = { totalBudget: next.totalBudget, expenses: next.expenses };
  if (tid === activeTripId && passChanged && sameJson(budgetPart, budgetContentOf({ totalBudget: appState.trip.totalBudget, expenses: appState.expenses }))) renderAll();
  if (tid === activeTripId && !sameJson(budgetPart, budgetContentOf({ totalBudget: appState.trip.totalBudget, expenses: appState.expenses }))) {
    isApplyingRemoteBudget = true;
    try {
      appState.trip.totalBudget = next.totalBudget;
      appState.expenses = JSON.parse(JSON.stringify(next.expenses));
      const active = getActiveTripObject();
      if (active) { active.trip.totalBudget = next.totalBudget; active.expenses = JSON.parse(JSON.stringify(next.expenses)); }
      saveAllTripsToLocalStorage();
      renderAll();
    } finally {
      isApplyingRemoteBudget = false;
    }
  }
  if (needsPush) pushMyBudget(tid);
}

function pushMyBudget(tid) {
  const t = allTrips.find(x => x.id === tid);
  if (!isTripInCloud(t)) return Promise.resolve(false);
  const prev = budgetPushQueue.get(tid) || Promise.resolve();
  const next = prev.catch(() => {}).then(() => pushMyBudgetNow(tid));
  budgetPushQueue.set(tid, next);
  next.finally(() => { if (budgetPushQueue.get(tid) === next) budgetPushQueue.delete(tid); });
  return next;
}

async function pushMyBudgetNow(tid) {
  if (!isCloudReady()) { pendingBudgetPushes.add(tid); updateSyncStatus(); return false; }
  const uid = currentUser.uid;
  const ref = doc(db, "trips", tid, "budgets", uid);
  syncInFlight++;
  updateSyncStatus();
  try {
    let result = null;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const entry = personalBudgetsByTrip[tid] || {};
      const local = budgetContentOf(entry);
      let content = local;
      if (snap.exists()) {
        const remote = budgetContentOf(snap.data());
        const base = entry._base || null;
        if (base && !sameJson(remote, base)) {
          content = mergeBudgetContent(base, local, remote);
        } else if (!Object.prototype.hasOwnProperty.call(local, "pass") && Object.prototype.hasOwnProperty.call(remote, "pass")) {
          content = { ...local, pass: remote.pass };
        }
      }
      const payload = {
        uid,
        name: String(userProfile.displayName || "Reisende").slice(0, 60),
        totalBudget: content.totalBudget,
        expenses: firestoreSafe(content.expenses.slice(0, 500)),
        updatedAt: new Date().toISOString()
      };
      if (Object.prototype.hasOwnProperty.call(content, "pass")) payload.pass = content.pass;
      tx.set(ref, payload);
      result = { content, local };
    });
    pendingBudgetPushes.delete(tid);
    lastSyncFailed = false;
    const entry = personalBudgetsByTrip[tid] || {};
    entry._base = result.content;
    if (!sameJson(result.content, result.local)) {
      const current = budgetContentOf(entry);
      const merged = sameJson(current, result.local) ? result.content : mergeBudgetContent(result.local, current, result.content);
      Object.assign(entry, merged);
      if (tid === activeTripId) {
        isApplyingRemoteBudget = true;
        try {
          appState.trip.totalBudget = merged.totalBudget;
          appState.expenses = JSON.parse(JSON.stringify(merged.expenses));
          personalBudgetsByTrip[tid] = entry;
          renderAll();
        } finally { isApplyingRemoteBudget = false; }
      }
    }
    personalBudgetsByTrip[tid] = entry;
    savePersonalBudgetsToStorage();
    return true;
  } catch (e) {
    console.warn("Kunne ikke lagre budsjett:", e);
    pendingBudgetPushes.add(tid);
    lastSyncFailed = true;
    return false;
  } finally {
    syncInFlight = Math.max(0, syncInFlight - 1);
    updateSyncStatus();
  }
}

// --- Felles utgifter -------------------------------------------------------
function tripParticipants(trip) {
  const t = trip || getActiveTripObject();
  const list = [];
  const seen = new Set();
  (t && Array.isArray(t.members) ? t.members : []).forEach(m => {
    const id = String(m.uid || m.id || "");
    if (!id || seen.has(id)) return;
    seen.add(id);
    // Bruk oppdatert navn fra profilen når vi har det
    const fresh = id === myUidOrLocal() ? userProfile : ((userProfile.friends || []).find(f => f.uid === id) || getAllKnownTravelers().find(x => x.uid === id));
    list.push({
      id,
      name: (fresh && fresh.displayName) || m.name || "Reisende",
      hasAccount: m.role === "owner" || isRealUid(id),
      avatarColor: (fresh && fresh.avatarColor) || m.avatarColor
    });
  });
  const me = myUidOrLocal();
  if (!seen.has(me)) list.unshift({ id: me, name: userProfile.displayName || "Meg", hasAccount: true, avatarColor: userProfile.avatarColor });
  return list;
}

function sharedExpensesFor(tid) {
  const map = new Map((sharedExpensesByTrip[tid] || []).map(e => [e.id, e]));
  sharedOutbox.filter(o => o.tripId === tid).forEach(o => {
    if (o.op === "delete") map.delete(o.id);
    else map.set(o.id, { ...o.data, _pending: true });
  });
  return [...map.values()].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

const toCents = (n) => Math.round((Number(n) || 0) * 100);

// Hvor mye hver person har betalt og skylder. Positivt = skal ha penger tilbake.
export function computeSharedBalances(expenses, participants) {
  const bal = {};
  participants.forEach(p => { bal[p.id] = 0; });
  expenses.forEach(e => {
    const amount = toCents(e.amount);
    const split = (Array.isArray(e.split) ? e.split : []).filter(Boolean);
    if (!amount || split.length === 0) return;
    if (!(e.paidBy in bal)) bal[e.paidBy] = 0;
    bal[e.paidBy] += amount;
    const each = Math.floor(amount / split.length);
    let rest = amount - each * split.length;
    split.forEach(id => {
      if (!(id in bal)) bal[id] = 0;
      bal[id] -= each + (rest > 0 ? 1 : 0);
      if (rest > 0) rest--;
    });
  });
  return bal;
}

// Færrest mulig overføringer for å gjøre opp
export function computeSettlementTransfers(balances) {
  const creditors = [];
  const debtors = [];
  Object.entries(balances).forEach(([id, c]) => {
    if (c > 0) creditors.push({ id, c });
    else if (c < 0) debtors.push({ id, c: -c });
  });
  creditors.sort((a, b) => b.c - a.c);
  debtors.sort((a, b) => b.c - a.c);
  const out = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].c, creditors[j].c);
    if (amt > 0) out.push({ from: debtors[i].id, to: creditors[j].id, cents: amt });
    debtors[i].c -= amt;
    creditors[j].c -= amt;
    if (debtors[i].c === 0) i++;
    if (creditors[j].c === 0) j++;
  }
  return out;
}

function myShareOfShared(tid, personId) {
  let cents = 0;
  const byCat = {};
  sharedExpensesFor(tid).forEach(e => {
    if (e.kind !== "expense") return;
    const split = Array.isArray(e.split) ? e.split : [];
    const idx = split.indexOf(personId);
    if (idx === -1) return;
    const amount = toCents(e.amount);
    const each = Math.floor(amount / split.length);
    const share = each + (idx < amount - each * split.length ? 1 : 0);
    cents += share;
    const cat = e.category || "Mat";
    byCat[cat] = (byCat[cat] || 0) + share;
  });
  return { cents, byCat };
}

function queueSharedOp(op) {
  sharedOutbox = sharedOutbox.filter(o => !(o.tripId === op.tripId && o.id === op.id));
  sharedOutbox.push(op);
  saveSharedOutbox();
  renderBudget();
  flushSharedOutbox();
}

let sharedFlushRunning = false;
async function flushSharedOutbox() {
  if (sharedFlushRunning || !isCloudReady() || sharedOutbox.length === 0) { updateSyncStatus(); return; }
  sharedFlushRunning = true;
  syncInFlight++;
  updateSyncStatus();
  try {
    for (const op of [...sharedOutbox]) {
      try {
        const ref = doc(db, "trips", op.tripId, "sharedExpenses", op.id);
        if (op.op === "delete") await deleteDoc(ref);
        else await setDoc(ref, firestoreSafe(op.data));
        sharedOutbox = sharedOutbox.filter(o => o !== op);
        // Vis skrivingen med en gang, før lytteren melder fra
        const list = sharedExpensesByTrip[op.tripId] || [];
        sharedExpensesByTrip[op.tripId] = op.op === "delete" ? list.filter(e => e.id !== op.id) : [...list.filter(e => e.id !== op.id), { ...op.data }];
      } catch (e) {
        if (e && e.code === "permission-denied") {
          sharedOutbox = sharedOutbox.filter(o => o !== op);
          showToast("Ikke lagret", "Du har ikke lenger tilgang til denne reisen.", "alert-triangle");
        } else {
          lastSyncFailed = true;
          break;
        }
      }
    }
    saveSharedOutbox();
  } finally {
    sharedFlushRunning = false;
    syncInFlight = Math.max(0, syncInFlight - 1);
    updateSyncStatus();
    if (budgetListenTripId === activeTripId) renderBudget();
  }
}

export function switchBudgetView(mode) {
  budgetViewMode = mode === "shared" ? "shared" : "personal";
  renderBudget();
}

export function selectBudgetPerson(uid) {
  budgetViewUid = uid;
  budgetViewMode = "personal";
  renderBudget();
}

export function openSharedExpenseModal(expenseId = null) {
  const active = getActiveTripObject();
  if (!isTripInCloud(active)) {
    showToast("Ikke tilgjengelig her", "Felles utgifter kan brukes på reiser som er lagret på kontoen din.", "info");
    return;
  }
  const people = tripParticipants(active);
  const existing = expenseId ? sharedExpensesFor(active.id).find(e => e.id === expenseId) : null;
  const me = myUidOrLocal();
  if (existing && existing.createdBy !== me && !isTripOwnedByCurrentUser(active)) {
    showToast("Kan ikke endres", "Bare den som la inn utgiften, eller eieren av reisen, kan endre den.", "lock");
    return;
  }
  document.getElementById("shared-expense-id").value = existing ? existing.id : "";
  document.getElementById("shared-expense-modal-title").textContent = existing ? "Endre felles utgift" : "Ny felles utgift";
  document.getElementById("shared-expense-title").value = existing ? existing.title : "";
  document.getElementById("shared-expense-amount").value = existing ? existing.amount : "";
  setupFxFields("shared-expense", existing || null);
  document.getElementById("shared-expense-category").value = existing && existing.category ? existing.category : "Mat";
  document.getElementById("shared-expense-date").value = existing ? existing.date : new Date().toISOString().slice(0, 10);
  const payer = document.getElementById("shared-expense-paid-by");
  payer.innerHTML = people.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.id === me ? `${p.name} (deg)` : p.name)}</option>`).join("");
  payer.value = existing ? existing.paidBy : me;
  const split = existing ? existing.split : people.map(p => p.id);
  document.getElementById("shared-expense-split").innerHTML = people.map(p => `
    <label class="flex items-center gap-2.5 py-1.5 text-sm text-slate-700 cursor-pointer">
      <input type="checkbox" value="${escapeHtml(p.id)}" ${split.includes(p.id) ? "checked" : ""} class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600/30">
      <span>${escapeHtml(p.id === me ? `${p.name} (deg)` : p.name)}</span>
    </label>`).join("");
  document.getElementById("shared-expense-error").classList.add("hidden");
  openModal("modal-shared-expense");
}

export function handleSaveSharedExpense(e) {
  if (e && e.preventDefault) e.preventDefault();
  const active = getActiveTripObject();
  if (!isTripInCloud(active)) return;
  const err = document.getElementById("shared-expense-error");
  const id = document.getElementById("shared-expense-id").value || ("sx_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const title = document.getElementById("shared-expense-title").value.trim().slice(0, 80);
  const fx = readFxAmount("shared-expense");
  const amount = fx.error ? 0 : fx.nok;
  const split = [...document.querySelectorAll("#shared-expense-split input:checked")].map(i => i.value);
  const paidBy = document.getElementById("shared-expense-paid-by").value;
  if (!title || !(amount > 0) || amount > 1000000 || split.length === 0) {
    err.textContent = !title ? "Skriv hva utgiften gjelder." : fx.error ? fx.error : !(amount > 0) || amount > 1000000 ? "Skriv inn et gyldig beløp." : "Velg minst én person utgiften skal deles på.";
    err.classList.remove("hidden");
    return;
  }
  const people = tripParticipants(active);
  const names = {};
  people.forEach(p => { if (split.includes(p.id) || p.id === paidBy) names[p.id] = String(p.name).slice(0, 60); });
  const existing = sharedExpensesFor(active.id).find(x => x.id === id);
  const now = new Date().toISOString();
  queueSharedOp({
    tripId: active.id, id, op: "set",
    data: {
      id, kind: "expense", title,
      category: document.getElementById("shared-expense-category").value || "Mat",
      amount, date: (document.getElementById("shared-expense-date").value || now.slice(0, 10)).slice(0, 10),
      paidBy, split, names,
      ...fx.fields,
      createdBy: existing ? existing.createdBy : currentUser.uid,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    }
  });
  closeModal("modal-shared-expense");
  showToast(existing ? "Utgiften er oppdatert" : "Felles utgift lagt til", `${title} · ${formatMoney(amount)}`, "receipt");
}

export async function deleteSharedExpense(id) {
  const active = getActiveTripObject();
  if (!active) return;
  const e = sharedExpensesFor(active.id).find(x => x.id === id);
  if (!e) return;
  const ok = await showAppDialog({
    title: e.kind === "payment" ? "Angre registrert betaling?" : `Slette «${e.title}»?`,
    message: "Oppgjøret regnes ut på nytt for alle i reisefølget.",
    confirmLabel: e.kind === "payment" ? "Angre betaling" : "Slett utgift",
    danger: true
  });
  if (!ok) return;
  queueSharedOp({ tripId: active.id, id, op: "delete" });
}

export async function registerSettlementPayment(fromId, toId, cents) {
  const active = getActiveTripObject();
  if (!isTripInCloud(active)) return;
  const people = tripParticipants(active);
  const nameOf = (id) => (people.find(p => p.id === id) || {}).name || "Reisende";
  const amount = Math.round(Number(cents)) / 100;
  const ok = await showAppDialog({
    title: "Registrere betaling?",
    message: `${nameOf(fromId)} har betalt ${formatMoney(amount)} til ${nameOf(toId)}.`,
    confirmLabel: "Registrer betalt"
  });
  if (!ok) return;
  const id = "pay_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();
  queueSharedOp({
    tripId: active.id, id, op: "set",
    data: {
      id, kind: "payment", title: `${nameOf(fromId)} betalte ${nameOf(toId)}`.slice(0, 80),
      amount, date: now.slice(0, 10), paidBy: fromId, split: [toId],
      names: { [fromId]: nameOf(fromId).slice(0, 60), [toId]: nameOf(toId).slice(0, 60) },
      createdBy: currentUser.uid, createdAt: now, updatedAt: now
    }
  });
}

function formatMoney(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return `${v.toLocaleString("nb-NO", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })} kr`;
}

export function renderBudget() {
  const active = getActiveTripObject();
  if (!active) return;
  const tid = active.id;
  const me = myUidOrLocal();
  const inCloud = isTripInCloud(active);
  const people = tripParticipants(active);
  const accountPeople = people.filter(p => p.hasAccount);
  const budgets = tripBudgets[tid] || {};
  if (!budgetViewUid || !accountPeople.some(p => p.id === budgetViewUid)) budgetViewUid = me;
  const viewingMe = budgetViewUid === me;
  const viewed = accountPeople.find(p => p.id === budgetViewUid) || { id: me, name: userProfile.displayName || "Meg" };

  // Hvem sitt budsjett vises
  let totalBudget, expenses;
  if (viewingMe) {
    totalBudget = Math.max(0, Number(appState.trip.totalBudget) || 0);
    expenses = Array.isArray(appState.expenses) ? appState.expenses : [];
  } else {
    const b = budgets[budgetViewUid];
    totalBudget = b ? Math.max(0, Number(b.totalBudget) || 0) : 0;
    expenses = b && Array.isArray(b.expenses) ? b.expenses : [];
  }
  const share = myShareOfShared(tid, budgetViewUid);
  // Sidemenyen viser hvor mye du har igjen
  const sideBadge = document.getElementById("sidebar-budget-badge");
  if (sideBadge) {
    const myTotal = Math.max(0, Number(appState.trip.totalBudget) || 0);
    const mySpent = (appState.expenses || []).reduce((a, e) => a + toCents(e.amount), 0) + myShareOfShared(tid, me).cents;
    sideBadge.textContent = myTotal > 0 ? `${Math.max(0, Math.round((myTotal * 100 - mySpent) / 100)).toLocaleString("nb-NO")} kr igjen` : "";
  }
  const personalCents = expenses.reduce((acc, e) => acc + toCents(e.amount), 0);
  const spentCents = personalCents + share.cents;
  const spent = spentCents / 100;
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };

  // Faner og personvelger
  const sharedList = sharedExpensesFor(tid);
  set("budget-view-btn-personal", el => { const on = budgetViewMode === "personal"; el.classList.toggle("bg-white", on); el.classList.toggle("shadow-sm", on); el.classList.toggle("text-slate-900", on); el.classList.toggle("text-slate-600", !on); el.setAttribute("aria-selected", on); });
  set("budget-view-btn-shared", el => { const on = budgetViewMode === "shared"; el.classList.toggle("bg-white", on); el.classList.toggle("shadow-sm", on); el.classList.toggle("text-slate-900", on); el.classList.toggle("text-slate-600", !on); el.setAttribute("aria-selected", on); });
  set("budget-shared-count", el => { const n = sharedList.filter(e => e.kind === "expense").length; el.textContent = n ? String(n) : ""; el.classList.toggle("hidden", !n); });
  set("budget-panel-personal", el => el.classList.toggle("hidden", budgetViewMode !== "personal"));
  set("budget-panel-shared", el => el.classList.toggle("hidden", budgetViewMode !== "shared"));
  set("budget-subtitle", el => {
    el.textContent = !inCloud ? "Budsjettet lagres på denne enheten til reisen er lagret på kontoen."
      : accountPeople.length > 1 ? "Alle i reisefølget kan se hverandres budsjett. Bare du kan endre ditt."
      : "Ditt budsjett for reisen. Deler du reisen, kan reisefølget se det.";
  });
  set("budget-person-picker", el => {
    el.classList.toggle("hidden", !(inCloud && accountPeople.length > 1) || budgetViewMode !== "personal");
    el.innerHTML = accountPeople.map(p => {
      const on = p.id === budgetViewUid;
      return `<button type="button" data-onclick="selectBudgetPerson(${jsArg(p.id)})" class="shrink-0 inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border text-sm transition ${on ? "border-slate-900 bg-fjord-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}">
        ${socialAvatarHtml({ displayName: p.name, avatarColor: p.avatarColor, photo: p.id === me ? userProfile.photo : ((userProfile.friends || []).find(f => f.uid === p.id) || {}).photo }, "w-6 h-6 text-[10px]", "#0b8176")}
        <span>${escapeHtml(p.id === me ? "Meg" : p.name)}</span></button>`;
    }).join("");
  });
  set("budget-readonly-note", el => {
    el.classList.toggle("hidden", viewingMe);
    el.textContent = viewingMe ? "" : (budgets[budgetViewUid] ? `Du ser ${viewed.name} sitt budsjett. Bare ${viewed.name} kan endre det.` : `${viewed.name} har ikke satt opp et budsjett ennå.`);
  });
  document.querySelectorAll("[data-budget-own-only]").forEach(el => el.classList.toggle("hidden", !viewingMe));

  // Oppsummering
  set("budget-total-label", el => { el.textContent = viewingMe ? "Mitt budsjett" : `${viewed.name} sitt budsjett`; });
  set("budget-total-val", el => { el.textContent = totalBudget > 0 ? formatMoney(totalBudget) : "Ikke satt"; });
  set("budget-spent-val", el => { el.textContent = formatMoney(spent); });
  set("budget-spent-pct", el => {
    el.textContent = share.cents > 0 ? `Inkl. ${formatMoney(share.cents / 100)} i felles utgifter` : (totalBudget > 0 ? `${Math.round(spent / totalBudget * 100)} % av budsjettet` : "Personlige utgifter");
  });
  set("budget-spent-bar", el => {
    const pctUsed = totalBudget > 0 ? Math.round(spent / totalBudget * 100) : 0;
    el.style.width = `${Math.min(100, pctUsed)}%`;
    el.classList.toggle("bg-rose-500", pctUsed >= 100);
    el.classList.toggle("bg-amber-500", pctUsed >= 80 && pctUsed < 100);
    el.classList.toggle("bg-brand-600", pctUsed < 80);
  });
  set("budget-remaining-val", el => {
    el.textContent = totalBudget > 0 ? formatMoney(totalBudget - spent) : "–";
    el.classList.toggle("text-rose-600", totalBudget > 0 && spent > totalBudget);
    el.classList.toggle("text-emerald-700", !(totalBudget > 0 && spent > totalBudget));
  });
  let durationDays = 1;
  if (appState.trip.startDate && appState.trip.endDate) {
    const diff = Math.ceil((new Date(appState.trip.endDate) - new Date(appState.trip.startDate)) / 86400000);
    if (diff > 0) durationDays = diff;
  }
  set("budget-daily-avg", el => { el.textContent = `${formatMoney(Math.round(spent / durationDays))} / dag`; });
  set("budget-daily-days-sub", el => { el.textContent = `Over ${durationDays} dager`; });
  set("budget-remaining-sub", el => { el.textContent = totalBudget > 0 && spent > totalBudget ? "Over budsjett" : "Igjen å bruke"; });

  // Kategorier
  set("budget-categories-container", el => {
    el.innerHTML = EXPENSE_CATEGORIES.map(cat => {
      const own = expenses.filter(e => (e.category || "Annet") === cat.name || (cat.name === "Mat" && e.category === "Mat & Drikke")).reduce((a, e) => a + toCents(e.amount), 0);
      const sum = own + (share.byCat[cat.name] || 0);
      const pct = spentCents > 0 ? Math.round(sum / spentCents * 100) : 0;
      return `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-sm">
            <span class="flex items-center gap-2 text-slate-700">${categoryChipHtml(cat.name, "w-7 h-7")}${cat.name}</span>
            <span class="font-medium text-slate-900">${formatMoney(sum / 100)} <span class="text-slate-500 font-normal">· ${pct} %</span></span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div class="${cat.bar} h-1.5 rounded-full" style="width: ${pct}%"></div></div>
        </div>`;
    }).join("");
  });

  // Personlige utgifter
  const sorted = [...expenses].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  set("expenses-count-badge", el => { el.textContent = `${expenses.length} ${expenses.length === 1 ? "utgift" : "utgifter"}`; });
  set("expenses-list", el => {
    if (sorted.length === 0) {
      el.innerHTML = `<div class="px-5 py-10 text-center">
        <p class="text-sm font-medium text-slate-900">${viewingMe ? "Ingen utgifter ennå" : "Ingen utgifter registrert"}</p>
        <p class="text-sm text-slate-500 mt-1">${viewingMe ? "Legg inn det du bruker underveis, så ser du hvor mye du har igjen." : ""}</p>
      </div>`;
      return;
    }
    el.innerHTML = sorted.map(exp => `
      <div class="px-5 py-3 flex items-center justify-between gap-3">
        <div class="min-w-0 flex items-center gap-3">
          ${categoryChipHtml(exp.category)}
          <div class="min-w-0">
          <p class="text-sm font-medium text-slate-900 truncate">${escapeHtml(exp.title || "Utgift")}</p>
          <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(expenseCategory(exp.category).name)} · ${escapeHtml(formatDate(exp.date))}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-right"><span class="block text-sm font-semibold text-slate-900 tabular-nums">${formatMoney(exp.amount)}</span>${expenseOrigHtml(exp)}</span>
          ${viewingMe ? `<button type="button" data-onclick="deleteExpense(${jsArg(exp.id)})" class="hit w-10 h-10 sm:w-8 sm:h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition" aria-label="Slett ${escapeHtml(exp.title || "utgift")}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ""}
        </div>
      </div>`).join("");
  });
  set("budget-shared-share-row", el => {
    el.classList.toggle("hidden", share.cents === 0);
    el.innerHTML = share.cents === 0 ? "" : `<button type="button" data-onclick="switchBudgetView('shared')" class="w-full px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition">
        <span class="min-w-0"><span class="block text-sm font-medium text-slate-900">Andel av felles utgifter</span><span class="block text-xs text-slate-500 mt-0.5">Se felles utgifter og oppgjør</span></span>
        <span class="text-sm font-semibold text-slate-900 tabular-nums">${formatMoney(share.cents / 100)}</span></button>`;
  });

  // Felles utgifter og oppgjør
  const nameOf = (e, id) => {
    const p = people.find(x => x.id === id);
    if (p) return id === me ? "deg" : p.name;
    return (e && e.names && e.names[id]) || "Tidligere medlem";
  };
  const isOwner = isTripOwnedByCurrentUser(active);
  set("shared-unavailable-note", el => el.classList.toggle("hidden", inCloud));
  set("shared-expenses-content", el => el.classList.toggle("hidden", !inCloud));
  set("shared-expenses-list", el => {
    const items = sharedList;
    if (items.length === 0) {
      el.innerHTML = `<div class="px-5 py-10 text-center">
        <p class="text-sm font-medium text-slate-900">Ingen felles utgifter ennå</p>
        <p class="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Har noen lagt ut for middag eller billetter? Legg det inn her, så regner RailSync ut hvem som skylder hvem.</p>
      </div>`;
      return;
    }
    el.innerHTML = items.map(e => {
      const canChange = e.createdBy === me || isOwner;
      if (e.kind === "payment") {
        return `<div class="px-5 py-3 flex items-center justify-between gap-3 bg-emerald-50/40">
          <div class="min-w-0 flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><i data-lucide="check" class="w-4 h-4"></i></span>
            <div class="min-w-0"><p class="text-sm text-slate-900 truncate">${escapeHtml(nameOf(e, e.paidBy) === "deg" ? "Du" : nameOf(e, e.paidBy))} betalte ${escapeHtml(nameOf(e, e.split[0]))}</p>
            <p class="text-xs text-slate-500">Oppgjør · ${escapeHtml(formatDate(e.date))}${e._pending ? " · venter på lagring" : ""}</p></div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-sm font-semibold text-emerald-700 tabular-nums">${formatMoney(e.amount)}</span>
            ${canChange ? `<button type="button" data-onclick="deleteSharedExpense(${jsArg(e.id)})" class="hit w-10 h-10 sm:w-8 sm:h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition" aria-label="Angre betaling"><i data-lucide="undo-2" class="w-4 h-4"></i></button>` : ""}
          </div></div>`;
      }
      const split = Array.isArray(e.split) ? e.split : [];
      const splitText = split.length === people.length && people.every(p => split.includes(p.id)) ? "alle" : split.map(id => nameOf(e, id)).join(", ");
      return `<div class="px-5 py-3 flex items-center justify-between gap-3">
        <button type="button" ${canChange ? `data-onclick="openSharedExpenseModal(${jsArg(e.id)})"` : "disabled"} class="min-w-0 text-left flex items-center gap-3 ${canChange ? "" : "cursor-default"}">
          ${categoryChipHtml(e.category)}
          <span class="min-w-0 block">
          <p class="text-sm font-medium text-slate-900 truncate">${escapeHtml(e.title || "Utgift")}</p>
          <p class="text-xs text-slate-500 mt-0.5 truncate">${escapeHtml(nameOf(e, e.paidBy) === "deg" ? "Du" : nameOf(e, e.paidBy))} betalte · delt på ${escapeHtml(splitText)} · ${escapeHtml(formatDate(e.date))}${e._pending ? " · venter på lagring" : ""}</p>
          </span>
        </button>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-right"><span class="block text-sm font-semibold text-slate-900 tabular-nums">${formatMoney(e.amount)}</span>${expenseOrigHtml(e)}</span>
          ${canChange ? `<button type="button" data-onclick="deleteSharedExpense(${jsArg(e.id)})" class="hit w-10 h-10 sm:w-8 sm:h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition" aria-label="Slett ${escapeHtml(e.title || "utgift")}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ""}
        </div></div>`;
    }).join("");
  });

  const balances = computeSharedBalances(sharedList, people);
  const transfers = computeSettlementTransfers(balances);
  const totalShared = sharedList.filter(e => e.kind === "expense").reduce((a, e) => a + toCents(e.amount), 0);
  set("shared-total-val", el => { el.textContent = formatMoney(totalShared / 100); });
  set("settlement-balances", el => {
    el.innerHTML = Object.keys(balances).filter(id => people.some(p => p.id === id) || balances[id] !== 0).map(id => {
      const c = balances[id];
      const label = id === me ? "Du" : nameOf(null, id);
      return `<li class="flex items-center justify-between gap-3 py-2 text-sm">
        <span class="text-slate-700 truncate">${escapeHtml(label)}</span>
        <span class="font-medium tabular-nums ${c > 0 ? "text-emerald-700" : c < 0 ? "text-rose-600" : "text-slate-500"}">${c > 0 ? "Skal ha " + formatMoney(c / 100) : c < 0 ? "Skylder " + formatMoney(-c / 100) : "Gjort opp"}</span>
      </li>`;
    }).join("");
  });
  set("settlement-transfers", el => {
    if (transfers.length === 0) {
      el.innerHTML = `<p class="text-sm text-slate-500">${totalShared > 0 ? "Alt er gjort opp." : "Oppgjøret vises her når dere har lagt inn felles utgifter."}</p>`;
      return;
    }
    el.innerHTML = transfers.map(t => `
      <div class="flex items-center justify-between gap-3 py-2.5">
        <p class="text-sm text-slate-700 min-w-0"><span class="font-medium text-slate-900">${escapeHtml(t.from === me ? "Du" : nameOf(null, t.from))}</span> betaler <span class="font-medium text-slate-900">${escapeHtml(t.to === me ? "deg" : nameOf(null, t.to))}</span><br><span class="font-semibold text-slate-900 tabular-nums">${formatMoney(t.cents / 100)}</span></p>
        <button type="button" data-onclick="registerSettlementPayment(${jsArg(t.from)}, ${jsArg(t.to)}, ${Number(t.cents)})" class="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">Registrer betalt</button>
      </div>`).join("");
  });

  if (window.lucide) lucide.createIcons();
}

const PACKING_CATEGORY_STYLE = {
  "Dokumenter & Billetter": { icon: "file-text", chip: "bg-amber-50 text-amber-700" },
  "Togkomfort & Sove": { icon: "bed", chip: "bg-violet-50 text-violet-700" },
  "Elektronikk": { icon: "smartphone", chip: "bg-sky-50 text-sky-700" },
  "Klær & Fottøy": { icon: "shirt", chip: "bg-rose-50 text-rose-700" },
  "Toalettsaker & Apotek": { icon: "pill", chip: "bg-emerald-50 text-emerald-700" }
};

function packingCategoryChipHtml(name) {
  const s = PACKING_CATEGORY_STYLE[name] || { icon: "tag", chip: "bg-slate-100 text-slate-600" };
  return `<span class="w-7 h-7 rounded-lg ${s.chip} flex items-center justify-center shrink-0" aria-hidden="true"><i data-lucide="${s.icon}" class="w-3.5 h-3.5"></i></span>`;
}

export function renderPacking() {
  const active = getActiveTripObject();
  const tid = active ? active.id : null;
  const me = myUidOrLocal();
  const inCloud = isTripInCloud(active);
  const accountPeople = active ? tripParticipants(active).filter(p => p.hasAccount) : [];
  const lists = (tid && tripPackingLists[tid]) || {};
  if (!packingViewUid || !accountPeople.some(p => p.id === packingViewUid)) packingViewUid = me;
  const viewingMe = packingViewUid === me;
  const viewed = accountPeople.find(p => p.id === packingViewUid) || { id: me, name: userProfile.displayName || "Meg" };
  const otherList = viewingMe ? null : lists[packingViewUid];
  const myEntry = active ? getMyPackingForTrip(active) : { hidden: false };
  const showPeople = inCloud && accountPeople.length > 1;
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };

  // Sidemenyen viser alltid din egen fremdrift
  const myItems = appState.packingList || [];
  const sProgress = document.getElementById("sidebar-packing-progress");
  if (sProgress) sProgress.textContent = `${myItems.filter(i => i.checked).length}/${myItems.length}`;

  set("packing-subtitle", el => {
    el.textContent = !showPeople ? "Din egen pakkeliste for reisen."
      : myEntry.hidden ? "Din egen pakkeliste. Den er skjult for reisefølget."
      : "Hver har sin egen liste. Reisefølget kan se din, men bare du kan endre den.";
  });
  set("packing-person-picker", el => {
    el.classList.toggle("hidden", !showPeople);
    el.innerHTML = showPeople ? accountPeople.map(p => {
      const on = p.id === packingViewUid;
      return `<button type="button" data-onclick="selectPackingPerson(${jsArg(p.id)})" aria-pressed="${on}" class="shrink-0 inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border text-sm transition ${on ? "border-slate-900 bg-fjord-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}">
        ${socialAvatarHtml({ displayName: p.name, avatarColor: p.avatarColor, photo: p.id === me ? userProfile.photo : ((userProfile.friends || []).find(f => f.uid === p.id) || {}).photo }, "w-6 h-6 text-[10px]", "#0b8176")}
        <span>${escapeHtml(p.id === me ? "Meg" : p.name)}</span></button>`;
    }).join("") : "";
  });
  set("packing-visibility", el => {
    el.classList.toggle("hidden", !showPeople || !viewingMe || !canEditActiveTrip());
    const input = el.querySelector("input");
    if (input) input.checked = Boolean(myEntry.hidden);
  });
  set("packing-readonly-note", el => {
    el.classList.toggle("hidden", viewingMe);
    el.textContent = viewingMe ? "" : (otherList
      ? `Du ser ${viewed.name} sin pakkeliste. Bare ${viewed.name} kan endre den.`
      : `${viewed.name} har ikke delt en pakkeliste.`);
  });
  document.querySelectorAll("[data-packing-own-only]").forEach(el => el.classList.toggle("hidden", !viewingMe));

  if (viewingMe) renderPackingAdapterHint();
  else set("packing-adapter-hint", el => el.classList.add("hidden"));

  const items = viewingMe ? myItems : (otherList && Array.isArray(otherList.items) ? otherList.items : []);
  const totalCount = items.length;
  const packedCount = items.filter(i => i.checked).length;
  const pct = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  const pctLabel = document.getElementById("packing-percentage-label");
  if (pctLabel) pctLabel.textContent = `${packedCount} av ${totalCount} pakket (${pct}%)`;

  const pBar = document.getElementById("packing-progress-bar");
  if (pBar) pBar.style.width = `${pct}%`;

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

  if (items.length === 0 && !viewingMe) {
    container.innerHTML = otherList ? `
      <div class="md:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <p class="text-sm font-semibold text-slate-900">${escapeHtml(viewed.name)} sin pakkeliste er tom</p>
      </div>` : "";
    return;
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="md:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <p class="text-sm font-semibold text-slate-900">Pakkelisten er tom</p>
        <p class="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Legg til det du skal ha med, eller start med en liste over det de fleste trenger på Interrail.</p>
        <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button type="button" data-onclick="addPackingSuggestions()" class="px-4 py-2 rounded-lg bg-fjord-800 hover:bg-fjord-700 text-white text-sm font-semibold transition">Bruk forslag</button>
          <button type="button" data-onclick="openAddPackingItemModal()" class="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Legg til selv</button>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = Object.keys(groups).filter(c => viewingMe || groups[c].length > 0).map(categoryName => {
    const catItems = groups[categoryName] || [];
    const catPacked = catItems.filter(i => i.checked).length;

    return `
      <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 class="font-bold text-slate-900 text-sm flex items-center gap-2">
              ${packingCategoryChipHtml(categoryName)}
              ${escapeHtml(categoryName)}
            </h3>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              ${catPacked}/${catItems.length}
            </span>
          </div>

          <div class="space-y-1.5 pt-2">
            ${catItems.length === 0 ? '<p class="text-xs text-slate-500 italic py-1">Ingen gjenstander i denne kategorien.</p>' : ''}
            ${catItems.map(item => viewingMe ? `
              <div class="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition group">
                <label class="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0 pr-2">
                  <input
                    type="checkbox"
                    ${item.checked ? 'checked' : ''}
                    data-onchange="togglePackingItem(${jsArg(item.id)})"
                    class="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 transition cursor-pointer"
                  >
                  <span class="text-xs sm:text-sm font-medium ${item.checked ? 'line-through text-slate-500' : 'text-slate-700'}">
                    ${escapeHtml(item.text)}
                  </span>
                </label>
                <button data-onclick="deletePackingItem(${jsArg(item.id)})" class="hit opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 text-slate-500 hover:text-rose-600 p-2 sm:p-1 rounded-lg transition" title="Slett" aria-label="Slett ${escapeHtml(item.text || "")}">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            ` : `
              <div class="flex items-center gap-3 p-2">
                <i data-lucide="${item.checked ? "circle-check" : "circle"}" class="w-4 h-4 shrink-0 ${item.checked ? "text-brand-600" : "text-slate-400"}" aria-hidden="true"></i>
                <span class="text-xs sm:text-sm font-medium ${item.checked ? 'line-through text-slate-500' : 'text-slate-700'}">
                  <span class="sr-only">${item.checked ? "Pakket: " : "Ikke pakket: "}</span>${escapeHtml(item.text)}
                </span>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="mt-2 pt-2 border-t border-slate-100 ${viewingMe ? "" : "hidden"}">
          <form data-onsubmit="handleQuickAddPacking(event, ${jsArg(categoryName)})" class="flex items-center gap-1.5">
            <input 
              type="text" 
              name="quickItemText"
              placeholder="Ny gjenstand …" aria-label="Ny gjenstand i ${escapeHtml(categoryName)}" 
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
      visBadge.className = "hidden xl:inline-flex cursor-pointer items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 transition shrink-0";
      visBadge.innerHTML = `👁️ Kun visning`;
    } else if (active.visibility === "shared") {
      visBadge.className = "hidden xl:inline-flex cursor-pointer items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 transition shrink-0";
      visBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Delt reise (${escapeHtml(active.shareCode || 'Live')})`;
    } else {
      visBadge.className = "hidden xl:inline-flex cursor-pointer items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 hover:border-brand-300 transition shrink-0";
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
      class="w-6 h-6 rounded-full text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white shadow-2xs"
      style="background-color: ${avatarColor(m.avatarColor)}; color: ${avatarInk(avatarColor(m.avatarColor))}"
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
  renderDayPlan();
  renderOverviewDayCard();
  renderTripStats();
  renderTripManagerList();
  renderSocialHub();
  renderOnboarding();
  updateAuthUI(currentUser);
  applyEditMode();
  applyTripPresence();
  if (currentTab === "welcome") renderWelcome();
  else if (TRIP_TABS.includes(currentTab) && !hasActiveTrip()) switchTab(currentTab);
  if (window.lucide) lucide.createIcons();
}

