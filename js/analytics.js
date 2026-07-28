// ============================================================
//  QuizTEL — Analytics Module
//  Tracks page views, unique visitors, and quiz attempts
//  using Firestore atomic increments.
// ============================================================

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ANALYTICS_DOC = doc(db, "analytics", "traffic");
const VISITED_KEY   = "quiztel_visited";

// ── Ensure the analytics document exists ──────────────────────
async function ensureAnalyticsDoc() {
  const snap = await getDoc(ANALYTICS_DOC);
  if (!snap.exists()) {
    await setDoc(ANALYTICS_DOC, {
      pageViews:      0,
      uniqueVisitors: 0,
      quizAttempts:   0
    });
  }
}

// ── Track page view + unique visitor on every page load ───────
export async function trackPageView() {
  try {
    await ensureAnalyticsDoc();

    const updates = { pageViews: increment(1) };

    if (!localStorage.getItem(VISITED_KEY)) {
      updates.uniqueVisitors = increment(1);
      localStorage.setItem(VISITED_KEY, "1");
    }

    await updateDoc(ANALYTICS_DOC, updates);
  } catch (err) {
    console.warn("Analytics tracking failed:", err.message);
  }
}

// ── Increment quiz attempts counter ───────────────────────────
export async function incrementQuizAttempts() {
  try {
    await ensureAnalyticsDoc();
    await updateDoc(ANALYTICS_DOC, { quizAttempts: increment(1) });
  } catch (err) {
    console.warn("Quiz attempt tracking failed:", err.message);
  }
}

// ── Subscribe to live analytics updates ───────────────────────
export function subscribeToAnalytics(callback) {
  return onSnapshot(ANALYTICS_DOC, (snap) => {
    if (snap.exists()) callback(snap.data());
    else callback({ pageViews: 0, uniqueVisitors: 0, quizAttempts: 0 });
  });
}

// ── Fetch analytics once ──────────────────────────────────────
export async function fetchAnalytics() {
  try {
    await ensureAnalyticsDoc();
    const snap = await getDoc(ANALYTICS_DOC);
    return snap.data() || { pageViews: 0, uniqueVisitors: 0, quizAttempts: 0 };
  } catch (err) {
    return { pageViews: 0, uniqueVisitors: 0, quizAttempts: 0 };
  }
}
