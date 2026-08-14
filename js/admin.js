// ============================================================
//  QuizTEL — Admin Dashboard (admin.js)
//  Handles Firebase Auth, CMS (Courses/Weeks/Questions),
//  Bulk Import (PDF/DOCX), and Live Analytics.
// ============================================================

import { loadCourses, loadWeeks, loadQuestions, loadResources, populateSelect, showToast, showSpinner, hideSpinner, fmt } from "./app.js";
import { 
  subscribeToAnalytics, 
  subscribeToLivePresence, 
  subscribeToFeedbacks, 
  trackPageView, 
  fetchDailyAnalytics, 
  generateCSVReport, 
  deleteFeedback, 
  toggleFeedbackStatus 
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

let rawFeedbackList       = [];
let currentFeedbackFilter = "all";

let viewsChart, visitorsChart, peakHoursChart;

// ── Init ──────────────────────────────────────────────────────
function init() {
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
    } else {
      authSection.classList.remove("hidden");
      adminSection.classList.add("hidden");
      if (unsubscribeAnalytics) { unsubscribeAnalytics(); unsubscribeAnalytics = null; }
      if (unsubscribePresence)  { unsubscribePresence();  unsubscribePresence = null; }
      if (unsubscribeFeedbacks) { unsubscribeFeedbacks(); unsubscribeFeedbacks = null; }
    }
  });
}

// ── Live Presence UI Handler ──────────────────────────────────
function updatePresenceUI({ activeCount, activePages }) {
  if (statLiveUsers) statLiveUsers.textContent = fmt(activeCount);
  if (cardLiveUsers) cardLiveUsers.textContent = fmt(activeCount);
}

