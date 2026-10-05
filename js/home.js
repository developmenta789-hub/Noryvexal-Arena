import "./maintenance.js";
import { ensureSession, gateFor, firstAuthState, getProfile, isAllowed, logout, getTournaments, getCategories, getAppInfo, getBanners, getLeaderboard, getAnnouncements, getNotifications, getWallet, getWalletFull, getCoinHistory, saveGameProfile, getMyFriendCode, createFriendCode, addFriendByCode, getFriends, removeFriend, getMyTeam, createTeam, joinTeam, leaveTeam, disbandTeam, getMyRegistrations, getTournamentsByIds, getMyTickets, createTicket, isJoined, getRoom, getResult, getResultPlayers, getSlots, joinTournament, friendlyError } from "./firebase.js";
import { $, initBrand, setMsg, mountAd } from "./ui.js";
import { useServer, server } from "./api.js";
import { mountSponsor } from "./sponsor.js";

initBrand();
const $$ = (s) => [...document.querySelectorAll(s)];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
let all = [], tab = "ongoing", catId = null, matchId = null, profile = null, authUser = null, coins = 0;
let cats = []; // game modes come ONLY from Admin (Firestore categories). Nothing is built in.
const joinedIds = new Set();
const loaded = { t: false, lb: false, my: false, cats: false };
let myIds = [], mtab = "ongoing";
let tFailed = false, myFailed = false, catsErr = false, sponsor = null;

/* ---------- helpers ---------- */
const statusOf = (t) => (t.status === "live" || t.status === "ongoing" ? "ongoing" : t.status === "completed" || t.status === "cancelled" ? "completed" : "upcoming");
const catOf = (t) => (cats.some((c) => c.id === t.category) ? t.category : null);
const teamSizeOf = (t) => Number(t.teamSize) || 1;
const teamLabel = (t) => { const n = teamSizeOf(t); return n === 1 ? "Solo" : n === 2 ? "Duo" : n === 4 ? "Squad" : n + " players"; };
const entry = (n) => (Number(n) > 0 ? Number(n) + " coins" : "Free");
const slots = (t) => (t.maxPlayers ? (Number(t.joined) || 0) + "/" + t.maxPlayers : "\u2014");
const money = (n) => (Number(n) > 0 ? "\u20B9" + Number(n) : "Free");
const started = (t) => { try { return t.startTime.toMillis() <= Date.now(); } catch (_) { return false; } }; // task 3: start time passed = joining closed
const when = (ts) => { try { return ts.toDate().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); } catch (_) { return "Time to be announced"; } };
const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === "https:" ? x.href : ""; } catch (_) { return ""; } };
const stat = (label, value) => { const d = el("div", label === "Prize pool" ? "tstat prize" : "tstat"); d.append(el("span", "tl", label), el("strong", "", value)); return d; };

