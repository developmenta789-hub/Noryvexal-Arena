import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  EmailAuthProvider, linkWithCredential, reauthenticateWithCredential, sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, query, orderBy, limit, getDocs, where, writeBatch, increment, deleteDoc, addDoc, Timestamp,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./config.js";
import { useServer, server, bindAuth, ensureSession } from "./api.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // (default) database

/* ---------- read cache (task 5, 2026-10-04) ----------
 * Why: Firebase Spark (free) plan = 50,000 reads/day. A cold home screen reads ~100 docs (matches 30, categories 20, notices 10 + 20,
 * leaderboard 20, banners 5, appInfo 1, my matches up to 50). Public lists change rarely, so they are kept in localStorage for a few minutes
 * (per key TTL below). Every read still goes through Firestore Rules; the cache only avoids asking the same thing again.
 * - Timestamps are saved as {__ts: ms} and revived as real Timestamp objects (the UI calls toMillis/toDate).
 * - If a fresh read fails (offline) and an older copy exists, the older copy is shown.
 * - Join / leave style writes call dropCache(...) so the user's own screens never show old numbers.
 * - Refresh button: force=true refetches, but never more than once per 15 s per key (gap), so button spam cannot burn the quota.
 * - Wallet, coin history, room, results, profile are NEVER cached (money and match-critical data are always read live). */
const CK = "nx_rc1_";
const memCache = new Map();
const inflight = new Map();
const encode = (v) => JSON.stringify(v, function (k, val) { const raw = this[k]; return raw instanceof Timestamp ? { __ts: raw.toMillis() } : val; });
const decode = (s) => JSON.parse(s, (k, val) => (val && typeof val === "object" && typeof val.__ts === "number" ? Timestamp.fromMillis(val.__ts) : val));
const cacheGet = (key, persist) => {
  const m = memCache.get(key);
  if (m) return m;
  if (!persist) return null;
  try {
    const s = localStorage.getItem(CK + key);
    if (!s) return null;
    const o = decode(s);
    if (o && typeof o.t === "number") { memCache.set(key, o); return o; }
  } catch (_) {}
  return null;
};
const cachePut = (key, v, persist) => {
  const o = { t: Date.now(), v };
  memCache.set(key, o);
  if (persist) { try { localStorage.setItem(CK + key, encode(o)); } catch (_) {} }
};
/** Forget cached reads whose key starts with prefix ("" = everything). */
export const dropCache = (prefix = "") => {
  for (const k of [...memCache.keys()]) if (k.startsWith(prefix)) memCache.delete(k);
  try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(CK + prefix)) localStorage.removeItem(k); } } catch (_) {}
};
async function cached(key, ttl, fn, { force = false, persist = true, gap = 15000 } = {}) {
  const hit = cacheGet(key, persist);
  const age = hit ? Date.now() - hit.t : Infinity;
  if (hit && age < ttl && !(force && age >= gap)) return hit.v;
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try { const v = await fn(); cachePut(key, v, persist); return v; }
    catch (e) { if (hit) return hit.v; throw e; }
    finally { inflight.delete(key); }
  })();
  inflight.set(key, p);
  return p;
}
bindAuth(async () => { if (!auth.currentUser) throw new Error("not signed in"); return auth.currentUser.getIdToken(); });
export { ensureSession };
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export const googlePopup = () => signInWithPopup(auth, provider);
const PWK = "nx_pwok";   // password step: uid that already confirmed its password on this browser
let pwMem = null;        // fallback when localStorage is blocked
export const logout = () => { dropCache("myreg_"); pwMem = null; try { localStorage.removeItem(PWK); } catch (_) {} return signOut(auth); };

/** Resolves once with the first auth state on page load. */
export const firstAuthState = () =>
  new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (u) => { off(); resolve(u); });
  });

/* ---------- password step (2026-10-05) ----------
 * The Google account gets an email+password sign-in LINKED to it (same uid, same Firestore profile).
 * setup   = account has no password yet (new sign-up, or an older account)
 * confirm = has a password but it was not typed on this browser since the last login
 * ok      = confirmed, go to home. The password lives only in Firebase Auth (never in Firestore). */
