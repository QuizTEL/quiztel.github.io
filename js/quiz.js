// ============================================================
//  QuizTEL — Quiz Engine (quiz.js)
//  Handles setup → quiz → results state machine
// ============================================================

import {
  loadCourses, loadWeeks, loadQuestions,
  populateSelect, showToast, showSpinner, hideSpinner, shuffleArray, initFeedbackModal, initTheme,
  subscribeToCourses, subscribeToWeeks
} from "./app.js";
import { trackPageView, incrementQuizAttempts, initPresence, trackQuizCompletion, trackShare } from "./analytics.js";

// ── DOM References ────────────────────────────────────────────
const setupPanel    = document.getElementById("setup-panel");
const quizPanel     = document.getElementById("quiz-panel");
const resultsPanel  = document.getElementById("results-panel");

const courseSelect  = document.getElementById("course-select");
const weekContainer = document.getElementById("week-container");
const allWeeksChk   = document.getElementById("all-weeks");
const modeRadios    = document.querySelectorAll("input[name='quiz-mode']");
const startBtn      = document.getElementById("start-btn");

const progressBar   = document.getElementById("progress-bar");
const qCounter      = document.getElementById("q-counter");
const questionText  = document.getElementById("question-text");
const optionsGrid   = document.getElementById("options-grid");
const prevBtn       = document.getElementById("prev-btn");
const nextBtn       = document.getElementById("next-btn");
const submitBtn     = document.getElementById("submit-btn");

const scoreRing     = document.getElementById("score-ring");
const scorePct      = document.getElementById("score-pct");
const scoreLabel    = document.getElementById("score-label");
const reviewArea    = document.getElementById("review-area");
const retryBtn      = document.getElementById("retry-btn");
const homeBtn       = document.getElementById("home-btn");
const shareScoreBtn = document.getElementById("share-score-btn");

const OPTION_LABELS = ["A", "B", "C", "D"];

// ── State ─────────────────────────────────────────────────────
let allWeeks            = [];
let builtQuiz           = [];   // [{text, options, correctOptionIndex, explanation}]
let userAnswers         = [];   // index of selected option per question, or null
let currentQIdx         = 0;
let courseId            = "";
let autoAdvanceTimeout  = null;

let unsubQuizCourses = null;
let unsubQuizWeeks   = null;

// ── Helper to match course ID or name ─────────────────────────
function findCourseMatch(courses, paramVal) {
  if (!paramVal) return null;
  const decoded = decodeURIComponent(paramVal).trim().toLowerCase();
  return courses.find(c => 
    c.id.toLowerCase() === decoded || 
    c.name.toLowerCase() === decoded ||
    encodeURIComponent(c.id).toLowerCase() === decoded
  );
}

// ── Course → live load weeks into checkboxes ──────────────────
function handleQuizCourseSelectionChange() {
  courseId = courseSelect.value;
  startBtn.disabled = true;
  if (allWeeksChk) allWeeksChk.checked = false;

  if (unsubQuizWeeks) { unsubQuizWeeks(); unsubQuizWeeks = null; }

  if (!courseId) {
    weekContainer.innerHTML = `<p class="text-sm text-slate-400 col-span-full text-center py-4">Select a course above to view available weeks.</p>`;
    return;
  }

  unsubQuizWeeks = subscribeToWeeks(courseId, (weeks) => {
    allWeeks = weeks;
    if (weeks.length === 0) {
      weekContainer.innerHTML = `<p class="text-sm text-slate-400 col-span-full text-center py-4">No weeks found for this course.</p>`;
      validateStart();
      return;
    }

    renderWeekPills(weeks);
  });
}

courseSelect.addEventListener("change", handleQuizCourseSelectionChange);

