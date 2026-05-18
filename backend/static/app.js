const API_BASE_URL = "";
// Keep last report rows in memory so we can filter by quarter
let lastReportRows = [];

// ---- DOM elements ----
const pingButton = document.getElementById("ping-button");
const pingStatus = document.getElementById("ping-status");

const goalForm = document.getElementById("goal-form");
const goalError = document.getElementById("goal-error");
const goalList = document.getElementById("goal-list");
const weightageSummary = document.getElementById("weightage-summary");

const sheetStatus = document.getElementById("sheet-status");
const sheetError = document.getElementById("sheet-error");
const submitSheetButton = document.getElementById("submit-sheet-button");

const achievementForm = document.getElementById("achievement-form");
const achievementGoalSelect = document.getElementById("achievement-goal");
const achievementQuarterSelect = document.getElementById("achievement-quarter");
const achievementActualInput = document.getElementById("achievement-actual");
const achievementStatusSelect = document.getElementById("achievement-status");
const achievementError = document.getElementById("achievement-error");

const managerStatus = document.getElementById("manager-status");
const managerWeightage = document.getElementById("manager-weightage");
const managerCommentDisplay = document.getElementById("manager-comment-display");
const managerCommentInput = document.getElementById("manager-comment-input");
const managerApproveButton = document.getElementById("manager-approve-button");
const managerReworkButton = document.getElementById("manager-rework-button");
const managerError = document.getElementById("manager-error");

const reportTbody = document.getElementById("report-tbody");
const downloadCsvButton = document.getElementById("download-csv-button");
const reportQuarterFilter = document.getElementById("report-quarter-filter");

const kpiTotalGoals = document.getElementById("kpi-total-goals");
const kpiSheetStatus = document.getElementById("kpi-sheet-status");
const kpiTotalWeightage = document.getElementById("kpi-total-weightage");
const quarterSummary = document.getElementById("quarter-summary");
const goalQuarterBreakdown = document.getElementById("goal-quarter-breakdown");

const adminUnlockButton = document.getElementById("admin-unlock-button");
const adminResetButton = document.getElementById("admin-reset-button");
const adminMessage = document.getElementById("admin-message");

const auditTbody = document.getElementById("audit-tbody");

const analyticsThrustArea = document.getElementById("analytics-thrust-area");
const analyticsUom = document.getElementById("analytics-uom");
const analyticsQuarterScores = document.getElementById("analytics-quarter-scores");

// ---- Escalation elements ----
const employeeEscalationList = document.getElementById("employee-escalation-list");
const escalationForm = document.getElementById("escalation-form");
const escalationGoalSelect = document.getElementById("escalation-goal");
const escalationQuarterSelect = document.getElementById("escalation-quarter");
const escalationSeveritySelect = document.getElementById("escalation-severity");
const escalationOwnerInput = document.getElementById("escalation-owner");
const escalationDeadlineInput = document.getElementById("escalation-deadline");
const escalationReasonInput = document.getElementById("escalation-reason");
const escalationCommentInput = document.getElementById("escalation-comment");
const escalationError = document.getElementById("escalation-error");
const escalationTbody = document.getElementById("escalation-tbody");

// ---- Role switcher elements ----
const roleTabs = document.querySelectorAll("[data-role-tab]");
const roleSections = document.querySelectorAll("[data-roles]");

// Change this if your backend runs on a different host/port


// =====================
// Theme toggle (light/dark)
// =====================
(function setupThemeToggle() {
  const body = document.body;
  const toggle = document.getElementById("theme-toggle");

  try {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      body.classList.add("theme-dark");
    }
  } catch (err) {
    console.warn("Theme storage unavailable:", err);
  }

  if (!toggle) return;

  updateThemeToggleLabel();

  toggle.addEventListener("click", () => {
    body.classList.toggle("theme-dark");
    const isDark = body.classList.contains("theme-dark");

    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch (err) {
      console.warn("Theme storage unavailable:", err);
    }

    updateThemeToggleLabel();
  });

  function updateThemeToggleLabel() {
    const isDark = body.classList.contains("theme-dark");
    toggle.textContent = isDark ? "🌞 Light" : "🌓 Dark";
  }
})();

