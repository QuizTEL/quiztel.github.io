import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { 
  loadCourses, loadWeeks, loadQuestions, loadResources, populateSelect, showToast, showSpinner, hideSpinner, fmt, initTheme,
  subscribeToCourses, subscribeToWeeks, subscribeToQuestions, subscribeToResources
} from "./app.js";
import { 
  subscribeToAnalytics, 
  subscribeToLivePresence, 
  subscribeToFeedbacks, 
  trackPageView, 
  fetchDailyAnalytics, 
  generateCSVReport, 
  deleteFeedback, 
  toggleFeedbackStatus,
  subscribeToSuggestedQuestions,
  updateSuggestedQuestionStatus,
  deleteSuggestedQuestion
} from "./analytics.js";
import { parseQuestionsFromText } from "./file-parser.js";

// ── DOM Elements ──────────────────────────────────────────────
const authSection     = document.getElementById("auth-section");
const adminSection    = document.getElementById("admin-section");
const loginForm       = document.getElementById("login-form");
const loginEmail      = document.getElementById("login-email");
const loginPass       = document.getElementById("login-pass");
const logoutBtn       = document.getElementById("logout-btn");
const adminUserEmail  = document.getElementById("admin-user-email");

// Tabs
const tabBtns         = document.querySelectorAll("[data-tab]");
const tabContents     = document.querySelectorAll("[data-tab-content]");

// Analytics DOM
const statViews          = document.getElementById("stat-views");
const statVisitors       = document.getElementById("stat-visitors");
const statAttempts       = document.getElementById("stat-attempts");
const statAttendees      = document.getElementById("stat-attendees");
const statAvgScore       = document.getElementById("stat-avg-score");
const statShares         = document.getElementById("stat-shares");
const statLiveUsers      = document.getElementById("stat-live-users");
const cardLiveUsers      = document.getElementById("card-live-users");
const statPeakHourBadge  = document.getElementById("stat-peak-hour-badge");
const peakHourHighlight  = document.getElementById("peak-hour-highlight");
const generateReportBtn  = document.getElementById("generate-report-btn");

// Feedback DOM
const fbTotalCount       = document.getElementById("fb-total-count");
const fbAvgRating        = document.getElementById("fb-avg-rating");
const fbBugCount         = document.getElementById("fb-bug-count");
const fbSuggestionCount  = document.getElementById("fb-suggestion-count");
const fbBadgeCount       = document.getElementById("feedback-badge-count");
const fbTableBody        = document.getElementById("feedbacks-table-body");
const fbFilterPills      = document.getElementById("fb-filter-pills");

// Suggested Questions (Submissions) DOM
const subTotalCount      = document.getElementById("sub-total-count");
const subPendingCount    = document.getElementById("sub-pending-count");
const subApprovedCount   = document.getElementById("sub-approved-count");
const subQuestionsCount  = document.getElementById("sub-questions-count");
const subBadgeCount      = document.getElementById("submissions-badge-count");
const subFilterPills     = document.getElementById("sub-filter-pills");
const subListContainer   = document.getElementById("submissions-list");

// CMS — Courses & Weeks
const courseSelect    = document.getElementById("cms-course-select");
const weekSelect      = document.getElementById("cms-week-select");
const addCourseForm   = document.getElementById("add-course-form");
const newCourseName   = document.getElementById("new-course-name");
const deleteCourseBtn = document.getElementById("delete-course-btn");

const addWeekForm     = document.getElementById("add-week-form");
const newWeekName     = document.getElementById("new-week-name");
const deleteWeekBtn   = document.getElementById("delete-week-btn");

// CMS — Questions & Resources
const questionForm    = document.getElementById("question-form");
const qIdInput        = document.getElementById("q-id");
const qTextInput      = document.getElementById("q-text");
const opt0Input       = document.getElementById("opt-0");
const opt1Input       = document.getElementById("opt-1");
const opt2Input       = document.getElementById("opt-2");
const opt3Input       = document.getElementById("opt-3");
const correctOptSelect = document.getElementById("correct-opt");
const qExplInput      = document.getElementById("q-explanation");
const cancelEditBtn   = document.getElementById("cancel-edit-btn");

const questionsTableBody = document.getElementById("questions-table-body");
const qListCount         = document.getElementById("q-list-count");

// PDF Resources DOM
const addResourceForm    = document.getElementById("add-resource-form");
const resTitleInput      = document.getElementById("res-title");
const resUrlInput        = document.getElementById("res-url");
const resourcesTableBody = document.getElementById("resources-table-body");
const resListCount       = document.getElementById("res-list-count");

// Bulk Import DOM
const importCourseSelect = document.getElementById("import-course-select");
const importWeekSelect   = document.getElementById("import-week-select");
const importTextInput    = document.getElementById("import-text-input");
const parseBtn           = document.getElementById("parse-btn");
const importPreviewArea  = document.getElementById("import-preview-area");
const previewTableBody   = document.getElementById("preview-table-body");
const previewCount       = document.getElementById("preview-count");
const saveBatchBtn       = document.getElementById("save-batch-btn");

// ── State ─────────────────────────────────────────────────────
let parsedQuestionsToSave = [];
let unsubscribeAnalytics  = null;
let unsubscribePresence   = null;
let unsubscribeFeedbacks  = null;
let unsubscribeSubmissions = null;

let rawFeedbackList       = [];
let currentFeedbackFilter = "all";

let rawSubmissionsList    = [];
let currentSubFilter      = "all";
let cachedCoursesList     = [];

let viewsChart = null;
let visitorsChart = null;
let peakHoursChart = null;

