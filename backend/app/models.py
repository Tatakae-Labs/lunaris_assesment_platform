from datetime import datetime, timezone
import json
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base, generate_uuid

def utcnow():
    return datetime.now(timezone.utc)

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    plan_id = Column(String(50), default="free")
    status = Column(String(50), default="active")  # active, suspended
    ai_generation_credits = Column(Integer, default=50)
    proctoring_attempts_quota = Column(Integer, default=25)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="organization", cascade="all, delete-orphan")
    question_banks = relationship("QuestionBank", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    status = Column(String(50), default="active")
    is_superadmin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    memberships = relationship("OrganizationMember", back_populates="user", cascade="all, delete-orphan")
    assignments = relationship("ExamAssignment", back_populates="candidate", cascade="all, delete-orphan")


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(50), default="candidate")  # owner, admin, exam_author, proctor, candidate
    created_at = Column(DateTime(timezone=True), default=utcnow)

    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="memberships")


class QuestionBank(Base):
    __tablename__ = "question_banks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    subject = Column(String(100), nullable=True)  # Physics, Chemistry, Mathematics
    created_at = Column(DateTime(timezone=True), default=utcnow)

    organization = relationship("Organization", back_populates="question_banks")
    questions = relationship("Question", back_populates="bank", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    bank_id = Column(String(36), ForeignKey("question_banks.id"), nullable=True, index=True)
    subject = Column(String(50), nullable=False)  # Physics, Chemistry, Mathematics
    question_type = Column(String(50), nullable=False)  # single_mcq, multi_mcq, numerical
    content_json = Column(Text, nullable=False)  # { text, options: [{id, text}], correct: [...], numerical_range: [min, max] }
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    bank = relationship("QuestionBank", back_populates="questions")
    revisions = relationship("QuestionRevision", back_populates="question", cascade="all, delete-orphan")


class QuestionRevision(Base):
    """Historical audit revisions for questions in item banks."""
    __tablename__ = "question_revisions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    question_id = Column(String(36), ForeignKey("questions.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    content_json = Column(Text, nullable=False)
    change_summary = Column(String(255), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    question = relationship("Question", back_populates="revisions")


class Exam(Base):
    __tablename__ = "exams"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    mode = Column(String(50), default="proctored_cbt")  # standard_quiz, quick_quiz, proctored_cbt
    room_code = Column(String(10), unique=True, index=True, nullable=True)  # For Kahoot/Quizinco-style joining
    per_question_time_seconds = Column(Integer, default=30)  # For Quick Quiz mode
    speed_scoring = Column(Boolean, default=False)  # Bonus points for speed
    duration_minutes = Column(Integer, nullable=False)
    status = Column(String(50), default="draft")  # draft, published, archived
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    results_released = Column(Boolean, default=False)
    settings_json = Column(Text, nullable=True)  # Marking schemes, sections, shuffle options
    created_at = Column(DateTime(timezone=True), default=utcnow)

    organization = relationship("Organization", back_populates="exams")
    versions = relationship("ExamVersion", back_populates="exam", cascade="all, delete-orphan")


class ExamVersion(Base):
    """Immutable snapshot of an exam upon publishing."""
    __tablename__ = "exam_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    mode = Column(String(50), default="proctored_cbt")
    room_code = Column(String(10), nullable=True)
    per_question_time_seconds = Column(Integer, default=30)
    speed_scoring = Column(Boolean, default=False)
    duration_minutes = Column(Integer, nullable=False)
    settings_json = Column(Text, nullable=False)
    snapshot_json = Column(Text, nullable=False)  # Full questions and scoring scheme snapshot
    results_released = Column(Boolean, default=False)
    published_at = Column(DateTime(timezone=True), default=utcnow)

    exam = relationship("Exam", back_populates="versions")
    assignments = relationship("ExamAssignment", back_populates="exam_version", cascade="all, delete-orphan")


class AIQuestionDraft(Base):
    __tablename__ = "ai_question_drafts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    topic = Column(String(255), nullable=False)
    subject = Column(String(100), nullable=False)
    difficulty = Column(String(50), default="medium")
    question_type = Column(String(50), default="single_mcq")
    content_json = Column(Text, nullable=False)
    status = Column(String(50), default="draft")  # draft, approved, rejected
    created_at = Column(DateTime(timezone=True), default=utcnow)


class ExamAssignment(Base):
    __tablename__ = "exam_assignments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    exam_version_id = Column(String(36), ForeignKey("exam_versions.id"), nullable=False, index=True)
    candidate_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    invite_token = Column(String(64), unique=True, index=True, nullable=False)
    opens_at = Column(DateTime(timezone=True), nullable=False)
    closes_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    exam_version = relationship("ExamVersion", back_populates="assignments")
    candidate = relationship("User", back_populates="assignments")
    attempts = relationship("ExamAttempt", back_populates="assignment", cascade="all, delete-orphan")


class Plan(Base):
    __tablename__ = "plans"

    id = Column(String(50), primary_key=True)  # "free", "creator_pro", "institution"
    name = Column(String(255), nullable=False)
    price_inr = Column(Integer, default=0)
    billing_period = Column(String(50), default="monthly")
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    entitlements = relationship("PlanEntitlement", back_populates="plan", cascade="all, delete-orphan")


class PlanEntitlement(Base):
    __tablename__ = "plan_entitlements"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    plan_id = Column(String(50), ForeignKey("plans.id"), nullable=False, index=True)
    key = Column(String(100), nullable=False)  # max_candidates, max_exams, ai_questions, proctoring_enabled
    value = Column(String(255), nullable=False)

    plan = relationship("Plan", back_populates="entitlements")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    plan_id = Column(String(50), ForeignKey("plans.id"), nullable=False, index=True)
    status = Column(String(50), default="active")  # active, past_due, canceled
    current_period_start = Column(DateTime(timezone=True), default=utcnow)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    trial_end = Column(DateTime(timezone=True), nullable=True)
    grace_period_end = Column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class PaymentEvent(Base):
    __tablename__ = "payment_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    provider = Column(String(50), default="stripe")
    event_id = Column(String(255), unique=True, index=True, nullable=False)
    event_type = Column(String(100), nullable=False)
    amount_inr = Column(Integer, default=0)
    payload_json = Column(Text, nullable=True)
    verified = Column(Boolean, default=False)  # Set True only after HMAC signature verification
    created_at = Column(DateTime(timezone=True), default=utcnow)


class UsageLedger(Base):
    __tablename__ = "usage_ledger"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    metric = Column(String(100), nullable=False)  # ai_questions, proctored_attempts, candidates_enrolled
    quantity = Column(Integer, default=1)
    reference_id = Column(String(255), nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=utcnow)


class ExamEnrollment(Base):
    """Candidate enrollment for exams without permanent account required."""
    __tablename__ = "exam_enrollments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    exam_id = Column(String(36), ForeignKey("exams.id"), nullable=False, index=True)
    exam_version_id = Column(String(36), ForeignKey("exam_versions.id"), nullable=True, index=True)
    candidate_uid = Column(String(64), index=True, nullable=False)  # e.g., "LUN-2026-9041"
    access_pin_hash = Column(String(255), nullable=True)
    # DEPRECATED: access_pin_plain stores PIN in cleartext. Do not use in new code.
    # Schedule removal after migration strips column from existing rows.
    access_pin_plain = Column(String(32), nullable=True)  # Legacy export; hash only going forward
    candidate_name = Column(String(255), nullable=False)
    candidate_email = Column(String(255), nullable=True)
    max_attempts = Column(Integer, default=1)
    attempts_used = Column(Integer, default=0)
    status = Column(String(50), default="active")  # active, revoked, expired, completed
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    sessions = relationship("CandidateSession", back_populates="enrollment", cascade="all, delete-orphan")
    attempts = relationship("ExamAttempt", back_populates="enrollment", cascade="all, delete-orphan")
    exam = relationship("Exam", backref="enrollments")


class CandidateSession(Base):
    """Short-lived, exam-scoped session for enrolled candidates."""
    __tablename__ = "candidate_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    enrollment_id = Column(String(36), ForeignKey("exam_enrollments.id"), nullable=False, index=True)
    attempt_id = Column(String(36), ForeignKey("exam_attempts.id"), nullable=True, index=True)
    session_token = Column(String(128), unique=True, index=True, nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    enrollment = relationship("ExamEnrollment", back_populates="sessions")


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    assignment_id = Column(String(36), ForeignKey("exam_assignments.id"), nullable=True, index=True)
    enrollment_id = Column(String(36), ForeignKey("exam_enrollments.id"), nullable=True, index=True)
    exam_version_id = Column(String(36), ForeignKey("exam_versions.id"), nullable=True, index=True)
    candidate_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    candidate_name = Column(String(255), nullable=True)
    candidate_identifier = Column(String(100), nullable=True)  # UID or Email
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), nullable=False)
    deadline_at = Column(DateTime(timezone=True), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="in_progress")  # in_progress, submitted, expired, terminated
    score_total = Column(Float, nullable=True)
    score_details_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    assignment = relationship("ExamAssignment", back_populates="attempts")
    enrollment = relationship("ExamEnrollment", back_populates="attempts")
    candidate = relationship("User", foreign_keys=[candidate_id])
    exam_version = relationship("ExamVersion")
    answers = relationship("AttemptAnswer", back_populates="attempt", cascade="all, delete-orphan")
    proctor_events = relationship("ProctorEvent", back_populates="attempt", cascade="all, delete-orphan")
    proctor_session = relationship("ProctorSession", back_populates="attempt", uselist=False, cascade="all, delete-orphan")


class ProctorSession(Base):
    """Records preflight consent and device monitoring status during candidate attempt."""
    __tablename__ = "proctor_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    attempt_id = Column(String(36), ForeignKey("exam_attempts.id"), nullable=False, unique=True, index=True)
    consent_given = Column(Boolean, default=False)
    consent_timestamp = Column(DateTime(timezone=True), nullable=True)
    camera_status = Column(String(50), default="unknown")  # granted, denied, degraded
    monitoring_state = Column(String(50), default="active")  # active, paused, ended
    last_heartbeat_at = Column(DateTime(timezone=True), default=utcnow)
    client_metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    attempt = relationship("ExamAttempt", back_populates="proctor_session")


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    attempt_id = Column(String(36), ForeignKey("exam_attempts.id"), nullable=False, index=True)
    question_id = Column(String(36), nullable=False, index=True)
    answer_json = Column(Text, nullable=False)  # { selected_options: [...], numerical_value: "3.14", state: "answered" }
    revision = Column(Integer, default=1)
    sequence_number = Column(Integer, default=1)
    saved_at = Column(DateTime(timezone=True), default=utcnow)

    attempt = relationship("ExamAttempt", back_populates="answers")


class ProctorEvent(Base):
    __tablename__ = "proctor_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    attempt_id = Column(String(36), ForeignKey("exam_attempts.id"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)  # face_not_detected, multiple_faces, head_turned, tab_switch, fullscreen_exit, mobile_hint
    severity = Column(String(50), default="advisory")  # advisory, suspicious, high
    duration_ms = Column(Integer, default=0)
    confidence = Column(Float, default=1.0)
    source = Column(String(50), default="mediapipe")  # mediapipe, browser_event, device_signal
    review_status = Column(String(50), default="pending")  # pending, reviewed, dismissed, flagged
    metadata_json = Column(Text, nullable=True)
    occurred_at = Column(DateTime(timezone=True), default=utcnow)

    attempt = relationship("ExamAttempt", back_populates="proctor_events")
    evidence = relationship("EvidenceAsset", back_populates="event", cascade="all, delete-orphan")
    review = relationship("ReviewDecision", back_populates="event", uselist=False, cascade="all, delete-orphan")


class EvidenceAsset(Base):
    __tablename__ = "evidence_assets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_id = Column(String(36), ForeignKey("proctor_events.id"), nullable=False, index=True)
    storage_key = Column(String(500), nullable=False)
    mime_type = Column(String(100), default="image/jpeg")
    retention_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    event = relationship("ProctorEvent", back_populates="evidence")


class ReviewDecision(Base):
    __tablename__ = "review_decisions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_id = Column(String(36), ForeignKey("proctor_events.id"), nullable=False, index=True)
    reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    decision = Column(String(50), nullable=False)  # dismissed, confirmed_violation, inconclusive
    reason = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), default=utcnow)

    event = relationship("ProctorEvent", back_populates="review")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True, index=True)
    actor_id = Column(String(36), nullable=True)
    actor_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(255), nullable=True)
    ip_address = Column(String(64), nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class UserSession(Base):
    """Server-side revocable session for authenticated users."""
    __tablename__ = "user_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    session_token = Column(String(128), unique=True, index=True, nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)
    is_revoked = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User")


class Appeal(Base):
    """Candidate/Faculty integrity violation appeal and review workflow."""
    __tablename__ = "appeals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    attempt_id = Column(String(36), ForeignKey("exam_attempts.id"), nullable=False, index=True)
    event_id = Column(String(36), ForeignKey("proctor_events.id"), nullable=True, index=True)
    candidate_identifier = Column(String(100), nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="pending")  # pending, accepted, rejected
    reviewer_notes = Column(Text, nullable=True)
    resolved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class ResultRevision(Base):
    """Manual score evaluation or regrading adjustment audit trail."""
    __tablename__ = "result_revisions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    attempt_id = Column(String(36), ForeignKey("exam_attempts.id"), nullable=False, index=True)
    revised_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    previous_score = Column(Float, nullable=False)
    new_score = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class QuizRoom(Base):
    """Multiplayer Quick Quiz persistent game session."""
    __tablename__ = "quiz_rooms"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True, index=True)
    room_code = Column(String(10), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    status = Column(String(50), default="waiting")  # waiting, active, round_active, completed
    current_round = Column(Integer, default=0)
    total_rounds = Column(Integer, default=5)
    per_question_time_seconds = Column(Integer, default=20)
    speed_scoring = Column(Boolean, default=True)
    host_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    questions_json = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    participants = relationship("QuizParticipant", back_populates="room", cascade="all, delete-orphan")
    rounds = relationship("QuizRound", back_populates="room", cascade="all, delete-orphan")


class QuizParticipant(Base):
    """Connected participant in a Quick Quiz arena."""
    __tablename__ = "quiz_participants"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    room_id = Column(String(36), ForeignKey("quiz_rooms.id"), nullable=False, index=True)
    participant_token = Column(String(64), unique=True, index=True, nullable=False)
    nickname = Column(String(100), nullable=False)
    score = Column(Integer, default=0)
    streak = Column(Integer, default=0)
    is_connected = Column(Boolean, default=True)
    joined_at = Column(DateTime(timezone=True), default=utcnow)

    room = relationship("QuizRoom", back_populates="participants")


class QuizRound(Base):
    """Active or archived question round in a Quick Quiz."""
    __tablename__ = "quiz_rounds"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    room_id = Column(String(36), ForeignKey("quiz_rooms.id"), nullable=False, index=True)
    round_number = Column(Integer, nullable=False)
    question_json = Column(Text, nullable=False)
    started_at = Column(DateTime(timezone=True), default=utcnow)
    ends_at = Column(DateTime(timezone=True), nullable=True)

    room = relationship("QuizRoom", back_populates="rounds")


class QuizResponse(Base):
    """Participant answer submission for a given round."""
    __tablename__ = "quiz_responses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    room_id = Column(String(36), ForeignKey("quiz_rooms.id"), nullable=False, index=True)
    participant_id = Column(String(36), ForeignKey("quiz_participants.id"), nullable=False, index=True)
    round_number = Column(Integer, nullable=False)
    selected_option = Column(String(50), nullable=True)
    is_correct = Column(Boolean, default=False)
    time_taken_ms = Column(Integer, default=0)
    points_awarded = Column(Integer, default=0)
    answered_at = Column(DateTime(timezone=True), default=utcnow)


class QuizLeaderboardSnapshot(Base):
    """Snapshot of player ranks at completion of a round."""
    __tablename__ = "quiz_leaderboard_snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    room_id = Column(String(36), ForeignKey("quiz_rooms.id"), nullable=False, index=True)
    round_number = Column(Integer, nullable=False)
    leaderboard_json = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
