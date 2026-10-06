# Noryvexal Arena (User Panel: sirf Website)

> ## 🛑 TESTING ONLY + NAHI BANANA HAI (2026-10-02, owner ka faisla, root README ke sabse upar wala box dekho)
> Abhi project **sirf testing ke liye bina backend ke** hai. Complete hone ke baad **owner khud backend + security banayega, tab publish hoga.** Abhi ke rules/client logic production ke liye safe nahi hain. **Mat banao:** Referral, Promo bonus, Play/Spin/Video earning, KYC document upload, Image Manager, Update screen, Storage/Functions/Blaze/koi paid cheez. In par sawal bhi mat poochho. Abhi sirf design + features + test.


> ## ⚠️ 2026-10-02: BACKEND HATA DIYA GAYA (owner ka faisla)
> Design aur baaki kaam pehle complete honge, backend baad mein banega. `NST Server/` project se hata diya gaya hai aur is app ka server flag band hai (USE_SERVER = false / useServer: false). Niche jahan NST Server / B6 likha hai wo sirf purana record hai. Abhi sirf Firebase wala flow chalega.


> ## ⚙️ STANDING RULE: DONO PANEL SATH MEIN
> User panel (Arena) mein jo bhi feature aaye jiska control Admin se hona chahiye, uska Admin control **usi kaam mein saath banao**, owner se alag se puchna nahi hai. Field names dono taraf same, `Firestor.rules` update, dono README ka kaam-log update, aur end mein poora project zip. Paise wale features par open-write rule nahi lagana. Poori detail: root `../README.md` section 1.2.


**2026-09-28 owner ka faisla:** Arena ab Android app nahi hai, sirf **website** hai (HTML/CSS/JS). Android app/WebView/Gradle files hata di gayi hain. Is folder ka poora contents hi website hai.

Brand: NST (Noryvexal Software Team), tagline "Powered by NST" (root `../README.md` section 18).

## Structure
```
Noryvexal Arena/
├── index.html      <- entry (login check -> login.html ya home.html)
├── login.html, signup.html, home.html
├── css/style.css
├── js/ (config.js, firebase.js, ui.js, login.js, signup.js, home.js)
├── assets/ (logo.png, favicon.png, fonts/Poppins-*.ttf)
└── README.md
```

## Hosting
- Is folder ka **poora contents** hosting ke **root** mein daalo (index.html root par hona chahiye). Koi code change nahi.
- Sirf relative paths hain. HTTPS zaroori hai (Google Sign-In ke liye). `file://` se nahi chalega (ES modules).
- **Firebase Console -> Authentication -> Settings -> Authorized domains** mein apni hosting ka domain jodo, warna `auth/unauthorized-domain` error aayega.
- Google provider enable hona chahiye (Authentication -> Sign-in method).
- Rules: `../Firestor.rules` ko Console (Firestore -> Rules) mein paste karke Publish karo (abhi publish kiya ho to hi login/signup chalega).
- Free hosting: Firebase Hosting (Spark) ya koi static host. Paid mat lo.

## Rules
- Sirf Firebase Web SDK (Auth + Firestore). Firebase Storage nahi. Security Firebase Auth + `Firestor.rules` se hai, frontend se nahi.
- Rules badlein to `Firestor.rules` update karo aur Console mein manually apply karo.

## Kaam log
| Tarikh | Kaam | Test |
|---|---|---|
| 2026-09-28 | Login/signup/home web bana (Google Sign-In, 18+). | Live test baaki |
| 2026-09-28 | Android app hata di, folder ab sirf website (index.html root par). | Static path check |
| 2026-09-28 | UI/UX redesign, English-only text, Poppins font bundled locally. | Visual check not done (no browser available here) |
| 2026-09-28 | Login/signup redesign: animated card border, staged entrance, logo halo, button shine, age-card and form reveal animations, 2-step indicator on signup. "Powered by NST" is pinned to the bottom of the screen. | Not visually tested (no browser here) |
| 2026-09-28 | Performance + responsive pass: removed heavy effects (blur filters, animated conic border, backdrop-filter), animations use transform/opacity only, phones keep the background static, desktop gets a two-column layout (hero + card) at 1024px+, `svh` units to stop mobile URL-bar jumps, hover effects only on hover devices. | Not tested in a browser (none available here) |
| 2026-09-28 | Tournaments list on home: tabs (Upcoming/Live/Completed), refresh, empty + error states. Reads `tournaments` (one query, limit 30). `Firestor.rules` updated (read for logged-in users, write false): publish in Console. | Not tested in a browser |

