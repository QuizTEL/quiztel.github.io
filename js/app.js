// ============================================================
//  QuizTEL — Shared App Utilities (app.js)
//  Common Firestore helpers, UI utilities, nav rendering
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Firestore Helpers ─────────────────────────────────────────

/** Fetch all courses → [{ id, name }] */
export async function loadCourses() {
  const snap = await getDocs(query(collection(db, "courses"), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Fetch all weeks for a course → [{ id, name }] */
export async function loadWeeks(courseId) {
  const ref  = collection(db, "courses", courseId, "weeks");
  const snap = await getDocs(query(ref, orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Fetch all questions for a week → [{ id, text, options, correctOptionIndex, explanation }] */
export async function loadQuestions(courseId, weekId) {
  const ref  = collection(db, "courses", courseId, "weeks", weekId, "questions");
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Fetch ALL questions across ALL weeks for a course → [{ ...question, weekId, weekName }] */
export async function loadAllQuestions(courseId) {
  const weeks = await loadWeeks(courseId);
  const result = [];
  for (const week of weeks) {
    const qs = await loadQuestions(courseId, week.id);
    qs.forEach(q => result.push({ ...q, weekId: week.id, weekName: week.name }));
  }
  return result;
}

// ── UI Helpers ────────────────────────────────────────────────

/** Populate a <select> element with an array of {id, name} items */
export function populateSelect(selectEl, items, placeholder = "Select…") {
  selectEl.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
  items.forEach(item => {
    const opt = document.createElement("option");
    opt.value       = item.id;
    opt.textContent = item.name;
    selectEl.appendChild(opt);
  });
}

/** Show a toast notification */
export function showToast(message, type = "success") {
  const existing = document.getElementById("qt-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "qt-toast";
  const colorMap = {
    success: "bg-emerald-500",
    error:   "bg-red-500",
    info:    "bg-indigo-500",
    warning: "bg-yellow-500 text-gray-900"
  };
  toast.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-semibold
    transition-all duration-300 opacity-0 translate-y-4 ${colorMap[type] || colorMap.info}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove("opacity-0", "translate-y-4");
  });

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-4");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/** Show a full-screen spinner overlay */
export function showSpinner(msg = "Loading…") {
  let el = document.getElementById("qt-spinner");
  if (!el) {
    el = document.createElement("div");
    el.id = "qt-spinner";
    el.className = "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm";
    el.innerHTML = `
      <div class="flex flex-col items-center gap-4">
        <div class="w-14 h-14 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
        <p id="qt-spinner-msg" class="text-white font-semibold text-lg">${msg}</p>
      </div>`;
    document.body.appendChild(el);
  } else {
    document.getElementById("qt-spinner-msg").textContent = msg;
    el.classList.remove("hidden");
  }
}

export function hideSpinner() {
  const el = document.getElementById("qt-spinner");
  if (el) el.classList.add("hidden");
}

/** Fisher-Yates shuffle (returns new array) */
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Format a number with thousands separators */
export function fmt(n) {
  return Number(n || 0).toLocaleString();
}

/** Active nav link highlighting */
export function highlightActiveNav() {
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach(link => {
    const href = link.getAttribute("href") || "";
    if (href.includes(current)) {
      link.classList.add("text-indigo-400", "font-bold");
    }
  });
}