// ── Init ──────────────────────────────────────────────────────
function init() {
  initTheme();
  trackPageView();

  // Auth state observer
  onAuthStateChanged(auth, (user) => {
    if (user) {
      authSection.classList.add("hidden");
      adminSection.classList.remove("hidden");
      if (adminUserEmail) adminUserEmail.textContent = user.email;

      // Init CMS & Real-time Subscriptions
      initCMS();

      if (!unsubscribeAnalytics) {
        unsubscribeAnalytics = subscribeToAnalytics(updateAnalyticsUI);
      }
      if (!unsubscribePresence) {
        unsubscribePresence = subscribeToLivePresence(updatePresenceUI);
      }
      if (!unsubscribeFeedbacks) {
        unsubscribeFeedbacks = subscribeToFeedbacks(updateFeedbacksUI);
      }
      if (!unsubscribeSubmissions) {
        unsubscribeSubmissions = subscribeToSuggestedQuestions(updateSubmissionsUI);
      }
    } else {
      authSection.classList.remove("hidden");
      adminSection.classList.add("hidden");
      if (unsubscribeAnalytics)   { unsubscribeAnalytics(); unsubscribeAnalytics = null; }
      if (unsubscribePresence)    { unsubscribePresence();  unsubscribePresence = null; }
      if (unsubscribeFeedbacks)   { unsubscribeFeedbacks(); unsubscribeFeedbacks = null; }
      if (unsubscribeSubmissions) { unsubscribeSubmissions(); unsubscribeSubmissions = null; }
    }
  });
}

// ── Auth Handlers ─────────────────────────────────────────────
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmail ? loginEmail.value.trim() : "";
    const pass  = loginPass ? loginPass.value.trim() : "";
    if (!email || !pass) return;

    showSpinner("Authenticating...");
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      showToast("Successfully logged in as Admin!", "success");
      loginForm.reset();
    } catch (err) {
      console.error("Firebase Login Error:", err);
      showToast("Login failed: " + err.message, "error");
    } finally {
      hideSpinner();
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      showToast("Logged out.", "info");
    } catch (err) {
      showToast("Logout error: " + err.message, "error");
    }
  });
}

// ── Tab Switching ─────────────────────────────────────────────
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabBtns.forEach(b => {
      if (b === btn) {
        b.classList.add("border-indigo-600", "text-indigo-600", "font-bold");
        b.classList.remove("border-transparent", "text-slate-500");
      } else {
        b.classList.remove("border-indigo-600", "text-indigo-600", "font-bold");
        b.classList.add("border-transparent", "text-slate-500");
      }
    });

    tabContents.forEach(content => {
      content.classList.toggle("hidden", content.dataset.tabContent !== target);
    });

    if (target === "analytics") {
      setTimeout(() => {
        renderCharts();
      }, 60);
    }
  });
});

// ── Live Presence UI Handler ──────────────────────────────────
function updatePresenceUI({ activeCount, activePages }) {
  if (statLiveUsers) statLiveUsers.textContent = fmt(activeCount);
  if (cardLiveUsers) cardLiveUsers.textContent = fmt(activeCount);
}

// ── Analytics UI & Stock Market Charts Handler ────────────────
async function renderCharts() {
  if (typeof Chart === "undefined") {
    console.warn("Chart.js not yet available in window");
    return;
  }

  const data = await fetchDailyAnalytics(30);
  if (!data || !data.length) return;
  
  const labels   = data.map(d => d.date ? d.date.slice(5) : "");
  const views    = data.map(d => Number(d.pageViews || 0));
  const visitors = data.map(d => Number(d.uniqueVisitors || 0));
  const attempts = data.map(d => Number(d.quizAttempts || 0));

  // 1. Stock Market Style Real-Time Line Area Chart
  const viewsCanvas = document.getElementById('viewsChart');
  if (viewsCanvas) {
    const viewsCtx = viewsCanvas.getContext('2d');
    if (viewsCtx) {
      if (viewsChart) {
        viewsChart.destroy();
        viewsChart = null;
      }
      
      const gradient = viewsCtx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

      viewsChart = new Chart(viewsCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Page Views Stream',
            data: views,
            borderColor: '#10b981',
            borderWidth: 3,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#ffffff',
            pointRadius: 3,
            pointHoverRadius: 6,
            backgroundColor: gradient,
            fill: true,
            tension: 0.35
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a',
              titleColor: '#38bdf8',
              bodyColor: '#f8fafc',
              borderColor: '#334155',
              borderWidth: 1
            }
          },
          scales: {
            x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
            y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' }, beginAtZero: true }
          }
        }
      });
    }
  }

  // 2. Peak Hours 24-Hour Distribution Chart
  const hourlyTotals = Array(24).fill(0);
  data.forEach(d => {
    if (d.hourlyViews) {
      Object.entries(d.hourlyViews).forEach(([hKey, count]) => {
        const hNum = parseInt(hKey.replace("H", ""));
        if (!isNaN(hNum) && hNum >= 0 && hNum < 24) {
          hourlyTotals[hNum] += count;
        }
      });
    }
  });

  let maxHourIdx = 0;
  let maxCount = 0;
  hourlyTotals.forEach((count, idx) => {
    if (count > maxCount) {
      maxCount = count;
      maxHourIdx = idx;
    }
  });

  const peakHourStr = maxCount > 0 ? `${String(maxHourIdx).padStart(2, '0')}:00` : "--:00";
  if (statPeakHourBadge) statPeakHourBadge.textContent = peakHourStr;
  if (peakHourHighlight) {
    peakHourHighlight.textContent = maxCount > 0 
      ? `Peak: ${peakHourStr} (${fmt(maxCount)} views)` 
      : `Peak: Awaiting traffic data`;
  }

  const peakCanvas = document.getElementById('peakHoursChart');
  if (peakCanvas) {
    const peakCtx = peakCanvas.getContext('2d');
    if (peakCtx) {
      if (peakHoursChart) {
        peakHoursChart.destroy();
        peakHoursChart = null;
      }
      
      const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
      const bgColors = hourlyTotals.map((c, i) => (i === maxHourIdx && maxCount > 0) ? '#f59e0b' : '#6366f1');

      peakHoursChart = new Chart(peakCtx, {
        type: 'bar',
        data: {
          labels: hourLabels,
          datasets: [{
            label: 'Hourly Views',
            data: hourlyTotals,
            backgroundColor: bgColors,
            borderRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { font: { size: 9 }, maxRotation: 45 } },
            y: { beginAtZero: true }
          }
        }
      });
    }
  }

  // 3. Unique Visitors vs Quiz Attempts Bar Chart
  const visitorsCanvas = document.getElementById('visitorsChart');
  if (visitorsCanvas) {
    const visitorsCtx = visitorsCanvas.getContext('2d');
    if (visitorsCtx) {
      if (visitorsChart) {
        visitorsChart.destroy();
        visitorsChart = null;
      }
      visitorsChart = new Chart(visitorsCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Unique Visitors', data: visitors, backgroundColor: '#d97706', borderRadius: 5 },
            { label: 'Quiz Attempts', data: attempts, backgroundColor: '#059669', borderRadius: 5 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { font: { size: 10 } } },
            y: { beginAtZero: true }
          }
        }
      });
    }
  }
}