export const hasPassword = (u) => !!u && u.providerData.some((p) => p.providerId === "password");
export const pwVerified = (u) => { if (!u) return false; try { return localStorage.getItem(PWK) === u.uid; } catch (_) { return pwMem === u.uid; } };
export const markPwVerified = (u) => { pwMem = u.uid; try { localStorage.setItem(PWK, u.uid); } catch (_) {} };
export const gateFor = (u) => (!hasPassword(u) ? "setup" : pwVerified(u) ? "ok" : "confirm");
/** Where a signed-in, allowed player must go next. */
export const nextUrl = (u) => (gateFor(u) === "ok" ? "home.html" : "password.html");
export const setNewPassword = async (u, pw) => { await linkWithCredential(u, EmailAuthProvider.credential(u.email, pw)); markPwVerified(u); };
export const confirmPassword = async (u, pw) => { await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, pw)); markPwVerified(u); };
export const resetPasswordMail = (email) => sendPasswordResetEmail(auth, email);

export const getProfile = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
};

export const createProfile = async (user) => {
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name: user.displayName || "Player",
    email: user.email,
    photoURL: user.photoURL || "",
    age18Plus: true,
    createdAt: serverTimestamp(),
  });
  if (useServer()) await ensureSession(); // server par bhi account (wallet 0 coins)
};

/** Saves the Arena game profile (nickname, UID, level). Firestor.rules allow only these fields (+ resetting gameVerified to false).
 *  This users/{uid} document is the single source of truth: Join and Payvex Withdraw read it, nothing is copied. */
export const saveGameProfile = async (uid, ingameName, gameUid, gameLevel, resetVerified = false) => {
  if (useServer()) await server.saveGameProfile(ingameName, gameUid, gameLevel); // server pehle (wahi validate karta hai)
  const data = { ingameName, gameUid, gameLevel };
  if (resetVerified) data.gameVerified = false; // details changed after the owner verified them: needs a new check
  return updateDoc(doc(db, "users", uid), data);
};

/* ---------- teams (A12) ---------- */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alike letters, subset of A-Z0-9
const newCode = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map((n) => CODE_CHARS[n % CODE_CHARS.length]).join(""); };

/** The user's team with members, or null. Reads: userTeams (1) + team (1) + members (up to 4). */
export const getMyTeam = async (uid) => {
  if (useServer()) return server.myTeam();
  const u = await getDoc(doc(db, "userTeams", uid));
  if (!u.exists()) return null;
  const tid = u.data().teamId;
  const t = await getDoc(doc(db, "teams", tid));
  if (!t.exists()) return null;
  const m = await getDocs(query(collection(db, "teams", tid, "members"), limit(4)));
  return { id: tid, ...t.data(), members: m.docs.map((d) => d.data()) };
};

/** One atomic batch: team + captain member + userTeams + join code. Retries once with a new code. */
export const createTeam = async (user, teamName, playerName) => {
  if (useServer()) { await server.createTeam(teamName); return; }
  for (let i = 0; i < 2; i++) {
    const code = newCode();
    const ref = doc(collection(db, "teams"));
    const b = writeBatch(db);
    b.set(ref, { name: teamName, captainUid: user.uid, captainName: playerName, code, memberCount: 1, createdAt: serverTimestamp() });
    b.set(doc(db, "teams", ref.id, "members", user.uid), { uid: user.uid, name: playerName, joinedAt: serverTimestamp() });
    b.set(doc(db, "userTeams", user.uid), { teamId: ref.id });
    b.set(doc(db, "teamCodes", code), { teamId: ref.id });
    try { await b.commit(); return; } catch (e) { if (i === 1) throw e; }
  }
};

/** Join with an 8-letter code. Rules reject it when the team is full or the user already has a team. */
export const joinTeam = async (user, code, playerName) => {
  if (useServer()) { await server.joinTeam(code); return; }
  const c = await getDoc(doc(db, "teamCodes", code));
  if (!c.exists()) { const e = new Error("no-code"); e.code = "app/no-code"; throw e; }
  const tid = c.data().teamId;
  const b = writeBatch(db);
  b.set(doc(db, "teams", tid, "members", user.uid), { uid: user.uid, name: playerName, joinedAt: serverTimestamp() });
  b.set(doc(db, "userTeams", user.uid), { teamId: tid });
  b.update(doc(db, "teams", tid), { memberCount: increment(1) });
  return b.commit();
};

