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

// Game modes are NOT built in any more: they are created in the Admin app (Categories) and read from Firestore `categories`.

// Web ads use Google AdSense (AdMob is for Android/iOS apps only). Leave empty to hide the slot.
export const ADS = { client: "", slot: "" }; // e.g. client: "ca-pub-1234567890123456", slot: "1234567890"
