// ============================================================
//  QuizTEL — Analytics Module
//  Tracks page views, unique visitors, and quiz attempts
//  using Firestore atomic increments (Global + Daily).
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  increment,
  onSnapshot,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ANALYTICS_DOC = doc(db, "analytics", "traffic");
const DAILY_COLLECTION = collection(db, "analytics_daily");
const VISITED_KEY   = "quiztel_visited";

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Removed ensureAnalyticsDoc because getDoc can fail for unauthenticated visitors due to Firestore rules.
// Using setDoc with { merge: true } directly handles document creation.

// ── Track page view + unique visitor on every page load ───────
export async function trackPageView() {
  try {
    const today = getTodayStr();
    const dailyRef = doc(DAILY_COLLECTION, today);

    const updates = { pageViews: increment(1) };
    const dailyUpdates = { pageViews: increment(1), date: today };

    if (!localStorage.getItem(VISITED_KEY)) {
      updates.uniqueVisitors = increment(1);
      dailyUpdates.uniqueVisitors = increment(1);
      localStorage.setItem(VISITED_KEY, "1");
    }

    await setDoc(ANALYTICS_DOC, updates, { merge: true });
    await setDoc(dailyRef, dailyUpdates, { merge: true });
  } catch (err) {
    console.warn("Analytics tracking failed:", err.message);
  }
}

// ── Increment quiz attempts counter ───────────────────────────
export async function incrementQuizAttempts() {
  try {
    const today = getTodayStr();
    const dailyRef = doc(DAILY_COLLECTION, today);

    await setDoc(ANALYTICS_DOC, { quizAttempts: increment(1) }, { merge: true });
    await setDoc(dailyRef, { quizAttempts: increment(1), date: today }, { merge: true });
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

// ── Fetch daily analytics for charts ──────────────────────────
export async function fetchDailyAnalytics(days = 30) {
  try {
    const q = query(DAILY_COLLECTION, orderBy("date", "desc"), limit(days));
    const snap = await getDocs(q);
    const results = snap.docs.map(d => d.data());
    return results.reverse(); // Return in chronological order
  } catch (err) {
    console.warn("Failed to fetch daily analytics:", err.message);
    return [];
  }
}

// ── Generate CSV Report ───────────────────────────────────────
export async function generateCSVReport() {
  try {
    const dailyData = await fetchDailyAnalytics(365);
    let csv = "Date,Page Views,Unique Visitors,Quiz Attempts\n";
    
    for (const row of dailyData) {
      csv += `${row.date},${row.pageViews || 0},${row.uniqueVisitors || 0},${row.quizAttempts || 0}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QuizTEL_Analytics_${getTodayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to generate report:", err);
    throw err;
  }
}