## Tournament document (add in Console: Firestore > tournaments > Add document, Auto-ID)
| Field | Type | Example |
|---|---|---|
| title | string | Clash Squad Cup |
| game | string | Free Fire |
| mode | string | Squad |
| map | string | Bermuda |
| entryFee | number | 20 (0 = free) |
| prizePool | number | 500 |
| maxPlayers | number | 48 |
| startTime | timestamp | pick date and time |
| status | string | upcoming / live / completed |
| 2026-09-28 | Dashboard redesign: game-mode tiles (Battle Royale, Clash Squad, Lone Wolf, Custom Room), tap opens matches with Ongoing/Upcoming/Completed tabs, sponsor banner, AdSense slots, Top players, Leaderboard and Profile pages, bottom nav. Rules: `banners`, `leaderboard` read-only. | Not tested in a browser |

Extra Console data: tournaments.category = battle-royale / clash-squad / lone-wolf / custom-room (status: ongoing / upcoming / completed). banners: imageUrl (https), linkUrl (https), active (bool). leaderboard/{uid}: name, photoURL, points, kills, wins. Ads: set ADS.client and ADS.slot in js/config.js (AdSense, real domain only).
| 2026-09-28 | Task 1: Match detail page (`#/match/<id>`): stats, prizes (1st/2nd/3rd, per kill), rules text, disabled "Joining opens soon" button. Tap any match card to open. New optional tournament fields: prize1, prize2, prize3, perKill, rules. | Not tested in a browser |
| 2026-09-28 | Task 2: "Latest updates" on home (pinned first, up to 5), reads `announcements` (title, message, pinned, createdAt). Section hides itself when empty. | Not tested in a browser |
| 2026-09-28 | Task 3: coins chip + Profile coins (read-only, no deposit/withdraw), Join button on match detail (atomic batch: registration + coins + joined), slots shown as joined/max, entry shown in coins. Rules: wallets/admins/registrations. Needs `wallets/<uid>` created by the wallet app or Console. | Rules and flow not tested (no browser/emulator here) |
| 2026-09-28 | Room details on match detail page: a player who joined (and match not completed) sees Room ID + Password from `rooms/{tid}`; others see nothing. Shows a "will appear before the match starts" note until Admin saves it. Rules: `rooms` (read only if registered, write open with validation): publish in Console. | Not tested in a browser (JS syntax checked only) |
| 2026-09-29 | Task 4b: completed match detail par "Results" box (1st/2nd/3rd, top killer, note) from `results/{tid}` (one read). "Results will be published soon." jab Admin ne publish nahi kiya. Koi coin/prize credit nahi. Rules: `results` public read, open write with validation: publish in Console. | JS syntax checked only (`node --check`), not tested in a browser |


> 2026-09-29: Poori task list, percent aur niyam root `../README.md` section 20 mein hain. Har task ke baad poora project ek zip mein do.
| 2026-09-29 | A10 My Matches (`#/my`, bottom nav, tabs Ongoing/Upcoming/Completed, one query on own `registrations` where uid == me, max 50). A11 Profile "Game details": in-game name + Free Fire UID saved to `users/{uid}` (`ingameName`, `gameUid`). Rules: registrations own-list + users update of those 2 fields only: publish in Console. | JS syntax checked (`node --check`), not tested in a browser |
| 2026-09-29 | A15 Notifications: bell icon + red dot, page `#/notifications`, reads `notifications` (one query, limit 20). Rules: publish in Console. | JS syntax checked only |
| 2026-09-29 | A17 About, Terms, Privacy pages (draft text) + links and "Powered by NST" footer on Profile. Brand text via `data-brand`. No rules change. | JS syntax checked only |
| 2026-09-29 | A12 Teams: `#/team` (Profile > My team). Create/join by code/leave/delete, max 4, one team per user. Data: `teams`, `teams/{tid}/members`, `userTeams`, `teamCodes`. Rules: publish in Console and test. | JS syntax checked only; rules not run in Playground |
| 2026-09-29 | A13 Team join: reads `tournaments.teamSize`; detail shows Solo/Duo/Squad; join needs a team of exactly teamSize; each player pays own fee; first teammate reserves slots (`teamRegs`). Rules: publish + test. | JS syntax checked only |

