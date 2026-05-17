from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
import io
import csv
import datetime
import sqlite3


app = FastAPI(
    title="AtomQuest Goal Portal",
    description="In-house Goal Setting & Tracking Portal backend",
)

origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "null",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "atomquest.db"
QuarterType = Literal["Q1", "Q2", "Q3", "Q4"]


# -----------------------------
# Models
# -----------------------------
class GoalCreate(BaseModel):
    thrust_area: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    uom: Literal["Numeric", "%", "Timeline", "Zero"]
    target: float = Field(..., gt=0)
    weightage: int = Field(..., ge=10, le=100)


class QuarterlyAchievement(BaseModel):
    quarter: QuarterType
    actual_achievement: float = Field(..., ge=0)
    status: Literal["Not Started", "On Track", "Completed"]
    progress_score: Optional[float] = None


class Goal(GoalCreate):
    id: int
    achievements: List[QuarterlyAchievement] = Field(default_factory=list)


class GoalSheet(BaseModel):
    status: Literal["draft", "submitted", "approved", "rework"]
    manager_comment: Optional[str] = None
    total_weightage: int


class ManagerDecision(BaseModel):
    action: Literal["approve", "rework"]
    comment: Optional[str] = None


class AchievementUpdate(BaseModel):
    quarter: QuarterType
    actual_achievement: float = Field(..., ge=0)
    status: Literal["Not Started", "On Track", "Completed"]


class ReportRow(BaseModel):
    goal_id: int
    thrust_area: str
    title: str
    uom: str
    weightage: int
    target: float
    quarter: str
    actual_achievement: float
    status: str
    progress_score: Optional[float]


class QuarterSummary(BaseModel):
    quarter: QuarterType
    goals_with_updates: int
    total_goals: int
    completion_percent: float


class DashboardSummary(BaseModel):
    total_goals: int
    sheet_status: str
    total_weightage: int
    quarters: List[QuarterSummary]


class AnalyticsCount(BaseModel):
    label: str
    count: int


class QuarterScore(BaseModel):
    quarter: QuarterType
    average_score: Optional[float]
    sample_size: int


class AnalyticsSummary(BaseModel):
    goals_by_thrust_area: List[AnalyticsCount]
    goals_by_uom: List[AnalyticsCount]
    quarter_scores: List[QuarterScore]


class AuditEntry(BaseModel):
    timestamp: str
    actor: str
    action: str
    goal_id: int
    quarter: Optional[QuarterType] = None
    before_actual: Optional[float] = None
    after_actual: Optional[float] = None
    before_status: Optional[str] = None
    after_status: Optional[str] = None
    before_score: Optional[float] = None
    after_score: Optional[float] = None


class EscalationCreate(BaseModel):
    goal_id: int
    quarter: QuarterType
    reason: str = Field(..., min_length=3, max_length=300)
    severity: Literal["Low", "Medium", "High", "Critical"]
    owner: str = Field(..., min_length=1, max_length=100)
    deadline: str = Field(..., min_length=1, max_length=30)
    comment: Optional[str] = Field(default=None, max_length=300)


class EscalationUpdate(BaseModel):
    status: Literal["Open", "In Progress", "Resolved", "Closed"]
    comment: Optional[str] = Field(default=None, max_length=300)
    owner: Optional[str] = Field(default=None, max_length=100)
    deadline: Optional[str] = Field(default=None, max_length=30)


class EscalationRecord(BaseModel):
    id: int
    goal_id: int
    goal_title: str
    quarter: QuarterType
    reason: str
    severity: str
    owner: str
    deadline: str
    status: str
    comment: Optional[str] = None
    created_at: str
    updated_at: str