/** Non-captain leaves. */
export const leaveTeam = (user, team) => {
  if (useServer()) return server.leaveTeam();
  const b = writeBatch(db);
  b.delete(doc(db, "teams", team.id, "members", user.uid));
  b.delete(doc(db, "userTeams", user.uid));
  b.update(doc(db, "teams", team.id), { memberCount: increment(-1) });
  return b.commit();
};

/** Captain deletes the team; only allowed when the captain is the only member. */
export const disbandTeam = (user, team) => {
  if (useServer()) return server.deleteTeam();
  const b = writeBatch(db);
  b.delete(doc(db, "teams", team.id, "members", user.uid));
  b.delete(doc(db, "userTeams", user.uid));
  b.delete(doc(db, "teamCodes", team.code));
  b.delete(doc(db, "teams", team.id));
  return b.commit();
};

/* ---------- friends (A14) ---------- */
/** My own friend code (string) or null. One read. */
export const getMyFriendCode = async (uid) => {
  const s = await getDoc(doc(db, "userFriendCode", uid));
  return s.exists() ? s.data().code : null;
};

/** Creates my friend code (one atomic batch: code doc + pointer). Retries once with a new code. */
export const createFriendCode = async (user, playerName) => {
  for (let i = 0; i < 2; i++) {
    const code = newCode();
    const b = writeBatch(db);
    b.set(doc(db, "friendCodes", code), { uid: user.uid, name: playerName });
    b.set(doc(db, "userFriendCode", user.uid), { code });
    try { await b.commit(); return code; } catch (e) { if (i === 1) throw e; }
  }
};

/** Adds a friend by code to MY list. Throws app/no-code when the code does not exist, app/self for own code. */
export const addFriendByCode = async (user, code) => {
  const c = await getDoc(doc(db, "friendCodes", code));
  if (!c.exists()) { const e = new Error("no-friend"); e.code = "app/no-friend"; throw e; }
  const f = c.data();
  if (f.uid === user.uid) { const e = new Error("self"); e.code = "app/self"; throw e; }
  await setDoc(doc(db, "friends", user.uid, "list", f.uid), { uid: f.uid, name: f.name, addedAt: serverTimestamp() });
  return f.name;
};

/** My friends (max 50, one query). */
export const getFriends = async (uid) => {
  const snap = await getDocs(query(collection(db, "friends", uid, "list"), limit(50)));
  return snap.docs.map((d) => d.data());
};

export const removeFriend = (uid, fuid) => deleteDoc(doc(db, "friends", uid, "list", fuid));