// =========================
// Role switcher logic
// =========================
function setActiveRole(role) {
  roleTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.roleTab === role);
  });

  roleSections.forEach((sec) => {
    const rolesAttr = sec.dataset.roles || "";
    const roles = rolesAttr
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);

    const hasAll = roles.includes("all");
    const hasRole = roles.includes(role);

    if (hasAll || hasRole || roles.length === 0) {
      sec.style.display = "";
    } else {
      sec.style.display = "none";
    }
  });
}

roleTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const role = tab.dataset.roleTab;
    setActiveRole(role);
  });
});

// =========================
// Small helpers
// =========================
function prettyStatus(status) {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getQuarterOrderValue(q) {
  const order = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
  return order[q] || 99;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getEscalationStatusClass(status) {
  if (status === "Resolved" || status === "Closed") return "green";
  if (status === "In Progress") return "amber";
  return "red";
}

// ---- Backend ping test ----
if (pingButton) {
  pingButton.addEventListener("click", async () => {
    pingStatus.textContent = "Contacting backend...";
    try {
      const resp = await fetch(`${API_BASE_URL}/api/ping`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      pingStatus.textContent = `Backend says: ${data.message}`;
    } catch (err) {
      console.error(err);
      pingStatus.textContent = "Failed to reach backend. Is it running?";
    }
  });
}

// ---- Load everything on page open ----
window.addEventListener("DOMContentLoaded", () => {
  loadGoals();
  loadGoalSheet();
  loadReport();
  loadDashboard();
  loadGoalQuarterBreakdown();
  loadAudit();
  loadAnalytics();
  loadEscalations();

  setActiveRole("employee");
});

// =========================
// Goals & Goal Sheet
// =========================
async function loadGoals() {
  if (goalList) {
    goalList.innerHTML = "<li>Loading...</li>";
  }

  if (achievementGoalSelect) {
    achievementGoalSelect.innerHTML = '<option value="">-- Select a goal --</option>';
  }

  if (escalationGoalSelect) {
    escalationGoalSelect.innerHTML = '<option value="">-- Select goal --</option>';
  }

  try {
    const resp = await fetch(`${API_BASE_URL}/api/goals`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const goals = await resp.json();

    if (goalList) {
      goalList.innerHTML = "";
    }

    if (!goals || goals.length === 0) {
      if (goalList) {
        goalList.innerHTML = "<li>No goals added yet.</li>";
      }
      return;
    }

    goals.forEach((g) => {
      if (goalList) {
        const li = document.createElement("li");

        let achievementText = "No quarterly updates yet.";

        if (g.achievements && g.achievements.length > 0) {
          const sortedAchievements = [...g.achievements].sort(
            (a, b) => getQuarterOrderValue(a.quarter) - getQuarterOrderValue(b.quarter)
          );

          achievementText = sortedAchievements
            .map((ach) => {
              const score =
                ach.progress_score !== null && ach.progress_score !== undefined
                  ? ach.progress_score.toFixed(1)
                  : "N/A";

              return `${ach.quarter}: Actual=${ach.actual_achievement}, Status=${ach.status}, Score=${score}`;
            })
            .join(" | ");
        }

        li.textContent = `[${g.thrust_area}] ${g.title} – ${g.weightage}% (${g.uom}, Target: ${g.target}) | ${achievementText}`;
        goalList.appendChild(li);
      }

      if (achievementGoalSelect) {
        const option = document.createElement("option");
        option.value = g.id;
        option.textContent = `${g.id} – ${g.title}`;
        achievementGoalSelect.appendChild(option);
      }

      if (escalationGoalSelect) {
        const option = document.createElement("option");
        option.value = g.id;
        option.textContent = `${g.id} – ${g.title}`;
        escalationGoalSelect.appendChild(option);
      }
    });
  } catch (err) {
    console.error(err);
    if (goalList) {
      goalList.innerHTML = "<li>Failed to load goals.</li>";
    }
  }
}

async function loadGoalSheet() {
  if (!sheetStatus || !weightageSummary || !managerStatus || !managerWeightage || !managerCommentDisplay) {
    return;
  }

  sheetError.textContent = "";
  managerError.textContent = "";

  try {
    const resp = await fetch(`${API_BASE_URL}/api/goal-sheet`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const statusText = prettyStatus(data.status);

    sheetStatus.textContent = `Goal sheet status: ${statusText}`;
    weightageSummary.textContent = `Total weightage: ${data.total_weightage}%`;

    managerStatus.textContent = `Manager sees status: ${statusText}`;
    managerWeightage.textContent = `Total weightage (for manager): ${data.total_weightage}%`;
    managerCommentDisplay.textContent = data.manager_comment
      ? `Manager comment: ${data.manager_comment}`
      : "Manager comment: (none yet)";
  } catch (err) {
    console.error(err);
    sheetStatus.textContent = "Failed to load goal sheet.";
    managerStatus.textContent = "Failed to load goal sheet.";
  }
}

// Employee: add goal
if (goalForm) {
  goalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    goalError.textContent = "";
    sheetError.textContent = "";

    const thrustArea = document.getElementById("thrust-area").value.trim();
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const uom = document.getElementById("uom").value;
    const target = parseFloat(document.getElementById("target").value);
    const weightage = parseInt(document.getElementById("weightage").value, 10);

    if (!thrustArea || !title || !description || !uom || isNaN(target) || isNaN(weightage)) {
      goalError.textContent = "Please fill all fields.";
      return;
    }

    const payload = {
      thrust_area: thrustArea,
      title,
      description,
      uom,
      target,
      weightage,
    };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/goals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null);
        const detail = errBody && errBody.detail ? errBody.detail : `HTTP ${resp.status}`;
        goalError.textContent = detail;
        return;
      }

      await resp.json();
      goalForm.reset();

      loadGoals();
      loadGoalSheet();
      loadDashboard();
      loadGoalQuarterBreakdown();
      loadAnalytics();
    } catch (err) {
      console.error(err);
      goalError.textContent = "Failed to save goal. Check backend.";
    }
  });
}