# -----------------------------
# DB helpers
# -----------------------------
def now_iso() -> str:
    return datetime.datetime.now().isoformat(timespec="seconds")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thrust_area TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            uom TEXT NOT NULL,
            target REAL NOT NULL,
            weightage INTEGER NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            goal_id INTEGER NOT NULL,
            quarter TEXT NOT NULL,
            actual_achievement REAL NOT NULL,
            status TEXT NOT NULL,
            progress_score REAL,
            UNIQUE(goal_id, quarter),
            FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS goal_sheet (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            status TEXT NOT NULL,
            manager_comment TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            goal_id INTEGER NOT NULL,
            quarter TEXT,
            before_actual REAL,
            after_actual REAL,
            before_status TEXT,
            after_status TEXT,
            before_score REAL,
            after_score REAL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS escalations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            goal_id INTEGER NOT NULL,
            quarter TEXT NOT NULL,
            reason TEXT NOT NULL,
            severity TEXT NOT NULL,
            owner TEXT NOT NULL,
            deadline TEXT NOT NULL,
            status TEXT NOT NULL,
            comment TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
        )
    """)

    cur.execute("""
        INSERT OR IGNORE INTO goal_sheet (id, status, manager_comment)
        VALUES (1, 'draft', NULL)
    """)

    conn.commit()
    conn.close()


@app.on_event("startup")
def on_startup():
    init_db()


def get_total_weightage(conn) -> int:
    row = conn.execute("SELECT COALESCE(SUM(weightage), 0) AS total FROM goals").fetchone()
    return int(row["total"])


def get_goal_sheet_state(conn):
    row = conn.execute(
        "SELECT status, manager_comment FROM goal_sheet WHERE id = 1"
    ).fetchone()
    if row is None:
        conn.execute(
            "INSERT INTO goal_sheet (id, status, manager_comment) VALUES (1, 'draft', NULL)"
        )
        conn.commit()
        return "draft", None
    return row["status"], row["manager_comment"]


def compute_progress_score(uom: str, target: float, actual: float) -> Optional[float]:
    if uom in ("Numeric", "%"):
        if target <= 0:
            return None
        score = (actual / target) * 100
        return max(0.0, min(score, 200.0))
    elif uom == "Zero":
        return 100.0 if actual == 0 else 0.0
    elif uom == "Timeline":
        return None
    return None


def log_audit(
    conn,
    actor: str,
    action: str,
    goal_id: int,
    quarter: Optional[str] = None,
    before_actual: Optional[float] = None,
    after_actual: Optional[float] = None,
    before_status: Optional[str] = None,
    after_status: Optional[str] = None,
    before_score: Optional[float] = None,
    after_score: Optional[float] = None,
):
    conn.execute(
        """
        INSERT INTO audit_log (
            timestamp, actor, action, goal_id, quarter,
            before_actual, after_actual, before_status, after_status,
            before_score, after_score
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            now_iso(),
            actor,
            action,
            goal_id,
            quarter,
            before_actual,
            after_actual,
            before_status,
            after_status,
            before_score,
            after_score,
        ),
    )


def get_achievements_for_goal(conn, goal_id: int) -> List[QuarterlyAchievement]:
    rows = conn.execute(
        """
        SELECT quarter, actual_achievement, status, progress_score
        FROM achievements
        WHERE goal_id = ?
        ORDER BY CASE quarter
            WHEN 'Q1' THEN 1
            WHEN 'Q2' THEN 2
            WHEN 'Q3' THEN 3
            WHEN 'Q4' THEN 4
            ELSE 99
        END
        """,
        (goal_id,),
    ).fetchall()

    return [
        QuarterlyAchievement(
            quarter=row["quarter"],
            actual_achievement=row["actual_achievement"],
            status=row["status"],
            progress_score=row["progress_score"],
        )
        for row in rows
    ]


def build_goal(conn, row) -> Goal:
    return Goal(
        id=row["id"],
        thrust_area=row["thrust_area"],
        title=row["title"],
        description=row["description"],
        uom=row["uom"],
        target=row["target"],
        weightage=row["weightage"],
        achievements=get_achievements_for_goal(conn, row["id"]),
    )


def fetch_goal_row(conn, goal_id: int):
    return conn.execute("SELECT * FROM goals WHERE id = ?", (goal_id,)).fetchone()


