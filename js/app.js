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

// ── Global Feedback Modal Generator ────────────────────────────
import { submitFeedback } from "./analytics.js";

export function initFeedbackModal() {
  if (document.getElementById("feedback-modal")) return;

  const modalHtml = `
    <div id="feedback-modal" class="fixed inset-0 z-[9990] hidden flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300 opacity-0">
      <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform scale-95 transition-all duration-300" id="feedback-modal-card">
        
        <!-- Modal Header -->
        <div class="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between text-white">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            </div>
            <div>
              <h3 class="font-extrabold text-base leading-tight">Share Your Feedback</h3>
              <p class="text-[11px] text-indigo-100">Help us improve QuizTEL for NPTEL learners</p>
            </div>
          </div>
          <button id="fb-close-btn" class="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center text-white text-xl font-bold transition">&times;</button>
        </div>

        <!-- Form Body -->
        <form id="feedback-form" class="p-6 space-y-4">
          
          <!-- Rating Stars -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">How was your experience?</label>
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
            <label for="fb-category" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Feedback Category</label>
            <select id="fb-category" class="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500">
              <option value="General Suggestion">💡 General Suggestion</option>
              <option value="Quiz Bug / Error">🐛 Quiz Bug / Error</option>
              <option value="Content Correction">📝 Question / Content Correction</option>
              <option value="Feature Request">🚀 Feature Request</option>
            </select>
          </div>

          <!-- Auto-Filled Name Input (Uses Chrome autocomplete='name') -->
          <div>
            <label for="fb-name" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Your Name (Chrome Profile Auto-filled)</label>
            <input type="text" id="fb-name" name="name" autocomplete="name" placeholder="Name (e.g. Vigneshwaran T)" class="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500">
          </div>

          <!-- Message Textarea -->
          <div>
            <label for="fb-message" class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Your Message / Feedback</label>
            <textarea id="fb-message" rows="3" required placeholder="Write your comments, bug reports, or feature requests here..." class="w-full bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-xl p-3 focus:ring-2 focus:ring-indigo-500"></textarea>
          </div>

          <!-- Submit Buttons -->
          <div class="flex items-center justify-end gap-3 pt-2">
            <button type="button" id="fb-cancel-btn" class="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition">Cancel</button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2">
              Submit Feedback &rarr;
            </button>
          </div>

        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  const modal = document.getElementById("feedback-modal");
  const modalCard = document.getElementById("feedback-modal-card");
  const closeBtn = document.getElementById("fb-close-btn");
  const cancelBtn = document.getElementById("fb-cancel-btn");
  const form = document.getElementById("feedback-form");
  const ratingInput = document.getElementById("fb-rating-val");
  const starBtns = document.querySelectorAll(".fb-star-btn");
  const nameInput = document.getElementById("fb-name");

  // Pre-fill name from localStorage if saved
  if (nameInput) {
    nameInput.value = localStorage.getItem("quiztel_user_name") || "";
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
  // Trigger 5 star default styling
  if (starBtns[4]) starBtns[4].click();

  const openModal = () => {
    modal.classList.remove("hidden");
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

  // Submit Feedback Form
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rating = ratingInput.value;
    const category = document.getElementById("fb-category").value;
    const name = document.getElementById("fb-name").value.trim();
    const message = document.getElementById("fb-message").value.trim();

    if (!message) return;

    if (name) {
      localStorage.setItem("quiztel_user_name", name);
    }

    showSpinner("Submitting feedback...");
    try {
      await submitFeedback({
        name: name || "NPTEL Learner",
        rating,
        category,
        message,
        page: window.location.pathname.split("/").pop() || "index.html"
      });
      showToast("Thank you for your feedback! Saved to Admin panel.", "success");
      form.reset();
      if (starBtns[4]) starBtns[4].click();
      closeModal();
    } catch (err) {
      showToast("Failed to submit feedback: " + err.message, "error");
    } finally {
      hideSpinner();
    }
  });
}

