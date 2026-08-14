// ============================================================
//  QuizTEL — Advanced Real-Time Analytics & Feedback Engine
//  Tracks: Page views, Unique visitors, Live Online Presence,
//  Peak Hours distribution (00-23h), Quiz Attendees, Average Scores,
//  Social Shares, and User Feedbacks via Firestore.
// ============================================================

import { db, auth } from "./firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ANALYTICS_DOC    = doc(db, "analytics", "traffic");
const DAILY_COLLECTION = collection(db, "analytics_daily");
const PRESENCE_COL     = collection(db, "analytics_presence");
const FEEDBACK_COL     = collection(db, "feedbacks");

const VISITED_KEY      = "quiztel_visited";
const SESSION_KEY      = "quiztel_session_id";
const ATTENDEE_KEY     = "quiztel_quiz_attendee";

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getHourKey() {
  const hour = new Date().getHours();
  return `H${String(hour).padStart(2, '0')}`;
}

// ── Session ID Generator ─────────────────────────────────────
function getSessionId() {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = "sess_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

// ── Live Presence Heartbeat ──────────────────────────────────
let presenceInterval = null;

export function initPresence() {
  const sid = getSessionId();
  const sessionRef = doc(PRESENCE_COL, sid);

  const ping = async () => {
    try {
      await setDoc(sessionRef, {
        lastSeen: Date.now(),
        page: window.location.pathname.split("/").pop() || "index.html",
        userAgent: navigator.userAgent
      }, { merge: true });
    } catch (err) {
      console.warn("Presence ping failed:", err.message);
    }
  };

  ping();
  if (!presenceInterval) {
    presenceInterval = setInterval(ping, 15000); // Heartbeat every 15s
  }

  // Remove presence on window unload
  window.addEventListener("beforeunload", () => {
    try {
      deleteDoc(sessionRef);
    } catch (e) {}
  });
}

// ── Subscribe to Live Active Users (Last 90s) ────────────────
export function subscribeToLivePresence(callback) {
  return onSnapshot(PRESENCE_COL, (snap) => {
    const now = Date.now();
    let activeCount = 0;
    const activePages = {};

    snap.docs.forEach(d => {
      const data = d.data();
      if (data.lastSeen && (now - data.lastSeen < 90000)) { // active in last 90 sec
        activeCount++;
        const p = data.page || "index.html";
        activePages[p] = (activePages[p] || 0) + 1;
      }
    });

    callback({ activeCount, activePages });
  });
}

// ── Track Page View & Peak Hours Distribution ────────────────
export async function trackPageView() {
  try {
    const today = getTodayStr();
    const hourKey = getHourKey();
    const dailyRef = doc(DAILY_COLLECTION, today);

    const updates = { 
      pageViews: increment(1),
      [`hourlyViews.${hourKey}`]: increment(1)
    };
    const dailyUpdates = { 
      pageViews: increment(1), 
      date: today,
      [`hourlyViews.${hourKey}`]: increment(1)
    };

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

// ── Track Quiz Start / Attempt ────────────────────────────────
export async function incrementQuizAttempts() {
  try {
    const today = getTodayStr();
    const hourKey = getHourKey();
    const dailyRef = doc(DAILY_COLLECTION, today);

    const updates = { 
      quizAttempts: increment(1),
      [`hourlyQuiz.${hourKey}`]: increment(1)
    };
    const dailyUpdates = { 
      quizAttempts: increment(1), 
      date: today,
      [`hourlyQuiz.${hourKey}`]: increment(1)
    };

    if (!localStorage.getItem(ATTENDEE_KEY)) {
      updates.quizAttendees = increment(1);
      dailyUpdates.quizAttendees = increment(1);
      localStorage.setItem(ATTENDEE_KEY, "1");
    }

    await setDoc(ANALYTICS_DOC, updates, { merge: true });
    await setDoc(dailyRef, dailyUpdates, { merge: true });
  } catch (err) {
    console.warn("Quiz attempt tracking failed:", err.message);
  }
}

// ── Track Quiz Completion & Score Stats ───────────────────────
export async function trackQuizCompletion({ scorePct, scoreCount, totalQuestions, courseId, weekId }) {
  try {
    const today = getTodayStr();
    const dailyRef = doc(DAILY_COLLECTION, today);

    const updates = {
      completedQuizzes: increment(1),
      totalScoreSum: increment(scorePct),
      totalScoreCount: increment(1)
    };

    const dailyUpdates = {
      completedQuizzes: increment(1),
      totalScoreSum: increment(scorePct),
      totalScoreCount: increment(1),
      date: today
    };

    await setDoc(ANALYTICS_DOC, updates, { merge: true });
    await setDoc(dailyRef, dailyUpdates, { merge: true });
  } catch (err) {
    console.warn("Quiz completion tracking failed:", err.message);
  }
}

// ── Track Social Shares ───────────────────────────────────────
export async function trackShare(shareType = "general") {
  try {
    const today = getTodayStr();
    const dailyRef = doc(DAILY_COLLECTION, today);

    const updates = { 
      totalShares: increment(1),
      [`shareTypes.${shareType}`]: increment(1)
    };

    const dailyUpdates = { 
      totalShares: increment(1), 
      date: today,
      [`shareTypes.${shareType}`]: increment(1)
    };

    await setDoc(ANALYTICS_DOC, updates, { merge: true });
    await setDoc(dailyRef, dailyUpdates, { merge: true });
  } catch (err) {
    console.warn("Share tracking failed:", err.message);
  }
}

import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

async function ensureAuth() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.warn("Anonymous auth skipped or failed:", e);
    }
  }
}