/* ---------- router ---------- */
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  let v = "home";
  if (h.startsWith("mode/")) { catId = h.slice(5); v = cats.some((c) => c.id === catId) ? "matches" : "home"; }
  else if (h.startsWith("match/")) { matchId = h.slice(6); v = "match"; }
  else if (h === "board") v = "board";
  else if (h === "my" || h.startsWith("my/")) { v = "my"; const q = h.slice(3); if ([ "ongoing", "upcoming", "completed" ].includes(q)) { mtab = q; $$(".mtab").forEach((x) => { const on = x.dataset.mtab === q; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); }); } }
  else if (h === "notifications") v = "notif";
  else if (h === "team") v = "team";
  else if (h === "friends") v = "friends";
  else if (h === "coins") v = "coins";
  else if (h === "support") v = "support";
  else if (h === "about" || h === "terms" || h === "privacy") v = h;
  else if (h === "profile") v = "profile";
  $$(".view").forEach((s) => (s.hidden = s.dataset.view !== v));
  $$("[data-nav]").forEach((a) => { const on = a.dataset.nav === (v === "matches" || v === "match" ? "home" : ["about", "terms", "privacy", "team", "friends", "coins", "support"].includes(v) ? "profile" : v); a.classList.toggle("on", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
  if (v === "home") renderMyHome();
  if (v === "matches") { $("#m-title").textContent = cats.find((c) => c.id === catId).name; renderMatches(); mountAd($("#ad-matches")); }
  if (v === "match") renderDetail();
  if (v === "board" && !loaded.lb) loadBoard();
  if (v === "notif") showNotifs();
  if (v === "team") loadTeam();
  if (v === "friends") loadFriends();
  if (v === "coins") loadCoinHistory();
  if (v === "support") loadSupport();
  if (v === "my") { loaded.my ? renderMy() : loadMy(); }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

/* ---------- Esports Matches: one card per section made in Admin (Categories). Max 3 per row (CSS grid). ---------- */
const PALETTE = ["#6366F1", "#22D3EE", "#F59E0B", "#EC4899", "#22C55E", "#8B5CF6"];
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>';
const iconTile = () => { const ic = el("span", "ecard-ic"); ic.innerHTML = ICON; return ic; }; // static trusted SVG
function renderCats() {
  const box = $("#cats");
  $("#home-empty").hidden = !(loaded.cats && !catsErr && !cats.length);
  $("#es-err").hidden = !(catsErr && !cats.length);
  if (catsErr && !cats.length) { box.hidden = true; return; }
  if (!loaded.cats) { // skeletons have the same size as real cards, so nothing jumps when data arrives
    box.hidden = false;
    box.replaceChildren(...[0, 1, 2].map(() => { const k = el("div", "ecard sk"); k.append(el("span", "ecard-art"), el("span", "ecard-foot")); return k; }));
    return;
  }
  box.hidden = !cats.length;
  box.replaceChildren(...cats.map((c, i) => {
    const rows = all.filter((t) => catOf(t) === c.id);
    const live = rows.filter((t) => statusOf(t) === "ongoing").length;
    const soon = rows.filter((t) => statusOf(t) === "upcoming").length;
    const a = el("a", "ecard"); a.href = "#/mode/" + c.id; a.style.setProperty("--a", PALETTE[i % PALETTE.length]);
    a.setAttribute("aria-label", c.name + (c.tag ? ". " + c.tag : ""));
    const art = el("span", "ecard-art");
    if (c.img) {
      const im = el("img"); im.alt = ""; im.loading = "lazy"; im.decoding = "async"; im.referrerPolicy = "no-referrer";
      im.addEventListener("load", () => im.classList.add("ok"));
      im.addEventListener("error", () => { im.remove(); art.prepend(iconTile()); }); // broken image: tidy icon tile
      im.src = c.img; art.append(im);
    } else art.append(iconTile());
    if (loaded.t && (live || soon)) art.append(el("span", "ecard-badge" + (live ? " hot" : ""), live ? "\u25CF " + live + " live" : soon + " upcoming"));
    const foot = el("span", "ecard-foot"); foot.append(el("span", "ecard-ft", c.name));
    foot.title = c.tag || c.name;
    a.append(art, foot);
    return a;
  }));
}
$("#es-retry").addEventListener("click", () => { catsErr = false; loadCategories(); });

/* ---------- My Matches (home): joined matches, grouped by their real status ---------- */
const MH = [["upcoming", "Upcoming"], ["ongoing", "Ongoing"], ["completed", "Completed"]];
const MH_LIMIT = 4;           // cards per group before "Show all"
const mhOpen = {};
const startMs = (t) => { try { return t.startTime.toMillis(); } catch (_) { return 0; } };
function renderMyHome() {} // home now shows 3 tiles (Ongoing / Upcoming / Completed) that open #/my/<tab>

/* ---------- matches ---------- */
function card(t) {
  const c = el("article", "tcard");
  const bu = safeUrl(t.bannerUrl), lu = safeUrl(t.logoUrl);
  if (bu) { // old app match card: banner on top, dark fade, FREE FIRE badge
    const ban = el("div", "tban"); const im = el("img"); im.src = bu; im.alt = ""; im.loading = "lazy"; im.referrerPolicy = "no-referrer";
    ban.append(im, el("span", "tbadge", "FREE FIRE")); c.append(ban);
  }
  const head = el("div", "thead");
  if (lu) { const lg = el("img", "tlogo"); lg.src = lu; lg.alt = ""; lg.width = 46; lg.height = 46; lg.referrerPolicy = "no-referrer"; head.append(lg); }
  const ttl = el("div", "ttl"); ttl.append(el("h3", "", String(t.title || "Untitled match").slice(0, 80)), el("p", "twhen", when(t.startTime)));
  head.append(ttl, el("span", "pill " + statusOf(t), statusOf(t)));
  const stats = el("div", "tstats");
  stats.append(stat("Entry", entry(t.entryFee)), stat("Prize pool", money(t.prizePool)), stat("Per kill", Number(t.perKill) > 0 ? "\u20B9" + Number(t.perKill) : "\u2014"), stat("Slots", slots(t)));
  c.tabIndex = 0; c.setAttribute("role", "link"); c.classList.add("go");
  const open = () => { location.hash = "#/match/" + t.id; };
  c.addEventListener("click", open);
  c.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  c.append(head, el("p", "tmeta", [t.mode, t.map].filter(Boolean).join(" \u2022 ")), stats);
  return c;
}
function renderDetail() {
  const box = $("#d-body");
  const t = all.find((x) => x.id === matchId);
  if (!t) { box.replaceChildren(el("p", "lempty", loaded.t ? "This match was not found. It may have been removed." : "Loading\u2026")); $("#d-back").href = "#/"; return; }
  $("#d-back").href = catOf(t) ? "#/mode/" + catOf(t) : "#/";
  const head = el("div", "thead");
  head.append(el("h2", "dtitle", String(t.title || "Untitled match").slice(0, 80)), el("span", "pill " + statusOf(t), statusOf(t)));
  const cat = cats.find((c) => c.id === catOf(t));
  const stats = el("div", "tstats");
  stats.append(stat("Entry", entry(t.entryFee)), stat("Prize pool", money(t.prizePool)), stat("Slots", slots(t)));
  const prizes = [["1st place", t.prize1], ["2nd place", t.prize2], ["3rd place", t.prize3], ["Per kill", t.perKill]].filter((r) => Number(r[1]) > 0);
  const pbox = el("div", "dbox"); pbox.append(el("h3", "", "Prizes"));
  if (prizes.length) prizes.forEach((r) => { const row = el("div", "prow"); row.append(el("span", "", r[0]), el("strong", "", "\u20B9" + Number(r[1]))); pbox.append(row); });
  else pbox.append(el("p", "tmeta", "Prize details will be announced."));
  const rbox = el("div", "dbox"); rbox.append(el("h3", "", "Rules"), el("div", "rules", String(t.rules || "Rules will be announced before the match.").slice(0, 1000)));
  const rm = el("div", "dbox"); rm.hidden = true;
  const res = el("div", "dbox"); res.hidden = true;
  const join = el("button", "btn", "Checking\u2026"); join.type = "button"; join.disabled = true;
  const kids = [];
  const bu = safeUrl(t.bannerUrl);
  if (bu) { const ban = el("div", "tban big"); const im = el("img"); im.src = bu; im.alt = ""; im.referrerPolicy = "no-referrer"; ban.append(im, el("span", "tbadge", "FREE FIRE")); kids.push(ban); }
  kids.push(head, el("p", "tmeta", [cat && cat.name, t.game, teamLabel(t), t.mode, t.map].filter(Boolean).join(" \u2022 ")), stats, el("p", "twhen", "Starts " + when(t.startTime)));
  const lv = safeUrl(t.liveUrl);
  if (lv) { const a = el("a", "btn live", "Watch live"); a.href = lv; a.target = "_blank"; a.rel = "noopener noreferrer"; kids.push(a); }
  const sbox = el("div", "dbox"); sbox.append(el("h3", "", "Slots"), el("p", "tmeta", "Loading\u2026"));
  kids.push(sbox, res, pbox, rm, rbox, join);
  box.replaceChildren(...kids);
  if (statusOf(t) === "completed" && t.status !== "cancelled") loadResult(t, res);
  setupJoin(t, join, rm, sbox);
}
const pad2 = (n) => String(n).padStart(2, "0");
/**
 * OLD APP slot list (one row per slot): [checkbox] 01 PLAYER NAME / Empty. Duo/Squad get a small gap after every 2/4 rows (team grouping).
 * canPick = true: tapping an empty row only selects/ticks it; joining happens later with the CONFIRM button.
 */
function renderSlots(t, box, sm, pick, canPick, onPick) {
  const max = Math.min(Number(t.maxPlayers) || 0, 100), ts = teamSizeOf(t);
  const h = el("h3", "", canPick ? "Select your slot" : "Slots");
  if (!max) { box.replaceChildren(h, el("p", "tmeta", "Slots will be announced.")); return; }
  const taken = Object.keys(sm).filter((k) => Number(k) >= 1 && Number(k) <= max).length;
  const list = el("div", "slist");
  for (let i = 1; i <= max; i++) {
    const mine = sm[i] != null && sm[i] === playerName() && joinedIds.has(t.id) && !canPick;
    const r = el("div", "srow" + (sm[i] != null ? " taken" : "") + (pick === i ? " pick" : "") + (mine ? " mine" : "") + (ts > 1 && i > 1 && (i - 1) % ts === 0 ? " gap" : ""));
    const cb = el("span", "scb", sm[i] != null || pick === i ? "\u2713" : "");
    r.append(cb, el("span", "sno", pad2(i)), el("span", "snm", sm[i] != null ? String(sm[i]).slice(0, 30) : "Empty"));
    if (canPick && sm[i] == null) { r.tabIndex = 0; r.setAttribute("role", "checkbox"); r.setAttribute("aria-checked", pick === i); const go = () => onPick(pick === i ? 0 : i); r.addEventListener("click", go); r.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }); }
    list.append(r);
  }
  box.replaceChildren(h, list, el("p", "tmeta", taken + " of " + max + " slots taken" + (ts > 1 ? " \u2022 each player picks their own slot" : "")));
}
async function refreshWallet() {
  let win = 0;
  try { const w = await getWalletFull(authUser.uid); coins = w.coins; win = w.win; } catch (_) {}
  $("#coins").textContent = coins; $("#p-coins").textContent = coins;
  const pw = $("#p-win"); if (pw) pw.textContent = win;   // task 4: winnings = the part you can withdraw in Payvex
}
/** Room ID + password, shown only to players who joined (Firestore rules enforce this, not this code). */
async function loadRoom(t, box) {
  box.hidden = false;
  box.replaceChildren(el("h3", "", "Room details"), el("p", "tmeta", "Loading\u2026"));
  let r = null, failed = false;
  try { r = await getRoom(t.id); } catch (_) { failed = true; }
  if (matchId !== t.id) return;
  const h = el("h3", "", "Room details");
  if (!r) { box.replaceChildren(h, el("p", "tmeta", failed ? "Could not load room details. Refresh and try again." : "Room ID and password will appear here before the match starts.")); return; }
  const line = (label, value) => { const row = el("div", "prow"); row.append(el("span", "", label), el("strong", "", String(value || "\u2014").slice(0, 60))); return row; };
  box.replaceChildren(h, line("Room ID", r.roomId), line("Password", r.roomPassword));
}
/** Results of a completed match (names only, no coins). Anyone can read them. */
async function loadResult(t, box) {
  box.hidden = false;
  const h = el("h3", "", "Results");
  box.replaceChildren(h, el("p", "tmeta", "Loading\u2026"));
  let r = null, failed = false, plist = [];
  try { r = await getResult(t.id); } catch (_) { failed = true; }
  try { plist = await getResultPlayers(t.id); } catch (_) {}
  if (matchId !== t.id) return;
  if (!r && plist.length) r = {};
  if (!r) { box.replaceChildren(h, el("p", "tmeta", failed ? "Could not load results. Refresh and try again." : "Results will be published soon.")); return; }
  const line = (label, value) => { const row = el("div", "prow"); row.append(el("span", "", label), el("strong", "", String(value).slice(0, 60))); return row; };
  const rows = [["1st place", r.place1], ["2nd place", r.place2], ["3rd place", r.place3]].filter((x) => x[1]).map((x) => line(x[0], x[1]));
  if (r.topKiller) rows.push(line("Top killer", r.topKiller + (Number(r.topKills) > 0 ? " (" + Number(r.topKills) + " kills)" : "")));
  const kids = [h, ...rows];
  if (plist.length) { // old app Results: Name / Kill / Winning per player, best winning first
    const tb = el("div", "rtable"); const hd = el("div", "rrow rhead"); hd.append(el("span", "", "Player"), el("span", "", "Kills"), el("span", "", "Winning")); tb.append(hd);
    plist.slice().sort((a, b) => (Number(b.winning) || 0) - (Number(a.winning) || 0)).forEach((x) => {
      const rr = el("div", "rrow"); rr.append(el("span", "rn", String(x.name || "Player").slice(0, 30)), el("span", "", String(Number(x.kills) || 0)), el("strong", "", "\u20B9" + (Number(x.winning) || 0))); tb.append(rr);
    });
    kids.push(tb);
  }
  if (r.note) kids.push(el("p", "tmeta", String(r.note).slice(0, 300)));
  box.replaceChildren(...kids);
}
async function setupJoin(t, btn, rm, sbox) {
  const fee = Number(t.entryFee) || 0;
  setMsg($("#d-msg"), "", "");
  const slotsP = getSlots(t.id).catch(() => null);
  let joined = joinedIds.has(t.id);
  if (!joined) { try { joined = await isJoined(t.id, authUser.uid); if (joined) joinedIds.add(t.id); } catch (_) {} }
  if (matchId !== t.id) return;
  if (joined && statusOf(t) !== "completed") loadRoom(t, rm);
  let sm = await slotsP;
  if (matchId !== t.id) return;
  if (!sm) { sm = {}; setMsg($("#d-msg"), "error", "Could not load slots. Refresh and try again."); }
  const stop = (text) => { btn.textContent = text; btn.disabled = true; renderSlots(t, sbox, sm, 0, false); };
  if (t.status === "cancelled") return stop("Match cancelled (entry fee refunded)");
  if (joined) return stop("You joined this match");
  if (statusOf(t) !== "upcoming") return stop("Registration closed");
  if (started(t)) return stop("Registration closed (match has started)");
  if (t.joinEnabled === false) return stop("Joining is paused for this match");
  const max = Math.min(Number(t.maxPlayers) || 0, 100);
  if (!max) return stop("Slots will be announced");
  if (Object.keys(sm).length >= max || (Number(t.joined) || 0) >= max) return stop("MATCH FULL");
  if (!(profile.ingameName || "").trim()) return stop("Set your in-game name first (Profile)");
  if (fee > coins) return stop("Not enough coins (need " + fee + ")");
  const nick = playerName();
  let pick = 0;
  const draw = () => {
    renderSlots(t, sbox, sm, pick, true, (n) => { pick = n; draw(); });
    sbox.append(el("p", "tmeta", "Your game nickname: " + nick));
    btn.disabled = !pick;
    btn.textContent = pick ? "CONFIRM SLOT " + pad2(pick) + (fee ? " \u2022 " + fee + " coins" : " \u2022 Free") : "Select your slot above";
  };
  draw();
  btn.onclick = async () => {
    if (!pick) return setMsg($("#d-msg"), "error", "Please select your slot number above before joining.");
    if (sm[pick] != null) { pick = 0; draw(); return setMsg($("#d-msg"), "error", friendlyError({ code: "app/slot-taken" })); }
    if (!confirm("Confirm slot #" + pick + " with nickname \"" + nick + "\"" + (fee ? " for " + fee + " coins?" : "?"))) return;
    btn.disabled = true; btn.textContent = "Joining\u2026"; setMsg($("#d-msg"), "", "");
    try {
      await joinTournament(t, authUser, nick, pick);
      joinedIds.add(t.id); if (!myIds.includes(t.id)) myIds.push(t.id); t.joined = (Number(t.joined) || 0) + 1;
      await refreshWallet(); renderDetail();
      setMsg($("#d-msg"), "success", "Slot #" + pick + " reserved. Joined match successfully. Good luck!");
    } catch (e) {
      let fresh = null; try { fresh = await getSlots(t.id, true); } catch (_) {}
      if (matchId !== t.id) return;
      if (fresh) sm = fresh;
      if (sm[pick] != null) { pick = 0; setMsg($("#d-msg"), "error", friendlyError({ code: "app/slot-taken" })); }
      else setMsg($("#d-msg"), "error", friendlyError(e) || "Could not join. Please try again.");
      draw();
    }
  };
}
function renderMatches() {
  const rows = all.filter((t) => catOf(t) === catId && statusOf(t) === tab);
  if (tab === "completed") rows.reverse();
  $("#tlist").replaceChildren(...rows.map(card));
  $("#tempty").hidden = rows.length > 0 || !loaded.t;
  const names = { ongoing: "No ongoing matches", upcoming: "No upcoming matches", completed: "No completed matches" };
  $("#tempty-title").textContent = names[tab];
  $("#tempty-text").textContent = "Check another tab, or come back later. New matches are announced here.";
}
async function loadTournaments(force = false) {
  setMsg($("#terr"), "", "");
  $("#refresh").disabled = true;
  try { all = await getTournaments(force === true); loaded.t = true; tFailed = false; }
  catch (e) { tFailed = true; setMsg($("#terr"), "error", friendlyError(e) || "Could not load matches. Check your connection and refresh."); }
  finally { $("#refresh").disabled = false; renderCats(); if (catId && !$("#v-matches").hidden) renderMatches(); if (matchId && !$("#v-match").hidden) renderDetail(); syncMy(); }
}
$$(".tab").forEach((b) => b.addEventListener("click", () => {
  tab = b.dataset.tab;
  $$(".tab").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); });
  renderMatches();
}));
$("#refresh").addEventListener("click", () => loadTournaments(true));   // task 5: button = fresh read (max once per 15 s), page load = cache