// Employee: submit goal sheet
if (submitSheetButton) {
  submitSheetButton.addEventListener("click", async () => {
    sheetError.textContent = "";
    managerError.textContent = "";

    try {
      const resp = await fetch(`${API_BASE_URL}/api/goal-sheet/submit`, {
        method: "POST",
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null);
        const detail = errBody && errBody.detail ? errBody.detail : `HTTP ${resp.status}`;
        sheetError.textContent = detail;
        return;
      }

      await resp.json();

      loadGoalSheet();
      loadDashboard();
      loadAudit();
      loadAnalytics();
    } catch (err) {
      console.error(err);
      sheetError.textContent = "Failed to submit goal sheet.";
    }
  });
}

// =========================
// Achievements
// =========================
if (achievementForm) {
  achievementForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    achievementError.textContent = "";

    const goalId = parseInt(achievementGoalSelect.value, 10);
    const quarter = achievementQuarterSelect.value;
    const actual = parseFloat(achievementActualInput.value);
    const status = achievementStatusSelect.value;

    if (isNaN(goalId) || !quarter || isNaN(actual) || !status) {
      achievementError.textContent = "Select goal, quarter and fill all fields.";
      return;
    }

    const payload = {
      quarter,
      actual_achievement: actual,
      status,
    };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/goals/${goalId}/achievement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null);
        const detail = errBody && errBody.detail ? errBody.detail : `HTTP ${resp.status}`;
        achievementError.textContent = detail;
        return;
      }

      await resp.json();
      achievementForm.reset();

      loadGoals();
      loadReport();
      loadDashboard();
      loadGoalQuarterBreakdown();
      loadAudit();
      loadAnalytics();
    } catch (err) {
      console.error(err);
      achievementError.textContent = "Failed to update achievement.";
    }
  });
}