function updateAnalyticsUI(data) {
  if (statViews)     statViews.textContent     = fmt(data.pageViews || 0);
  if (statVisitors)  statVisitors.textContent  = fmt(data.uniqueVisitors || 0);
  if (statAttempts)  statAttempts.textContent  = fmt(data.quizAttempts || 0);
  if (statAttendees) statAttendees.textContent = fmt(data.quizAttendees || data.uniqueVisitors || 0);
  if (statShares)    statShares.textContent    = fmt(data.totalShares || 0);

  const avgPct = data.totalScoreCount ? (data.totalScoreSum / data.totalScoreCount).toFixed(1) : "0";
  if (statAvgScore)  statAvgScore.textContent  = `${avgPct}%`;

  renderCharts();
}

// ── User Feedbacks Management UI ──────────────────────────────
function updateFeedbacksUI(list) {
  rawFeedbackList = list || [];

  const total = rawFeedbackList.length;
  if (fbTotalCount) fbTotalCount.textContent = fmt(total);

  if (fbBadgeCount) {
    if (total > 0) {
      fbBadgeCount.textContent = total;
      fbBadgeCount.classList.remove("hidden");
    } else {
      fbBadgeCount.classList.add("hidden");
    }
  }

  // Avg Star Rating
  const avg = total > 0 ? (rawFeedbackList.reduce((acc, item) => acc + (Number(item.rating) || 5), 0) / total).toFixed(1) : "5.0";
  if (fbAvgRating) fbAvgRating.textContent = `${avg} ★`;

  // Bug & Suggestion Counts
  const bugs = rawFeedbackList.filter(item => item.category === "Quiz Bug / Error").length;
  const suggestions = rawFeedbackList.filter(item => item.category === "General Suggestion" || item.category === "Feature Request").length;
  if (fbBugCount) fbBugCount.textContent = fmt(bugs);
  if (fbSuggestionCount) fbSuggestionCount.textContent = fmt(suggestions);

  renderFeedbacksTable();
}

function renderFeedbacksTable() {
  if (!fbTableBody) return;

  const filtered = currentFeedbackFilter === "all"
    ? rawFeedbackList
    : rawFeedbackList.filter(item => item.category === currentFeedbackFilter);

  if (filtered.length === 0) {
    fbTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400 text-sm">No user feedbacks found for this filter.</td></tr>`;
    return;
  }

  const categoryBadgeMap = {
    "General Suggestion": "bg-indigo-100 text-indigo-800",
    "Quiz Bug / Error": "bg-red-100 text-red-800",
    "Content Correction": "bg-amber-100 text-amber-800",
    "Feature Request": "bg-purple-100 text-purple-800"
  };

  fbTableBody.innerHTML = filtered.map(f => {
    const stars = "★".repeat(f.rating || 5) + "☆".repeat(5 - (f.rating || 5));
    const badgeCls = categoryBadgeMap[f.category] || "bg-slate-100 text-slate-800";
    const statusTag = f.reviewed 
      ? `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">✓ Reviewed</span>`
      : `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">New</span>`;

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition text-xs ${f.reviewed ? 'opacity-75' : ''}">
        <td class="py-3.5 px-4 font-bold text-slate-900">
          ${escHtml(f.name || 'NPTEL Learner')}
          <span class="block text-[10px] font-medium text-slate-400">${escHtml(f.email || '')}</span>
        </td>
        <td class="py-3.5 px-4 text-amber-500 font-bold tracking-wider">${stars}</td>
        <td class="py-3.5 px-4">
          <span class="px-2.5 py-1 rounded-lg text-[11px] font-bold ${badgeCls}">${escHtml(f.category || 'General')}</span>
        </td>
        <td class="py-3.5 px-4 text-slate-700 font-medium max-w-xs leading-relaxed">
          ${escHtml(f.message)}
        </td>
        <td class="py-3.5 px-4 text-indigo-600 font-bold font-mono">
          ${escHtml(f.page || 'index.html')}
        </td>
        <td class="py-3.5 px-4 text-slate-400 text-[11px]">
          ${f.createdDateStr || 'Recently'}
        </td>
        <td class="py-3.5 px-4 text-right space-x-1.5">
          <button data-action="toggle-fb-status" data-id="${f.id}" data-status="${!f.reviewed}" class="px-2.5 py-1 ${f.reviewed ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-600'} hover:opacity-80 font-bold rounded-lg transition">
            ${f.reviewed ? 'Unmark' : '✓ Mark Reviewed'}
          </button>
          <button data-action="delete-fb" data-id="${f.id}" class="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-lg transition">
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Attach button event listeners with Instant Optimistic UI Update & Live Sync
  fbTableBody.querySelectorAll("button[data-action='toggle-fb-status']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const status = btn.dataset.status === "true";

      const targetItem = rawFeedbackList.find(item => item.id === id);
      if (targetItem) {
        targetItem.reviewed = status;
      }
      updateFeedbacksUI(rawFeedbackList);

      try {
        await toggleFeedbackStatus(id, status);
        showToast("Feedback status updated!", "info");
      } catch (err) {
        console.error("Failed to update feedback status:", err);
      }
    });
  });

  fbTableBody.querySelectorAll("button[data-action='delete-fb']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (confirm("Are you sure you want to delete this user feedback entry?")) {
        rawFeedbackList = rawFeedbackList.filter(item => item.id !== id);
        updateFeedbacksUI(rawFeedbackList);

        try {
          await deleteFeedback(id);
          showToast("Feedback deleted.", "info");
        } catch (err) {
          console.error("Failed to delete feedback:", err);
        }
      }
    });
  });
}