def get_report_rows_from_db(conn) -> List[ReportRow]:
    rows = conn.execute(
        """
        SELECT
            g.id AS goal_id,
            g.thrust_area,
            g.title,
            g.uom,
            g.weightage,
            g.target,
            a.quarter,
            a.actual_achievement,
            a.status,
            a.progress_score
        FROM goals g
        JOIN achievements a ON a.goal_id = g.id
        ORDER BY g.id,
                 CASE a.quarter
                    WHEN 'Q1' THEN 1
                    WHEN 'Q2' THEN 2
                    WHEN 'Q3' THEN 3
                    WHEN 'Q4' THEN 4
                    ELSE 99
                 END
        """
    ).fetchall()

    return [
        ReportRow(
            goal_id=row["goal_id"],
            thrust_area=row["thrust_area"],
            title=row["title"],
            uom=row["uom"],
            weightage=row["weightage"],
            target=row["target"],
            quarter=row["quarter"],
            actual_achievement=row["actual_achievement"],
            status=row["status"],
            progress_score=row["progress_score"],
        )
        for row in rows
    ]


def build_escalation_record(row) -> EscalationRecord:
    return EscalationRecord(
        id=row["id"],
        goal_id=row["goal_id"],
        goal_title=row["goal_title"],
        quarter=row["quarter"],
        reason=row["reason"],
        severity=row["severity"],
        owner=row["owner"],
        deadline=row["deadline"],
        status=row["status"],
        comment=row["comment"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


# -----------------------------
# Basic test endpoints
# -----------------------------
@app.get("/")
def read_root():
    return {"message": "AtomQuest Goal Portal API is running"}


@app.get("/api/ping")
def ping():
    return {"status": "ok", "message": "Ping from backend"}


# -----------------------------
# Employee goals
# -----------------------------
@app.get("/api/goals", response_model=List[Goal])
def list_goals():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM goals ORDER BY id").fetchall()
    goals = [build_goal(conn, row) for row in rows]
    conn.close()
    return goals


@app.post("/api/goals", response_model=Goal)
def create_goal(goal_in: GoalCreate):
    conn = get_conn()

    sheet_status, _ = get_goal_sheet_state(conn)
    if sheet_status not in ("draft", "rework"):
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Goal sheet is not editable in status '{sheet_status}'.",
        )

    row = conn.execute("SELECT COUNT(*) AS count FROM goals").fetchone()
    if row["count"] >= 8:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Maximum 8 goals allowed for an employee",
        )

    current_total = get_total_weightage(conn)
    new_total = current_total + goal_in.weightage
    if new_total > 100:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Total weightage would become {new_total}%, which exceeds 100%. Adjust weights.",
        )

    cur = conn.execute(
        """
        INSERT INTO goals (thrust_area, title, description, uom, target, weightage)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            goal_in.thrust_area,
            goal_in.title,
            goal_in.description,
            goal_in.uom,
            goal_in.target,
            goal_in.weightage,
        ),
    )
    conn.commit()

    goal_row = fetch_goal_row(conn, cur.lastrowid)
    goal = build_goal(conn, goal_row)
    conn.close()
    return goal


# -----------------------------
# Goal sheet & manager actions
# -----------------------------
@app.get("/api/goal-sheet", response_model=GoalSheet)
def get_goal_sheet():
    conn = get_conn()
    status, manager_comment = get_goal_sheet_state(conn)
    total = get_total_weightage(conn)
    conn.close()

    return GoalSheet(
        status=status,
        manager_comment=manager_comment,
        total_weightage=total,
    )


@app.post("/api/goal-sheet/submit", response_model=GoalSheet)
def submit_goal_sheet():
    conn = get_conn()

    row = conn.execute("SELECT COUNT(*) AS count FROM goals").fetchone()
    if row["count"] == 0:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Add at least one goal before submitting.",
        )

    total = get_total_weightage(conn)
    if total != 100:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Total weightage is {total}%. It must be exactly 100% to submit.",
        )

    conn.execute(
        "UPDATE goal_sheet SET status = ?, manager_comment = ? WHERE id = 1",
        ("submitted", None),
    )
    conn.commit()
    conn.close()

    return GoalSheet(
        status="submitted",
        manager_comment=None,
        total_weightage=total,
    )


@app.post("/api/manager/decision", response_model=GoalSheet)
def manager_decision(decision: ManagerDecision):
    conn = get_conn()

    old_status, _ = get_goal_sheet_state(conn)
    if old_status != "submitted":
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Can only take a decision on submitted goal sheets.",
        )

    comment = decision.comment or (
        "Approved." if decision.action == "approve" else "Sent back for rework."
    )
    new_status = "approved" if decision.action == "approve" else "rework"

    conn.execute(
        "UPDATE goal_sheet SET status = ?, manager_comment = ? WHERE id = 1",
        (new_status, comment),
    )

    log_audit(
        conn,
        actor="manager",
        action=f"manager_{decision.action}",
        goal_id=0,
        quarter=None,
        before_status=old_status,
        after_status=new_status,
    )

    conn.commit()
    total = get_total_weightage(conn)
    conn.close()

    return GoalSheet(
        status=new_status,
        manager_comment=comment,
        total_weightage=total,
    )


# -----------------------------
# Achievement tracking
# -----------------------------
@app.post("/api/goals/{goal_id}/achievement", response_model=Goal)
def update_achievement(goal_id: int, update: AchievementUpdate):
    conn = get_conn()

    goal_row = fetch_goal_row(conn, goal_id)
    if goal_row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Goal not found")

    existing = conn.execute(
        """
        SELECT actual_achievement, status, progress_score
        FROM achievements
        WHERE goal_id = ? AND quarter = ?
        """,
        (goal_id, update.quarter),
    ).fetchone()

    old_actual = existing["actual_achievement"] if existing else None
    old_status = existing["status"] if existing else None
    old_score = existing["progress_score"] if existing else None

    new_score = compute_progress_score(
        goal_row["uom"], goal_row["target"], update.actual_achievement
    )

    if existing:
        conn.execute(
            """
            UPDATE achievements
            SET actual_achievement = ?, status = ?, progress_score = ?
            WHERE goal_id = ? AND quarter = ?
            """,
            (
                update.actual_achievement,
                update.status,
                new_score,
                goal_id,
                update.quarter,
            ),
        )
    else:
        conn.execute(
            """
            INSERT INTO achievements (goal_id, quarter, actual_achievement, status, progress_score)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                goal_id,
                update.quarter,
                update.actual_achievement,
                update.status,
                new_score,
            ),
        )

    log_audit(
        conn,
        actor="employee",
        action="update_achievement",
        goal_id=goal_id,
        quarter=update.quarter,
        before_actual=old_actual,
        after_actual=update.actual_achievement,
        before_status=old_status,
        after_status=update.status,
        before_score=old_score,
        after_score=new_score,
    )

    conn.commit()
    updated_goal_row = fetch_goal_row(conn, goal_id)
    goal = build_goal(conn, updated_goal_row)
    conn.close()
    return goal


