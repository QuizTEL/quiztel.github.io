// ============================================================
//  QuizTEL — Firebase Configuration
//  Replace the firebaseConfig object below with YOUR project's
//  credentials from the Firebase Console:
//  Console → Project Settings → Your Apps → Web App → Config
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyC-KBmeM81Tk9Zvln_JyV_nQBIScT_Xvpg",
  authDomain: "iot3-39887.firebaseapp.com",
  projectId: "iot3-39887",
  storageBucket: "iot3-39887.firebasestorage.app",
  messagingSenderId: "462513364978",
  appId: "1:462513364978:web:279274dfe9e190d1b4d56b",
  measurementId: "G-QWKCRDYKX3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db   = getFirestore(app);
export const auth = getAuth(app);
export default app;
