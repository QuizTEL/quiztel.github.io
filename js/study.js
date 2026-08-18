// ============================================================
//  QuizTEL — Study Mode (study.js)
// ============================================================

import { 
  loadCourses, loadWeeks, loadQuestions, loadResources, populateSelect, showToast, showSpinner, hideSpinner, initFeedbackModal, initTheme,
  subscribeToCourses, subscribeToWeeks, subscribeToQuestions, subscribeToResources
} from "./app.js";
import { trackPageView, initPresence } from "./analytics.js";

const courseSelect  = document.getElementById("course-select");
const weekSelect    = document.getElementById("week-select");
const questionsArea = document.getElementById("questions-area");
const qCount        = document.getElementById("q-count");
const emptyState    = document.getElementById("empty-state");
const resourcesArea = document.getElementById("resources-area");
const resourcesList = document.getElementById("resources-list");

const OPTION_LABELS = ["A", "B", "C", "D"];

let unsubStudyCourses = null;
let unsubStudyWeeks = null;
let unsubStudyQuestions = null;
let unsubStudyResources = null;

// ── Init ──────────────────────────────────────────────────────
function init() {
  initTheme();
  trackPageView();
  initPresence();
  initFeedbackModal();

  const urlParams = new URLSearchParams(window.location.search);
  const targetCourseId = urlParams.get("course");

  unsubStudyCourses = subscribeToCourses((courses) => {
    const curVal = courseSelect.value || (targetCourseId && courses.some(c => c.id === targetCourseId) ? targetCourseId : "");
    populateSelect(courseSelect, courses, "— Select a Course —");
    if (curVal) {
      courseSelect.value = curVal;
      courseSelect.dispatchEvent(new Event("change"));
    }
  });
}

// ── Course selection → load weeks ─────────────────────────────
courseSelect.addEventListener("change", () => {
  const cid = courseSelect.value;

  if (unsubStudyWeeks) { unsubStudyWeeks(); unsubStudyWeeks = null; }
  if (unsubStudyQuestions) { unsubStudyQuestions(); unsubStudyQuestions = null; }
  if (unsubStudyResources) { unsubStudyResources(); unsubStudyResources = null; }

  weekSelect.innerHTML = `<option value="" disabled selected>— Select a Week —</option>`;
  weekSelect.disabled = !cid;
  questionsArea.innerHTML = "";
  if (qCount) qCount.textContent = "";
  if (emptyState) emptyState.classList.remove("hidden");
  if (resourcesArea) resourcesArea.classList.add("hidden");

  if (!cid) return;

  unsubStudyWeeks = subscribeToWeeks(cid, (weeks) => {
    const curWeek = weekSelect.value;
    populateSelect(weekSelect, weeks, "— Select a Week —");
    if (curWeek && weeks.some(w => w.id === curWeek)) {
      weekSelect.value = curWeek;
      weekSelect.dispatchEvent(new Event("change"));
    } else if (targetCourseId && weeks.length > 0) {
      // Auto-select Week 1 when navigating directly from Home page card
      weekSelect.value = weeks[0].id;
      weekSelect.dispatchEvent(new Event("change"));
    }
    weekSelect.disabled = false;
  });
});

// ── Week selection → live fetch questions & resources ──────────
weekSelect.addEventListener("change", () => {
  const cid = courseSelect.value;
  const wid = weekSelect.value;

  if (unsubStudyQuestions) { unsubStudyQuestions(); unsubStudyQuestions = null; }
  if (unsubStudyResources) { unsubStudyResources(); unsubStudyResources = null; }

  if (!cid || !wid) return;

  if (emptyState) emptyState.classList.add("hidden");

  // Real-time Resources Listener
  unsubStudyResources = subscribeToResources(cid, wid, (resources) => {
    if (resources && resources.length > 0) {
      if (resourcesArea) resourcesArea.classList.remove("hidden");
      if (resourcesList) {
        resourcesList.innerHTML = resources.map(r => `
          <a href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer" class="flex items-center justify-between p-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition text-xs font-semibold group">
            <span class="truncate max-w-[240px] sm:max-w-xs" title="${escHtml(r.title)}">${escHtml(r.title)}</span>
            <span class="px-3 py-1 bg-amber-400 text-indigo-950 font-bold rounded-lg group-hover:scale-105 transition flex items-center gap-1 flex-shrink-0">
              Download PDF &darr;
            </span>
          </a>
        `).join("");
      }
    } else {
      if (resourcesArea) resourcesArea.classList.add("hidden");
    }
  });

  // Real-time Questions Listener
  unsubStudyQuestions = subscribeToQuestions(cid, wid, (questions) => {
    if (questions.length === 0) {
      if (emptyState) emptyState.classList.remove("hidden");
      questionsArea.innerHTML = "";
      if (qCount) qCount.textContent = "";
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");
    if (qCount) {
      qCount.textContent = `${questions.length} question${questions.length !== 1 ? "s" : ""}`;
    }

    renderQuestions(questions);
  });
});

// ── Render question cards ─────────────────────────────────────
function renderQuestions(questions) {
  questionsArea.innerHTML = "";

  questions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "study-card bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5";

    const optionsHTML = q.options.map((opt, i) => {
      const isCorrect = i === q.correctOptionIndex;
      const baseClass = isCorrect
        ? "flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border-2 border-emerald-500 font-semibold"
        : "flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-slate-200 font-medium";
      const labelClass = isCorrect
        ? "flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center shadow-sm"
        : "flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 text-slate-700 text-xs font-bold flex items-center justify-center";
      const textClass = isCorrect
        ? "text-sm text-emerald-900 flex-1 leading-normal"
        : "text-sm text-slate-800 flex-1 leading-normal";
      const icon = isCorrect ? `<svg class="ml-auto w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>` : "";

      return `<div class="${baseClass}">
        <span class="${labelClass}">${OPTION_LABELS[i]}</span>
        <span class="${textClass}">${escHtml(opt)}</span>
        ${icon}
      </div>`;
    }).join("");

    const explHTML = q.explanation && q.explanation !== "No explanation provided."
      ? `<details class="expl-details group mt-4 border border-indigo-200/80 bg-indigo-50/70 rounded-xl overflow-hidden transition-all duration-200">
           <summary class="flex items-center justify-between p-3.5 text-xs font-bold text-indigo-900 cursor-pointer select-none hover:bg-indigo-100/70 transition">
             <span class="flex items-center gap-2">
               <svg class="w-4 h-4 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
               View Detailed Explanation
             </span>
             <svg class="w-4 h-4 text-indigo-500 transform group-open:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
           </summary>
           <div class="expl-body px-4 pb-4 pt-2 border-t border-indigo-200/60 bg-white/70 text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
             ${escHtml(q.explanation)}
           </div>
         </details>`
      : "";

    card.innerHTML = `
      <div class="flex items-start gap-3 mb-4">
        <span class="flex-shrink-0 w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-sm font-bold shadow-sm">${idx + 1}</span>
        <p class="text-gray-800 font-medium text-base leading-relaxed mt-1">${escHtml(q.text)}</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
        ${optionsHTML}
      </div>
      ${explHTML}`;

    questionsArea.appendChild(card);
  });

  // Animate in
  requestAnimationFrame(() => {
    questionsArea.querySelectorAll(".study-card").forEach((card, i) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(16px)";
      setTimeout(() => {
        card.style.transition = "opacity 0.35s ease, transform 0.35s ease";
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      }, i * 60);
    });
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Start ─────────────────────────────────────────────────────
init();