# -----------------------------
# Achievement report
# -----------------------------
@app.get("/api/report/achievement", response_model=List[ReportRow])
def get_achievement_report():
    conn = get_conn()
    rows = get_report_rows_from_db(conn)
    conn.close()
    return rows


@app.get("/api/report/achievement-csv")
def download_achievement_report_csv():
    fieldnames = [
        "goal_id",
        "thrust_area",
        "title",
        "uom",
        "weightage",
        "target",
        "quarter",
        "actual_achievement",
        "status",
        "progress_score",
    ]

    conn = get_conn()
    report_rows = get_report_rows_from_db(conn)
    conn.close()

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for row in report_rows:
        writer.writerow(
            {
                "goal_id": row.goal_id,
                "thrust_area": row.thrust_area,
                "title": row.title,
                "uom": row.uom,
                "weightage": row.weightage,
                "target": row.target,
                "quarter": row.quarter,
                "actual_achievement": row.actual_achievement,
                "status": row.status,
                "progress_score": row.progress_score if row.progress_score is not None else "",
            }
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=achievement_report.csv"},
    )


# -----------------------------
# Dashboard summary
# -----------------------------
@app.get("/api/dashboard/summary", response_model=DashboardSummary)
def get_dashboard_summary():
    conn = get_conn()

    total_goals = conn.execute("SELECT COUNT(*) AS count FROM goals").fetchone()["count"]
    total_weight = get_total_weightage(conn)
    sheet_status, _ = get_goal_sheet_state(conn)

    quarters: List[QuarterSummary] = []
    for q in ["Q1", "Q2", "Q3", "Q4"]:
        goals_with_updates = conn.execute(
            "SELECT COUNT(DISTINCT goal_id) AS count FROM achievements WHERE quarter = ?",
            (q,),
        ).fetchone()["count"]

        completion_percent = (
            (goals_with_updates / total_goals) * 100.0 if total_goals > 0 else 0.0
        )

        quarters.append(
            QuarterSummary(
                quarter=q,
                goals_with_updates=goals_with_updates,
                total_goals=total_goals,
                completion_percent=completion_percent,
            )
        )

    conn.close()

    return DashboardSummary(
        total_goals=total_goals,
        sheet_status=sheet_status,
        total_weightage=total_weight,
        quarters=quarters,
    )