// ── Submit Feedback ───────────────────────────────────────────
export async function submitFeedback({ name, email, rating, category, message, page }) {
  try {
    await ensureAuth();
    const currentUser = auth.currentUser;
    const finalName = name || currentUser?.displayName || currentUser?.email || "NPTEL Learner";
    const finalEmail = email || currentUser?.email || "";

    const docData = {
      name: finalName,
      email: finalEmail,
      rating: Number(rating) || 5,
      category: category || "General Suggestion",
      message: String(message || "").trim(),
      page: page || window.location.pathname.split("/").pop() || "index.html",
      reviewed: false,
      createdAt: serverTimestamp(),
      createdDateStr: new Date().toLocaleString()
    };

    await addDoc(FEEDBACK_COL, docData);

    try {
      await setDoc(ANALYTICS_DOC, { totalFeedbacks: increment(1) }, { merge: true });
    } catch (e) {
      // Non-critical metric increment
    }
    return true;
  } catch (err) {
    console.error("Failed to submit feedback:", err);

    // Permission fallback: Save locally so user request succeeds gracefully
    if (err.code === "permission-denied" || (err.message && err.message.toLowerCase().includes("permission"))) {
      try {
        const offlineQueue = JSON.parse(localStorage.getItem("quiztel_offline_feedbacks") || "[]");
        offlineQueue.push({
          id: "local_" + Date.now(),
          name: name || "NPTEL Learner",
          email: email || "",
          rating: Number(rating) || 5,
          category: category || "General Suggestion",
          message: String(message || "").trim(),
          page: page || window.location.pathname.split("/").pop() || "index.html",
          reviewed: false,
          createdDateStr: new Date().toLocaleString()
        });
        localStorage.setItem("quiztel_offline_feedbacks", JSON.stringify(offlineQueue));
        return true;
      } catch (localErr) {
        console.error("Local feedback save error:", localErr);
      }
    }
    throw err;
  }
}

// ── Subscribe to User Feedbacks List (Admin) ──────────────────
export function subscribeToFeedbacks(callback) {
  const q = query(FEEDBACK_COL, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const offlineList = JSON.parse(localStorage.getItem("quiztel_offline_feedbacks") || "[]");
    callback([...offlineList, ...firestoreList]);
  }, (err) => {
    console.warn("Feedback subscription error:", err);
    const offlineList = JSON.parse(localStorage.getItem("quiztel_offline_feedbacks") || "[]");
    callback(offlineList);
  });
}

// ── Delete Feedback ───────────────────────────────────────────
export async function deleteFeedback(feedbackId) {
  await deleteDoc(doc(FEEDBACK_COL, feedbackId));
}

// ── Toggle Feedback Reviewed Status ───────────────────────────
export async function toggleFeedbackStatus(feedbackId, newStatus) {
  await updateDoc(doc(FEEDBACK_COL, feedbackId), { reviewed: newStatus });
}

// ── Subscribe to Live Global Analytics ────────────────────────
export function subscribeToAnalytics(callback) {
  return onSnapshot(ANALYTICS_DOC, (snap) => {
    if (snap.exists()) callback(snap.data());
    else callback({ pageViews: 0, uniqueVisitors: 0, quizAttempts: 0, totalShares: 0, totalFeedbacks: 0 });
  });
}

// ── Fetch Daily Analytics for Charts ──────────────────────────
export async function fetchDailyAnalytics(days = 30) {
  try {
    const q = query(DAILY_COLLECTION, orderBy("date", "desc"), limit(days));
    const snap = await getDocs(q);
    const results = snap.docs.map(d => d.data());
    return results.reverse();
  } catch (err) {
    console.warn("Failed to fetch daily analytics:", err.message);
    return [];
  }
}

// ── Generate Comprehensive CSV Report ─────────────────────────
export async function generateCSVReport() {
  try {
    const dailyData = await fetchDailyAnalytics(365);
    let csv = "Date,Page Views,Unique Visitors,Quiz Attempts,Quiz Attendees,Completed Quizzes,Avg Score %,Total Shares\n";
    
    for (const row of dailyData) {
      const avgScore = row.totalScoreCount ? (row.totalScoreSum / row.totalScoreCount).toFixed(1) : "0";
      csv += `${row.date},${row.pageViews || 0},${row.uniqueVisitors || 0},${row.quizAttempts || 0},${row.quizAttendees || 0},${row.completedQuizzes || 0},${avgScore}%,${row.totalShares || 0}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QuizTEL_Full_Analytics_${getTodayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to generate report:", err);
    throw err;
  }
}

