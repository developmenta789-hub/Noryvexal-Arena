// One place for brand + Firebase config (from the root Firebase.json).
export const BRAND = {
  product: "Noryvexal Arena",
  company: "Noryvexal Software Team (NST)",
  short: "NST",
  powered: "Powered by NST",
};

export const firebaseConfig = {
  apiKey: "AIzaSyBZojUxbpwKIOY2Epx7CUKNQ1hX3JndMOA",
  authDomain: "noryvexal-784c8.firebaseapp.com",
  projectId: "noryvexal-784c8",
  storageBucket: "noryvexal-784c8.firebasestorage.app",
  messagingSenderId: "30725535538",
  appId: "1:30725535538:web:aa10bd6c638b07c3bf892b",
  measurementId: "G-JB63YZD02E",
};

// NST Server (B6). useServer = true: wallet, matches, join, room, results, teams aur game profile server se aate hain.
// false karo to purana Firestore flow wapas chalega (koi aur change nahi). baseUrl = Render service ka URL.
export const SERVER = { useServer: false, baseUrl: "" }; // backend abhi hata diya gaya hai

// Game modes shown as tiles on the dashboard. `id` is stored in tournaments.category.
export const CATEGORIES = [
  { id: "battle-royale", name: "Battle Royale", tag: "50 players, last one standing", a: "#2F80FF",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>' },
  { id: "clash-squad", name: "Clash Squad", tag: "4v4 rounds", a: "#7C5CFF",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>' },
  { id: "lone-wolf", name: "Lone Wolf", tag: "1v1 and 2v2 duels", a: "#22D3EE",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>' },
  { id: "custom-room", name: "Custom Room", tag: "Special and sponsor events", a: "#F5A524",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>' },
];

// Web ads use Google AdSense (AdMob is for Android/iOS apps only). Leave empty to hide the slot.
export const ADS = { client: "", slot: "" }; // e.g. client: "ca-pub-1234567890123456", slot: "1234567890"