# -----------------------------
# Analytics summary
# -----------------------------
@app.get("/api/analytics/summary", response_model=AnalyticsSummary)
def get_analytics_summary():
    conn = get_conn()

    thrust_rows = conn.execute(
        """
        SELECT thrust_area AS label, COUNT(*) AS count
        FROM goals
        GROUP BY thrust_area
        ORDER BY count DESC, thrust_area
        """
    ).fetchall()

    goals_by_thrust_area = [
        AnalyticsCount(label=row["label"], count=row["count"])
        for row in thrust_rows
    ]

    uom_rows = conn.execute(
        """
        SELECT uom AS label, COUNT(*) AS count
        FROM goals
        GROUP BY uom
        ORDER BY count DESC, uom
        """
    ).fetchall()

    goals_by_uom = [
        AnalyticsCount(label=row["label"], count=row["count"])
        for row in uom_rows
    ]

    quarter_scores: List[QuarterScore] = []
    for q in ["Q1", "Q2", "Q3", "Q4"]:
        row = conn.execute(
            """
            SELECT AVG(progress_score) AS avg_score, COUNT(*) AS sample_size
            FROM achievements
            WHERE quarter = ? AND progress_score IS NOT NULL
            """,
            (q,),
        ).fetchone()

        quarter_scores.append(
            QuarterScore(
                quarter=q,
                average_score=row["avg_score"],
                sample_size=row["sample_size"],
            )
        )

    conn.close()

    return AnalyticsSummary(
        goals_by_thrust_area=goals_by_thrust_area,
        goals_by_uom=goals_by_uom,
        quarter_scores=quarter_scores,
    )


# -----------------------------
# Audit log
# -----------------------------
@app.get("/api/audit", response_model=List[AuditEntry])
def get_audit_log():
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT timestamp, actor, action, goal_id, quarter,
               before_actual, after_actual,
               before_status, after_status,
               before_score, after_score
        FROM audit_log
        ORDER BY id DESC
        """
    ).fetchall()
    conn.close()

    return [
        AuditEntry(
            timestamp=row["timestamp"],
            actor=row["actor"],
            action=row["action"],
            goal_id=row["goal_id"],
            quarter=row["quarter"],
            before_actual=row["before_actual"],
            after_actual=row["after_actual"],
            before_status=row["before_status"],
            after_status=row["after_status"],
            before_score=row["before_score"],
            after_score=row["after_score"],
        )
        for row in rows
    ]


# -----------------------------
# Escalation module
# -----------------------------
@app.get("/api/escalations", response_model=List[EscalationRecord])
def list_escalations():
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT
            e.id,
            e.goal_id,
            g.title AS goal_title,
            e.quarter,
            e.reason,
            e.severity,
            e.owner,
            e.deadline,
            e.status,
            e.comment,
            e.created_at,
            e.updated_at
        FROM escalations e
        JOIN goals g ON g.id = e.goal_id
        ORDER BY e.id DESC
        """
    ).fetchall()
    conn.close()

    return [build_escalation_record(row) for row in rows]