// Category filter pills click handler
if (fbFilterPills) {
  fbFilterPills.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      currentFeedbackFilter = btn.dataset.filter;
      fbFilterPills.querySelectorAll("button").forEach(b => {
        if (b === btn) {
          b.classList.add("bg-indigo-600", "text-white");
          b.classList.remove("bg-slate-100", "text-slate-700");
        } else {
          b.classList.remove("bg-indigo-600", "text-white");
          b.classList.add("bg-slate-100", "text-slate-700");
        }
      });
      renderFeedbacksTable();
    });
  });
}

// ── User Suggested Questions (Submissions) UI ─────────────────
function updateSubmissionsUI(list) {
  rawSubmissionsList = list || [];

  const total = rawSubmissionsList.length;
  const pending = rawSubmissionsList.filter(s => s.status === "pending").length;
  const approved = rawSubmissionsList.filter(s => s.status === "approved").length;
  const totalQuestions = rawSubmissionsList.reduce((acc, s) => acc + (s.questionCount || (s.questions ? s.questions.length : 0)), 0);

  if (subTotalCount)     subTotalCount.textContent     = fmt(total);
  if (subPendingCount)   subPendingCount.textContent   = fmt(pending);
  if (subApprovedCount)  subApprovedCount.textContent  = fmt(approved);
  if (subQuestionsCount) subQuestionsCount.textContent = fmt(totalQuestions);

  if (subBadgeCount) {
    if (pending > 0) {
      subBadgeCount.textContent = pending;
      subBadgeCount.classList.remove("hidden");
    } else {
      subBadgeCount.classList.add("hidden");
    }
  }

  renderSubmissionsList();
}