/* ---------- notifications (bell) ---------- */
let notifs = [], notifOk = false, notifTried = false;
const SEEN = "nst_notif_seen";
const seenAt = () => { try { return Number(localStorage.getItem(SEEN)) || 0; } catch (_) { return 0; } };
const tsMs = (t) => { try { return t.toDate().getTime(); } catch (_) { return 0; } };
function updateBell() { $("#bell-dot").hidden = !notifs.some((n) => tsMs(n.createdAt) > seenAt()); }
async function loadNotifs() {
  try { notifs = await getNotifications(); notifOk = true; } catch (_) {}
  notifTried = true;
  updateBell(); if (!$("#v-notif").hidden) showNotifs();
}
function showNotifs() {
  setMsg($("#nerr"), "", "");
  if (!notifTried) { $("#nlist").replaceChildren(el("p", "lempty", "Loading\u2026")); $("#nempty").hidden = true; return; }
  if (!notifOk) { $("#nlist").replaceChildren(); $("#nempty").hidden = true; setMsg($("#nerr"), "error", "Could not load notifications. Refresh and try again."); return; }
  $("#nlist").replaceChildren(...notifs.map((n) => {
    const fresh = tsMs(n.createdAt) > seenAt();
    const c = el("article", "ucard" + (fresh ? " pin" : ""));
    const h = el("div", "thead");
    h.append(el("h3", "", String(n.title || "Notice").slice(0, 80)));
    if (n.type === "match" || n.type === "offer") h.append(el("span", "pill upcoming", n.type));
    c.append(h, el("p", "umsg", String(n.message || "").slice(0, 120) + (String(n.message || "").length > 120 ? "\u2026" : "")), el("p", "twhen", when(n.createdAt)));
    c.classList.add("go"); c.tabIndex = 0; c.setAttribute("role", "button");
    const open = () => { $("#ndlg-title").textContent = String(n.title || "Notice").slice(0, 80); $("#ndlg-msg").textContent = String(n.message || "").slice(0, 1000); $("#ndlg-when").textContent = when(n.createdAt); $("#ndlg").hidden = false; $("#ndlg-close").focus(); };
    c.addEventListener("click", open); c.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
    return c;
  }));
  $("#nempty").hidden = notifs.length > 0;
  const newest = Math.max(0, ...notifs.map((n) => tsMs(n.createdAt)));
  try { if (newest) localStorage.setItem(SEEN, String(newest)); } catch (_) {}
  $("#bell-dot").hidden = true;
}

