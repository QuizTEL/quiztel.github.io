// ============================================================
//  QuizTEL — Study Mode (study.js)
//  Course → Paper Type (Current/PYQ) → Week → Questions
// ============================================================

import { 
  loadCourses, loadWeeks, loadQuestions, loadResources, populateSelect, showToast, showSpinner, hideSpinner, initFeedbackModal, initTheme,
  subscribeToCourses, subscribeToWeeks, subscribeToQuestions, subscribeToResources
} from "./app.js?v=20261023_7";
import { trackPageView, initPresence } from "./analytics.js";

const courseSelect        = document.getElementById("course-select");
const paperTypeSection    = document.getElementById("paper-type-section");
const paperTypeCurrentBtn = document.getElementById("paper-type-current-btn");
const paperTypePyqBtn     = document.getElementById("paper-type-pyq-btn");
const paperTypeHint       = document.getElementById("paper-type-hint");
const paperTypeBadge      = document.getElementById("paper-type-badge");
const weekSelect          = document.getElementById("week-select");
const questionsArea       = document.getElementById("questions-area");
const qCount              = document.getElementById("q-count");
const emptyState          = document.getElementById("empty-state");
const emptyStateTitle     = document.getElementById("empty-state-title");
const emptyStateDesc      = document.getElementById("empty-state-desc");
const emptyStateActions   = document.getElementById("empty-state-actions");
const resourcesArea       = document.getElementById("resources-area");
const resourcesList       = document.getElementById("resources-list");

const OPTION_LABELS = ["A", "B", "C", "D"];

let unsubStudyCourses   = null;
let unsubStudyWeeks     = null;
let unsubStudyQuestions = null;
let unsubStudyResources = null;

let cachedWeeks         = [];
let selectedPaperType   = null; // "current" | "pyq"

// ── Init ──────────────────────────────────────────────────────
function init() {
  initTheme();
  trackPageView();
  initPresence();
  initFeedbackModal();

  const urlParams = new URLSearchParams(window.location.search);
  const targetCourseId = urlParams.get("course");
  const targetType = urlParams.get("type"); // optional preset type

  unsubStudyCourses = subscribeToCourses((courses) => {
    const curVal = courseSelect.value || (targetCourseId && courses.some(c => c.id === targetCourseId) ? targetCourseId : "");
    populateSelect(courseSelect, courses, "— Select NPTEL Course —");
    if (curVal) {
      courseSelect.value = curVal;
      onCourseSelected(curVal, targetType);
    }
  });

  // Attach Paper Type card click listeners
  if (paperTypeCurrentBtn) {
    paperTypeCurrentBtn.addEventListener("click", () => {
      if (paperTypeCurrentBtn.disabled) return;
      setPaperType("current");
    });
  }

  if (paperTypePyqBtn) {
    paperTypePyqBtn.addEventListener("click", () => {
      if (paperTypePyqBtn.disabled) return;
      setPaperType("pyq");
    });
  }
}

// ── 1. Course Selection ───────────────────────────────────────
courseSelect.addEventListener("change", () => {
  const cid = courseSelect.value;
  onCourseSelected(cid);
});

function onCourseSelected(cid, initialType = null) {
  // Tear down existing listeners
  if (unsubStudyWeeks) { unsubStudyWeeks(); unsubStudyWeeks = null; }
  if (unsubStudyQuestions) { unsubStudyQuestions(); unsubStudyQuestions = null; }
  if (unsubStudyResources) { unsubStudyResources(); unsubStudyResources = null; }

  // Reset UI elements
  questionsArea.innerHTML = "";
  if (qCount) {
    qCount.textContent = "";
    qCount.className = "hidden";
  }
  if (resourcesArea) resourcesArea.classList.add("hidden");

  if (!cid) {
    // Disable Paper Type and Week selectors
    selectedPaperType = null;
    updatePaperTypeUI(null);
    disablePaperTypeControls(true);
    weekSelect.innerHTML = `<option value="" disabled selected>— Select Course & Paper Type First —</option>`;
    weekSelect.disabled = true;
    showEmptyState(
      "No Questions Displayed",
      "Select a course, paper type, and week from the controls above to view questions."
    );
    return;
  }

  // Course selected: enable paper type buttons and prompt user
  disablePaperTypeControls(false);

  // If initialType provided, set it; otherwise wait for explicit user choice
  if (initialType === "pyq" || initialType === "current") {
    setPaperType(initialType);
  } else {
    // Keep week selection disabled until paper type is explicitly chosen
    selectedPaperType = null;
    updatePaperTypeUI(null);
    weekSelect.innerHTML = `<option value="" disabled selected>— Select Paper Type (Current Year or PYQ) —</option>`;
    weekSelect.disabled = true;
    showEmptyState(
      "Which question paper would you like to practice?",
      "Please choose either 📘 Current Year or 📙 Previous Year Questions (PYQ) above to continue."
    );
  }
}