// ── Init ──────────────────────────────────────────────────────
function init() {
  initTheme();
  trackPageView();
  initPresence();
  initFeedbackModal();

  const urlParams = new URLSearchParams(window.location.search);
  const targetCourseParam = urlParams.get("course") || urlParams.get("name");

  unsubQuizCourses = subscribeToCourses((courses) => {
    populateSelect(courseSelect, courses, "— Choose a Course —");

    const matchedCourse = findCourseMatch(courses, targetCourseParam);
    if (matchedCourse) {
      courseSelect.value = matchedCourse.id;
      handleQuizCourseSelectionChange();
    } else if (courseSelect.value) {
      handleQuizCourseSelectionChange();
    }
  });
}

  if (!courseId) {
    weekContainer.innerHTML = `<p class="text-sm text-slate-400 col-span-full text-center py-4">Select a course above to view available weeks.</p>`;
    return;
  }

  unsubQuizWeeks = subscribeToWeeks(courseId, (weeks) => {
    allWeeks = weeks;
    if (weeks.length === 0) {
      weekContainer.innerHTML = `<p class="text-sm text-slate-400 col-span-full text-center py-4">No weeks found for this course.</p>`;
      validateStart();
      return;
    }

    renderWeekPills(weeks);
  });
});

function renderWeekPills(weeks) {
  weekContainer.innerHTML = weeks.map(w => `
    <label class="week-pill-card relative flex items-center justify-between p-3.5 rounded-2xl border-2 border-slate-200 bg-white cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 group select-none">
      <input type="checkbox" name="week" value="${w.id}" class="week-chk sr-only">
      <span class="week-title text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition">${escHtml(w.name)}</span>
      <span class="week-badge w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-white font-bold transition">✓</span>
    </label>
  `).join("");

  weekContainer.querySelectorAll("input[type='checkbox']").forEach(cb => {
    cb.addEventListener("change", () => {
      updateWeekPillStyles();
      validateStart();
    });
  });

  updateWeekPillStyles();
  validateStart();
}

function updateWeekPillStyles() {
  weekContainer.querySelectorAll(".week-pill-card").forEach(card => {
    const chk = card.querySelector("input[type='checkbox']");
    const badge = card.querySelector(".week-badge");
    const title = card.querySelector(".week-title");

    if (chk.checked) {
      card.className = "week-pill-card relative flex items-center justify-between p-3.5 rounded-2xl border-2 border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/20 shadow-md cursor-pointer transition-all duration-200 group select-none";
      if (title) title.className = "week-title text-xs font-extrabold text-indigo-900 transition";
      if (badge) badge.className = "week-badge w-5 h-5 rounded-full bg-indigo-600 border-2 border-indigo-600 flex items-center justify-center text-[10px] text-white font-bold transition scale-110";
    } else {
      card.className = "week-pill-card relative flex items-center justify-between p-3.5 rounded-2xl border-2 border-slate-200 bg-white cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 group select-none";
      if (title) title.className = "week-title text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition";
      if (badge) badge.className = "week-badge w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-white font-bold transition";
    }
  });
}

// "Select All Weeks" button handler
const toggleAllBtn = document.getElementById("toggle-all-weeks-btn");
if (toggleAllBtn) {
  toggleAllBtn.addEventListener("click", () => {
    const chks = [...weekContainer.querySelectorAll("input[type='checkbox']")];
    if (!chks.length) return;
    const allChecked = chks.every(cb => cb.checked);
    chks.forEach(cb => { cb.checked = !allChecked; });
    updateWeekPillStyles();
    validateStart();
  });
}

// ── Randomization Mode Pill Styles & Event Listeners ──────────
function updateModePillStyles() {
  document.querySelectorAll(".mode-pill-card").forEach(card => {
    const radio = card.querySelector("input[type='radio']");
    const badge = card.querySelector(".mode-badge");

    if (radio.checked) {
      card.className = "mode-pill-card relative flex items-start gap-3.5 p-4 rounded-2xl border-2 border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/20 shadow-md cursor-pointer transition-all duration-200 group select-none";
      if (badge) badge.className = "mode-badge w-5 h-5 rounded-full bg-indigo-600 border-2 border-indigo-600 flex items-center justify-center text-[10px] text-white font-bold transition mt-0.5 flex-shrink-0 scale-110";
    } else {
      card.className = "mode-pill-card relative flex items-start gap-3.5 p-4 rounded-2xl border-2 border-slate-200 bg-white cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group select-none";
      if (badge) badge.className = "mode-badge w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-white font-bold transition mt-0.5 flex-shrink-0";
    }
  });
}