/* old app notification detail dialog */
$("#ndlg-close").addEventListener("click", () => { $("#ndlg").hidden = true; });
$("#ndlg").addEventListener("click", (e) => { if (e.target.id === "ndlg") $("#ndlg").hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#ndlg").hidden = true; });

/* ---------- team (A12) ---------- */
let team = null, teamState = "idle";
const playerName = () => (profile.ingameName || profile.name || "Player").trim().slice(0, 100);
async function loadTeam() {
  const box = $("#team-body"); setMsg($("#team-msg"), "", "");
  box.replaceChildren(el("p", "lempty", "Loading\u2026"));
  try { team = await getMyTeam(authUser.uid); teamState = "ok"; }
  catch (e) { teamState = "err"; box.replaceChildren(); setMsg($("#team-msg"), "error", friendlyError(e) || "Could not load your team. Refresh and try again."); return; }
  renderTeam();
}
function field(label, id, attrs) {
  const l = el("label", "flabel", label); l.htmlFor = id;
  const i = el("input", "finput"); i.id = id; i.type = "text"; i.autocomplete = "off"; Object.assign(i, attrs);
  return [l, i];
}
function renderTeam() {
  const box = $("#team-body"), msg = $("#team-msg");
  if (!team) {
    const c = el("div", "dbox"); c.append(el("h3", "", "Create a team"), el("p", "tmeta", "You become the captain. Share the team code with up to 3 friends."));
    const [l1, name] = field("Team name (2 to 24 characters)", "t-name", { maxLength: 24, placeholder: "Team name" });
    const mk = el("button", "btn", "Create team"); mk.type = "button";
    c.append(l1, name, mk);
    const j = el("div", "dbox"); j.append(el("h3", "", "Join with a code"), el("p", "tmeta", "Ask your captain for the 8-character team code."));
    const [l2, code] = field("Team code", "t-code", { maxLength: 8, placeholder: "e.g. K7M2QX9P" }); code.style.textTransform = "uppercase";
    const jn = el("button", "btn", "Join team"); jn.type = "button";
    j.append(l2, code, jn);
    mk.onclick = async () => {
      const n = name.value.trim();
      if (n.length < 2 || n.length > 24) return setMsg(msg, "error", "Team name must be 2 to 24 characters.");
      mk.disabled = true; setMsg(msg, "", "");
      try { await createTeam(authUser, n, playerName()); await loadTeam(); setMsg($("#team-msg"), "success", "Team created. Share your code with friends."); }
      catch (e) { mk.disabled = false; setMsg(msg, "error", friendlyError(e) || "Could not create the team. Please try again."); }
    };
    jn.onclick = async () => {
      const cd = code.value.trim().toUpperCase();
      if (!/^[A-Z0-9]{8}$/.test(cd)) return setMsg(msg, "error", "The team code has 8 letters or numbers.");
      jn.disabled = true; setMsg(msg, "", "");
      try { await joinTeam(authUser, cd, playerName()); await loadTeam(); setMsg($("#team-msg"), "success", "You joined the team."); }
      catch (e) { jn.disabled = false; setMsg(msg, "error", e && e.code === "app/no-code" ? friendlyError(e) : "Could not join. The team may be full, or you may already be in a team."); }
    };
    box.replaceChildren(c, j); return;
  }
  const isCap = team.captainUid === authUser.uid;
  const info = el("div", "dbox"); info.append(el("h3", "", String(team.name).slice(0, 24)), el("p", "tmeta", "Members: " + team.members.length + "/4"));
  const codeRow = el("div", "tcode"); const cs = el("strong", "", team.code);
  const cp = el("button", "btn ghost", "Copy"); cp.type = "button";
  cp.onclick = async () => { try { await navigator.clipboard.writeText(team.code); cp.textContent = "Copied"; } catch (_) { cp.textContent = "Select and copy"; } };
  codeRow.append(cs, cp); info.append(codeRow, el("p", "tmeta", "Share this code so friends can join. Anyone with the code can join while there is space."));
  const list = el("div", "dbox"); list.append(el("h3", "", "Members"));
  team.members.slice().sort((a, b) => (b.uid === team.captainUid) - (a.uid === team.captainUid)).forEach((m) => {
    const row = el("div", "prow"); row.append(el("span", "", String(m.name).slice(0, 40) + (m.uid === authUser.uid ? " (you)" : "")), el("strong", "", m.uid === team.captainUid ? "Captain" : "Member")); list.append(row);
  });
  const act = el("div", "dbox");
  if (isCap) {
    if (team.members.length > 1) act.append(el("p", "tmeta", "You can delete the team only when you are the last member. Other members must leave first."));
    const d = el("button", "btn danger", "Delete team"); d.type = "button"; d.disabled = team.members.length > 1;
    d.onclick = async () => {
      if (!confirm("Delete this team? This cannot be undone.")) return;
      d.disabled = true;
      try { await disbandTeam(authUser, team); await loadTeam(); } catch (e) { d.disabled = false; setMsg(msg, "error", friendlyError(e) || "Could not delete the team. Refresh and try again."); }
    };
    act.append(d);
  } else {
    const lv = el("button", "btn danger", "Leave team"); lv.type = "button";
    lv.onclick = async () => {
      if (!confirm("Leave this team?")) return;
      lv.disabled = true;
      try { await leaveTeam(authUser, team); await loadTeam(); } catch (e) { lv.disabled = false; setMsg(msg, "error", friendlyError(e) || "Could not leave the team. Refresh and try again."); }
    };
    act.append(lv);
  }
  box.replaceChildren(info, list, act);
}

/* ---------- friends (A14) ---------- */
let myFCode = null, friends = [];
async function loadFriends() {
  const box = $("#friends-body"); setMsg($("#friends-msg"), "", "");
  box.replaceChildren(el("p", "tmeta", "Loading..."));
  try { [myFCode, friends] = await Promise.all([getMyFriendCode(authUser.uid), getFriends(authUser.uid)]); }
  catch (e) { box.replaceChildren(); setMsg($("#friends-msg"), "error", friendlyError(e) || "Could not load your friends. Refresh and try again."); return; }
  renderFriends();
}
function renderFriends() {
  const box = $("#friends-body"), msg = $("#friends-msg");
  const mine = el("div", "dbox"); mine.append(el("h3", "", "Your friend code"));
  if (myFCode) {
    mine.append(el("p", "tmeta", "Share this code. Friends who enter it can add you to their list."));
    const row = el("div", "tcode"); const cs = el("strong", "", myFCode);
    const cp = el("button", "btn ghost", "Copy"); cp.type = "button";
    cp.onclick = async () => { try { await navigator.clipboard.writeText(myFCode); cp.textContent = "Copied"; } catch (_) { cp.textContent = "Select and copy"; } };
    row.append(cs, cp); mine.append(row);
  } else {
    mine.append(el("p", "tmeta", "Create your code once. It shows only your player name."));
    const mk = el("button", "btn", "Create my code"); mk.type = "button";
    mk.onclick = async () => {
      mk.disabled = true; setMsg(msg, "", "");
      try { myFCode = await createFriendCode(authUser, playerName()); renderFriends(); }
      catch (e) { mk.disabled = false; setMsg(msg, "error", friendlyError(e) || "Could not create your code. Please try again."); }
    };
    mine.append(mk);
  }
  const add = el("div", "dbox"); add.append(el("h3", "", "Add a friend"), el("p", "tmeta", "Enter your friend's 8-character friend code."));
  const [l, code] = field("Friend code", "f-code", { maxLength: 8, placeholder: "e.g. K7M2QX9P" }); code.style.textTransform = "uppercase";
  const ab = el("button", "btn", "Add friend"); ab.type = "button";
  ab.onclick = async () => {
    const cd = code.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(cd)) return setMsg(msg, "error", "The friend code has 8 letters or numbers.");
    if (friends.length >= 50) return setMsg(msg, "error", "You can keep up to 50 friends. Remove one first.");
    ab.disabled = true; setMsg(msg, "", "");
    try { const n = await addFriendByCode(authUser, cd); friends = await getFriends(authUser.uid); renderFriends(); setMsg($("#friends-msg"), "success", String(n).slice(0, 40) + " added to your friends."); }
    catch (e) { ab.disabled = false; setMsg(msg, "error", friendlyError(e) || "Could not add this friend. Please try again."); }
  };
  add.append(l, code, ab);
  const list = el("div", "dbox"); list.append(el("h3", "", "My friends (" + friends.length + ")"));
  if (!friends.length) list.append(el("p", "tmeta", "No friends yet. Add one with a friend code."));
  friends.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).forEach((f) => {
    const row = el("div", "prow"); const rm = el("button", "btn ghost sm", "Remove"); rm.type = "button";
    rm.onclick = async () => {
      if (!confirm("Remove " + String(f.name).slice(0, 40) + " from your friends?")) return;
      rm.disabled = true;
      try { await removeFriend(authUser.uid, f.uid); friends = friends.filter((x) => x.uid !== f.uid); renderFriends(); }
      catch (e) { rm.disabled = false; setMsg(msg, "error", friendlyError(e) || "Could not remove. Please try again."); }
    };
    row.append(el("span", "", String(f.name).slice(0, 40)), rm); list.append(row);
  });
  box.replaceChildren(mine, add, list);
}

