// NST Server client (B6). Sirf paise/security wale kaam: wallet, matches, join, room, results, teams, game profile.
// Baaki (friends, announcements, banners, leaderboard, notifications, appConfig) Firebase par hi rehta hai.
import { SERVER } from "./config.js";

export const useServer = () => SERVER.useServer === true;
const BASE = String(SERVER.baseUrl || "").replace(/\/+$/, "");

/** Firestore Timestamp jaisa object (ms number se), taaki home.js ka `.toDate()` chale. */
export const ts = (ms) => (Number.isFinite(Number(ms)) && ms !== null ? { toDate: () => new Date(Number(ms)), toMillis: () => Number(ms) } : null);

let getToken = async () => { throw new Error("api not ready"); };
export const bindAuth = (fn) => { getToken = fn; };

/** Server ka error: e.code = "api/<server code>", e.message = server ka public message. */
function apiError(status, body) {
  const e = new Error((body && (body.message || body.error)) || "Request failed");
  e.code = "api/" + ((body && body.error) || "http_" + status);
  e.status = status;
  return e;
}

export async function call(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (auth) headers.Authorization = "Bearer " + (await getToken());
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (_) {
    const e = new Error("network"); e.code = "auth/network-request-failed"; throw e;
  }
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw apiError(res.status, data);
  return data;
}

/* ---------- adapters: server JSON -> Firestore-jaise shape jo home.js expect karta hai ---------- */
const tournament = (t) => ({ ...t, startTime: ts(t.startTime) });
const team = (t) => (t ? { ...t, createdAt: ts(t.createdAt), members: (t.members || []).map((m) => ({ ...m, joinedAt: ts(m.joinedAt) })) } : null);

let regCache = { at: 0, items: [] };
async function registrations(force) {
  if (!force && Date.now() - regCache.at < 5000) return regCache.items;
  const r = await call("/api/my/registrations");
  regCache = { at: Date.now(), items: r.items || [] };
  return regCache.items;
}

/** Login ke baad ek baar: server par user banao/dhundo. Firebase profile 18+ ka saboot hai, isliye age18Plus bhejte hain. */
export async function ensureSession() {
  return call("/api/auth/session", { method: "POST", body: { age18Plus: true } });
}

export const server = {
  tournaments: async () => ((await call("/api/tournaments?limit=100", { auth: false })).items || []).map(tournament),
  wallet: async () => Number((await call("/api/wallet")).coins) || 0,
  room: async (tid) => { const r = (await call("/api/tournaments/" + encodeURIComponent(tid) + "/room")).room; return r ? { ...r, updatedAt: ts(r.updatedAt) } : null; },
  result: async (tid) => { const r = (await call("/api/tournaments/" + encodeURIComponent(tid) + "/results", { auth: false })).result; return r ? { ...r, publishedAt: ts(r.publishedAt) } : null; },
  myRegistrations: async () => (await registrations(true)).map((r) => ({ ...r, createdAt: ts(r.createdAt) })),
  isJoined: async (tid) => (await registrations(false)).some((r) => r.tournamentId === tid),
  join: async (tid) => { const r = await call("/api/tournaments/" + encodeURIComponent(tid) + "/join", { method: "POST" }); regCache.at = 0; return r; },
  saveGameProfile: (ingameName, gameUid, gameLevel) => call("/api/me", { method: "PATCH", body: { ingameName, gameUid, gameLevel } }),
  myTeam: async () => team((await call("/api/my/team")).team),
  createTeam: (name) => call("/api/teams", { method: "POST", body: { name } }),
  joinTeam: (code) => call("/api/teams/join", { method: "POST", body: { code } }),
  leaveTeam: () => call("/api/my/team/leave", { method: "POST" }),
  deleteTeam: () => call("/api/my/team", { method: "DELETE" }),
};
