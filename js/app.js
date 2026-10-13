// ============================================================
//  QuizTEL — Shared App Utilities (app.js)
//  Common Firestore helpers, UI utilities, nav rendering
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  orderBy,
  query,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Dark / Light Theme Manager ───────────────────────────────
export function initTheme() {
  injectDarkThemeStyles();

  const savedTheme = localStorage.getItem("quiztel_theme");
  const isDark = savedTheme === "dark"; // Default is ALWAYS light mode unless user explicitly selected dark

  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  // Update all theme toggle buttons across navigation headers
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.setAttribute("aria-label", "Toggle dark/light theme");
    updateToggleBtnIcon(btn, isDark);

    btn.addEventListener("click", () => {
      const currentlyDark = document.documentElement.classList.contains("dark");
      const nextDark = !currentlyDark;

      if (nextDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("quiztel_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("quiztel_theme", "light");
      }

      document.querySelectorAll("[data-theme-toggle]").forEach(b => updateToggleBtnIcon(b, nextDark));
    });
  });
}

function updateToggleBtnIcon(btn, isDark) {
  if (isDark) {
    // Sun Icon (Switch to Light)
    btn.innerHTML = `<svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`;
  } else {
    // Moon Icon (Switch to Dark)
    btn.innerHTML = `<svg class="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>`;
  }
}

function injectDarkThemeStyles() {
  if (document.getElementById("quiztel-dark-styles")) return;
  const styleEl = document.createElement("style");
  styleEl.id = "quiztel-dark-styles";
  styleEl.textContent = `
    html.dark {
      color-scheme: dark;
    }
    html.dark body {
      background-color: #0f172a !important;
      color: #f8fafc !important;
    }
    html.dark .bg-white,
    html.dark div[class*="bg-white"],
    html.dark section[class*="bg-white"] {
      background-color: #1e293b !important;
      color: #f8fafc !important;
    }
    html.dark .bg-slate-50, 
    html.dark div[class*="bg-slate-50"] {
      background-color: #0f172a !important;
      color: #f8fafc !important;
    }
    html.dark .bg-slate-100,
    html.dark div[class*="bg-slate-100"] {
      background-color: #334155 !important;
      color: #f8fafc !important;
    }
    html.dark .text-slate-900, html.dark .text-slate-800, html.dark .text-slate-700, 
    html.dark .text-gray-900, html.dark .text-gray-800, html.dark .text-gray-700,
    html.dark p, html.dark h1, html.dark h2, html.dark h3, html.dark h4, html.dark label {
      color: #f8fafc !important;
    }
    html.dark .text-slate-600, html.dark .text-slate-500, html.dark .text-slate-400, 
    html.dark .text-gray-600, html.dark .text-gray-500 {
      color: #cbd5e1 !important;
    }
    html.dark .border-slate-200, html.dark .border-slate-100, html.dark .border-gray-200, html.dark .border-gray-100 {
      border-color: #334155 !important;
    }
    html.dark select, html.dark input[type="text"], html.dark input[type="email"], html.dark input[type="password"], html.dark textarea {
      background-color: #1e293b !important;
      color: #f8fafc !important;
      border-color: #475569 !important;
    }
    html.dark header {
      background-color: rgba(15, 23, 42, 0.95) !important;
      border-color: #1e293b !important;
    }
    html.dark .study-card, html.dark .week-pill-card, html.dark .mode-pill-card, html.dark .quiz-card {
      background-color: #1e293b !important;
      border-color: #334155 !important;
      color: #f8fafc !important;
    }
    html.dark .week-pill-card.border-indigo-600, html.dark .mode-pill-card.border-indigo-600 {
      background-color: rgba(99, 102, 241, 0.25) !important;
      border-color: #6366f1 !important;
    }
    /* Options & Choice Badges in Dark Mode */
    html.dark div[class*="bg-gray-50"],
    html.dark button[class*="bg-gray-50"],
    html.dark .bg-gray-50 {
      background-color: #334155 !important;
      border-color: #475569 !important;
      color: #f8fafc !important;
    }
    html.dark div[class*="bg-gray-50"] span,
    html.dark button[class*="bg-gray-50"] span,
    html.dark .bg-gray-50 span {
      color: #f8fafc !important;
    }
    html.dark div[class*="bg-emerald-50"],
    html.dark button[class*="bg-emerald-50"],
    html.dark .bg-emerald-50 {
      background-color: rgba(6, 78, 59, 0.85) !important;
      border-color: #10b981 !important;
      color: #ecfdf5 !important;
    }
    html.dark div[class*="bg-emerald-50"] span,
    html.dark button[class*="bg-emerald-50"] span,
    html.dark .bg-emerald-50 span {
      color: #ecfdf5 !important;
    }
    html.dark div[class*="bg-red-50"],
    html.dark button[class*="bg-red-50"],
    html.dark .bg-red-50 {
      background-color: rgba(153, 27, 27, 0.85) !important;
      border-color: #ef4444 !important;
      color: #fef2f2 !important;
    }
    html.dark div[class*="bg-red-50"] span,
    html.dark button[class*="bg-red-50"] span,
    html.dark .bg-red-50 span {
      color: #fef2f2 !important;
    }
    html.dark div[class*="bg-gray-200"],
    html.dark span[class*="bg-gray-200"],
    html.dark .bg-gray-200 {
      background-color: #475569 !important;
      color: #f8fafc !important;
    }
    /* Explanations Accordion */
    html.dark .expl-details {
      background-color: rgba(30, 41, 59, 0.95) !important;
      border-color: #334155 !important;
    }
    html.dark .expl-details summary {
      color: #818cf8 !important;
    }
    html.dark .expl-details summary:hover {
      background-color: #334155 !important;
    }
    html.dark .expl-body {
      background-color: #0f172a !important;
      border-color: #334155 !important;
      color: #cbd5e1 !important;
    }
    /* Quiz Panels & Results */
    html.dark #results-panel,
    html.dark #results-panel div[class*="bg-white"],
    html.dark #setup-panel div[class*="bg-white"],
    html.dark #quiz-panel div[class*="bg-white"] {
      background-color: #1e293b !important;
      border-color: #334155 !important;
      color: #f8fafc !important;
    }
    html.dark #results-panel p,
    html.dark #results-panel h2,
    html.dark #results-panel h3,
    html.dark #results-panel span {
      color: #f8fafc !important;
    }
    html.dark table thead th {
      background-color: #0f172a !important;
      color: #94a3b8 !important;
      border-color: #334155 !important;
    }
    html.dark tr.border-b {
      border-color: #334155 !important;
    }
    html.dark tr:hover {
      background-color: #334155 !important;
    }
  `;
  document.head.appendChild(styleEl);
}

