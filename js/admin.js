// ============================================================
//  QuizTEL — Admin Dashboard (admin.js)
//  Handles Firebase Auth, CMS (Courses/Weeks/Questions),
//  Bulk Import (PDF/DOCX), and Live Analytics.
// ============================================================

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

import { loadCourses, loadWeeks, loadQuestions, loadResources, populateSelect, showToast, showSpinner, hideSpinner, fmt } from "./app.js";
import { subscribeToAnalytics, trackPageView } from "./analytics.js";
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
const statViews       = document.getElementById("stat-views");
const statVisitors    = document.getElementById("stat-visitors");
const statAttempts    = document.getElementById("stat-attempts");

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

// ── Init ──────────────────────────────────────────────────────
function init() {
  trackPageView();

  // Auth state observer
  onAuthStateChanged(auth, (user) => {
    if (user) {
      authSection.classList.add("hidden");
      adminSection.classList.remove("hidden");
      if (adminUserEmail) adminUserEmail.textContent = user.email;

      // Init CMS & Analytics
      initCMS();
      if (!unsubscribeAnalytics) {
        unsubscribeAnalytics = subscribeToAnalytics(updateAnalyticsUI);
      }
    } else {
      authSection.classList.remove("hidden");
      adminSection.classList.add("hidden");
      if (unsubscribeAnalytics) {
        unsubscribeAnalytics();
        unsubscribeAnalytics = null;
      }
    }
  });
}

// ── Auth Handlers ─────────────────────────────────────────────
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginEmail.value.trim();
  const pass  = loginPass.value.trim();
  if (!email || !pass) return;

  showSpinner("Authenticating...");
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast("Successfully logged in as Admin!", "success");
    loginForm.reset();
  } catch (err) {
    console.error("Firebase Login Error:", err);
    alert("Login Error: " + err.message);
    showToast("Login failed: " + err.message, "error");
  } finally {
    hideSpinner();
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showToast("Logged out.", "info");
  } catch (err) {
    showToast("Logout error: " + err.message, "error");
  }
});

// ── Tab Switching ─────────────────────────────────────────────
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabBtns.forEach(b => {
      if (b === btn) {
        b.classList.add("border-indigo-600", "text-indigo-600", "font-bold");
        b.classList.remove("border-transparent", "text-gray-500");
      } else {
        b.classList.remove("border-indigo-600", "text-indigo-600", "font-bold");
        b.classList.add("border-transparent", "text-gray-500");
      }
    });

    tabContents.forEach(content => {
      content.classList.toggle("hidden", content.dataset.tabContent !== target);
    });
  });
});

// ── Analytics UI Update ───────────────────────────────────────
function updateAnalyticsUI(data) {
  if (statViews)    statViews.textContent    = fmt(data.pageViews);
  if (statVisitors) statVisitors.textContent = fmt(data.uniqueVisitors);
  if (statAttempts) statAttempts.textContent = fmt(data.quizAttempts);
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

    // Firestore batch supports up to 500 operations per batch
    let batch = writeBatch(db);
    let count = 0;

    for (const q of parsedQuestionsToSave) {
      const newDocRef = doc(qColRef);
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