function renderSubmissionsList() {
  if (!subListContainer) return;

  const filtered = currentSubFilter === "all"
    ? rawSubmissionsList
    : rawSubmissionsList.filter(s => s.status === currentSubFilter);

  if (!filtered.length) {
    subListContainer.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 mx-auto flex items-center justify-center text-xl font-bold mb-3">
          📥
        </div>
        <p class="text-slate-700 font-bold text-sm">No suggested question submissions found</p>
        <p class="text-xs text-slate-400 mt-1">Learners can suggest new questions from the Feedback button on any study page.</p>
      </div>`;
    return;
  }

  const statusBadgeMap = {
    "pending": `<span class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold flex items-center gap-1"><span>⏳</span> Pending Review</span>`,
    "approved": `<span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold flex items-center gap-1"><span>✓</span> Approved & Added</span>`,
    "rejected": `<span class="px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-[11px] font-extrabold flex items-center gap-1"><span>✕</span> Rejected</span>`
  };

  subListContainer.innerHTML = filtered.map(sub => {
    const qCount = sub.questions ? sub.questions.length : (sub.questionCount || 0);
    const badge = statusBadgeMap[sub.status] || statusBadgeMap["pending"];

    const questionsHtml = (sub.questions || []).map((q, idx) => {
      const optsHtml = (q.options || []).map((opt, optIdx) => {
        const isCorrect = Number(q.correctOptionIndex) === optIdx;
        return `
          <div class="flex items-center gap-2 p-2 rounded-xl text-xs ${isCorrect ? 'bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold' : 'bg-slate-50 border border-slate-200 text-slate-700'}">
            <span class="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}">
              ${['A','B','C','D'][optIdx] || optIdx + 1}
            </span>
            <span class="flex-1">${escHtml(opt)}</span>
            ${isCorrect ? '<span class="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">Correct Option</span>' : ''}
          </div>
        `;
      }).join("");

      return `
        <div class="border border-slate-200 rounded-xl p-4 bg-white space-y-2.5 shadow-xs">
          <div class="flex items-start justify-between gap-2">
            <span class="text-xs font-black uppercase tracking-wider text-indigo-600">Question #${idx + 1}</span>
          </div>
          <p class="text-xs sm:text-sm font-bold text-slate-900 leading-relaxed">${escHtml(q.text)}</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            ${optsHtml}
          </div>
          ${q.explanation ? `
            <div class="bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-100 text-[11px] text-indigo-900">
              <span class="font-bold">Explanation:</span> ${escHtml(q.explanation)}
            </div>` : ''}
        </div>
      `;
    }).join("");

    return `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" data-sub-card="${sub.id}">
        
        <!-- Card Header -->
        <div class="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <span class="px-3 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-extrabold">
                📚 ${escHtml(sub.courseName || 'NPTEL Course')}
              </span>
              ${badge}
              <span class="text-xs font-bold text-slate-500">(${qCount} Question${qCount > 1 ? 's' : ''})</span>
            </div>
            <p class="text-xs text-slate-600">
              Submitted by <span class="font-bold text-slate-900">${escHtml(sub.submitterName || 'Learner')}</span>
              ${sub.submitterEmail ? `<span class="text-slate-400">(${escHtml(sub.submitterEmail)})</span>` : ''}
              &bull; <span class="text-slate-400">${sub.createdDateStr || 'Recently'}</span>
            </p>
          </div>

          <!-- Quick Action Buttons -->
          <div class="flex flex-wrap items-center gap-2">
            <button data-action="delete-sub" data-id="${sub.id}" class="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition">
              Delete
            </button>
            ${sub.status !== 'rejected' ? `
              <button data-action="reject-sub" data-id="${sub.id}" class="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition">
                Reject
              </button>` : ''}
            ${sub.status !== 'approved' ? `
              <div class="flex items-center gap-2 bg-emerald-50 border border-emerald-200 p-1.5 rounded-xl">
                <select class="sub-target-week-select text-xs font-bold bg-white border border-emerald-300 text-emerald-900 rounded-lg p-1.5" data-course-id="${sub.courseId}" data-sub-id="${sub.id}">
                  <option value="" disabled selected>Select Week to Add</option>
                </select>
                <button data-action="approve-sub" data-id="${sub.id}" data-course-id="${sub.courseId}" data-course-name="${escHtml(sub.courseName)}" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-sm transition flex items-center gap-1">
                  ✓ Approve & Add
                </button>
              </div>` : `
              <span class="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                ✓ Added to Course Quizzes
              </span>`}
          </div>
        </div>

        <!-- Questions List Body -->
        <div class="p-5 space-y-3 bg-slate-50/20">
          ${questionsHtml}
        </div>

      </div>
    `;
  }).join("");

  // Asynchronously populate week options for each submission card
  subListContainer.querySelectorAll(".sub-target-week-select").forEach(async (selectEl) => {
    const courseId = selectEl.dataset.courseId;
    if (!courseId) {
      selectEl.innerHTML = `<option value="week_1">Week 1 (Default)</option>`;
      return;
    }

    try {
      const weeks = await loadWeeks(courseId);
      if (weeks && weeks.length) {
        selectEl.innerHTML = `<option value="" disabled selected>— Select Week —</option>` +
          weeks.map(w => `<option value="${w.id}">${escHtml(w.name)}</option>`).join("");
      } else {
        selectEl.innerHTML = `
          <option value="week_1">Week 1</option>
          <option value="week_2">Week 2</option>
          <option value="week_3">Week 3</option>
          <option value="week_4">Week 4</option>
        `;
      }
    } catch (e) {
      selectEl.innerHTML = `
        <option value="week_1">Week 1</option>
        <option value="week_2">Week 2</option>
      `;
    }
  });

  // Attach Approval Button Listeners
  subListContainer.querySelectorAll("button[data-action='approve-sub']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const subId = btn.dataset.id;
      const targetSub = rawSubmissionsList.find(s => s.id === subId);
      if (!targetSub) return;

      const card = btn.closest("[data-sub-card]");
      const weekSelectEl = card?.querySelector(".sub-target-week-select");
      let selectedWeekId = weekSelectEl?.value;

      if (!selectedWeekId) {
        // Prompt admin or default
        const entered = prompt(`Enter week name or week number to add these ${targetSub.questions.length} questions to (e.g. Week 1):`, "Week 1");
        if (!entered) return;
        selectedWeekId = entered.trim().toLowerCase().replace(/\s+/g, "_");
      }

      showSpinner(`Publishing ${targetSub.questions.length} question(s) to course...`);
      try {
        const questionsToAdd = targetSub.questions || [];
        const cid = targetSub.courseId;

        for (let i = 0; i < questionsToAdd.length; i++) {
          const q = questionsToAdd[i];
          const qRef = collection(db, "courses", cid, "weeks", selectedWeekId, "questions");
          await addDoc(qRef, {
            text: q.text,
            options: q.options,
            correctOptionIndex: Number(q.correctOptionIndex) || 0,
            explanation: q.explanation || "",
            order: Date.now() + i
          });
        }

        // Mark submission as approved
        await updateSuggestedQuestionStatus(subId, "approved", {
          targetWeekId: selectedWeekId,
          approvedAt: Date.now()
        });

        // Instant optimistic UI
        targetSub.status = "approved";
        updateSubmissionsUI(rawSubmissionsList);

        showToast(`Successfully added ${questionsToAdd.length} question(s) to ${targetSub.courseName}!`, "success");
      } catch (err) {
        console.error("Failed to approve questions:", err);
        showToast("Approval error: " + err.message, "error");
      } finally {
        hideSpinner();
      }
    });
  });

  // Reject Button Listeners
  subListContainer.querySelectorAll("button[data-action='reject-sub']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const subId = btn.dataset.id;
      const targetSub = rawSubmissionsList.find(s => s.id === subId);
      if (targetSub) {
        targetSub.status = "rejected";
        updateSubmissionsUI(rawSubmissionsList);
      }
      try {
        await updateSuggestedQuestionStatus(subId, "rejected");
        showToast("Submission marked as rejected.", "info");
      } catch (err) {
        console.error("Reject error:", err);
      }
    });
  });

  // Delete Button Listeners
  subListContainer.querySelectorAll("button[data-action='delete-sub']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const subId = btn.dataset.id;
      if (confirm("Are you sure you want to permanently delete this suggested question submission?")) {
        rawSubmissionsList = rawSubmissionsList.filter(s => s.id !== subId);
        updateSubmissionsUI(rawSubmissionsList);
        try {
          await deleteSuggestedQuestion(subId);
          showToast("Submission deleted.", "info");
        } catch (err) {
          console.error("Delete submission error:", err);
        }
      }
    });
  });
}