// ── Firestore Helpers ─────────────────────────────────────────

/** Fetch all courses → [{ id, name }] */
export async function loadCourses() {
  const snap = await getDocs(query(collection(db, "courses"), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Real-time Subscribe to all courses */
export function subscribeToCourses(callback) {
  const q = query(collection(db, "courses"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.warn("Real-time courses error:", err);
  });
}

/** Fetch all weeks for a course → [{ id, name }] */
export async function loadWeeks(courseId) {
  const ref  = collection(db, "courses", courseId, "weeks");
  const snap = await getDocs(query(ref));
  const weeks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return weeks.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

/** Real-time Subscribe to weeks of a course */
export function subscribeToWeeks(courseId, callback) {
  if (!courseId) return () => {};
  const ref = collection(db, "courses", courseId, "weeks");
  const q = query(ref);
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    callback(list);
  }, (err) => {
    console.warn("Real-time weeks error:", err);
  });
}

/** Fetch all questions for a week → [{ id, text, options, correctOptionIndex, explanation, order }] */
export async function loadQuestions(courseId, weekId) {
  const ref  = collection(db, "courses", courseId, "weeks", weekId, "questions");
  const snap = await getDocs(ref);
  const questions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return questions.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    return a.id.localeCompare(b.id);
  });
}

