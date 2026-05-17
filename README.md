# AtomQuest Goal Portal

A role-based goal management portal built for employee goal setting, quarterly tracking, manager approval, admin control, analytics, audit visibility, and escalation handling.

## Project Overview

AtomQuest Goal Portal is a full-stack web application designed to simulate a performance and goal tracking workflow inside an organization.

It supports:
- Employee goal creation
- Quarterly achievement updates
- Manager review and approval
- Admin/HR unlock and reset actions
- Analytics dashboard
- Audit log tracking
- Escalation tracking for delayed or critical goals

## Roles in the System

### Employee
- Add goals
- Submit goal sheet
- Update quarterly achievement
- View escalations raised against goals

### Manager (L1)
- Review employee goal sheet
- Approve goals or send back for rework
- View dashboard, analytics, reports, and goal-wise quarter breakdown
- Raise escalations

### Admin / HR
- View manager-level dashboard and reports
- Unlock goal sheet
- Reset employee data
- View audit log
- Track escalations

## Core Features

- Role-based UI switching
- Goal creation with thrust area, target, UoM, and weightage
- Goal sheet workflow: Draft -> Submitted -> Approved / Rework
- Quarterly progress tracking for Q1, Q2, Q3, Q4
- Achievement report with quarter filter
- KPI dashboard
- Goal-wise quarterly breakdown
- Analytics summary by thrust area, UoM, and quarter scores
- Audit trail for important actions
- Escalation module for manager intervention
- Dark mode toggle

## Tech Stack

### Frontend
- HTML
- CSS
- Vanilla JavaScript

### Backend
- FastAPI
- Python

### Data Layer
- SQLite

## Folder Structure

```text
atomquest-goal-portal/
├── README.md
├── demo_script.txt
├── backend/
│   └── main.py
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── styles.css
```

## How to Run the Project

### 1. Start backend

Open terminal inside the `backend` folder and run:

```bash
uvicorn main:app --reload
```

Backend should run on:

```text
http://127.0.0.1:8000
```

### 2. Start frontend

Open the `frontend` folder using Live Server in VS Code, or open `index.html` in a browser.

Suggested frontend URL:

```text
http://127.0.0.1:5500
```

## Main API Endpoints

- `GET /api/ping`
- `GET /api/goals`
- `POST /api/goals`
- `GET /api/goal-sheet`
- `POST /api/goal-sheet/submit`
- `POST /api/goals/{goal_id}/achievement`
- `POST /api/manager/decision`
- `GET /api/report/achievement`
- `GET /api/report/achievement-csv`
- `GET /api/dashboard/summary`
- `GET /api/analytics/summary`
- `GET /api/audit`
- `POST /api/admin/unlock-goal-sheet`
- `POST /api/admin/reset-employee`
- `GET /api/escalations`
- `POST /api/escalations`

## BRD Mapping

| BRD Requirement | Implemented Feature |
|---|---|
| Employee can create goals | Goal creation form |
| Goal sheet submission workflow | Submit to manager button + manager decision |
| Quarterly achievement tracking | Quarterly Achievement Update form |
| Quarter-wise reporting | Achievement report + quarter filter |
| Goal visibility to manager/admin | Dashboard + report + breakdown |
| Approval and rework flow | Manager approve / send back |
| Admin intervention | Unlock and reset buttons |
| Performance insights | KPI dashboard + analytics |
| Auditability | Audit log |
| Escalation support | Escalation module |

## Workflow Summary

1. Employee creates goals.
2. Employee submits goal sheet to manager.
3. Manager reviews and either approves or sends back for rework.
4. Employee updates quarterly achievements.
5. Manager and admin monitor progress through dashboard, reports, analytics, and audit logs.
6. Manager raises escalation if any goal needs intervention.

## Notes

- This project is built for demo and evaluation purposes.
- Current implementation uses local backend + frontend setup.
- UI includes role-based sections for Employee, Manager, and Admin / HR.
- Dark mode support is included.

## Demo Highlights

- Goal creation and weightage validation
- Quarterly progress updates
- Achievement report and CSV export
- Manager approval flow
- Admin reset/unlock flow
- Escalation tracker
- Analytics and audit log

## Future Improvements

- Authentication and real login system
- Multi-employee support
- Better chart visualizations
- Notifications
- Persistent deployment
- Improved UI/UX and responsive polish