function disablePaperTypeControls(disabled) {
  if (paperTypeCurrentBtn) {
    paperTypeCurrentBtn.disabled = disabled;
    if (disabled) {
      paperTypeCurrentBtn.classList.add("opacity-50", "cursor-not-allowed");
      paperTypeCurrentBtn.classList.remove("cursor-pointer", "hover:border-indigo-400");
    } else {
      paperTypeCurrentBtn.classList.remove("opacity-50", "cursor-not-allowed");
      paperTypeCurrentBtn.classList.add("cursor-pointer");
    }
  }

  if (paperTypePyqBtn) {
    paperTypePyqBtn.disabled = disabled;
    if (disabled) {
      paperTypePyqBtn.classList.add("opacity-50", "cursor-not-allowed");
      paperTypePyqBtn.classList.remove("cursor-pointer", "hover:border-amber-400");
    } else {
      paperTypePyqBtn.classList.remove("opacity-50", "cursor-not-allowed");
      paperTypePyqBtn.classList.add("cursor-pointer");
    }
  }

  if (paperTypeHint) {
    if (disabled) {
      paperTypeHint.textContent = "Select a course above first to choose question paper type.";
      paperTypeHint.className = "text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 italic";
    } else {
      paperTypeHint.textContent = "Click an option above to load weekly questions.";
      paperTypeHint.className = "text-[11px] text-indigo-600 dark:text-indigo-400 mt-1.5 font-semibold";
    }
  }
}

// ── 2. Paper Type Selection ───────────────────────────────────
function setPaperType(type) {
  selectedPaperType = type;
  updatePaperTypeUI(type);

  const cid = courseSelect.value;
  if (cid) {
    if (unsubStudyWeeks) { unsubStudyWeeks(); unsubStudyWeeks = null; }
    weekSelect.innerHTML = `<option value="" disabled selected>Loading ${type === "pyq" ? "PYQ" : "Current Year"} weeks...</option>`;
    weekSelect.disabled = true;

    // Real-time subscribe strictly to weeks belonging to this paperType
    unsubStudyWeeks = subscribeToWeeks(cid, (weeks) => {
      cachedWeeks = weeks;
      populateWeekDropdown();
    }, type);
  }
}