/* ---------- my matches ---------- */
async function loadMy() {
  setMsg($("#merr"), "", ""); myFailed = false;
  try { myIds = (await getMyRegistrations(authUser.uid)).map((r) => r.tournamentId); myIds.forEach((i) => joinedIds.add(i)); loaded.my = true; }
  catch (e) { myFailed = true; setMsg($("#merr"), "error", friendlyError(e) || "Could not load your matches. Refresh and try again."); renderMyHome(); return; }
  await syncMy();
}
/** Joined matches older than the 30 loaded ones are fetched one by one (small, cached), then both My Matches screens are drawn. */
async function syncMy() {
  if (loaded.my && loaded.t) {
    const miss = myIds.filter((id) => !all.some((t) => t.id === id));
    if (miss.length) { try { const add = (await getTournamentsByIds(miss)).filter((r) => !all.some((t) => t.id === r.id)); if (add.length) all = all.concat(add); } catch (_) {} }
  }
  renderMyHome();
  if (loaded.my && !$("#v-my").hidden) renderMy();
}
function renderMy() {
  const mine = all.filter((t) => myIds.includes(t.id));
  const rows = mine.filter((t) => statusOf(t) === mtab);
  if (mtab === "completed") rows.reverse();
  $("#mlist").replaceChildren(...rows.map(card));
  const names = { ongoing: "No ongoing matches", upcoming: "No upcoming matches", completed: "No completed matches" };
  $("#mempty-title").textContent = names[mtab];
  $("#mempty").hidden = rows.length > 0 || !loaded.t;
}
$$(".mtab").forEach((b) => b.addEventListener("click", () => {
  mtab = b.dataset.mtab;
  $$(".mtab").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); });
  renderMy();
}));