document.querySelectorAll(".mode-pill-card input[type='radio']").forEach(radio => {
  radio.addEventListener("change", updateModePillStyles);
});
updateModePillStyles();

function validateStart() {
  const anyWeekChecked = [...weekContainer.querySelectorAll("input[type='checkbox']")].some(cb => cb.checked);
  startBtn.disabled = !anyWeekChecked;
}

// ── Get selected mode ─────────────────────────────────────────
function getMode() {
  for (const r of modeRadios) if (r.checked) return r.value;
  return "normal";
}

// ── Start Quiz ────────────────────────────────────────────────
startBtn.addEventListener("click", async () => {
  const selectedWeekIds = [...weekContainer.querySelectorAll("input[type=checkbox]:checked")].map(cb => cb.value);
  if (!selectedWeekIds.length) return;
  const mode = getMode();

  showSpinner("Building quiz…");

  try {
    let rawQuestions = [];
    for (const wid of selectedWeekIds) {
      const qs = await loadQuestions(courseId, wid);
      rawQuestions.push(...qs);
    }

    if (!rawQuestions.length) {
      hideSpinner();
      showToast("No questions found for the selected week(s).", "info");
      return;
    }

    builtQuiz   = buildQuiz(rawQuestions, mode);
    userAnswers = new Array(builtQuiz.length).fill(null);
    currentQIdx = 0;

    hideSpinner();
    showPanel("quiz");
    renderQuestion();
    await incrementQuizAttempts();
  } catch (e) {
    hideSpinner();
    showToast("Error building quiz: " + e.message, "error");
  }
});

// ── Build quiz with shuffle modes ─────────────────────────────
function buildQuiz(questions, mode) {
  let qs = [...questions];

  // Shuffle question order if needed
  if (mode === "mixed-questions" || mode === "mixed-both") {
    qs = shuffleArray(qs);
  }

  return qs.map(q => {
    let options = [...q.options];
    let correctIndex = q.correctOptionIndex;

    // Shuffle option order if needed
    if (mode === "mixed-options" || mode === "mixed-both") {
      // Create indexed options, shuffle, track new correct position
      const indexed = options.map((opt, i) => ({ opt, isCorrect: i === correctIndex }));
      const shuffled = shuffleArray(indexed);
      options      = shuffled.map(x => x.opt);
      correctIndex = shuffled.findIndex(x => x.isCorrect);
    }

    return {
      text:               q.text,
      options,
      correctOptionIndex: correctIndex,
      explanation:        q.explanation || ""
    };
  });
}