function updatePaperTypeUI(type) {
  // Current Year Button Styling
  if (paperTypeCurrentBtn) {
    const badge = paperTypeCurrentBtn.querySelector(".paper-badge");
    if (type === "current") {
      paperTypeCurrentBtn.className = "paper-type-card text-left p-4 rounded-2xl border-2 border-indigo-600 dark:border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-md cursor-pointer transition-all duration-200 group flex items-start gap-3.5 select-none";
      if (badge) badge.className = "paper-badge w-5 h-5 rounded-full bg-indigo-600 border-2 border-indigo-600 flex items-center justify-center text-[10px] text-white font-bold transition scale-110";
    } else {
      paperTypeCurrentBtn.className = "paper-type-card text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-200 cursor-pointer group flex items-start gap-3.5 select-none";
      if (badge) badge.className = "paper-badge w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center text-[10px] text-white font-bold transition";
    }
  }

  // PYQ Button Styling
  if (paperTypePyqBtn) {
    const badge = paperTypePyqBtn.querySelector(".paper-badge");
    if (type === "pyq") {
      paperTypePyqBtn.className = "paper-type-card text-left p-4 rounded-2xl border-2 border-amber-500 dark:border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 ring-2 ring-amber-500/20 shadow-md cursor-pointer transition-all duration-200 group flex items-start gap-3.5 select-none";
      if (badge) badge.className = "paper-badge w-5 h-5 rounded-full bg-amber-500 border-2 border-amber-500 flex items-center justify-center text-[10px] text-white font-bold transition scale-110";
    } else {
      paperTypePyqBtn.className = "paper-type-card text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:border-amber-400 hover:bg-amber-50/30 transition-all duration-200 cursor-pointer group flex items-start gap-3.5 select-none";
      if (badge) badge.className = "paper-badge w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center text-[10px] text-white font-bold transition";
    }
  }

  // Top Badge
  if (paperTypeBadge) {
    if (type === "pyq") {
      paperTypeBadge.textContent = "📙 Previous Year Questions (PYQ)";
      paperTypeBadge.className = "inline-flex items-center px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold";
    } else if (type === "current") {
      paperTypeBadge.textContent = "📘 Current Year Assignment";
      paperTypeBadge.className = "inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold";
    } else {
      paperTypeBadge.className = "hidden";
    }
  }
}

// ── 3. Week Selection ─────────────────────────────────────────
function populateWeekDropdown() {
  const currentVal = weekSelect.value;
  const modeTitle = selectedPaperType === "pyq" ? "PYQ 📙" : "Current Year 📘";
  weekSelect.innerHTML = `<option value="" disabled selected>— Select ${modeTitle} Week (1 to 12) —</option>`;

  if (cachedWeeks.length === 0) {
    weekSelect.innerHTML = `<option value="" disabled selected>— No ${selectedPaperType === "pyq" ? "PYQ" : "Current Year"} Weeks Available —</option>`;
    weekSelect.disabled = true;
    showEmptyState(
      `No ${modeTitle} Available Yet`,
      `There are no weeks published under ${selectedPaperType === "pyq" ? "Previous Year Questions (PYQ)" : "Current Year"} for this course yet.`
    );
    return;
  }

  cachedWeeks.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = w.name;
    weekSelect.appendChild(opt);
  });

  if (currentVal && cachedWeeks.some(w => w.id === currentVal)) {
    weekSelect.value = currentVal;
    loadWeekContent();
  } else {
    weekSelect.value = "";
    showEmptyState(
      `Select a Week for ${modeTitle}`,
      `Choose Week 1 through Week 12 from the dropdown below to view questions.`
    );
  }

  weekSelect.disabled = false;
}

weekSelect.addEventListener("change", () => {
  loadWeekContent();
});