/* ---------- coin history (A18, Firestore se; server mode mein server se) ---------- */
const COIN_LABELS = { deposit: "Deposit added", join: "Match entry fee", prize: "Prize won", refund: "Match refund", withdraw: "Withdraw request", withdraw_refund: "Withdraw returned" };
async function loadCoinHistory() {
  setMsg($("#cerr"), "", "");
  const list = $("#clist"), empty = $("#cempty");
  let rows;
  try { rows = await getCoinHistory(authUser.uid); }
  catch (e) { setMsg($("#cerr"), "error", friendlyError(e) || "Could not load your coin history. Refresh and try again."); return; }
  empty.hidden = rows.length > 0;
  list.replaceChildren(...rows.map((r) => {
    const plus = Number(r.delta) > 0;
    const c = el("article", "ucard");
    const h = el("div", "thead");
    h.append(el("h3", "", COIN_LABELS[r.type] || "Coins"), el("span", "pill " + (plus ? "ongoing" : "upcoming"), (plus ? "+" : "") + Number(r.delta) + " coins"));
    const note = r.note ? String(r.note).slice(0, 80) : "";
    c.append(h, el("p", "umsg", [note, r.balanceAfter != null ? "Balance: " + Number(r.balanceAfter) : ""].filter(Boolean).join(" | ")), el("p", "twhen", when(r.createdAt)));
    return c;
  }));
}