/** Latest tournaments, oldest start first. One read per tournament, limited to 30. */
export const getTournaments = async (force = false) => {
  if (useServer()) return server.tournaments();
  return cached("tournaments", 120000, async () => {   // 2 min
    const snap = await getDocs(query(collection(db, "tournaments"), orderBy("startTime", "asc"), limit(30)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, { force });
};

/**
 * Matches the user joined that are NOT in the 30 matches loaded by getTournaments (old finished matches fill that list first).
 * One small read per missing match (max 20), cached 2 min per match. Used only by My Matches on the home screen.
 * Server mode already returns up to 100 matches, so nothing extra is read there.
 */
export const getTournamentsByIds = async (ids) => {
  if (useServer()) return [];
  const rows = await Promise.all([...new Set(ids)].slice(0, 20).map((id) => cached("t_" + id, 120000, async () => {
    const s = await getDoc(doc(db, "tournaments", id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  }, { persist: false }).catch(() => null)));
  return rows.filter(Boolean);
};

/** Coin balance of the signed-in user (0 when no wallet exists yet). Read-only from the site. */
export const getWallet = async (uid) => {
  if (useServer()) return server.wallet();
  const s = await getDoc(doc(db, "wallets", uid));
  return s.exists() ? Number(s.data().coins) || 0 : 0;
};
/** task 4: { coins, win } where win = winnings (the only part that can be withdrawn in Payvex). */
export const getWalletFull = async (uid) => {
  if (useServer()) return { coins: await server.wallet(), win: 0 };
  const s = await getDoc(doc(db, "wallets", uid));
  const d = s.exists() ? s.data() : {};
  return { coins: Number(d.coins) || 0, win: Math.min(Number(d.winCoins) || 0, Number(d.coins) || 0) };
};

/** Room ID + password. Rules let only a player who joined this match read it. Returns null when not set yet. */
export const getRoom = async (tid) => {
  if (useServer()) return server.room(tid);
  const s = await getDoc(doc(db, "rooms", tid));
  return s.exists() ? s.data() : null;
};

/** Published results of a match (placings only). Returns null when Admin has not published yet. One read. */
export const getResult = async (tid) => {
  if (useServer()) return server.result(tid);
  const s = await getDoc(doc(db, "results", tid));
  return s.exists() ? s.data() : null;
};

/** OLD APP Results list: per-player rows { name, kills, winning } written by Admin when prizes are credited (results/{tid}/players, max 100). */
export const getResultPlayers = async (tid) => {
  const snap = await getDocs(query(collection(db, "results", tid, "players"), limit(100)));
  return snap.docs.map((d) => d.data());
};

/** Matches the user joined: one query on own registrations (rules need where uid == myUid), max 50. */
export const getMyRegistrations = async (uid) => {
  if (useServer()) return server.myRegistrations();
  return cached("myreg_" + uid, 120000, async () => {   // 2 min, cleared on join and on logout
    const snap = await getDocs(query(collection(db, "registrations"), where("uid", "==", uid), limit(50)));
    return snap.docs.map((d) => d.data());
  });
};

export const isJoined = async (tid, uid) => useServer() ? server.isJoined(tid) : (await getDoc(doc(db, "registrations", tid + "_" + uid))).exists();

/** Did this team already reserve slots in this match? (the first member's join creates it) */
// Server mode: server khud tay karta hai ki slot reserve hoga ya nahi; yahan false (sirf "Match is full" ka andaza).
export const getTeamReg = async (tid, teamId) => useServer() ? false : (await getDoc(doc(db, "teamRegs", tid + "_" + teamId))).exists();

/** OLD APP slot grid: slot number -> player name for one match (tournaments/{tid}/slots, max 100 docs, one query). */
export const getSlots = async (tid, force = false) => cached("slots_" + tid, 20000, async () => {   // 20 s, memory only; force = always fresh
  const snap = await getDocs(query(collection(db, "tournaments", tid, "slots"), limit(100)));
  const m = {};
  snap.docs.forEach((d) => { m[Number(d.id)] = String((d.data() || {}).name || "Player"); });
  return m;
}, { persist: false, force, gap: 0 });

/**
 * OLD APP join: the player picks ONE slot. One atomic batch (Firestore rules check all of it together):
 * registration (with slot) + slot doc (name) + coins - fee + joined + 1. If someone took the slot first, the batch fails.
 * Duo/Squad: every teammate joins from their own account and picks their own slot.
 */
export const joinTournament = async (t, user, name, slot) => {
  const fee = Number(t.entryFee) || 0;
  const n = Number(slot);
  const nick = String(name || "Player").slice(0, 100);
  // task 4: wallet = coins + winCoins (winnings). Fee is paid from deposit coins first, winnings last. Fresh read right before the write.
  let winPart = 0, newWin = 0;
  if (fee > 0) {
    const ws = await getDoc(doc(db, "wallets", user.uid));
    const w = ws.exists() ? ws.data() : {};
    const oldWin = Number(w.winCoins) || 0;
    newWin = Math.min(oldWin, (Number(w.coins) || 0) - fee);
    winPart = oldWin - newWin;
  }
  const b = writeBatch(db);
  const reg = { tournamentId: t.id, uid: user.uid, name: nick, fee, slot: n, createdAt: serverTimestamp() };
  if (winPart > 0) reg.winPart = winPart;
  b.set(doc(db, "registrations", t.id + "_" + user.uid), reg);
  b.set(doc(db, "tournaments", t.id, "slots", String(n)), { uid: user.uid, name: nick, createdAt: serverTimestamp() });
  if (fee > 0) b.update(doc(db, "wallets", user.uid), { coins: increment(-fee), lastJoin: t.id, winCoins: newWin });
  b.update(doc(db, "tournaments", t.id), { joined: increment(1) });
  await b.commit();
  dropCache("tournaments"); dropCache("myreg_"); dropCache("slots_");   // task 5: own screens must not show old numbers
};

/* ---------- support tickets (A16) ---------- */
/** My tickets, newest first (one query: where uid == me, max 30; sorted here so no index is needed). */
export const getMyTickets = async (uid) => {
  const snap = await getDocs(query(collection(db, "tickets"), where("uid", "==", uid), limit(30)));
  const ms = (t) => { try { return t.createdAt.toMillis(); } catch (_) { return 0; } };
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b) - ms(a));
};

/** New ticket (status open). Rules: subject 3-80, message 5-500, createdAt = server time. */
export const createTicket = (user, playerName, subject, message) =>
  addDoc(collection(db, "tickets"), { uid: user.uid, name: playerName, subject, message, status: "open", createdAt: serverTimestamp() });

/** Latest announcements (max 10). Fields: title, message, pinned, createdAt. */
export const getAnnouncements = async () => cached("announcements", 300000, async () => {   // 5 min
  const snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(10)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
});

/** Latest notices for the bell (max 20, one query). Fields: title, message, type, createdAt. */
export const getNotifications = async () => cached("notifications", 300000, async () => {   // 5 min
  const snap = await getDocs(query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(20)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
});

/** Active sponsor banners (max 5). Fields: imageUrl, linkUrl, active. */
export const getBanners = async () => cached("banners", 300000, async () => {   // 5 min. Sorted + capped to 10 in home.js (home redesign, 2026-10-05)
  const snap = await getDocs(query(collection(db, "banners"), where("active", "==", true), limit(12)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
});

/** Top 20 players by points. Fields: name, photoURL, points, kills, wins. Filled later by results feature. */
export const getLeaderboard = async () => cached("leaderboard", 600000, async () => {   // 10 min
  const snap = await getDocs(query(collection(db, "leaderboard"), orderBy("points", "desc"), limit(20)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
});

/** Game categories managed from Admin (old app "Category"): { id = game mode id, title, imageUrl, order, active }. Empty = nothing shown. */
export const getCategories = async () => cached("categories", 120000, async () => {   // 2 min (owner wants new game modes to show quickly)
  const snap = await getDocs(query(collection(db, "categories"), limit(30)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
});

/** App info from Admin (old app "App Info"): whatsappUrl, youtubeUrl, termsText, privacyText. One read, null when not set. */
export const getAppInfo = async () => cached("appinfo", 300000, async () => {   // 5 min
  const s = await getDoc(doc(db, "appInfo", "main"));
  return s.exists() ? s.data() : null;
});

/** Only users who signed up as 18+ are allowed in. */
export const isAllowed = (p) => !!p && p.age18Plus === true;

export const friendlyError = (e) => {
  const c = e && e.code;
  if (typeof c === "string" && c.startsWith("api/")) return e.status === 401 ? "Please log in again." : String(e.message || "Something went wrong. Please try again.").slice(0, 200);
  if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return "";
  if (c === "auth/popup-blocked") return "Your browser blocked the sign-in pop-up. Allow pop-ups for this site and try again.";
  if (c === "app/no-code") return "No team found for that code. Check it and try again.";
  if (c === "app/no-friend") return "No player found for that friend code. Check it and try again.";
  if (c === "app/self") return "That is your own friend code.";
  if (c === "app/slot-taken") return "This slot was just taken by someone else. Please pick another slot.";
  if (c === "auth/network-request-failed") return "Please check your internet connection and try again.";
  if (c === "auth/unauthorized-domain") return "This domain is not authorized in Firebase. Add it under Authentication > Settings > Authorized domains.";
  if (c === "auth/wrong-password" || c === "auth/invalid-credential" || c === "auth/invalid-login-credentials") return "Wrong password. Please try again.";
  if (c === "auth/too-many-requests") return "Too many attempts. Wait a few minutes, or use Forgot password.";
  if (c === "auth/weak-password") return "That password is too weak. Use at least 8 characters.";
  if (c === "auth/requires-recent-login") return "For safety, please log in with Google again and then continue.";
  if (c === "auth/credential-already-in-use" || c === "auth/email-already-in-use") return "This email already has a password login. Please contact support.";
  if (c === "auth/operation-not-allowed") return "Google sign-in is not enabled in the Firebase Console.";
  if (c === "permission-denied" || (e && /permission/i.test(e.message || ""))) return "Permission denied. Make sure the latest Firestore rules are published.";
  return "Something went wrong. Please try again in a moment.";
};