// Filter pills click handler for submissions
if (subFilterPills) {
  subFilterPills.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      currentSubFilter = btn.dataset.filter;
      subFilterPills.querySelectorAll("button").forEach(b => {
        if (b === btn) {
          b.classList.add("bg-indigo-600", "text-white");
          b.classList.remove("bg-slate-100", "text-slate-700");
        } else {
          b.classList.remove("bg-indigo-600", "text-white");
          b.classList.add("bg-slate-100", "text-slate-700");
        }
      });
      renderSubmissionsList();
    });
  });
}

// ── CSV Report Generator ──────────────────────────────────────
if (generateReportBtn) {
  generateReportBtn.addEventListener("click", async () => {
    try {
      showSpinner("Generating Report...");
      await generateCSVReport();
      showToast("Report generated & downloaded!", "success");
    } catch (e) {
      showToast("Report generation failed: " + e.message, "error");
    } finally {
      hideSpinner();
    }
  });
}

// ── Real-Time Unsubscribe References ────────────────────────
let unsubCourses = null;
let unsubWeeks = null;
let unsubImportWeeks = null;
let unsubQuestions = null;
let unsubResources = null;

// ── CMS Initialization & Select Handlers ─────────────────────
function initCMS() {
  if (unsubCourses) unsubCourses();
  unsubCourses = subscribeToCourses((courses) => {
    cachedCoursesList = courses;
    const curVal = courseSelect.value;
    const curImpVal = importCourseSelect.value;

    populateSelect(courseSelect, courses, "— Select Course —");
    populateSelect(importCourseSelect, courses, "— Select Course —");

    if (curVal) courseSelect.value = curVal;
    if (curImpVal) importCourseSelect.value = curImpVal;

    deleteCourseBtn.disabled = !courseSelect.value;
  });
}

// Course selection change in CMS tab
courseSelect.addEventListener("change", () => {
  const cid = courseSelect.value;
  deleteCourseBtn.disabled = !cid;
  deleteWeekBtn.disabled = true;

  if (unsubWeeks) { unsubWeeks(); unsubWeeks = null; }
  if (unsubQuestions) { unsubQuestions(); unsubQuestions = null; }
  if (unsubResources) { unsubResources(); unsubResources = null; }

  weekSelect.innerHTML = `<option value="" disabled selected>— Select Week —</option>`;
  weekSelect.disabled = !cid;
  questionsTableBody.innerHTML = "";
  if (qListCount) qListCount.textContent = "0";
  if (resListCount) resListCount.textContent = "0";

  if (!cid) return;

  // Real-time subscribe to weeks of selected course
  unsubWeeks = subscribeToWeeks(cid, (weeks) => {
    const curWeekVal = weekSelect.value;
    populateSelect(weekSelect, weeks, "— Select Week —");
    if (curWeekVal) weekSelect.value = curWeekVal;
    deleteWeekBtn.disabled = !weekSelect.value;
  });
});

// Week selection change in CMS tab
weekSelect.addEventListener("change", () => {
  const cid = courseSelect.value;
  const wid = weekSelect.value;
  deleteWeekBtn.disabled = !wid;

  if (unsubQuestions) { unsubQuestions(); unsubQuestions = null; }
  if (unsubResources) { unsubResources(); unsubResources = null; }

  if (!cid || !wid) {
    questionsTableBody.innerHTML = "";
    if (qListCount) qListCount.textContent = "0";
    if (resListCount) resListCount.textContent = "0";
    return;
  }

  // Real-time subscribe to questions of selected week
  unsubQuestions = subscribeToQuestions(cid, wid, (questions) => {
    renderQuestionsTable(questions);
  });

  // Real-time subscribe to resources of selected week
  unsubResources = subscribeToResources(cid, wid, (resources) => {
    renderResourcesTable(resources);
  });
});