/* ---------- help and support (A16): ticket banao, Admin ka reply dekho ---------- */
let tickets = [];
async function loadSupport() {
  const box = $("#support-body"); setMsg($("#support-msg"), "", "");
  box.replaceChildren(el("p", "tmeta", "Loading..."));
  try { tickets = await getMyTickets(authUser.uid); }
  catch (e) { box.replaceChildren(); setMsg($("#support-msg"), "error", friendlyError(e) || "Could not load your tickets. Refresh and try again."); return; }
  renderSupport();
}
function renderSupport() {
  const box = $("#support-body"), msg = $("#support-msg");
  const form = el("div", "dbox"); form.append(el("h3", "", "Contact us"), el("p", "tmeta", "Problem with a match, coins or your account? Write it here. We reply in this page."));
  const [l1, subj] = field("Subject", "t-subject", { maxLength: 80, placeholder: "e.g. Room ID not showing" });
  const l2 = el("label", "flabel", "Message"); l2.htmlFor = "t-msg";
  const text = el("textarea", "finput"); text.id = "t-msg"; text.rows = 4; text.maxLength = 500; text.placeholder = "Explain the problem (5 to 500 characters)";
  const send = el("button", "btn", "Send ticket"); send.type = "button";
  send.onclick = async () => {
    const s1 = subj.value.trim(), m1 = text.value.trim();
    if (s1.length < 3) return setMsg(msg, "error", "Subject needs at least 3 characters.");
    if (m1.length < 5) return setMsg(msg, "error", "Message needs at least 5 characters.");
    if (tickets.filter((t) => t.status === "open").length >= 3) return setMsg(msg, "error", "You already have 3 open tickets. Please wait for a reply.");
    send.disabled = true; setMsg(msg, "", "");
    try { await createTicket(authUser, playerName(), s1, m1); tickets = await getMyTickets(authUser.uid); renderSupport(); setMsg($("#support-msg"), "success", "Ticket sent. Check back here for our reply."); }
    catch (e) { send.disabled = false; setMsg(msg, "error", friendlyError(e) || "Could not send your ticket. Please try again."); }
  };
  form.append(l1, subj, l2, text, send);
  const list = el("div", "ulist");
  const head = el("div", "dbox"); head.append(el("h3", "", "My tickets (" + tickets.length + ")"));
  if (!tickets.length) head.append(el("p", "tmeta", "No tickets yet."));
  list.append(...tickets.map((t) => {
    const c = el("article", "ucard"); const h = el("div", "thead");
    h.append(el("h3", "", String(t.subject || "Ticket").slice(0, 80)), el("span", "pill " + (t.status === "open" ? "upcoming" : "completed"), String(t.status || "open")));
    c.append(h, el("p", "umsg", String(t.message || "").slice(0, 500)), el("p", "twhen", when(t.createdAt)));
    if (t.reply) { const r = el("div", "dbox"); r.append(el("h3", "", "Reply from NST"), el("p", "umsg", String(t.reply).slice(0, 500)), el("p", "twhen", when(t.repliedAt))); c.append(r); }
    return c;
  }));
  box.replaceChildren(form, head, list);
}

/* ---------- categories + app info (old app: Category, App Info) set from Admin ---------- */
async function loadCategories() {
  let rows = [];
  try { rows = await getCategories(); } catch (_) { catsErr = true; renderCats(); return; }
  loaded.cats = true; catsErr = false;
  cats = rows.filter((r) => r.active !== false && /^[a-z0-9][a-z0-9-]{1,38}$/.test(String(r.id)))
    .sort((a, b) => (Number(b.order) || 0) - (Number(a.order) || 0))
    .map((r) => ({ id: r.id, name: String(r.title || r.id).slice(0, 40), tag: String(r.subtitle || "").slice(0, 60), img: safeUrl(r.imageUrl) }));
  renderCats();
  if (location.hash.startsWith("#/mode/") || location.hash.startsWith("#/match/")) route();
}
async function loadAppInfo() {
  let a = null;
  try { a = await getAppInfo(); } catch (_) { return; }
  if (!a) return;
  const about = $("#v-about .doc");
  [["WhatsApp", a.whatsappUrl], ["YouTube", a.youtubeUrl]].forEach(([n, u]) => {
    const l = safeUrl(u); if (!l) return;
    const p = el("p"); const x = el("a", "", n); x.href = l; x.target = "_blank"; x.rel = "noopener noreferrer"; p.append(x); about.append(p);
  });
  const doc = (id, text) => {
    const t = String(text || "").trim(); if (!t) return;
    const box = $(id + " .doc"); box.replaceChildren(...t.slice(0, 8000).split(/\n{2,}/).map((x) => el("p", "", x)));
  };
  doc("#v-terms", a.termsText); doc("#v-privacy", a.privacyText);
}

/* ---------- announcements ---------- */
async function loadUpdates() {
  let rows = [];
  try { rows = await getAnnouncements(); } catch (_) { return; }
  rows.sort((a, b) => (b.pinned === true) - (a.pinned === true));
  rows = rows.slice(0, 5);
  if (!rows.length) return;
  $("#ulist").replaceChildren(...rows.map((a) => {
    const c = el("article", "ucard" + (a.pinned === true ? " pin" : ""));
    const h = el("div", "thead");
    h.append(el("h3", "", String(a.title || "Update").slice(0, 80)));
    if (a.pinned === true) h.append(el("span", "pill upcoming", "pinned"));
    c.append(h, el("p", "umsg", String(a.message || "").slice(0, 500)), el("p", "twhen", when(a.createdAt)));
    return c;
  }));
  $("#updates").hidden = false;
}