/** Real-time Subscribe to questions of a week */
export function subscribeToQuestions(courseId, weekId, callback) {
  if (!courseId || !weekId) return () => {};
  const ref = collection(db, "courses", courseId, "weeks", weekId, "questions");
  return onSnapshot(ref, (snap) => {
    const questions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    questions.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return a.id.localeCompare(b.id);
    });
    callback(questions);
  }, (err) => {
    console.warn("Real-time questions error:", err);
  });
}

/** Fetch all PDF/solution resources for a week → [{ id, title, url }] */
export async function loadResources(courseId, weekId) {
  try {
    const ref  = collection(db, "courses", courseId, "weeks", weekId, "resources");
    const snap = await getDocs(ref);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Could not load resources (possibly permissions):", err);
    return [];
  }
}

/** Real-time Subscribe to resources of a week */
export function subscribeToResources(courseId, weekId, callback) {
  if (!courseId || !weekId) return () => {};
  const ref = collection(db, "courses", courseId, "weeks", weekId, "resources");
  return onSnapshot(ref, (snap) => {
    const resources = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(resources);
  }, (err) => {
    console.warn("Real-time resources error:", err);
  });
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

// ── Global Feedback & Question Contribution Modal Generator ──
import { submitFeedback, submitSuggestedQuestions } from "./analytics.js";

export function initFeedbackModal() {
  if (document.getElementById("feedback-modal")) return;

  const modalHtml = `
    <div id="feedback-modal" class="fixed inset-0 z-[9990] hidden flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300 opacity-0">
      <div class="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transform scale-95 transition-all duration-300" id="feedback-modal-card">
        
        <!-- Modal Header -->
        <div class="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-5 sm:px-6 py-4 flex items-center justify-between text-white flex-shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            </div>
            <div>
              <h3 class="font-extrabold text-base leading-tight">Learner Feedback & Contribution</h3>
              <p class="text-[11px] text-indigo-100">Send reviews or suggest new questions for Admin approval</p>
            </div>
          </div>
          <button id="fb-close-btn" class="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center text-white text-xl font-bold transition">&times;</button>
        </div>

        <!-- Mode Navigation Tabs -->
        <div class="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-4 sm:px-6 flex-shrink-0">
          <button id="fb-tab-general-btn" type="button" class="py-3 px-4 text-xs sm:text-sm font-extrabold border-b-2 border-indigo-600 text-indigo-600 flex items-center gap-1.5 transition">
            <span>💬</span> General Feedback
          </button>
          <button id="fb-tab-suggest-btn" type="button" class="py-3 px-4 text-xs sm:text-sm font-extrabold border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 transition">
            <span>✍️</span> Suggest Questions <span class="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">Admin Review</span>
          </button>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="overflow-y-auto flex-1 p-5 sm:p-6 space-y-4">
          
          <!-- TAB 1: GENERAL FEEDBACK -->
          <form id="feedback-form" class="space-y-4">
            
            <!-- Optional User Identity -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="fb-user-name" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">Your Name (Optional)</label>
                <input type="text" id="fb-user-name" placeholder="e.g. Rahul Sharma" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500">
              </div>
              <div>
                <label for="fb-user-email" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">Email (Optional)</label>
                <input type="email" id="fb-user-email" placeholder="rahul@example.com" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500">
              </div>
            </div>

            <!-- Rating Stars -->
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">How was your learning experience?</label>
              <div class="flex items-center gap-2" id="fb-star-container">
                ${[1,2,3,4,5].map(star => `
                  <button type="button" data-star="${star}" class="fb-star-btn w-10 h-10 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-500 flex items-center justify-center text-xl font-bold transition border border-amber-200">
                    ★
                  </button>
                `).join("")}
              </div>
              <input type="hidden" id="fb-rating-val" value="5">
            </div>

            <!-- Category Selection -->
            <div>
              <label for="fb-category" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">Feedback Category</label>
              <select id="fb-category" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500">
                <option value="General Suggestion">💡 General Suggestion</option>
                <option value="Quiz Bug / Error">🐛 Quiz Bug / Error</option>
                <option value="Content Correction">📝 Question / Content Correction</option>
                <option value="Feature Request">🚀 Feature Request</option>
              </select>
            </div>

            <!-- Message Textarea -->
            <div>
              <label for="fb-message" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">Your Message / Feedback</label>
              <textarea id="fb-message" rows="3" required placeholder="Write your comments, bug reports, or feature requests here..." class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-sm rounded-xl p-3 focus:ring-2 focus:ring-indigo-500"></textarea>
            </div>

            <!-- Submit Buttons -->
            <div class="flex items-center justify-end gap-3 pt-2">
              <button type="button" id="fb-cancel-btn" class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
              <button type="submit" class="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2">
                Submit Feedback &rarr;
              </button>
            </div>

          </form>

          <!-- TAB 2: SUGGEST ADDITIONAL QUESTIONS FOR ADMIN REVIEW -->
          <form id="suggest-questions-form" class="hidden space-y-5">
            
            <div class="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 p-3.5 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
              <span class="text-base">ℹ️</span>
              <div>
                <p class="font-bold">Contribute Questions to QuizTEL</p>
                <p class="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">Select a course, write your questions with 4 options and the correct answer. You can add as many questions as you like! The Admin will review and approve them before they are added to the official quizzes.</p>
              </div>
            </div>

            <!-- Course Selection -->
            <div>
              <label for="sq-course-select" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Target Course <span class="text-red-500">*</span>
              </label>
              <select id="sq-course-select" required class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 font-medium">
                <option value="" disabled selected>Loading available courses...</option>
              </select>
            </div>

            <!-- Optional Submitter Info -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="sq-submitter-name" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">Your Name</label>
                <input type="text" id="sq-submitter-name" placeholder="e.g. Vignesh (NPTEL Student)" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500">
              </div>
              <div>
                <label for="sq-submitter-email" class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">Your Email</label>
                <input type="email" id="sq-submitter-email" placeholder="student@example.com" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500">
              </div>
            </div>

            <!-- Dynamic Question Cards Container -->
            <div class="space-y-4 pt-2" id="sq-questions-list">
              <!-- Rendered via JS -->
            </div>

            <!-- Add Another Question Button -->
            <div class="pt-1">
              <button type="button" id="sq-add-question-btn" class="w-full py-2.5 border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                + Add Another Question
              </button>
            </div>

            <!-- Submit Buttons -->
            <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button type="button" id="sq-cancel-btn" class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
              <button type="submit" class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2">
                Submit Questions for Admin Approval &rarr;
              </button>
            </div>

          </form>

        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  const modal = document.getElementById("feedback-modal");
  const modalCard = document.getElementById("feedback-modal-card");
  const closeBtn = document.getElementById("fb-close-btn");
  const cancelBtn = document.getElementById("fb-cancel-btn");
  const sqCancelBtn = document.getElementById("sq-cancel-btn");
  
  const tabGeneralBtn = document.getElementById("fb-tab-general-btn");
  const tabSuggestBtn = document.getElementById("fb-tab-suggest-btn");
  const generalForm = document.getElementById("feedback-form");
  const suggestForm = document.getElementById("suggest-questions-form");
  const courseSelect = document.getElementById("sq-course-select");
  const questionsList = document.getElementById("sq-questions-list");
  const addQBtn = document.getElementById("sq-add-question-btn");

  const ratingInput = document.getElementById("fb-rating-val");
  const starBtns = document.querySelectorAll(".fb-star-btn");

  // Tab switching
  function switchTab(mode) {
    if (mode === "general") {
      tabGeneralBtn.classList.add("border-indigo-600", "text-indigo-600");
      tabGeneralBtn.classList.remove("border-transparent", "text-slate-500", "dark:text-slate-400");
      tabSuggestBtn.classList.remove("border-indigo-600", "text-indigo-600");
      tabSuggestBtn.classList.add("border-transparent", "text-slate-500", "dark:text-slate-400");
      generalForm.classList.remove("hidden");
      suggestForm.classList.add("hidden");
    } else {
      tabSuggestBtn.classList.add("border-indigo-600", "text-indigo-600");
      tabSuggestBtn.classList.remove("border-transparent", "text-slate-500", "dark:text-slate-400");
      tabGeneralBtn.classList.remove("border-indigo-600", "text-indigo-600");
      tabGeneralBtn.classList.add("border-transparent", "text-slate-500", "dark:text-slate-400");
      generalForm.classList.add("hidden");
      suggestForm.classList.remove("hidden");
      loadCourseOptions();
    }
  }

  tabGeneralBtn.addEventListener("click", () => switchTab("general"));
  tabSuggestBtn.addEventListener("click", () => switchTab("suggest"));

  // Dynamic Question Cards Logic
  let questionCardCount = 0;

  function createQuestionCard() {
    questionCardCount++;
    const qIndex = questionCardCount;
    const card = document.createElement("div");
    card.className = "sq-question-card bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 relative transition";
    card.dataset.cardIndex = qIndex;

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
          <span class="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold sq-badge-num">1</span>
          Question
        </span>
        <button type="button" class="sq-remove-btn text-xs text-red-500 hover:text-red-700 font-bold transition ${qIndex === 1 ? 'hidden' : ''}">
          ✕ Remove
        </button>
      </div>

      <div>
        <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Question Text <span class="text-red-500">*</span></label>
        <textarea rows="2" required placeholder="Type the question prompt here..." class="sq-q-text w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs sm:text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"></textarea>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Option A <span class="text-red-500">*</span></label>
          <input type="text" required placeholder="Option A text" class="sq-opt-0 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs rounded-xl p-2 focus:ring-2 focus:ring-indigo-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Option B <span class="text-red-500">*</span></label>
          <input type="text" required placeholder="Option B text" class="sq-opt-1 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs rounded-xl p-2 focus:ring-2 focus:ring-indigo-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Option C</label>
          <input type="text" placeholder="Option C text (optional)" class="sq-opt-2 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs rounded-xl p-2 focus:ring-2 focus:ring-indigo-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Option D</label>
          <input type="text" placeholder="Option D text (optional)" class="sq-opt-3 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs rounded-xl p-2 focus:ring-2 focus:ring-indigo-500">
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Correct Answer <span class="text-red-500">*</span></label>
          <select class="sq-correct-opt w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs rounded-xl p-2 font-bold focus:ring-2 focus:ring-indigo-500">
            <option value="0">Option A</option>
            <option value="1">Option B</option>
            <option value="2">Option C</option>
            <option value="3">Option D</option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Explanation (Optional)</label>
          <input type="text" placeholder="Why is this option correct?" class="sq-explanation w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-xs rounded-xl p-2 focus:ring-2 focus:ring-indigo-500">
        </div>
      </div>
    `;

    // Remove listener
    card.querySelector(".sq-remove-btn").addEventListener("click", () => {
      card.remove();
      updateQuestionCardBadges();
    });

    questionsList.appendChild(card);
    updateQuestionCardBadges();
  }

  function updateQuestionCardBadges() {
    const cards = questionsList.querySelectorAll(".sq-question-card");
    cards.forEach((c, idx) => {
      const badge = c.querySelector(".sq-badge-num");
      if (badge) badge.textContent = idx + 1;
      const removeBtn = c.querySelector(".sq-remove-btn");
      if (removeBtn) {
        removeBtn.classList.toggle("hidden", cards.length <= 1);
      }
    });
  }

  addQBtn.addEventListener("click", createQuestionCard);

  // Initialize with 1 default question card
  createQuestionCard();

  // Load Courses for Suggestion Tab
  async function loadCourseOptions() {
    if (courseSelect.options.length > 1) return;
    try {
      const { loadCourses } = await import("./app.js");
      const list = await loadCourses();
      if (list && list.length) {
        courseSelect.innerHTML = `<option value="" disabled selected>— Choose Course —</option>` +
          list.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
      } else {
        courseSelect.innerHTML = `<option value="" disabled selected>No courses found in database</option>`;
      }
    } catch (e) {
      console.warn("Could not load courses for feedback modal:", e);
      courseSelect.innerHTML = `<option value="" disabled selected>Select course</option>`;
    }
  }

  // Star Rating Picker Logic
  starBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const val = parseInt(btn.dataset.star);
      ratingInput.value = val;
      starBtns.forEach(b => {
        const bVal = parseInt(b.dataset.star);
        if (bVal <= val) {
          b.classList.add("bg-amber-400", "text-white", "border-amber-400");
          b.classList.remove("bg-amber-50", "text-amber-500", "border-amber-200");
        } else {
          b.classList.remove("bg-amber-400", "text-white", "border-amber-400");
          b.classList.add("bg-amber-50", "text-amber-500", "border-amber-200");
        }
      });
    });
  });
  if (starBtns[4]) starBtns[4].click();

  const openModal = () => {
    modal.classList.remove("hidden");
    loadCourseOptions();
    requestAnimationFrame(() => {
      modal.classList.remove("opacity-0");
      modalCard.classList.remove("scale-95");
      modalCard.classList.add("scale-100");
    });
  };

  const closeModal = () => {
    modal.classList.add("opacity-0");
    modalCard.classList.remove("scale-100");
    modalCard.classList.add("scale-95");
    setTimeout(() => modal.classList.add("hidden"), 300);
  };

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  sqCancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Global triggers for opening feedback modal
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-open-feedback]");
    if (trigger) {
      e.preventDefault();
      openModal();
    }
  });

  // ── Form 1: General Feedback Submission ──
  generalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rating = ratingInput.value;
    const category = document.getElementById("fb-category").value;
    const message = document.getElementById("fb-message").value.trim();
    const userName = document.getElementById("fb-user-name")?.value || "";
    const userEmail = document.getElementById("fb-user-email")?.value || "";

    if (!message) return;

    showSpinner("Submitting feedback...");
    try {
      await submitFeedback({
        rating,
        category,
        message,
        userName,
        userEmail,
        page: window.location.pathname.split("/").pop() || "index.html"
      });
      showToast("Thank you for your feedback!", "success");
      generalForm.reset();
      if (starBtns[4]) starBtns[4].click();
      closeModal();
    } catch (err) {
      showToast("Feedback error: " + err.message, "error");
    } finally {
      hideSpinner();
    }
  });

  // ── Form 2: Suggest Additional Questions Submission ──
  suggestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const courseId = courseSelect.value;
    const courseName = courseSelect.options[courseSelect.selectedIndex]?.textContent || "NPTEL Course";
    const submitterName = document.getElementById("sq-submitter-name")?.value || "";
    const submitterEmail = document.getElementById("sq-submitter-email")?.value || "";

    if (!courseId) {
      showToast("Please choose a target course.", "error");
      return;
    }

    const cards = questionsList.querySelectorAll(".sq-question-card");
    const questions = [];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const text = card.querySelector(".sq-q-text").value.trim();
      const opt0 = card.querySelector(".sq-opt-0").value.trim();
      const opt1 = card.querySelector(".sq-opt-1").value.trim();
      const opt2 = card.querySelector(".sq-opt-2").value.trim();
      const opt3 = card.querySelector(".sq-opt-3").value.trim();
      const correctOptionIndex = parseInt(card.querySelector(".sq-correct-opt").value) || 0;
      const explanation = card.querySelector(".sq-explanation").value.trim();

      if (!text) {
        showToast(`Question #${i + 1} is missing question text.`, "error");
        return;
      }
      if (!opt0 || !opt1) {
        showToast(`Question #${i + 1} needs at least Option A and Option B.`, "error");
        return;
      }

      const options = [opt0, opt1];
      if (opt2) options.push(opt2);
      if (opt3) options.push(opt3);

      questions.push({
        text,
        options,
        correctOptionIndex: Math.min(correctOptionIndex, options.length - 1),
        explanation
      });
    }

    if (!questions.length) {
      showToast("Please add at least one question.", "error");
      return;
    }

    showSpinner(`Submitting ${questions.length} question(s) to Admin...`);
    try {
      await submitSuggestedQuestions({
        courseId,
        courseName,
        submitterName,
        submitterEmail,
        questions
      });
      showToast(`Successfully submitted ${questions.length} question(s) for Admin approval!`, "success");
      suggestForm.reset();
      questionsList.innerHTML = "";
      questionCardCount = 0;
      createQuestionCard();
      closeModal();
    } catch (err) {
      showToast("Failed to submit questions: " + err.message, "error");
    } finally {
      hideSpinner();
    }
  });
}