@app.post("/api/escalations", response_model=EscalationRecord)
def create_escalation(escalation_in: EscalationCreate):
    conn = get_conn()

    goal_row = fetch_goal_row(conn, escalation_in.goal_id)
    if goal_row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Goal not found")

    current_time = now_iso()
    cur = conn.execute(
        """
        INSERT INTO escalations (
            goal_id, quarter, reason, severity, owner, deadline,
            status, comment, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            escalation_in.goal_id,
            escalation_in.quarter,
            escalation_in.reason,
            escalation_in.severity,
            escalation_in.owner,
            escalation_in.deadline,
            "Open",
            escalation_in.comment,
            current_time,
            current_time,
        ),
    )

    log_audit(
        conn,
        actor="manager",
        action="create_escalation",
        goal_id=escalation_in.goal_id,
        quarter=escalation_in.quarter,
        before_status=None,
        after_status="Open",
    )

    conn.commit()

    row = conn.execute(
        """
        SELECT
            e.id,
            e.goal_id,
            g.title AS goal_title,
            e.quarter,
            e.reason,
            e.severity,
            e.owner,
            e.deadline,
            e.status,
            e.comment,
            e.created_at,
            e.updated_at
        FROM escalations e
        JOIN goals g ON g.id = e.goal_id
        WHERE e.id = ?
        """,
        (cur.lastrowid,),
    ).fetchone()

    conn.close()
    return build_escalation_record(row)


@app.patch("/api/escalations/{escalation_id}", response_model=EscalationRecord)
def update_escalation(escalation_id: int, update: EscalationUpdate):
    conn = get_conn()

    existing = conn.execute(
        """
        SELECT
            e.id,
            e.goal_id,
            g.title AS goal_title,
            e.quarter,
            e.reason,
            e.severity,
            e.owner,
            e.deadline,
            e.status,
            e.comment,
            e.created_at,
            e.updated_at
        FROM escalations e
        JOIN goals g ON g.id = e.goal_id
        WHERE e.id = ?
        """,
        (escalation_id,),
    ).fetchone()

    if existing is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Escalation not found")

    new_owner = update.owner if update.owner is not None else existing["owner"]
    new_deadline = update.deadline if update.deadline is not None else existing["deadline"]
    new_comment = update.comment if update.comment is not None else existing["comment"]
    new_status = update.status

    conn.execute(
        """
        UPDATE escalations
        SET owner = ?, deadline = ?, comment = ?, status = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            new_owner,
            new_deadline,
            new_comment,
            new_status,
            now_iso(),
            escalation_id,
        ),
    )

    log_audit(
        conn,
        actor="manager",
        action="update_escalation",
        goal_id=existing["goal_id"],
        quarter=existing["quarter"],
        before_status=existing["status"],
        after_status=new_status,
    )

    conn.commit()

    updated = conn.execute(
        """
        SELECT
            e.id,
            e.goal_id,
            g.title AS goal_title,
            e.quarter,
            e.reason,
            e.severity,
            e.owner,
            e.deadline,
            e.status,
            e.comment,
            e.created_at,
            e.updated_at
        FROM escalations e
        JOIN goals g ON g.id = e.goal_id
        WHERE e.id = ?
        """,
        (escalation_id,),
    ).fetchone()

    conn.close()
    return build_escalation_record(updated)


# -----------------------------
# Admin / HR actions
# -----------------------------
@app.post("/api/admin/unlock-goal-sheet")
def admin_unlock_goal_sheet():
    conn = get_conn()

    old_status, _ = get_goal_sheet_state(conn)
    if old_status == "draft":
        conn.close()
        return {"status": "draft", "message": "Sheet already in draft state."}

    conn.execute(
        "UPDATE goal_sheet SET status = ?, manager_comment = ? WHERE id = 1",
        ("draft", "Unlocked by Admin / HR"),
    )

    log_audit(
        conn,
        actor="admin",
        action="admin_unlock_goal_sheet",
        goal_id=0,
        quarter=None,
        before_status=old_status,
        after_status="draft",
    )

    conn.commit()
    conn.close()

    return {"status": "draft", "message": "Goal sheet unlocked by Admin."}


@app.post("/api/admin/reset-employee")
def admin_reset_employee():
    conn = get_conn()

    conn.execute("DELETE FROM achievements")
    conn.execute("DELETE FROM escalations")
    conn.execute("DELETE FROM goals")
    conn.execute("DELETE FROM audit_log")

    conn.execute(
        "DELETE FROM sqlite_sequence WHERE name IN ('goals', 'achievements', 'audit_log', 'escalations')"
    )

    conn.execute(
        "UPDATE goal_sheet SET status = ?, manager_comment = ? WHERE id = 1",
        ("draft", None),
    )

    conn.commit()
    conn.close()

    return {"message": "Employee data, escalations, and audit log reset by Admin."}