// ── Render current question ───────────────────────────────────
function renderQuestion() {
  if (autoAdvanceTimeout) {
    clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = null;
  }

  const q       = builtQuiz[currentQIdx];
  const total   = builtQuiz.length;
  const userAns = userAnswers[currentQIdx];
  const isAnswered = userAns !== null && userAns !== undefined;

  // Progress Bar & Question Counter
  const pct = ((currentQIdx + 1) / total) * 100;
  if (progressBar) progressBar.style.width = pct + "%";
  if (qCounter)    qCounter.textContent = `Question ${currentQIdx + 1} of ${total}`;

  // Question Text
  if (questionText) questionText.textContent = q.text;

  // Options Grid
  if (optionsGrid) {
    optionsGrid.innerHTML = q.options.map((opt, i) => {
      let btnCls   = "option-btn w-full flex items-center justify-between gap-3 text-left p-4 rounded-2xl border-2 transition-all duration-200 font-medium text-sm select-none ";
      let badgeCls = "flex-shrink-0 w-7 h-7 rounded-xl text-xs font-bold flex items-center justify-center transition ";
      let statusIcon = "";

      if (isAnswered) {
        // Question has been answered -> apply GREEN/RED visual feedback
        if (i === q.correctOptionIndex) {
          // Actual Correct Answer -> GREEN
          btnCls += "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200 scale-[1.01]";
          badgeCls += "bg-white/20 text-white";
          statusIcon = `<span class="text-xs font-extrabold px-2 py-0.5 bg-white/20 rounded-lg">✓ Correct</span>`;
        } else if (i === userAns) {
          // Selected Wrong Answer -> RED
          btnCls += "bg-red-600 border-red-600 text-white shadow-lg shadow-red-200 scale-[1.01]";
          badgeCls += "bg-white/20 text-white";
          statusIcon = `<span class="text-xs font-extrabold px-2 py-0.5 bg-white/20 rounded-lg">✗ Wrong</span>`;
        } else {
          // Other unselected options -> Muted
          btnCls += "bg-slate-50/60 border-slate-200 text-slate-400 opacity-60";
          badgeCls += "bg-slate-200 text-slate-500";
        }
      } else {
        // Not yet answered -> Standard unselected interactive state
        btnCls += "bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50 hover:shadow-sm";
        badgeCls += "bg-slate-100 text-slate-500";
      }

      return `
        <button
          data-idx="${i}"
          ${isAnswered ? "disabled" : ""}
          class="${btnCls}"
        >
          <div class="flex items-center gap-3">
            <span class="${badgeCls}">
              ${OPTION_LABELS[i]}
            </span>
            <span class="font-medium">${escHtml(opt)}</span>
          </div>
          ${statusIcon}
        </button>`;
    }).join("");

    if (!isAnswered) {
      optionsGrid.querySelectorAll(".option-btn").forEach(btn => {
        btn.addEventListener("click", () => selectOption(parseInt(btn.dataset.idx)));
      });
    }
  }

  // Navigation Buttons
  if (prevBtn) prevBtn.disabled = currentQIdx === 0;
  if (nextBtn) {
    nextBtn.classList.toggle("hidden", currentQIdx === total - 1);
  }
  if (submitBtn) {
    const answered = userAnswers.filter(a => a !== null).length;
    submitBtn.textContent = currentQIdx === total - 1 ? `Finish Quiz (${answered}/${total} answered)` : `Submit Quiz (${answered}/${total} answered)`;
  }
}

// ── Select Option with Instant Feedback & Auto-Next ──────────
function selectOption(idx) {
  if (userAnswers[currentQIdx] !== null) return; // Prevent double selections

  userAnswers[currentQIdx] = idx;
  renderQuestion();

  // Automatic Next Question after 600ms visual feedback
  autoAdvanceTimeout = setTimeout(() => {
    if (currentQIdx < builtQuiz.length - 1) {
      currentQIdx++;
      renderQuestion();
    } else {
      showResults();
    }
  }, 600);
}

// ── Navigation Buttons ────────────────────────────────────────
if (prevBtn) {
  prevBtn.addEventListener("click", () => {
    if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);
    if (currentQIdx > 0) {
      currentQIdx--;
      renderQuestion();
    }
  });
}

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);
    if (currentQIdx < builtQuiz.length - 1) {
      currentQIdx++;
      renderQuestion();
    }
  });
}