// =========================
// Manager decisions
// =========================
async function sendManagerDecision(action) {
  managerError.textContent = "";
  sheetError.textContent = "";

  const comment = managerCommentInput.value.trim();
  const payload = { action, comment: comment || null };

  try {
    const resp = await fetch(`${API_BASE_URL}/api/manager/decision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => null);
      const detail = errBody && errBody.detail ? errBody.detail : `HTTP ${resp.status}`;
      managerError.textContent = detail;
      return;
    }

    await resp.json();
    managerCommentInput.value = "";

    loadGoalSheet();
    loadDashboard();
    loadAudit();
    loadAnalytics();
  } catch (err) {
    console.error(err);
    managerError.textContent = "Failed to send manager decision.";
  }
}

if (managerApproveButton) {
  managerApproveButton.addEventListener("click", () => {
    sendManagerDecision("approve");
  });
}

if (managerReworkButton) {
  managerReworkButton.addEventListener("click", () => {
    sendManagerDecision("rework");
  });
}

// =========================
// Report + quarter filter
// =========================
async function loadReport() {
  if (!reportTbody) return;

  reportTbody.innerHTML = "<tr><td colspan='10'>Loading...</td></tr>";

  try {
    const resp = await fetch(`${API_BASE_URL}/api/report/achievement`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const rows = await resp.json();
    lastReportRows = rows;
    renderReportTable();
  } catch (err) {
    console.error(err);
    reportTbody.innerHTML = "<tr><td colspan='10'>Failed to load report.</td></tr>";
  }
}

function renderReportTable() {
  if (!reportTbody) return;

  const filter = reportQuarterFilter ? reportQuarterFilter.value : "ALL";

  const filtered = lastReportRows.filter((r) => {
    if (!filter || filter === "ALL") return true;
    return r.quarter === filter;
  });

  if (filtered.length === 0) {
    reportTbody.innerHTML = "<tr><td colspan='10'>No rows for selected quarter.</td></tr>";
    return;
  }

  reportTbody.innerHTML = "";

  filtered.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.goal_id}</td>
      <td>${escapeHtml(r.thrust_area)}</td>
      <td>${escapeHtml(r.title)}</td>
      <td>${escapeHtml(r.uom)}</td>
      <td>${r.weightage}</td>
      <td>${r.target}</td>
      <td>${escapeHtml(r.quarter)}</td>
      <td>${r.actual_achievement}</td>
      <td>${escapeHtml(r.status)}</td>
      <td>${
        r.progress_score !== null && r.progress_score !== undefined
          ? r.progress_score.toFixed(1)
          : ""
      }</td>
    `;
    reportTbody.appendChild(tr);
  });
}

if (reportQuarterFilter) {
  reportQuarterFilter.addEventListener("change", () => {
    renderReportTable();
  });
}