/* ---------- sponsor banner (Admin > Sponsor banners): lowest position first, at most 10 ---------- */
async function loadSponsor() {
  let rows = [];
  try { rows = (await getBanners()).filter((b) => b && b.active !== false && safeUrl(b.imageUrl)); } catch (_) { rows = []; }
  rows.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id)));
  if (sponsor) sponsor.destroy();
  sponsor = mountSponsor({ box: $("#sp"), view: $("#sp-view"), track: $("#sp-track"), dots: $("#sp-dots") }, rows.slice(0, 10), safeUrl);
}

/* ---------- leaderboard ---------- */
function row(p, rank) {
  const li = el("li", "lrow");
  const img = el("img", "lav"); img.alt = ""; img.width = 40; img.height = 40; img.referrerPolicy = "no-referrer";
  if (safeUrl(p.photoURL)) img.src = safeUrl(p.photoURL); else img.style.visibility = "hidden";
  const who = el("span", "lwho"); who.append(el("strong", "", String(p.name || "Player").slice(0, 40)), el("small", "", (Number(p.kills) || 0) + " kills \u2022 " + (Number(p.wins) || 0) + " wins"));
  li.append(el("span", "lrank r" + rank, String(rank)), img, who, el("span", "lpts", (Number(p.points) || 0) + " pts"));
  return li;
}
async function loadBoard() {
  try {
    const rows = await getLeaderboard(); loaded.lb = true;
    $("#lb-full").replaceChildren(...rows.map((p, i) => row(p, i + 1)));
    $("#lb-mini").replaceChildren(...rows.slice(0, 3).map((p, i) => row(p, i + 1)));
    $("#lb-empty").hidden = rows.length > 0;
    $("#lb-section").hidden = rows.length === 0;   // nothing to show until the owner adds leaderboard entries
  } catch (_) { $("#lb-section").hidden = true; }
}

/* ---------- profile ---------- */
function renderProfile() {
  $("#p-name").textContent = profile.name || "Player";
  $("#p-email").textContent = profile.email || "";
  try { $("#p-since").textContent = "Member since " + profile.createdAt.toDate().toLocaleDateString([], { dateStyle: "medium" }); } catch (_) {}
  $("#g-name").value = profile.ingameName || ""; $("#g-uid").value = profile.gameUid || ""; $("#g-mobile").value = profile.mobile || "";
  $("#g-status").textContent = profile.ingameName && profile.gameUid ? "Game ID: saved" : "Game ID: not set yet (needed to join matches)";
  const u = safeUrl(profile.photoURL);
  if (u) { const i = $("#p-photo"); i.src = u; i.referrerPolicy = "no-referrer"; i.hidden = false; const a = $("#avatar"); a.src = u; a.referrerPolicy = "no-referrer"; a.hidden = false; }
}
$("#g-save").addEventListener("click", async () => {
  const n = $("#g-name").value.trim(), g = $("#g-uid").value.trim(), mb = $("#g-mobile").value.trim(), msg = $("#g-msg");
  if (n.length < 2 || n.length > 30) return setMsg(msg, "error", "Enter your in-game name (2 to 30 characters).");
  if (!/^[0-9]{6,15}$/.test(g)) return setMsg(msg, "error", "UID must be 6 to 15 digits, numbers only.");
  if (mb && !/^[0-9]{10}$/.test(mb)) return setMsg(msg, "error", "Mobile number must be exactly 10 digits.");
  const b = $("#g-save"); b.disabled = true; setMsg(msg, "", "");
  try { await saveGameProfile(authUser.uid, n, g, mb); profile.ingameName = n; profile.gameUid = g; if (mb) profile.mobile = mb; renderProfile(); setMsg(msg, "success", "Saved."); }
  catch (e) { setMsg(msg, "error", friendlyError(e) || "Could not save. Please try again."); }
  finally { b.disabled = false; }
});
$("#share-app").addEventListener("click", async (e) => { // old app Profile > Share App
  e.preventDefault();
  const data = { title: "Noryvexal Arena", text: "Play Free Fire tournaments on Noryvexal Arena", url: location.origin + location.pathname.replace(/[^/]*$/, "") };
  try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); alert("Link copied: " + data.url); } } catch (_) {}
});
$("#logout").addEventListener("click", async () => { await logout(); location.replace("login.html"); });

/* ---------- start ---------- */
(async () => {
  const u = await firstAuthState();
  if (!u) return location.replace("login.html");
  authUser = u;
  try { profile = await getProfile(u.uid); } catch (_) {}
  if (!isAllowed(profile)) { await logout(); return location.replace("login.html"); }
  if (gateFor(u) !== "ok") return location.replace("password.html"); // set / confirm password first
  if (profile.status === "banned" || profile.status === "suspended") { // old app Banned / Suspended screens
    const b = $("#blocked"); b.dataset.state = profile.status;
    $("#blocked-title").textContent = profile.status === "banned" ? "Account banned" : "Account suspended";
    $("#blocked-text").textContent = profile.status === "banned" ? "Your account was banned for breaking the rules. You cannot join matches." : "Your account is suspended for now. Contact support or try again later.";
    b.hidden = false; $("#blocked-out").addEventListener("click", async () => { await logout(); location.replace("login.html"); });
    return;
  }
  if (useServer()) { try { await ensureSession(); } catch (_) {} } // purane Firebase users ka server account bhi ban jaye
  renderProfile(); renderCats(); renderMyHome(); route();
  $("#app").hidden = false;
  mountAd($("#ad-home"));
  refreshWallet(); loadTournaments(); loadMy(); loadCategories(); loadAppInfo(); loadSponsor(); loadUpdates(); loadBoard(); loadNotifs();
})();