// ── Submit Quiz ───────────────────────────────────────────────
if (submitBtn) {
  submitBtn.addEventListener("click", () => {
    if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);
    const answered = userAnswers.filter(a => a !== null).length;
    const unanswered = builtQuiz.length - answered;

    if (unanswered > 0) {
      const ok = confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`);
      if (!ok) return;
    }
    showResults();
  });
}

// ── Results ───────────────────────────────────────────────────
function showResults() {
  if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);

  let correct = 0;
  builtQuiz.forEach((q, i) => {
    if (userAnswers[i] === q.correctOptionIndex) correct++;
  });

  const pct = Math.round((correct / builtQuiz.length) * 100);

  // Track quiz completion analytics
  trackQuizCompletion({
    scorePct: pct,
    scoreCount: 1,
    totalQuestions: builtQuiz.length,
    courseId
  });

  if (scorePct)   scorePct.textContent   = `${pct}%`;
  if (scoreLabel) scoreLabel.textContent = `${correct} / ${builtQuiz.length} correct`;

  // Score ring color
  if (scoreRing) {
    const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
    const circumference = 2 * Math.PI * 45;
    const offset = circumference * (1 - pct / 100);
    scoreRing.innerHTML = `
      <svg viewBox="0 0 100 100" class="w-36 h-36 -rotate-90">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" stroke-width="8"/>
        <circle cx="50" cy="50" r="45" fill="none" stroke="${color}" stroke-width="8"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
          style="transition: stroke-dashoffset 1s ease; stroke-linecap: round;"/>
      </svg>`;
  }

  // Review cards
  if (reviewArea) {
    reviewArea.innerHTML = builtQuiz.map((q, i) => {
      const ua = userAnswers[i];
      const isCorrect = ua === q.correctOptionIndex;
      const skipped   = ua === null;

      const optionsHTML = q.options.map((opt, oi) => {
        let cls = "flex items-start gap-2 p-2.5 rounded-xl text-sm border ";
        if (oi === q.correctOptionIndex) {
          cls += "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold";
        } else if (oi === ua && !isCorrect) {
          cls += "bg-red-50 border-red-300 text-red-800 font-bold";
        } else {
          cls += "bg-gray-50 border-gray-200 text-gray-600";
        }

        let icon = "";
        if (oi === q.correctOptionIndex) icon = `<svg class="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`;
        if (oi === ua && !isCorrect) icon = `<svg class="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;

        return `<div class="${cls}">${icon}<span class="font-bold mr-1">${OPTION_LABELS[oi]})</span>${escHtml(opt)}</div>`;
      }).join("");

      const statusBadge = isCorrect
        ? `<span class="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">✓ Correct</span>`
        : skipped
        ? `<span class="px-2.5 py-0.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-full">— Skipped</span>`
        : `<span class="px-2.5 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">✗ Incorrect</span>`;

      const explHTML = q.explanation && q.explanation !== "No explanation provided."
        ? `<details class="expl-details group mt-3 border border-indigo-200/80 bg-indigo-50/70 rounded-xl overflow-hidden transition-all duration-200">
             <summary class="flex items-center justify-between p-3 text-xs font-bold text-indigo-900 cursor-pointer select-none hover:bg-indigo-100/70 transition">
               <span class="flex items-center gap-1.5">
                 <svg class="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
                 View Detailed Explanation
               </span>
               <svg class="w-3.5 h-3.5 text-indigo-500 transform group-open:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
             </summary>
             <div class="expl-body px-3.5 pb-3.5 pt-2 border-t border-indigo-200/60 bg-white/70 text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
               ${escHtml(q.explanation)}
             </div>
           </details>`
        : "";

      return `
        <div class="bg-white rounded-2xl shadow-sm border ${isCorrect ? "border-emerald-200" : skipped ? "border-gray-200" : "border-red-200"} p-5 mb-4">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-start gap-2">
              <span class="flex-shrink-0 w-7 h-7 ${isCorrect ? "bg-emerald-500" : skipped ? "bg-gray-300" : "bg-red-400"} text-white rounded-full text-xs font-bold flex items-center justify-center">${i + 1}</span>
              <p class="text-gray-800 font-medium text-sm leading-relaxed">${escHtml(q.text)}</p>
            </div>
            ${statusBadge}
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${optionsHTML}
          </div>
          ${explHTML}
        </div>`;
    }).join("");
  }

  showPanel("results");
}

// ── Share Score Button ─────────────────────────────────────────
if (shareScoreBtn) {
  shareScoreBtn.addEventListener("click", async () => {
    const text = `I just scored ${scorePct?.textContent || "great"} on QuizTEL NPTEL Quiz! Check out your NPTEL course prep here:`;
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title: "QuizTEL Score", text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        showToast("Score link copied to clipboard!", "success");
      }
      trackShare("quiz_score");
    } catch (e) {
      console.warn("Share cancelled or failed:", e);
    }
  });
}

// ── Retry / Home ──────────────────────────────────────────────
if (retryBtn) retryBtn.addEventListener("click", () => showPanel("setup"));
if (homeBtn)  homeBtn.addEventListener("click",  () => window.location.href = "index.html");

// ── Panel switcher ────────────────────────────────────────────
function showPanel(name) {
  setupPanel?.classList.toggle("hidden",   name !== "setup");
  quizPanel?.classList.toggle("hidden",    name !== "quiz");
  resultsPanel?.classList.toggle("hidden", name !== "results");
  window.scrollTo({ top: 0, behavior: "smooth" });
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