// ── Analytics UI & Stock Market Charts Handler ────────────────
async function renderCharts() {
  const data = await fetchDailyAnalytics(30);
  if (!data.length) return;
  
  const labels   = data.map(d => d.date);
  const views    = data.map(d => d.pageViews || 0);
  const visitors = data.map(d => d.uniqueVisitors || 0);
  const attempts = data.map(d => d.quizAttempts || 0);

  // 1. Stock Market Style Real-Time Line Area Chart
  const viewsCtx = document.getElementById('viewsChart')?.getContext('2d');
  if (viewsCtx) {
    if (viewsChart) viewsChart.destroy();
    
    // Create stock market glowing green gradient fill
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
          pointRadius: 4,
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
          x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
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

  const peakHourStr = `${String(maxHourIdx).padStart(2, '0')}:00`;
  if (statPeakHourBadge) statPeakHourBadge.textContent = peakHourStr;
  if (peakHourHighlight) peakHourHighlight.textContent = `Peak: ${peakHourStr} (${fmt(maxCount)} views)`;

  const peakCtx = document.getElementById('peakHoursChart')?.getContext('2d');
  if (peakCtx) {
    if (peakHoursChart) peakHoursChart.destroy();
    
    const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    const bgColors = hourlyTotals.map((_, i) => i === maxHourIdx ? '#f59e0b' : '#6366f1');

    peakHoursChart = new Chart(peakCtx, {
      type: 'bar',
      data: {
        labels: hourLabels,
        datasets: [{
          label: 'Hourly Views',
          data: hourlyTotals,
          backgroundColor: bgColors,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 } } },
          y: { beginAtZero: true }
        }
      }
    });
  }

  // 3. Unique Visitors vs Quiz Attempts Bar Chart
  const visitorsCtx = document.getElementById('visitorsChart')?.getContext('2d');
  if (visitorsCtx) {
    if (visitorsChart) visitorsChart.destroy();
    visitorsChart = new Chart(visitorsCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Unique Visitors', data: visitors, backgroundColor: '#d97706', borderRadius: 6 },
          { label: 'Quiz Attempts', data: attempts, backgroundColor: '#059669', borderRadius: 6 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

function updateAnalyticsUI(data) {
  if (statViews)     statViews.textContent     = fmt(data.pageViews);
  if (statVisitors)  statVisitors.textContent  = fmt(data.uniqueVisitors);
  if (statAttempts)  statAttempts.textContent  = fmt(data.quizAttempts);
  if (statAttendees) statAttendees.textContent = fmt(data.quizAttendees || data.uniqueVisitors);
  if (statShares)    statShares.textContent    = fmt(data.totalShares);

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

  // Attach button event listeners
  fbTableBody.querySelectorAll("button[data-action='toggle-fb-status']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const status = btn.dataset.status === "true";
      await toggleFeedbackStatus(id, status);
      showToast("Feedback status updated!", "info");
    });
  });

  fbTableBody.querySelectorAll("button[data-action='delete-fb']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (confirm("Are you sure you want to delete this user feedback entry?")) {
        await deleteFeedback(id);
        showToast("Feedback deleted.", "info");
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

if (generateReportBtn) {
  generateReportBtn.addEventListener("click", async () => {
    try {
      showSpinner("Generating Report...");
      await generateCSVReport();
      showToast("Report generated!", "success");
    } catch (e) {
      showToast("Report generation failed: " + e.message, "error");
    } finally {
      hideSpinner();
    }
  });
}

// ── CMS Initialization & Select Handlers ─────────────────────
async function initCMS() {
  await refreshCourses();
}

async function refreshCourses() {
  showSpinner("Loading courses...");
  try {
    const courses = await loadCourses();
    populateSelect(courseSelect, courses, "— Select Course —");
    populateSelect(importCourseSelect, courses, "— Select Course —");

    // Reset dependent selects
    weekSelect.innerHTML = `<option value="" disabled selected>— Select Week —</option>`;
    weekSelect.disabled = true;
    importWeekSelect.innerHTML = `<option value="" disabled selected>— Select Week —</option>`;
    importWeekSelect.disabled = true;

    deleteCourseBtn.disabled = true;
    deleteWeekBtn.disabled = true;

    questionsTableBody.innerHTML = "";
    if (qListCount) qListCount.textContent = "0";
  } catch (err) {
    showToast("Error loading courses: " + err.message, "error");
  } finally {
    hideSpinner();
  }
}

// Course selection change in CMS tab
courseSelect.addEventListener("change", async () => {
  const cid = courseSelect.value;
  deleteCourseBtn.disabled = !cid;
  deleteWeekBtn.disabled = true;

  weekSelect.innerHTML = `<option value="" disabled selected>Loading weeks...</option>`;
  weekSelect.disabled = true;
  questionsTableBody.innerHTML = "";
  if (qListCount) qListCount.textContent = "0";

  try {
    const weeks = await loadWeeks(cid);
    populateSelect(weekSelect, weeks, "— Select Week —");
    weekSelect.disabled = false;
  } catch (err) {
    showToast("Error loading weeks: " + err.message, "error");
  }
});

// Week selection change in CMS tab
weekSelect.addEventListener("change", async () => {
  const wid = weekSelect.value;
  deleteWeekBtn.disabled = !wid;
  await refreshQuestionsList();
  await refreshResourcesList();
});

// ── PDF Resources CRUD ─────────────────────────────────────────
async function refreshResourcesList() {
  const cid = courseSelect.value;
  const wid = weekSelect.value;
  if (!cid || !wid) return;

  try {
    const resources = await loadResources(cid, wid);
    if (resListCount) resListCount.textContent = resources.length;
    renderResourcesTable(resources);
  } catch (err) {
    showToast("Failed to load PDF resources: " + err.message, "error");
  }
}

function renderResourcesTable(resources) {
  if (resources.length === 0) {
    resourcesTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-400 text-sm">No PDF answer keys or attachment files added to this week yet.</td></tr>`;
    return;
  }

  resourcesTableBody.innerHTML = resources.map((r, idx) => `
    <tr class="border-b border-gray-100 hover:bg-gray-50 transition text-sm">
      <td class="py-3 px-4 font-semibold text-gray-600">${idx + 1}</td>
      <td class="py-3 px-4 text-gray-800 font-medium">${escHtml(r.title)}</td>
      <td class="py-3 px-4">
        <a href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:underline font-semibold text-xs inline-flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          View / Open Link
        </a>
      </td>
      <td class="py-3 px-4 text-right">
        <button data-action="delete-res" data-id="${r.id}" class="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-lg text-xs transition">Delete</button>
      </td>
    </tr>
  `).join("");

  resourcesTableBody.querySelectorAll("button[data-action='delete-res']").forEach(btn => {
    btn.addEventListener("click", () => deleteResource(btn.dataset.id));
  });
}

if (addResourceForm) {
  addResourceForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cid = courseSelect.value;
    const wid = weekSelect.value;
    if (!cid || !wid) {
      showToast("Please select a Course and Week first!", "warning");
      return;
    }

    const title = resTitleInput.value.trim();
    const url   = resUrlInput.value.trim();
    if (!title || !url) return;

    showSpinner("Attaching PDF Resource...");
    try {
      await addDoc(collection(db, "courses", cid, "weeks", wid, "resources"), {
        title,
        url,
        createdAt: new Date().toISOString()
      });
      showToast(`PDF Resource "${title}" attached!`, "success");
      addResourceForm.reset();
      await refreshResourcesList();
    } catch (err) {
      showToast("Failed to attach PDF resource: " + err.message, "error");
    } finally {
      hideSpinner();
    }
  });
}

