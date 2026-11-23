// Tester for sikkerhetsreglene i firestore.rules.
// Kjøres mot Firestore-emulatoren: npm run test:rules
//
// Hver test speiler det appen faktisk sender (src/app/), slik at vanlig bruk
// fortsatt virker, og prøver i tillegg de angrepene reglene skal stoppe.

import { describe, test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  runTransaction,
} from 'firebase/firestore';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rulesFile = process.env.RULES_FILE || path.join(root, 'firestore.rules');

let env;

const NOW = '2026-11-23T12:00:00.000Z';
const OWNER = 'owner-uid';
const EDITOR = 'editor-uid';
const VIEWER = 'viewer-uid';
const STRANGER = 'stranger-uid';
const JPEG = 'data:image/jpeg;base64,' + 'A'.repeat(200);

const member = (uid, name, role) => ({ id: uid, uid, name, role, avatarColor: '#0d9488' });

function baseTrip(overrides = {}) {
  return {
    title: 'Europaturné',
    ownerUid: OWNER,
    owner: { uid: OWNER, name: 'Eier' },
    memberUids: [OWNER, EDITOR, VIEWER],
    editorUids: [OWNER, EDITOR],
    members: [
      member(OWNER, 'Eier', 'owner'),
      member(EDITOR, 'Redaktør', 'editor'),
      member(VIEWER, 'Leser', 'viewer'),
    ],
    visibility: 'shared',
    sharePermission: 'view',
    updatedAt: NOW,
    ...overrides,
  };
}

/** Oppføringen appen legger til når noen blir med (05-lagring-og-skysynk.js). */
function joinEntry(uid, role) {
  return {
    id: uid,
    uid,
    username: '@fremmed',
    name: 'Fremmed',
    role,
    avatarColor: '#2563eb',
    joinedAt: NOW,
  };
}

const db = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

async function seed(path, data) {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));
}