// ── Course & Week Management (CRUD) ───────────────────────────
addCourseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = newCourseName.value.trim();
  if (!name) return;

  showSpinner("Adding Course...");
  try {
    await addDoc(collection(db, "courses"), { name });
    showToast(`Course "${name}" created!`, "success");
    newCourseName.value = "";
  } catch (err) {
    showToast("Error adding course: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

deleteCourseBtn.addEventListener("click", async () => {
  const cid = courseSelect.value;
  if (!cid) return;
  const courseName = courseSelect.options[courseSelect.selectedIndex]?.textContent;

  if (!confirm(`Are you sure you want to delete "${courseName}" and all its content?`)) return;

  showSpinner("Deleting Course...");
  try {
    await deleteDoc(doc(db, "courses", cid));
    showToast(`Course "${courseName}" deleted.`, "info");
    courseSelect.value = "";
    weekSelect.innerHTML = `<option value="" disabled selected>— Select Week —</option>`;
    weekSelect.disabled = true;
    deleteCourseBtn.disabled = true;
    deleteWeekBtn.disabled = true;
    questionsTableBody.innerHTML = "";
  } catch (err) {
    showToast("Error deleting course: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

addWeekForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cid = courseSelect.value;
  const name = newWeekName.value.trim();
  if (!cid) {
    showToast("Please select a Course first.", "warning");
    return;
  }
  if (!name) return;

  showSpinner("Adding Week...");
  try {
    await addDoc(collection(db, "courses", cid, "weeks"), { name });
    showToast(`"${name}" added!`, "success");
    newWeekName.value = "";
  } catch (err) {
    showToast("Error adding week: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

deleteWeekBtn.addEventListener("click", async () => {
  const cid = courseSelect.value;
  const wid = weekSelect.value;
  if (!cid || !wid) return;
  const weekName = weekSelect.options[weekSelect.selectedIndex]?.textContent;

  if (!confirm(`Are you sure you want to delete "${weekName}" and all its questions?`)) return;

  showSpinner("Deleting Week...");
  try {
    await deleteDoc(doc(db, "courses", cid, "weeks", wid));
    showToast(`"${weekName}" deleted.`, "info");
    weekSelect.value = "";
    deleteWeekBtn.disabled = true;
    questionsTableBody.innerHTML = "";
  } catch (err) {
    showToast("Error deleting week: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

// ── Question Management (Form & Table) ────────────────────────
questionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cid = courseSelect.value;
  const wid = weekSelect.value;

  if (!cid || !wid) {
    showToast("Please select both a Course and a Week before saving questions.", "warning");
    return;
  }

  const editId = qIdInput.value;
  const qData = {
    text: qTextInput.value.trim(),
    options: [
      opt0Input.value.trim(),
      opt1Input.value.trim(),
      opt2Input.value.trim(),
      opt3Input.value.trim()
    ],
    correctOptionIndex: parseInt(correctOptSelect.value),
    explanation: qExplInput.value.trim()
  };

  if (!qData.text || !qData.options[0] || !qData.options[1]) {
    showToast("Question text and at least 2 options are required.", "warning");
    return;
  }

  showSpinner(editId ? "Updating Question..." : "Saving Question...");
  try {
    if (editId) {
      await updateDoc(doc(db, "courses", cid, "weeks", wid, "questions", editId), qData);
      showToast("Question updated!", "success");
    } else {
      qData.order = Date.now();
      await addDoc(collection(db, "courses", cid, "weeks", wid, "questions"), qData);
      showToast("Question added!", "success");
    }
    resetQuestionForm();
  } catch (err) {
    showToast("Error saving question: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

cancelEditBtn.addEventListener("click", () => {
  resetQuestionForm();
});

function resetQuestionForm() {
  questionForm.reset();
  qIdInput.value = "";
  cancelEditBtn.classList.add("hidden");
  document.getElementById("submit-q-btn").textContent = "Save Question";
}

function renderQuestionsTable(questions) {
  if (qListCount) qListCount.textContent = questions.length;

  if (!questions.length) {
    questionsTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400 text-sm">No questions in this week yet. Use the form above to add questions or import in bulk.</td></tr>`;
    return;
  }

  questionsTableBody.innerHTML = questions.map((q, idx) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
      <td class="py-3 px-4 font-bold text-slate-400">${idx + 1}</td>
      <td class="py-3 px-4 font-semibold text-slate-800 max-w-xs truncate">${escHtml(q.text)}</td>
      <td class="py-3 px-4 text-emerald-600 font-bold">
        ${['A','B','C','D'][q.correctOptionIndex] || q.correctOptionIndex}: ${escHtml(q.options[q.correctOptionIndex] || '')}
      </td>
      <td class="py-3 px-4 text-slate-500 max-w-xs truncate">${escHtml(q.explanation || '—')}</td>
      <td class="py-3 px-4 text-right space-x-1.5">
        <button data-action="edit-q" data-id="${q.id}" class="px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-lg transition">Edit</button>
        <button data-action="delete-q" data-id="${q.id}" class="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-lg transition">Delete</button>
      </td>
    </tr>
  `).join("");

  // Attach Question Table Edit/Delete handlers
  questionsTableBody.querySelectorAll("button[data-action='edit-q']").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = questions.find(item => item.id === btn.dataset.id);
      if (!q) return;

      qIdInput.value = q.id;
      qTextInput.value = q.text || "";
      opt0Input.value = q.options[0] || "";
      opt1Input.value = q.options[1] || "";
      opt2Input.value = q.options[2] || "";
      opt3Input.value = q.options[3] || "";
      correctOptSelect.value = q.correctOptionIndex !== undefined ? q.correctOptionIndex : "0";
      qExplInput.value = q.explanation || "";

      cancelEditBtn.classList.remove("hidden");
      document.getElementById("submit-q-btn").textContent = "Update Question";
      questionForm.scrollIntoView({ behavior: 'smooth' });
    });
  });

  questionsTableBody.querySelectorAll("button[data-action='delete-q']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const qid = btn.dataset.id;
      const cid = courseSelect.value;
      const wid = weekSelect.value;
      if (!cid || !wid || !qid) return;

      if (!confirm("Delete this question?")) return;

      try {
        await deleteDoc(doc(db, "courses", cid, "weeks", wid, "questions", qid));
        showToast("Question deleted.", "info");
      } catch (err) {
        showToast("Error deleting question: " + err.message, "error");
      }
    });
  });
}

// ── Resource Materials Management ─────────────────────────────
addResourceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cid = courseSelect.value;
  const wid = weekSelect.value;

  if (!cid || !wid) {
    showToast("Please select a Course and Week first.", "warning");
    return;
  }

  const title = resTitleInput.value.trim();
  const url   = resUrlInput.value.trim();
  if (!title || !url) return;

  showSpinner("Adding Resource...");
  try {
    await addDoc(collection(db, "courses", cid, "weeks", wid, "resources"), { title, url, createdAt: Date.now() });
    showToast("Resource added!", "success");
    resTitleInput.value = "";
    resUrlInput.value = "";
  } catch (err) {
    showToast("Error adding resource: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

function renderResourcesTable(resources) {
  if (resListCount) resListCount.textContent = resources.length;

  if (!resources.length) {
    resourcesTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-slate-400 text-sm">No PDF or study resources added for this week yet.</td></tr>`;
    return;
  }

  resourcesTableBody.innerHTML = resources.map((r, idx) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
      <td class="py-3 px-4 font-bold text-slate-400">${idx + 1}</td>
      <td class="py-3 px-4 font-semibold text-slate-800">${escHtml(r.title)}</td>
      <td class="py-3 px-4 text-right space-x-1.5">
        <a href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-lg transition inline-block">Open</a>
        <button data-action="delete-res" data-id="${r.id}" class="px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-lg transition">Delete</button>
      </td>
    </tr>
  `).join("");

  resourcesTableBody.querySelectorAll("button[data-action='delete-res']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const rid = btn.dataset.id;
      const cid = courseSelect.value;
      const wid = weekSelect.value;
      if (!confirm("Delete this study resource?")) return;

      try {
        await deleteDoc(doc(db, "courses", cid, "weeks", wid, "resources", rid));
        showToast("Resource deleted.", "info");
      } catch (err) {
        showToast("Error deleting resource: " + err.message, "error");
      }
    });
  });
}

// ── Bulk Text Importer ─────────────────────────────────────────
importCourseSelect.addEventListener("change", () => {
  const cid = importCourseSelect.value;
  if (unsubImportWeeks) { unsubImportWeeks(); unsubImportWeeks = null; }
  importWeekSelect.innerHTML = `<option value="" disabled selected>— Select Week —</option>`;
  importWeekSelect.disabled = !cid;

  if (!cid) return;

  unsubImportWeeks = subscribeToWeeks(cid, (weeks) => {
    const cur = importWeekSelect.value;
    populateSelect(importWeekSelect, weeks, "— Select Week —");
    if (cur) importWeekSelect.value = cur;
  });
});

parseBtn.addEventListener("click", () => {
  const rawText = importTextInput.value.trim();
  if (!rawText) {
    showToast("Please paste text to parse questions.", "warning");
    return;
  }

  try {
    parsedQuestionsToSave = parseQuestionsFromText(rawText);
    if (!parsedQuestionsToSave.length) {
      showToast("No valid questions could be detected. Check assignment format.", "error");
      importPreviewArea.classList.add("hidden");
      return;
    }

    previewCount.textContent = parsedQuestionsToSave.length;
    previewTableBody.innerHTML = parsedQuestionsToSave.map((q, idx) => `
      <tr class="border-b border-slate-100 text-xs">
        <td class="py-2.5 px-3 font-bold text-slate-400">${idx + 1}</td>
        <td class="py-2.5 px-3 font-medium text-slate-800 max-w-xs truncate">${escHtml(q.text)}</td>
        <td class="py-2.5 px-3 text-emerald-600 font-bold">
          ${['A','B','C','D'][q.correctOptionIndex] || q.correctOptionIndex}: ${escHtml(q.options[q.correctOptionIndex] || '')}
        </td>
        <td class="py-2.5 px-3 text-slate-400 max-w-xs truncate">${escHtml(q.explanation || '—')}</td>
      </tr>
    `).join("");

    importPreviewArea.classList.remove("hidden");
    showToast(`Successfully parsed ${parsedQuestionsToSave.length} questions! Click Save Batch below.`, "success");
  } catch (err) {
    showToast("Parser error: " + err.message, "error");
  }
});

saveBatchBtn.addEventListener("click", async () => {
  const cid = importCourseSelect.value;
  const wid = importWeekSelect.value;

  if (!cid || !wid) {
    showToast("Please choose target Course and Week before saving batch.", "warning");
    return;
  }

  if (!parsedQuestionsToSave.length) {
    showToast("No parsed questions to save.", "warning");
    return;
  }

  showSpinner(`Saving ${parsedQuestionsToSave.length} questions to database...`);
  try {
    let batch = writeBatch(db);
    let count = 0;

    for (let i = 0; i < parsedQuestionsToSave.length; i++) {
      const q = parsedQuestionsToSave[i];
      const newDocRef = doc(collection(db, "courses", cid, "weeks", wid, "questions"));
      batch.set(newDocRef, {
        text: q.text,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation || "",
        order: Date.now() + i
      });
      count++;

      if (count % 450 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }

    if (count % 450 !== 0) {
      await batch.commit();
    }

    showToast(`Successfully saved all ${parsedQuestionsToSave.length} questions to Firestore!`, "success");

    parsedQuestionsToSave = [];
    if (importTextInput) importTextInput.value = "";
    importPreviewArea.classList.add("hidden");
  } catch (err) {
    showToast("Batch save failed: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Run Init ──────────────────────────────────────────────────
init();
