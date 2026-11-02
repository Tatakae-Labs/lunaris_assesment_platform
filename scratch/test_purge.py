import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from app.core.database import SessionLocal
from app.models import (
    User, Organization, OrganizationMember, QuizRoom, ExamAttempt, CandidateSession,
    AttemptAnswer, ProctorEvent, EvidenceAsset, ReviewDecision, Appeal, ProctorSession,
    ExamEnrollment, ExamAssignment, ExamVersion, Exam, Question, QuestionRevision,
    QuestionBank, AIQuestionDraft, UsageLedger, PaymentEvent, Subscription,
    OrganizationInvite, AuditEvent
)

def purge_organization_data(db, org_id_val):
    org = db.query(Organization).filter((Organization.id == org_id_val) | (Organization.slug == org_id_val)).first()
    if not org:
        return None
    org_name = org.name
    org_id = org.id

    rooms = db.query(QuizRoom).filter(QuizRoom.organization_id == org_id).all()
    room_ids = [r.id for r in rooms]
    if room_ids:
        from app.models import QuizResponse, QuizRound, QuizLeaderboardSnapshot
        db.query(QuizResponse).filter(QuizResponse.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizParticipant).filter(QuizParticipant.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizRound).filter(QuizRound.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizLeaderboardSnapshot).filter(QuizLeaderboardSnapshot.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizRoom).filter(QuizRoom.organization_id == org_id).delete(synchronize_session=False)

    attempts = db.query(ExamAttempt).filter(ExamAttempt.organization_id == org_id).all()
    attempt_ids = [a.id for a in attempts]
    if attempt_ids:
        db.query(CandidateSession).filter(CandidateSession.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        from app.models import ResultRevision
        db.query(ResultRevision).filter(ResultRevision.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        events = db.query(ProctorEvent).filter(ProctorEvent.attempt_id.in_(attempt_ids)).all()
        event_ids = [ev.id for ev in events]
        if event_ids:
            db.query(EvidenceAsset).filter(EvidenceAsset.event_id.in_(event_ids)).delete(synchronize_session=False)
            db.query(ReviewDecision).filter(ReviewDecision.event_id.in_(event_ids)).delete(synchronize_session=False)
            db.query(Appeal).filter(Appeal.event_id.in_(event_ids)).delete(synchronize_session=False)
        db.query(ProctorEvent).filter(ProctorEvent.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(ProctorSession).filter(ProctorSession.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(Appeal).filter(Appeal.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(ExamAttempt).filter(ExamAttempt.organization_id == org_id).delete(synchronize_session=False)

    db.query(Appeal).filter(Appeal.organization_id == org_id).delete(synchronize_session=False)

    enrollments = db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org_id).all()
    enrollment_ids = [en.id for en in enrollments]
    if enrollment_ids:
        db.query(CandidateSession).filter(CandidateSession.enrollment_id.in_(enrollment_ids)).delete(synchronize_session=False)
    db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org_id).delete(synchronize_session=False)
    db.query(ExamAssignment).filter(ExamAssignment.organization_id == org_id).delete(synchronize_session=False)

    exams = db.query(Exam).filter(Exam.organization_id == org_id).all()
    exam_ids = [e.id for e in exams]
    if exam_ids:
        db.query(ExamVersion).filter(ExamVersion.exam_id.in_(exam_ids)).delete(synchronize_session=False)
        db.query(Exam).filter(Exam.organization_id == org_id).delete(synchronize_session=False)

    questions = db.query(Question).filter(Question.organization_id == org_id).all()
    q_ids = [q.id for q in questions]
    if q_ids:
        db.query(QuestionRevision).filter(QuestionRevision.question_id.in_(q_ids)).delete(synchronize_session=False)
        db.query(Question).filter(Question.organization_id == org_id).delete(synchronize_session=False)
    db.query(QuestionBank).filter(QuestionBank.organization_id == org_id).delete(synchronize_session=False)

    db.query(AIQuestionDraft).filter(AIQuestionDraft.organization_id == org_id).delete(synchronize_session=False)
    db.query(UsageLedger).filter(UsageLedger.organization_id == org_id).delete(synchronize_session=False)
    db.query(PaymentEvent).filter(PaymentEvent.organization_id == org_id).delete(synchronize_session=False)
    db.query(Subscription).filter(Subscription.organization_id == org_id).delete(synchronize_session=False)
    db.query(OrganizationInvite).filter(OrganizationInvite.organization_id == org_id).delete(synchronize_session=False)
    db.query(OrganizationMember).filter(OrganizationMember.organization_id == org_id).delete(synchronize_session=False)
    db.query(AuditEvent).filter(AuditEvent.organization_id == org_id).delete(synchronize_session=False)

    db.delete(org)
    db.commit()
    return org_name

def cleanup_free_organizations_for_user(db, user_id):
    memberships = db.query(OrganizationMember).filter(OrganizationMember.user_id == user_id).all()
    org_ids = [m.organization_id for m in memberships]
    if not org_ids:
        return []

    orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    has_paid_org = any(o.plan_id and o.plan_id != "free" for o in orgs)
    if not has_paid_org:
        return []

    deleted_names = []
    for m in memberships:
        if m.role in ["owner", "admin"]:
            org = db.query(Organization).filter(Organization.id == m.organization_id).first()
            if org and (not org.plan_id or org.plan_id == "free"):
                deleted_name = purge_organization_data(db, org.id)
                if deleted_name:
                    deleted_names.append(deleted_name)
    return deleted_names

def cleanup_all_duplicate_free_organizations(db):
    users = db.query(User).all()
    cleaned = {}
    for u in users:
        removed = cleanup_free_organizations_for_user(db, u.id)
        if removed:
            cleaned[u.email] = removed
    return cleaned

db = SessionLocal()
try:
    print("Executing cleanup of duplicate free accounts...")
    res = cleanup_all_duplicate_free_organizations(db)
    print("Cleanup Result:", res)

    # Now verify remaining orgs for all users
    users = db.query(User).all()
    print("\nREMAINING ORGANIZATIONS PER USER:")
    for u in users:
        memberships = db.query(OrganizationMember).filter(OrganizationMember.user_id == u.id).all()
        if memberships:
            print(f"User {u.email}:")
            for m in memberships:
                o = db.query(Organization).filter(Organization.id == m.organization_id).first()
                if o:
                    print(f"  -> {o.name} [plan: {o.plan_id}, role: {m.role}]")
finally:
    db.close()