async function read(path) {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-railsync',
    firestore: { rules: readFileSync(rulesFile, 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// ---------------------------------------------------------------------------
describe('Bli med i delt reise', () => {
  test('vis-tilgang: blir med som leser slik appen gjør', async () => {
    await seed('trips/t1', baseTrip({ sharePermission: 'view' }));
    await assertSucceeds(updateDoc(doc(db(STRANGER), 'trips/t1'), {
      memberUids: arrayUnion(STRANGER),
      members: arrayUnion(joinEntry(STRANGER, 'viewer')),
      updatedAt: NOW,
    }));
  });

  test('rediger-tilgang: blir med som redaktør slik appen gjør', async () => {
    await seed('trips/t1', baseTrip({ sharePermission: 'edit' }));
    await assertSucceeds(updateDoc(doc(db(STRANGER), 'trips/t1'), {
      memberUids: arrayUnion(STRANGER),
      members: arrayUnion(joinEntry(STRANGER, 'editor')),
      editorUids: arrayUnion(STRANGER),
      updatedAt: NOW,
    }));
  });

  test('reise uten sharePermission regnes som rediger-tilgang', async () => {
    const trip = baseTrip();
    delete trip.sharePermission;
    await seed('trips/t1', trip);
    await assertSucceeds(updateDoc(doc(db(STRANGER), 'trips/t1'), {
      memberUids: arrayUnion(STRANGER),
      members: arrayUnion(joinEntry(STRANGER, 'editor')),
      editorUids: arrayUnion(STRANGER),
      updatedAt: NOW,
    }));
  });

  test('ANGREP: gir seg selv redaktør-rolle i vis-reise', async () => {
    await seed('trips/t1', baseTrip({ sharePermission: 'view' }));
    await assertFails(updateDoc(doc(db(STRANGER), 'trips/t1'), {
      memberUids: arrayUnion(STRANGER),
      members: arrayUnion(joinEntry(STRANGER, 'editor')),
      updatedAt: NOW,
    }));
  });

  test('ANGREP: legger seg i editorUids i vis-reise', async () => {
    await seed('trips/t1', baseTrip({ sharePermission: 'view' }));
    await assertFails(updateDoc(doc(db(STRANGER), 'trips/t1'), {
      memberUids: arrayUnion(STRANGER),
      editorUids: arrayUnion(STRANGER),
      members: arrayUnion(joinEntry(STRANGER, 'viewer')),
      updatedAt: NOW,
    }));
  });

  test('ANGREP: endrer et annet medlems rolle samtidig som man blir med', async () => {
    await seed('trips/t1', baseTrip({ sharePermission: 'view' }));
    const t = baseTrip();
    const members = t.members.map((m) => (m.uid === VIEWER ? { ...m, role: 'editor' } : m));
    await assertFails(updateDoc(doc(db(STRANGER), 'trips/t1'), {
      memberUids: arrayUnion(STRANGER),
      members: [...members, joinEntry(STRANGER, 'viewer')],
      updatedAt: NOW,
    }));
  });

  test('ANGREP: bytter ut et annet medlem (samme lengde + 1)', async () => {
    await seed('trips/t1', baseTrip({ sharePermission: 'view' }));
    const t = baseTrip();
    await assertFails(updateDoc(doc(db(STRANGER), 'trips/t1'), {
      memberUids: arrayUnion(STRANGER),
      members: [t.members[0], t.members[1], joinEntry(STRANGER, 'viewer'), joinEntry(STRANGER, 'viewer')],
      updatedAt: NOW,
    }));
  });

  test('ANGREP: legger til oppføring for en annen bruker', async () => {
    await seed('trips/t1', baseTrip({ sharePermission: 'view' }));
    await assertFails(updateDoc(doc(db(STRANGER), 'trips/t1'), {
      memberUids: arrayUnion(STRANGER),
      members: arrayUnion(joinEntry('someone-else', 'viewer')),
      updatedAt: NOW,
    }));
  });

  test('ANGREP: ekstra felt i medlemsoppføringen', async () => {
    await seed('trips/t1', baseTrip({ sharePermission: 'view' }));
    await assertFails(updateDoc(doc(db(STRANGER), 'trips/t1'), {
      memberUids: arrayUnion(STRANGER),
      members: arrayUnion({ ...joinEntry(STRANGER, 'viewer'), isAdmin: true }),
      updatedAt: NOW,
    }));
  });

  test('privat reise kan ikke åpnes eller blis med i', async () => {
    await seed('trips/t1', baseTrip({ visibility: 'private' }));
    await assertFails(getDoc(doc(db(STRANGER), 'trips/t1')));
    await assertFails(updateDoc(doc(db(STRANGER), 'trips/t1'), {
      memberUids: arrayUnion(STRANGER),
      members: arrayUnion(joinEntry(STRANGER, 'viewer')),
      updatedAt: NOW,
    }));
  });

  test('delt reise kan leses av innlogget med lenken, ikke av utlogget', async () => {
    await seed('trips/t1', baseTrip());
    await assertSucceeds(getDoc(doc(db(STRANGER), 'trips/t1')));
    await assertFails(getDoc(doc(anon(), 'trips/t1')));
  });
});

// ---------------------------------------------------------------------------
describe('Forlate reise', () => {
  /** Slik appen gjør det (13-sosialt.js, deleteTrip for ikke-eiere). */
  function leaveLikeApp(firestore, uid) {
    const ref = doc(firestore, 'trips/t1');
    return runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const members = snap.data().members || [];
      tx.update(ref, {
        memberUids: arrayRemove(uid),
        editorUids: arrayRemove(uid),
        members: members.filter((m) => (m.uid || m.id) !== uid),
        updatedAt: NOW,
      });
    });
  }

  test('leser forlater reisen', async () => {
    await seed('trips/t1', baseTrip());
    await assertSucceeds(leaveLikeApp(db(VIEWER), VIEWER));
    const trip = await read('trips/t1');
    if (trip.members.some((m) => m.uid === VIEWER)) throw new Error('leseren ble ikke fjernet');
    if (trip.members.length !== 2) throw new Error('andre medlemmer ble endret');
  });

  test('redaktør forlater reisen', async () => {
    await seed('trips/t1', baseTrip());
    await assertSucceeds(leaveLikeApp(db(EDITOR), EDITOR));
  });

  test('eldre oppføring med bare id (uten uid) kan fjernes', async () => {
    const t = baseTrip();
    t.members[2] = { id: VIEWER, name: 'Leser', role: 'viewer' };
    await seed('trips/t1', t);
    await assertSucceeds(leaveLikeApp(db(VIEWER), VIEWER));
  });

  test('medlem uten oppføring i members kan likevel forlate', async () => {
    const t = baseTrip();
    t.members = t.members.filter((m) => m.uid !== VIEWER);
    await seed('trips/t1', t);
    await assertSucceeds(leaveLikeApp(db(VIEWER), VIEWER));
  });

  test('ANGREP: fjerner et annet medlem i stedet for seg selv', async () => {
    await seed('trips/t1', baseTrip());
    const t = baseTrip();
    await assertFails(updateDoc(doc(db(VIEWER), 'trips/t1'), {
      memberUids: arrayRemove(VIEWER),
      editorUids: arrayRemove(VIEWER),
      members: [t.members[0], t.members[2]], // fjerner redaktøren
      updatedAt: NOW,
    }));
  });

  test('ANGREP: endrer et annet medlems rolle på vei ut', async () => {
    await seed('trips/t1', baseTrip());
    const t = baseTrip();
    await assertFails(updateDoc(doc(db(VIEWER), 'trips/t1'), {
      memberUids: arrayRemove(VIEWER),
      editorUids: arrayRemove(VIEWER),
      members: [t.members[0], { ...t.members[1], role: 'owner' }],
      updatedAt: NOW,
    }));
  });

  test('ANGREP: legger til en ny oppføring på vei ut', async () => {
    await seed('trips/t1', baseTrip());
    const t = baseTrip();
    await assertFails(updateDoc(doc(db(VIEWER), 'trips/t1'), {
      memberUids: arrayRemove(VIEWER),
      editorUids: arrayRemove(VIEWER),
      members: [t.members[0], t.members[1], member('fake', 'Falsk', 'editor')],
      updatedAt: NOW,
    }));
  });

  test('eieren kan ikke «forlate» sin egen reise', async () => {
    await seed('trips/t1', baseTrip());
    // Eieren kan oppdatere fritt, men ikke endre ownerUid
    await assertFails(updateDoc(doc(db(OWNER), 'trips/t1'), { ownerUid: EDITOR }));
  });
});

// ---------------------------------------------------------------------------
describe('Vanlig redigering (skal virke som før)', () => {
  test('eieren kan endre roller og medlemmer', async () => {
    await seed('trips/t1', baseTrip());
    const t = baseTrip();
    await assertSucceeds(updateDoc(doc(db(OWNER), 'trips/t1'), {
      members: t.members.map((m) => (m.uid === VIEWER ? { ...m, role: 'editor' } : m)),
      editorUids: [OWNER, EDITOR, VIEWER],
      updatedAt: NOW,
    }));
  });

  test('redaktør kan endre reisen, men ikke medlemmer eller deling', async () => {
    await seed('trips/t1', baseTrip());
    await assertSucceeds(updateDoc(doc(db(EDITOR), 'trips/t1'), { title: 'Ny tittel', updatedAt: NOW }));
    await assertFails(updateDoc(doc(db(EDITOR), 'trips/t1'), { members: [] }));
    await assertFails(updateDoc(doc(db(EDITOR), 'trips/t1'), { visibility: 'private' }));
  });

  test('leser kan ikke endre reisen', async () => {
    await seed('trips/t1', baseTrip());
    await assertFails(updateDoc(doc(db(VIEWER), 'trips/t1'), { title: 'Hacket', updatedAt: NOW }));
  });

  test('medlem kan lagre eget budsjett, ikke andres', async () => {
    await seed('trips/t1', baseTrip());
    const budget = (uid) => ({ uid, name: 'Meg', totalBudget: 5000, expenses: [], updatedAt: NOW });
    await assertSucceeds(setDoc(doc(db(VIEWER), `trips/t1/budgets/${VIEWER}`), budget(VIEWER)));
    await assertFails(setDoc(doc(db(VIEWER), `trips/t1/budgets/${EDITOR}`), budget(EDITOR)));
    await assertFails(setDoc(doc(db(STRANGER), `trips/t1/budgets/${STRANGER}`), budget(STRANGER)));
  });
});

// ---------------------------------------------------------------------------
describe('Venneforespørsler', () => {
  /** myPublicSnippet() i 01-firebase-profil-og-venner.js */
  const snippet = (overrides = {}) => ({
    displayName: 'Leon',
    username: '@leon',
    avatarColor: '#0d9488',
    photo: '',
    homeStation: 'Oslo S',
    ...overrides,
  });

  const request = (from, to, fromProfile = snippet()) => ({
    from, to, status: 'pending', createdAt: NOW, fromProfile,
  });

  test('sender forespørsel slik appen gjør (med og uten bilde)', async () => {
    await assertSucceeds(setDoc(doc(db(OWNER), `friendRequests/${OWNER}_${EDITOR}`), request(OWNER, EDITOR)));
    await assertSucceeds(setDoc(doc(db(VIEWER), `friendRequests/${VIEWER}_${EDITOR}`),
      request(VIEWER, EDITOR, snippet({ photo: JPEG }))));
  });

  test('forespørsel uten profilutdrag godtas fortsatt', async () => {
    const r = request(OWNER, EDITOR);
    delete r.fromProfile;
    await assertSucceeds(setDoc(doc(db(OWNER), `friendRequests/${OWNER}_${EDITOR}`), r));
  });

  test('ANGREP: ugyldig profilutdrag avvises', async () => {
    const bad = [
      snippet({ avatarColor: 'red; background:url(x)' }),
      snippet({ photo: 'https://evil.example/track.png' }),
      snippet({ displayName: 'x'.repeat(61) }),
      { ...snippet(), isVerified: true },
      'ikke et kart',
    ];
    for (const fromProfile of bad) {
      await assertFails(setDoc(doc(db(OWNER), `friendRequests/${OWNER}_${EDITOR}`), request(OWNER, EDITOR, fromProfile)));
    }
  });

  test('mottaker godtar med gyldig profilutdrag, ikke med ugyldig', async () => {
    await seed(`friendRequests/${OWNER}_${EDITOR}`, request(OWNER, EDITOR));
    const ref = doc(db(EDITOR), `friendRequests/${OWNER}_${EDITOR}`);
    await assertFails(updateDoc(ref, { status: 'accepted', acceptedAt: NOW, toProfile: snippet({ avatarColor: 'blue' }) }));
    await assertSucceeds(updateDoc(ref, { status: 'accepted', acceptedAt: NOW, toProfile: snippet() }));
  });

  test('avsender kan ikke godta sin egen forespørsel', async () => {
    await seed(`friendRequests/${OWNER}_${EDITOR}`, request(OWNER, EDITOR));
    await assertFails(updateDoc(doc(db(OWNER), `friendRequests/${OWNER}_${EDITOR}`), { status: 'accepted' }));
  });
});