// =========================
// KPI Dashboard
// =========================
async function loadDashboard() {
  if (!quarterSummary || !kpiTotalGoals || !kpiSheetStatus || !kpiTotalWeightage) return;

  try {
    const resp = await fetch(`${API_BASE_URL}/api/dashboard/summary`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();

    kpiTotalGoals.textContent = data.total_goals;
    kpiSheetStatus.textContent = prettyStatus(data.sheet_status);
    kpiTotalWeightage.textContent = `${data.total_weightage}%`;

    quarterSummary.innerHTML = "";

    data.quarters.forEach((q) => {
      const div = document.createElement("div");
      const percent = q.completion_percent;

      let colorClass = "red";
      if (percent >= 80) {
        colorClass = "green";
      } else if (percent >= 50) {
        colorClass = "amber";
      }

      div.className = `quarter-card ${colorClass}`;
      const percentText = percent.toFixed(1);

      div.innerHTML = `
        <div class="quarter-title">${q.quarter}</div>
        <div class="quarter-text">
          ${q.goals_with_updates} of ${q.total_goals} goals have updates (${percentText}%)
        </div>
        <div class="progress">
          <div class="progress-fill" style="width: ${percent}%;"></div>
        </div>
      `;

      quarterSummary.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    quarterSummary.innerHTML =
      "<div class='quarter-card'><div class='quarter-text'>Failed to load dashboard.</div></div>";
  }
}

// =========================
// Goal-wise Quarterly Breakdown
// =========================
async function loadGoalQuarterBreakdown() {
  if (!goalQuarterBreakdown) return;

  goalQuarterBreakdown.innerHTML = "<p>Loading goal-wise quarterly breakdown...</p>";

  try {
    const resp = await fetch(`${API_BASE_URL}/api/goals`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const goals = await resp.json();

    if (!goals || goals.length === 0) {
      goalQuarterBreakdown.innerHTML = "<p>No goals added yet.</p>";
      return;
    }

    const quarterOrder = ["Q1", "Q2", "Q3", "Q4"];
    goalQuarterBreakdown.innerHTML = "";

    goals.forEach((g) => {
      const wrapper = document.createElement("div");
      wrapper.className = "card";
      wrapper.style.marginBottom = "12px";
      wrapper.style.padding = "14px 16px";

      let quarterCardsHtml = "";

      quarterOrder.forEach((quarter) => {
        const ach = (g.achievements || []).find((item) => item.quarter === quarter);

        let actualText = "No update";
        let statusText = "Not Started";
        let scoreText = "N/A";
        let progressPercent = 0;
        let colorClass = "red";

        if (ach) {
          actualText = ach.actual_achievement;
          statusText = ach.status;

          if (ach.progress_score !== null && ach.progress_score !== undefined) {
            scoreText = ach.progress_score.toFixed(1);
            progressPercent = Math.min(ach.progress_score, 100);
          } else {
            if (ach.status === "Completed") {
              progressPercent = 100;
            } else if (ach.status === "On Track") {
              progressPercent = 60;
            } else {
              progressPercent = 0;
            }
          }

          if (progressPercent >= 80) {
            colorClass = "green";
          } else if (progressPercent >= 50) {
            colorClass = "amber";
          }
        }

        quarterCardsHtml += `
          <div class="quarter-card ${colorClass}">
            <div class="quarter-title">${quarter}</div>
            <div class="quarter-text">Actual: ${escapeHtml(actualText)}</div>
            <div class="quarter-text">Status: ${escapeHtml(statusText)}</div>
            <div class="quarter-text">Score: ${escapeHtml(scoreText)}</div>
            <div class="progress">
              <div class="progress-fill" style="width: ${progressPercent}%;"></div>
            </div>
          </div>
        `;
      });

      wrapper.innerHTML = `
        <h3 style="margin-bottom: 6px;">${escapeHtml(g.title)}</h3>
        <p style="font-size: 13px; margin-bottom: 10px;">
          <strong>Thrust Area:</strong> ${escapeHtml(g.thrust_area)} |
          <strong>Weightage:</strong> ${g.weightage}% |
          <strong>UoM:</strong> ${escapeHtml(g.uom)} |
          <strong>Target:</strong> ${g.target}
        </p>
        <div class="quarter-row">
          ${quarterCardsHtml}
        </div>
      `;

      goalQuarterBreakdown.appendChild(wrapper);
    });
  } catch (err) {
    console.error(err);
    goalQuarterBreakdown.innerHTML = "<p>Failed to load goal-wise quarterly breakdown.</p>";
  }
}

// =========================
// Escalations
// =========================
async function loadEscalations() {
  if (employeeEscalationList) {
    employeeEscalationList.innerHTML = "<p>Loading escalations...</p>";
  }
  if (escalationTbody) {
    escalationTbody.innerHTML = "<tr><td colspan='9'>Loading...</td></tr>";
  }

  try {
    const resp = await fetch(`${API_BASE_URL}/api/escalations`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const rows = await resp.json();

    // Employee read-only list
    if (employeeEscalationList) {
      if (!rows || rows.length === 0) {
        employeeEscalationList.innerHTML = "<p>No escalations raised yet.</p>";
      } else {
        employeeEscalationList.innerHTML = rows
          .map((item) => {
            const statusClass = getEscalationStatusClass(item.status);
            return `
              <div class="quarter-card ${statusClass}" style="margin-bottom: 10px;">
                <div class="quarter-title">Goal ${item.goal_id}: ${escapeHtml(item.goal_title)}</div>
                <div class="quarter-text">Quarter: ${escapeHtml(item.quarter)}</div>
                <div class="quarter-text">Severity: ${escapeHtml(item.severity)}</div>
                <div class="quarter-text">Owner: ${escapeHtml(item.owner)}</div>
                <div class="quarter-text">Deadline: ${escapeHtml(item.deadline)}</div>
                <div class="quarter-text">Status: ${escapeHtml(item.status)}</div>
                <div class="quarter-text">Reason: ${escapeHtml(item.reason)}</div>
                <div class="quarter-text">Comment: ${escapeHtml(item.comment || "—")}</div>
              </div>
            `;
          })
          .join("");
      }
    }

    // Manager/Admin tracker table
    if (escalationTbody) {
      if (!rows || rows.length === 0) {
        escalationTbody.innerHTML = "<tr><td colspan='9'>No escalations yet.</td></tr>";
      } else {
        escalationTbody.innerHTML = "";

        rows.forEach((item) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${item.id}</td>
            <td>${escapeHtml(item.goal_title)}</td>
            <td>${escapeHtml(item.quarter)}</td>
            <td>${escapeHtml(item.severity)}</td>
            <td>${escapeHtml(item.owner)}</td>
            <td>${escapeHtml(item.deadline)}</td>
            <td>${escapeHtml(item.status)}</td>
            <td>${escapeHtml(item.reason)}</td>
            <td>${escapeHtml(item.comment || "—")}</td>
          `;
          escalationTbody.appendChild(tr);
        });
      }
    }
  } catch (err) {
    console.error(err);
    if (employeeEscalationList) {
      employeeEscalationList.innerHTML = "<p>Failed to load escalations.</p>";
    }
    if (escalationTbody) {
      escalationTbody.innerHTML = "<tr><td colspan='9'>Failed to load escalations.</td></tr>";
    }
  }
}

if (escalationForm) {
  escalationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    escalationError.textContent = "";

    const goal_id = parseInt(escalationGoalSelect.value, 10);
    const quarter = escalationQuarterSelect.value;
    const severity = escalationSeveritySelect.value;
    const owner = escalationOwnerInput.value.trim();
    const deadline = escalationDeadlineInput.value;
    const reason = escalationReasonInput.value.trim();
    const comment = escalationCommentInput.value.trim();

    if (isNaN(goal_id) || !quarter || !severity || !owner || !deadline || !reason) {
      escalationError.textContent = "Please fill all escalation fields.";
      return;
    }

    const payload = {
      goal_id,
      quarter,
      reason,
      severity,
      owner,
      deadline,
      comment: comment || null,
    };

    try {
      const resp = await fetch(`${API_BASE_URL}/api/escalations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null);
        const detail = errBody && errBody.detail ? errBody.detail : `HTTP ${resp.status}`;
        escalationError.textContent = detail;
        return;
      }

      await resp.json();
      escalationForm.reset();

      loadEscalations();
      loadAudit();
    } catch (err) {
      console.error(err);
      escalationError.textContent = "Failed to create escalation.";
    }
  });
}

// =========================
// Analytics
// =========================
async function loadAnalytics() {
  if (!analyticsThrustArea || !analyticsUom || !analyticsQuarterScores) return;

  analyticsThrustArea.textContent = "Loading...";
  analyticsUom.textContent = "Loading...";
  analyticsQuarterScores.textContent = "Loading...";

  try {
    const resp = await fetch(`${API_BASE_URL}/api/analytics/summary`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();

    analyticsThrustArea.innerHTML = "";
    if (data.goals_by_thrust_area.length === 0) {
      analyticsThrustArea.textContent = "No goals yet.";
    } else {
      const maxCount = Math.max(...data.goals_by_thrust_area.map((item) => item.count));

      data.goals_by_thrust_area.forEach((item) => {
        const row = document.createElement("div");
        row.className = "analytics-row";

        const label = document.createElement("div");
        label.className = "analytics-label";
        label.textContent = item.label;

        const bar = document.createElement("div");
        bar.className = "analytics-bar";

        const fill = document.createElement("div");
        fill.className = "analytics-bar-fill";
        const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        fill.style.width = `${pct}%`;

        bar.appendChild(fill);

        const value = document.createElement("div");
        value.className = "analytics-value";
        value.textContent = item.count;

        row.appendChild(label);
        row.appendChild(bar);
        row.appendChild(value);
        analyticsThrustArea.appendChild(row);
      });
    }

    analyticsUom.innerHTML = "";
    if (data.goals_by_uom.length === 0) {
      analyticsUom.textContent = "No goals yet.";
    } else {
      const maxCountUom = Math.max(...data.goals_by_uom.map((item) => item.count));

      data.goals_by_uom.forEach((item) => {
        const row = document.createElement("div");
        row.className = "analytics-row";

        const label = document.createElement("div");
        label.className = "analytics-label";
        label.textContent = item.label;

        const bar = document.createElement("div");
        bar.className = "analytics-bar";

        const fill = document.createElement("div");
        fill.className = "analytics-bar-fill";
        const pct = maxCountUom > 0 ? (item.count / maxCountUom) * 100 : 0;
        fill.style.width = `${pct}%`;

        bar.appendChild(fill);

        const value = document.createElement("div");
        value.className = "analytics-value";
        value.textContent = item.count;

        row.appendChild(label);
        row.appendChild(bar);
        row.appendChild(value);
        analyticsUom.appendChild(row);
      });
    }

    analyticsQuarterScores.innerHTML = "";
    const maxScore = 100;

    data.quarter_scores.forEach((qs) => {
      const row = document.createElement("div");
      row.className = "analytics-row";

      const label = document.createElement("div");
      label.className = "analytics-label";
      label.textContent = qs.quarter;

      const bar = document.createElement("div");
      bar.className = "analytics-bar";

      const fill = document.createElement("div");
      fill.className = "analytics-bar-fill";

      let pct = 0;
      let valueText = "–";

      if (qs.average_score !== null && qs.average_score !== undefined) {
        const clamped = Math.min(qs.average_score, maxScore);
        pct = (clamped / maxScore) * 100;
        valueText = `${qs.average_score.toFixed(1)}`;
      }

      fill.style.width = `${pct}%`;
      bar.appendChild(fill);

      const value = document.createElement("div");
      value.className = "analytics-value";
      value.textContent = valueText;

      row.appendChild(label);
      row.appendChild(bar);
      row.appendChild(value);
      analyticsQuarterScores.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    analyticsThrustArea.textContent = "Failed to load analytics.";
    analyticsUom.textContent = "Failed to load analytics.";
    analyticsQuarterScores.textContent = "Failed to load analytics.";
  }
}

// =========================
// Audit log
// =========================
async function loadAudit() {
  if (!auditTbody) return;

  auditTbody.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";

  try {
    const resp = await fetch(`${API_BASE_URL}/api/audit`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const rows = await resp.json();

    if (rows.length === 0) {
      auditTbody.innerHTML = "<tr><td colspan='7'>No audit entries yet.</td></tr>";
      return;
    }

    auditTbody.innerHTML = "";

    rows.forEach((e) => {
      const beforeTextParts = [];
      const afterTextParts = [];

      if (e.before_actual !== null && e.before_actual !== undefined) {
        beforeTextParts.push(`Actual: ${e.before_actual}`);
      }
      if (e.before_status) {
        beforeTextParts.push(`Status: ${e.before_status}`);
      }
      if (e.before_score !== null && e.before_score !== undefined) {
        beforeTextParts.push(`Score: ${Number(e.before_score).toFixed(1)}`);
      }

      if (e.after_actual !== null && e.after_actual !== undefined) {
        afterTextParts.push(`Actual: ${e.after_actual}`);
      }
      if (e.after_status) {
        afterTextParts.push(`Status: ${e.after_status}`);
      }
      if (e.after_score !== null && e.after_score !== undefined) {
        afterTextParts.push(`Score: ${Number(e.after_score).toFixed(1)}`);
      }

      const beforeText = beforeTextParts.join(", ") || "-";
      const afterText = afterTextParts.join(", ") || "-";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(e.timestamp)}</td>
        <td>${escapeHtml(e.actor)}</td>
        <td>${escapeHtml(e.action)}</td>
        <td>${e.goal_id}</td>
        <td>${escapeHtml(e.quarter || "-")}</td>
        <td>${escapeHtml(beforeText)}</td>
        <td>${escapeHtml(afterText)}</td>
      `;
      auditTbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    auditTbody.innerHTML = "<tr><td colspan='7'>Failed to load audit log.</td></tr>";
  }
}

// =========================
// Admin / HR actions
// =========================
if (adminUnlockButton) {
  adminUnlockButton.addEventListener("click", async () => {
    adminMessage.textContent = "";

    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/unlock-goal-sheet`, {
        method: "POST",
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null);
        const detail = errBody && errBody.detail ? errBody.detail : `HTTP ${resp.status}`;
        adminMessage.textContent = detail;
        return;
      }

      const data = await resp.json();
      adminMessage.textContent = data.message || "Goal sheet unlocked.";

      loadGoalSheet();
      loadDashboard();
      loadAudit();
      loadAnalytics();
    } catch (err) {
      console.error(err);
      adminMessage.textContent = "Failed to unlock goal sheet.";
    }
  });
}

if (adminResetButton) {
  adminResetButton.addEventListener("click", async () => {
    adminMessage.textContent = "";

    const ok = window.confirm(
      "Are you sure you want to reset all goals and data for this employee? This cannot be undone."
    );
    if (!ok) return;

    try {
      const resp = await fetch(`${API_BASE_URL}/api/admin/reset-employee`, {
        method: "POST",
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null);
        const detail = errBody && errBody.detail ? errBody.detail : `HTTP ${resp.status}`;
        adminMessage.textContent = detail;
        return;
      }

      const data = await resp.json();
      adminMessage.textContent = data.message || "Employee data reset.";

      loadGoals();
      loadGoalSheet();
      loadReport();
      loadDashboard();
      loadGoalQuarterBreakdown();
      loadEscalations();
      loadAudit();
      loadAnalytics();
    } catch (err) {
      console.error(err);
      adminMessage.textContent = "Failed to reset employee data.";
    }
  });
}

// =========================
// CSV download
// =========================
if (downloadCsvButton) {
  downloadCsvButton.addEventListener("click", () => {
    window.location.href = `${API_BASE_URL}/api/report/achievement-csv`;
  });
}

const API_BASE_URL = ""