async function deleteResource(resId) {
  const cid = courseSelect.value;
  const wid = weekSelect.value;
  if (!cid || !wid || !resId) return;

  if (!confirm("Are you sure you want to remove this PDF resource?")) return;

  showSpinner("Deleting PDF Resource...");
  try {
    await deleteDoc(doc(db, "courses", cid, "weeks", wid, "resources", resId));
    showToast("PDF Resource deleted.", "info");
    await refreshResourcesList();
  } catch (err) {
    showToast("Failed to delete resource: " + err.message, "error");
  } finally {
    hideSpinner();
  }
}

// Course selection change in Import tab
importCourseSelect.addEventListener("change", async () => {
  const cid = importCourseSelect.value;
  importWeekSelect.innerHTML = `<option value="" disabled selected>Loading weeks...</option>`;
  importWeekSelect.disabled = true;

  try {
    const weeks = await loadWeeks(cid);
    populateSelect(importWeekSelect, weeks, "— Select Week —");
    importWeekSelect.disabled = false;
  } catch (err) {
    showToast("Error loading weeks for import: " + err.message, "error");
  }
});

// ── Course & Week CRUD ────────────────────────────────────────
addCourseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = newCourseName.value.trim();
  if (!name) return;

  showSpinner("Adding Course...");
  try {
    await addDoc(collection(db, "courses"), { name });
    showToast(`Course "${name}" added!`, "success");
    newCourseName.value = "";
    await refreshCourses();
  } catch (err) {
    showToast("Failed to add course: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

deleteCourseBtn.addEventListener("click", async () => {
  const cid = courseSelect.value;
  if (!cid) return;
  const courseName = courseSelect.options[courseSelect.selectedIndex].text;

  if (!confirm(`Are you sure you want to delete course "${courseName}"? Note: Subcollections must be cleaned up manually if any.`)) return;

  showSpinner("Deleting Course...");
  try {
    await deleteDoc(doc(db, "courses", cid));
    showToast(`Course "${courseName}" deleted.`, "info");
    await refreshCourses();
  } catch (err) {
    showToast("Failed to delete course: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

addWeekForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cid = courseSelect.value;
  const name = newWeekName.value.trim();
  if (!cid || !name) return;

  showSpinner("Adding Week...");
  try {
    await addDoc(collection(db, "courses", cid, "weeks"), { name });
    showToast(`Week "${name}" added!`, "success");
    newWeekName.value = "";

    // Refresh weeks list
    const weeks = await loadWeeks(cid);
    populateSelect(weekSelect, weeks, "— Select Week —");
    weekSelect.value = "";
    deleteWeekBtn.disabled = true;
  } catch (err) {
    showToast("Failed to add week: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

deleteWeekBtn.addEventListener("click", async () => {
  const cid = courseSelect.value;
  const wid = weekSelect.value;
  if (!cid || !wid) return;
  const weekName = weekSelect.options[weekSelect.selectedIndex].text;

  if (!confirm(`Are you sure you want to delete "${weekName}"?`)) return;

  showSpinner("Deleting Week...");
  try {
    await deleteDoc(doc(db, "courses", cid, "weeks", wid));
    showToast(`Week "${weekName}" deleted.`, "info");

    const weeks = await loadWeeks(cid);
    populateSelect(weekSelect, weeks, "— Select Week —");
    weekSelect.value = "";
    deleteWeekBtn.disabled = true;
    questionsTableBody.innerHTML = "";
    if (qListCount) qListCount.textContent = "0";
  } catch (err) {
    showToast("Failed to delete week: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

// ── Questions CRUD ────────────────────────────────────────────
async function refreshQuestionsList() {
  const cid = courseSelect.value;
  const wid = weekSelect.value;
  if (!cid || !wid) return;

  showSpinner("Loading questions...");
  try {
    const questions = await loadQuestions(cid, wid);
    if (qListCount) qListCount.textContent = questions.length;
    renderQuestionsTable(questions);
  } catch (err) {
    showToast("Failed to load questions: " + err.message, "error");
  } finally {
    hideSpinner();
  }
}

function renderQuestionsTable(questions) {
  if (questions.length === 0) {
    questionsTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-400 text-sm">No questions added to this week yet.</td></tr>`;
    return;
  }

  const optionLetters = ["A", "B", "C", "D"];

  questionsTableBody.innerHTML = questions.map((q, idx) => `
    <tr class="border-b border-gray-100 hover:bg-gray-50 transition text-sm">
      <td class="py-3 px-4 font-semibold text-gray-600">${idx + 1}</td>
      <td class="py-3 px-4 text-gray-800 font-medium max-w-md truncate" title="${escHtml(q.text)}">${escHtml(q.text)}</td>
      <td class="py-3 px-4">
        <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs">
          Option ${optionLetters[q.correctOptionIndex]}
        </span>
      </td>
      <td class="py-3 px-4 text-right space-x-2">
        <button data-action="edit" data-id="${q.id}" class="px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold rounded-lg text-xs transition">Edit</button>
        <button data-action="delete" data-id="${q.id}" class="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 font-semibold rounded-lg text-xs transition">Delete</button>
      </td>
    </tr>
  `).join("");

  // Attach action listeners
  questionsTableBody.querySelectorAll("button[data-action='edit']").forEach(btn => {
    btn.addEventListener("click", () => editQuestion(btn.dataset.id, questions));
  });

  questionsTableBody.querySelectorAll("button[data-action='delete']").forEach(btn => {
    btn.addEventListener("click", () => deleteQuestion(btn.dataset.id));
  });
}

const qSubmitBtn   = document.getElementById("q-submit-btn");
const editorTitle  = document.getElementById("editor-title");
const qEditorCard  = document.getElementById("question-editor-card");

function editQuestion(qid, questions) {
  const q = questions.find(item => item.id === qid);
  if (!q) return;

  qIdInput.value        = q.id;
  qTextInput.value      = q.text;
  opt0Input.value       = q.options[0] || "";
  opt1Input.value       = q.options[1] || "";
  opt2Input.value       = q.options[2] || "";
  opt3Input.value       = q.options[3] || "";
  correctOptSelect.value = q.correctOptionIndex;
  qExplInput.value      = q.explanation || "";

  if (qSubmitBtn)  qSubmitBtn.textContent  = "✓ Update Question in Firestore";
  if (editorTitle) editorTitle.textContent = "Edit Selected Question";
  if (qEditorCard) qEditorCard.classList.add("ring-2", "ring-indigo-500", "border-indigo-500");

  cancelEditBtn.classList.remove("hidden");
  qTextInput.scrollIntoView({ behavior: "smooth" });
}

function resetQuestionEditor() {
  questionForm.reset();
  qIdInput.value = "";
  if (qSubmitBtn)  qSubmitBtn.textContent  = "+ Add New Question";
  if (editorTitle) editorTitle.textContent = "Manual Question Editor";
  if (qEditorCard) qEditorCard.classList.remove("ring-2", "ring-indigo-500", "border-indigo-500");
  cancelEditBtn.classList.add("hidden");
}

cancelEditBtn.addEventListener("click", resetQuestionEditor);

questionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cid = courseSelect.value;
  const wid = weekSelect.value;

  if (!cid || !wid) {
    showToast("Please select a Course and Week first!", "warning");
    return;
  }

  const qid = qIdInput.value;
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

  showSpinner(qid ? "Updating Question..." : "Saving Question...");
  try {
    if (qid) {
      await updateDoc(doc(db, "courses", cid, "weeks", wid, "questions", qid), qData);
      showToast("Question updated successfully!", "success");
    } else {
      const qs = await loadQuestions(cid, wid);
      const maxOrder = qs.length > 0 ? Math.max(...qs.map(q => q.order !== undefined ? q.order : -1)) : -1;
      qData.order = maxOrder + 1;
      
      await addDoc(collection(db, "courses", cid, "weeks", wid, "questions"), qData);
      showToast("Question created successfully!", "success");
    }

    resetQuestionEditor();
    await refreshQuestionsList();
  } catch (err) {
    showToast("Failed to save question: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

async function deleteQuestion(qid) {
  const cid = courseSelect.value;
  const wid = weekSelect.value;
  if (!cid || !wid || !qid) return;

  if (!confirm("Are you sure you want to delete this question?")) return;

  showSpinner("Deleting Question...");
  try {
    await deleteDoc(doc(db, "courses", cid, "weeks", wid, "questions", qid));
    showToast("Question deleted.", "info");
    await refreshQuestionsList();
  } catch (err) {
    showToast("Failed to delete question: " + err.message, "error");
  } finally {
    hideSpinner();
  }
}

// ── Bulk Document / Text Import ───────────────────────────────
parseBtn.addEventListener("click", () => {
  const text = importTextInput ? importTextInput.value.trim() : "";
  if (!text) {
    showToast("Please paste your question text into the box first.", "warning");
    return;
  }

  showSpinner("Parsing text questions...");
  try {
    parsedQuestionsToSave = parseQuestionsFromText(text);

    if (!parsedQuestionsToSave.length) {
      showToast("No valid questions found in pasted text. Make sure questions have Q:, options A/B/C/D, and Answer: A.", "warning");
      importPreviewArea.classList.add("hidden");
      return;
    }

    renderImportPreview(parsedQuestionsToSave);
    importPreviewArea.classList.remove("hidden");
    showToast(`Successfully parsed ${parsedQuestionsToSave.length} questions!`, "success");
  } catch (err) {
    showToast("Parsing error: " + err.message, "error");
    importPreviewArea.classList.add("hidden");
  } finally {
    hideSpinner();
  }
});

function renderImportPreview(questions) {
  const optionLetters = ["A", "B", "C", "D"];
  if (previewCount) previewCount.textContent = questions.length;

  previewTableBody.innerHTML = questions.map((q, idx) => `
    <tr class="border-b border-gray-100 hover:bg-gray-50 text-xs">
      <td class="py-2 px-3 font-semibold text-gray-500">${idx + 1}</td>
      <td class="py-2 px-3 font-medium text-gray-800 max-w-sm truncate" title="${escHtml(q.text)}">${escHtml(q.text)}</td>
      <td class="py-2 px-3 text-gray-600">${q.options.map(o => escHtml(o)).join(" | ")}</td>
      <td class="py-2 px-3 font-bold text-emerald-600">${optionLetters[q.correctOptionIndex]}</td>
      <td class="py-2 px-3 text-gray-500 max-w-xs truncate" title="${escHtml(q.explanation)}">${escHtml(q.explanation)}</td>
    </tr>
  `).join("");
}

saveBatchBtn.addEventListener("click", async () => {
  const cid = importCourseSelect.value;
  const wid = importWeekSelect.value;

  if (!cid || !wid) {
    showToast("Please select a Target Course and Target Week.", "warning");
    return;
  }

  if (!parsedQuestionsToSave.length) {
    showToast("No parsed questions to save.", "warning");
    return;
  }

  showSpinner(`Batch saving ${parsedQuestionsToSave.length} questions to Firestore...`);
  try {
    const qColRef = collection(db, "courses", cid, "weeks", wid, "questions");
    const existingQs = await loadQuestions(cid, wid);
    let currentOrder = existingQs.length > 0 ? Math.max(...existingQs.map(q => q.order !== undefined ? q.order : -1)) + 1 : 0;

    // Firestore batch supports up to 500 operations per batch
    let batch = writeBatch(db);
    let count = 0;

    for (const q of parsedQuestionsToSave) {
      const newDocRef = doc(qColRef);
      q.order = currentOrder++;
      batch.set(newDocRef, q);
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

    // Reset import tab
    parsedQuestionsToSave = [];
    if (importTextInput) importTextInput.value = "";
    importPreviewArea.classList.add("hidden");

    // If CMS course & week match, refresh questions list
    if (courseSelect.value === cid && weekSelect.value === wid) {
      await refreshQuestionsList();
    }
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
