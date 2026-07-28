// ============================================================
//  QuizTEL — Study Mode (study.js)
// ============================================================

import { loadCourses, loadWeeks, loadQuestions, loadResources, populateSelect, showToast, showSpinner, hideSpinner } from "./app.js";
import { trackPageView } from "./analytics.js";

const courseSelect  = document.getElementById("course-select");
const weekSelect    = document.getElementById("week-select");
const questionsArea = document.getElementById("questions-area");
const qCount        = document.getElementById("q-count");
const emptyState    = document.getElementById("empty-state");
const resourcesArea = document.getElementById("resources-area");
const resourcesList = document.getElementById("resources-list");

const OPTION_LABELS = ["A", "B", "C", "D"];

// ── Init ──────────────────────────────────────────────────────
async function init() {
  trackPageView();
  showSpinner("Loading courses…");
  try {
    const courses = await loadCourses();
    populateSelect(courseSelect, courses, "— Select a Course —");
    if (courses.length === 0) {
      showToast("No courses found. Ask admin to add courses.", "info");
    }
  } catch (err) {
    showToast("Failed to load courses: " + err.message, "error");
  } finally {
    hideSpinner();
  }
}

// ── Course selection → load weeks ─────────────────────────────
courseSelect.addEventListener("change", async () => {
  const cid = courseSelect.value;
  weekSelect.innerHTML = `<option value="" disabled selected>Loading weeks…</option>`;
  weekSelect.disabled = true;
  questionsArea.innerHTML = "";
  if (qCount) qCount.textContent = "";
  if (emptyState) emptyState.classList.remove("hidden");
  if (resourcesArea) resourcesArea.classList.add("hidden");

  try {
    const weeks = await loadWeeks(cid);
    populateSelect(weekSelect, weeks, "— Select a Week —");
    weekSelect.disabled = false;
  } catch (err) {
    showToast("Failed to load weeks: " + err.message, "error");
  }
});

// ── Week selection → automatically fetch questions & resources ──
weekSelect.addEventListener("change", async () => {
  const cid = courseSelect.value;
  const wid = weekSelect.value;
  if (!cid || !wid) return;

  showSpinner("Fetching questions and attachments…");
  if (emptyState) emptyState.classList.add("hidden");
  questionsArea.innerHTML = "";
  if (qCount) qCount.textContent = "";
  if (resourcesArea) resourcesArea.classList.add("hidden");

  try {
    const questions = await loadQuestions(cid, wid);
    
    let resources = [];
    try {
      resources = await loadResources(cid, wid);
    } catch (e) {
      console.warn("Could not load resources:", e);
    }
    
    hideSpinner();

    // Render downloadable PDF resources if available
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

    if (questions.length === 0 && (!resources || resources.length === 0)) {
      if (emptyState) emptyState.classList.remove("hidden");
      showToast("No questions found for this week.", "info");
      return;
    }

    if (qCount) {
      qCount.textContent = `${questions.length} question${questions.length !== 1 ? "s" : ""}`;
    }

    renderQuestions(questions);
  } catch (err) {
    hideSpinner();
    showToast("Failed to load questions: " + err.message, "error");
  }
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
        ? "flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border-2 border-emerald-400"
        : "flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200";
      const labelClass = isCorrect
        ? "flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center"
        : "flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center";
      const icon = isCorrect ? `<svg class="ml-auto w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>` : "";

      return `<div class="${baseClass}">
        <span class="${labelClass}">${OPTION_LABELS[i]}</span>
        <span class="text-sm text-gray-700 flex-1">${escHtml(opt)}</span>
        ${icon}
      </div>`;
    }).join("");

    const explHTML = q.explanation && q.explanation !== "No explanation provided."
      ? `<div class="mt-4 p-4 bg-indigo-50 border-l-4 border-indigo-400 rounded-r-xl">
           <p class="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
             <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
             Explanation
           </p>
           <p class="text-sm text-indigo-800">${escHtml(q.explanation)}</p>
         </div>`
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