// ── 4. Load & Display Questions for Course + Paper Type + Week
function loadWeekContent() {
  const cid = courseSelect.value;
  const wid = weekSelect.value;

  if (unsubStudyQuestions) { unsubStudyQuestions(); unsubStudyQuestions = null; }
  if (unsubStudyResources) { unsubStudyResources(); unsubStudyResources = null; }

  if (!cid || !wid || !selectedPaperType) return;

  // Real-time Resources Listener (Solution keys / official PDFs)
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

  // Real-time Questions Listener filtered by selectedPaperType
  unsubStudyQuestions = subscribeToQuestions(cid, wid, (questions) => {
    if (questions.length === 0) {
      questionsArea.innerHTML = "";
      if (qCount) {
        qCount.textContent = "";
        qCount.className = "hidden";
      }

      if (selectedPaperType === "pyq") {
        showEmptyState(
          "PYQs are not available for this week yet.",
          "Previous-year questions have not been added for this week yet. You can practice the Current Year assignment instead or pick another week.",
          `<button type="button" id="switch-to-current-btn" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-1.5">
             <span>📘 Switch to Current Year</span>
           </button>`
        );
        const switchBtn = document.getElementById("switch-to-current-btn");
        if (switchBtn) {
          switchBtn.addEventListener("click", () => setPaperType("current"));
        }
      } else {
        showEmptyState(
          "No Current Year Questions Available",
          "Current Year questions have not been uploaded for this week yet. Please check back later or select another week."
        );
      }
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    if (qCount) {
      const typeLabel = selectedPaperType === "pyq" ? "📙 PYQ" : "📘 Current Year";
      qCount.textContent = `${typeLabel} • ${questions.length} question${questions.length !== 1 ? "s" : ""}`;
      qCount.className = selectedPaperType === "pyq"
        ? "inline-flex items-center px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold self-start md:self-auto"
        : "inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold self-start md:self-auto";
    }

    renderQuestions(questions);
  }, selectedPaperType);
}

function showEmptyState(title, desc, actionsHtml = "") {
  if (!emptyState) return;
  emptyState.classList.remove("hidden");
  if (emptyStateTitle) emptyStateTitle.textContent = title;
  if (emptyStateDesc) emptyStateDesc.textContent = desc;

  if (emptyStateActions) {
    if (actionsHtml) {
      emptyStateActions.innerHTML = actionsHtml;
      emptyStateActions.classList.remove("hidden");
    } else {
      emptyStateActions.innerHTML = "";
      emptyStateActions.classList.add("hidden");
    }
  }
}

// ── Render question cards ─────────────────────────────────────
function renderQuestions(questions) {
  questionsArea.innerHTML = "";

  questions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "study-card bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-gray-100 dark:border-slate-700 p-6 mb-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5";

    const optionsHTML = q.options.map((opt, i) => {
      const isCorrect = i === q.correctOptionIndex;
      const baseClass = isCorrect
        ? "flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-500 font-semibold"
        : "flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 font-medium";
      const labelClass = isCorrect
        ? "flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center shadow-sm"
        : "flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center";
      const textClass = isCorrect
        ? "text-sm text-emerald-900 dark:text-emerald-200 flex-1 leading-normal"
        : "text-sm text-slate-800 dark:text-slate-200 flex-1 leading-normal";
      const icon = isCorrect ? `<svg class="ml-auto w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>` : "";

      return `<div class="${baseClass}">
        <span class="${labelClass}">${OPTION_LABELS[i]}</span>
        <span class="${textClass}">${escHtml(opt)}</span>
        ${icon}
      </div>`;
    }).join("");

    const explHTML = q.explanation && q.explanation !== "No explanation provided."
      ? `<details class="expl-details group mt-4 border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl overflow-hidden transition-all duration-200">
           <summary class="flex items-center justify-between p-3.5 text-xs font-bold text-indigo-900 dark:text-indigo-200 cursor-pointer select-none hover:bg-indigo-100/70 dark:hover:bg-indigo-900/50 transition">
             <span class="flex items-center gap-2">
               <svg class="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
               View Detailed Explanation
             </span>
             <svg class="w-4 h-4 text-indigo-500 transform group-open:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
           </summary>
           <div class="expl-body px-4 pb-4 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/40 bg-white/70 dark:bg-slate-900/70 text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
             ${escHtml(q.explanation)}
           </div>
         </details>`
      : "";

    const typeTag = selectedPaperType === "pyq" || q.questionType === "pyq" || q.isPYQ
      ? `<span class="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold uppercase tracking-wider">PYQ</span>`
      : `<span class="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider">Current Year</span>`;

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-2">
          <span class="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xs font-bold shadow-sm">${idx + 1}</span>
          ${typeTag}
        </div>
      </div>
      <p class="text-slate-800 dark:text-slate-100 font-medium text-base leading-relaxed mb-4">${escHtml(q.text)}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
        ${optionsHTML}
      </div>
      ${explHTML}`;

    questionsArea.appendChild(card);
  });

  // Smooth appearance animation
  requestAnimationFrame(() => {
    questionsArea.querySelectorAll(".study-card").forEach((card, i) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(16px)";
      setTimeout(() => {
        card.style.transition = "opacity 0.35s ease, transform 0.35s ease";
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      }, i * 50);
    });
  });
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Run Init ──────────────────────────────────────────────────
init();