- 2026-09-29 Task A14: Friends page `#/friends` (friend code, add by code, list, remove). New functions in `js/firebase.js` (getMyFriendCode, createFriendCode, addFriendByCode, getFriends, removeFriend) and `loadFriends/renderFriends` in `js/home.js`. Rules changed: Publish in Console. Not built or run.

- 2026-09-29: Public `terms.html` + `privacy.html` (+ `js/legal.js`), linked from the signup checkbox. Text is a copy of the in-app pages: edit both. Not built or run.

- 2026-09-30 Task A21: Maintenance screen. `js/maintenance.js` (imported at the top of `home.js`, `login.js`, `signup.js`) reads the public doc `appConfig/arena` once; if `maintenance == true` a full-screen "Under maintenance" notice (owner's `maintenanceMessage` + Check again button) covers the page. Any error = site works normally. **The owner switches it in the ADMIN app (App control, app = arena); Arena has no owner controls of its own** (root README section 22). `Firestor.rules` CHANGED (`appConfig`): Publish in Console. JS syntax checked only (`node --check`).


- 2026-10-01 **B6 (Arena):** Arena ab NST Server se judta hai. Naya `js/api.js` (server client + adapter), `js/config.js` mein `SERVER = { useServer, baseUrl }`. `useServer: true` par server se aate hain: matches list, wallet coins, join (fee + slot + registration atomic), room, results, My Matches, teams (create/join/leave/delete), in-game name + UID save (`PATCH /api/me`). Login/signup ke baad `POST /api/auth/session` (server par account; purane Firebase users ka account home khulne par ban jata hai). **Firebase par hi rahta hai:** login (Google), profile doc, friends, announcements, banners, leaderboard, notifications, appConfig. `useServer: false` karo to poora purana Firestore flow wapas. Server ke cancelled matches "completed" tab mein dikhte hain, Join band, "entry fee refunded". Limit: team match mein "Match is full" ka andaza thoda conservative hai (server khud sahi tay karta hai). **Zaroori:** (1) Render env `CORS_ORIGINS` mein Arena website ka https origin, (2) Render env `ADMIN_UIDS` mein owner ka Firebase uid, (3) jab tak Admin app server se na jude, server par matches nahi bante, isliye list khali dikhegi (ya `useServer:false`). Smoke test (api.js vs test server: session, list, join, room, team, errors) pass; browser mein live test baaki.

- 2026-10-01 A18: Coin history. `home.html` section `#v-coins` + Profile link, `js/api.js` `server.coinHistory()`, `js/home.js` `loadCoinHistory()`. Server mode only (`SERVER.useServer`); in Firestore mode it shows "not available". Read-only, 1 request per open. No rules change. JS syntax checked only, not tested in a browser.
- 2026-10-02 **Backend hata diya:** `SERVER.useServer = false`. Sab kuch Firebase (Auth + Firestore, Spark free). Coin history ab Firestore se (`getCoinHistory` in `js/firebase.js`, sirf `where uid == myUid` queries, balance column nahi dikhta). `Firestor.rules` header update, Console mein Publish zaroori. Build/run nahi kiya, sirf syntax check.
- 2026-10-02 **A16 Support tickets:** Profile > Help and support (`#/support`). `getMyTickets` + `createTicket` in `js/firebase.js`, UI in `js/home.js` (`loadSupport`), section `v-support` in `home.html`. Max 3 open tickets (app side). Rules `tickets`: Publish zaroori. Syntax check ok, browser mein run nahi kiya.

- 2026-10-02 Light design (root README section 24.7): `css/style.css` bottom block overrides the dark theme with the old Arena app look (indigo `#4F46E5`, page `#F5F6FA`, white cards radius 16). `index.html` splash = old app splash. 6 HTML files: `theme-color` `#F5F6FA`, `color-scheme` light (index.html stays dark). No JS, rules or feature change. Not run on a real device. Open: maintenance overlay still dark; Coin history (`#/coins`) still in Arena (owner says wallet is separate: ask before removing); no banner-image match card yet.

## 2026-10-02 (task 2): purane Arena app ke features
Banner wala match card, slot grid, Watch live, Admin se categories + app info, Banned/Suspended screen. Detail aur "nahi liya" list: root `../README.md` section 25.6. Browser mein chalaya nahi. `Firestor.rules` Console mein Publish karo.

- 2026-10-02 Task 4 (old app slot flow): match detail ab purane app jaisa slot picker deta hai (`renderSlots`/`setupJoin` in `js/home.js`, `getSlots`/`joinTournament(t, user, name, slot)` in `js/firebase.js`, `.srow` CSS neeche). Profile mein optional mobile + Share app, notification tap par detail dialog. `Firestor.rules` CHANGED (okJoin, `tournaments/{id}/slots`, `users.mobile`): Publish in Console. Browser mein chala nahi, rules test nahi hue. Team ab join ke liye zaroori nahi.

- 2026-10-02 Task 5: purana Results list. `getResultPlayers` (`js/firebase.js`) + `loadResult` (`js/home.js`) match detail par Player/Kills/Winning table dikhate hain (`results/{tid}/players`). Rules changed: Publish in Console. Chala nahi, sirf `node --check`.

- 2026-10-04 Task D18 (Arena part): coin history now also reads `refunds` (label "Match refund"). Cancelled matches already showed as cancelled. Rules changed: Publish in Console. Only `node --check` done.

- 2026-10-04 Task A22: match detail closes joining once `startTime` passes (`started()` in `js/home.js`); the real lock is in `Firestor.rules` (`okJoin`). Rules changed: Publish in Console. Only `node --check` done.

- 2026-10-04 Task P13: `joinTournament` reads the wallet fresh and writes `winCoins` + registration `winPart`; Profile shows winnings (`getWalletFull`). Rules changed: Publish in Console. Only `node --check` done.

- 2026-10-04 Task A23: read cache in `js/firebase.js` (`cached`, `dropCache`, key prefix `nx_rc1_`). Public lists 2-15 min, slots 20 s, wallet/history/profile/room/results never cached; join clears tournaments/myreg/slots; Refresh button forces a read (max once per 15 s). Rules unchanged. Only `node --check` + node test of Timestamp save/restore done.


## 2026-10-05 Home Screen v2
Sponsor carousel (`js/sponsor.js`) > My Matches > Esports Matches. Details + test result: root README, last Log section. Firestor.rules (banners: title, order) updated.


## 2026-10-05 Password step (Arena)
Google sign-up/login now has a password step. New page `password.html` + `js/password.js`; helpers in `js/firebase.js` (`gateFor`, `nextUrl`, `setNewPassword`, `confirmPassword`, `resetPasswordMail`).
- Sign up: age + terms > Google > **password.html (set)**: password + confirm, eye show/hide, strength bar, rules, match check > home.
- Login: Google > if the Google account has no profile in Firestore `users` it is sent to **signup.html**; if it has one > **password.html (confirm)** > home. Older accounts without a password are asked to set one first.
- The password is an email+password sign-in LINKED to the Google account in Firebase Auth (same uid). It is never stored in Firestore. Payvex asks for the same password.
- `home.html`, `index.html`, `login.html`, `signup.html` all check `gateFor(user)`; `logout()` clears the confirmation.
- **Owner must do once:** Firebase Console > Authentication > Sign-in method > enable **Email/Password**. Firestore rules: no change.
- The confirmation flag is kept in the browser (`nx_pwok`), so this step protects a login on a shared device; the hard security stays Google sign-in + Firestore rules.

| 2026-10-06 | Bottom navigation redesigned (owner request): floating glass pill, active tab gets a gradient capsule + cyan icon, reduced-motion respected. Only CSS appended at the end of `css/style.css` ("bottom nav v2"); `home.html` / JS unchanged; `.content` bottom padding raised to 112px so nothing hides behind the floating bar. | Not run in browser |


| 2026-10-06 | Profile: Phone/Mobile field removed, **Game level** (1..100) added; coin history removed (screen, route, query, link). Profile data = single source for Join + Payvex Withdraw (`gameDone()` in `home.js` mirrors `gameDone` in `Firestor.rules`). Changing nickname/UID/level after owner verification sends `gameVerified:false`. `Firestor.rules` changed: re-publish in Console. Not run against real Firebase. |
