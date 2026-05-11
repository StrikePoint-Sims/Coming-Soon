// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE CONFIGURATION — StrikePoint Sims Accounting
// ─────────────────────────────────────────────────────────────────────────────
//
// SETUP INSTRUCTIONS (one-time, ~10 minutes):
//
// 1. Go to https://console.firebase.google.com
// 2. Click "Add project" → name it "StrikePoint Sims Accounting"
// 3. Disable Google Analytics (not needed) → Create project
//
// 4. Enable Authentication:
//    Sidebar → Build → Authentication → Get started
//    Sign-in method tab → Enable "Google" → Save
//    Authorized domains → Add: strikepointsims.com (and any dev URLs)
//
// 5. Enable Firestore:
//    Sidebar → Build → Firestore Database → Create database
//    Choose "Production mode" → Select region (us-east1 for CT) → Done
//
// 6. Enable Storage:
//    Sidebar → Build → Storage → Get started → Next → Done
//
// 7. Get your config:
//    Project Settings (gear icon) → General → Your apps → Add app → Web (</>)
//    Register app name: "SP Accounting" → Copy the firebaseConfig object below
//
// 8. Set up Hosting:
//    Sidebar → Build → Hosting → Get started → follow prompts
//    Install Firebase CLI: npm install -g firebase-tools
//    Run: firebase login → firebase init → firebase deploy
//
// 9. Custom domain (strikepointsims.com):
//    Hosting → Add custom domain → follow DNS verification steps
//
// ─────────────────────────────────────────────────────────────────────────────
// REPLACE the values below with YOUR project's config from step 7:
// ─────────────────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyDFUm2mDCqwQXqTaxGxwQ0E5Yayid9xqoI",
  authDomain: "strikepoint-sims.firebaseapp.com",
  projectId: "strikepoint-sims",
  storageBucket: "strikepoint-sims.firebasestorage.app",
  messagingSenderId: "511868473293",
  appId: "1:511868473293:web:930c9c1ce41182c90ebe84"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

// Convenience: returns a reference to the current user's Firestore root
function userRef() {
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) throw new Error('Not authenticated');
  return db.collection('users').doc(uid);
}

// Convenience: returns a reference to a sub-collection under the current user
function col(name) {
  return userRef().collection(name);
}
