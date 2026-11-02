import re

with open('backend/app/platform/router.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update ensure_superadmin_seeded to invoke cleanup_all_duplicate_free_organizations
seed_target = '''        admin.is_superadmin = True
        admin.admin_role = "superadmin"
        db.commit()
    return admin'''

seed_replacement = '''        admin.is_superadmin = True
        admin.admin_role = "superadmin"
        db.commit()

    # Automatically purge redundant free accounts for any user with a paid plan
    try:
        cleanup_all_duplicate_free_organizations(db)
    except Exception as exc:
        print(f"Automatic free organization cleanup note: {exc}")

    return admin'''

if seed_target not in code:
    raise ValueError("seed_target not found!")

code = code.replace(seed_target, seed_replacement, 1)

# 2. Add purge_organization_data, cleanup_free_organizations_for_user, cleanup_all_duplicate_free_organizations right above delete_organization_superadmin
helper_functions = '''def purge_organization_data(db: Session, org_id_val: str) -> Optional[str]:
    """Deeply and cleanly purges all related foreign keys, telemetry, exams, questions, members, and the organization itself."""
    org = db.query(Organization).filter((Organization.id == org_id_val) | (Organization.slug == org_id_val)).first()
    if not org:
        return None

    org_name = org.name
    org_id = org.id

    # 1. Clean up Quick Quiz arenas and participants
    rooms = db.query(QuizRoom).filter(QuizRoom.organization_id == org_id).all()
    room_ids = [r.id for r in rooms]
    if room_ids:
        from app.models import QuizResponse, QuizRound, QuizLeaderboardSnapshot
        db.query(QuizResponse).filter(QuizResponse.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizParticipant).filter(QuizParticipant.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizRound).filter(QuizRound.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizLeaderboardSnapshot).filter(QuizLeaderboardSnapshot.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(QuizRoom).filter(QuizRoom.organization_id == org_id).delete(synchronize_session=False)

    # 2. Clean up Exam Attempts and all telemetry/answers/reviews
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

    # 3. Clean up Appeals for this org
    db.query(Appeal).filter(Appeal.organization_id == org_id).delete(synchronize_session=False)

    # 4. Clean up Enrollments & Assignments
    enrollments = db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org_id).all()
    enrollment_ids = [en.id for en in enrollments]
    if enrollment_ids:
        db.query(CandidateSession).filter(CandidateSession.enrollment_id.in_(enrollment_ids)).delete(synchronize_session=False)
    db.query(ExamEnrollment).filter(ExamEnrollment.organization_id == org_id).delete(synchronize_session=False)
    db.query(ExamAssignment).filter(ExamAssignment.organization_id == org_id).delete(synchronize_session=False)

    # 5. Clean up Exams and Exam Versions
    exams = db.query(Exam).filter(Exam.organization_id == org_id).all()
    exam_ids = [e.id for e in exams]
    if exam_ids:
        db.query(ExamVersion).filter(ExamVersion.exam_id.in_(exam_ids)).delete(synchronize_session=False)
        db.query(Exam).filter(Exam.organization_id == org_id).delete(synchronize_session=False)

    # 6. Clean up Questions, Revisions, and Question Banks
    questions = db.query(Question).filter(Question.organization_id == org_id).all()
    q_ids = [q.id for q in questions]
    if q_ids:
        db.query(QuestionRevision).filter(QuestionRevision.question_id.in_(q_ids)).delete(synchronize_session=False)
        db.query(Question).filter(Question.organization_id == org_id).delete(synchronize_session=False)
    db.query(QuestionBank).filter(QuestionBank.organization_id == org_id).delete(synchronize_session=False)

    # 7. Clean up AI Question Drafts & Usage
    db.query(AIQuestionDraft).filter(AIQuestionDraft.organization_id == org_id).delete(synchronize_session=False)
    db.query(UsageLedger).filter(UsageLedger.organization_id == org_id).delete(synchronize_session=False)

    # 8. Clean up Financials & Subscriptions
    db.query(PaymentEvent).filter(PaymentEvent.organization_id == org_id).delete(synchronize_session=False)
    db.query(Subscription).filter(Subscription.organization_id == org_id).delete(synchronize_session=False)

    # 9. Clean up Invites & Members
    db.query(OrganizationInvite).filter(OrganizationInvite.organization_id == org_id).delete(synchronize_session=False)
    db.query(OrganizationMember).filter(OrganizationMember.organization_id == org_id).delete(synchronize_session=False)

    # 10. Clean up Org Audit Events
    db.query(AuditEvent).filter(AuditEvent.organization_id == org_id).delete(synchronize_session=False)

    # 11. Delete the organization
    db.delete(org)
    db.commit()

    # Clean up dual-engine MongoDB documents if enabled
    try:
        from app.core.mongodb import get_collection
        for coll_name in [
            "organizations", "organization_members", "subscriptions", "exams", "questions",
            "exam_attempts", "candidate_sessions", "attempt_answers", "proctor_sessions",
            "proctor_events", "evidence_assets", "review_decisions", "quiz_rooms",
            "quiz_participants", "audit_logs"
        ]:
            c = get_collection(coll_name)
            if c is not None:
                if coll_name == "organizations":
                    c.delete_one({"_id": org_id})
                else:
                    c.delete_many({"organization_id": org_id})
    except Exception as exc:
        print(f"MongoDB org delete sync note: {exc}")

    try:
        from app.core.database import checkpoint_and_sync_db
        checkpoint_and_sync_db(db)
    except Exception:
        pass

    return org_name


def cleanup_free_organizations_for_user(db: Session, user_id: str) -> List[str]:
    """If user owns or has access to at least one paid organization (plan_id != 'free'),
    remove all free organizations (plan_id == 'free') that this user owns."""
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


def cleanup_all_duplicate_free_organizations(db: Session) -> Dict[str, Any]:
    """Scans all users across the platform. If any user has at least one paid account (plan_id != 'free')
    and also a free account (plan_id == 'free'), automatically remove the free one."""
    users = db.query(User).all()
    cleaned = {}
    for u in users:
        removed = cleanup_free_organizations_for_user(db, u.id)
        if removed:
            cleaned[u.email] = removed
    return cleaned

'''

del_target = '@router.delete("/organizations/{org_id}")'
if del_target not in code:
    raise ValueError("del_target not found!")

code = code.replace(del_target, helper_functions + '\n' + del_target, 1)

# 3. Simplify delete_organization_superadmin to use purge_organization_data
old_delete_body = '''@router.delete("/organizations/{org_id}")
def delete_organization_superadmin(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_main_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org_name = org.name
    org_id_val = org.id'''

new_delete_body = '''@router.delete("/organizations/{org_id}")
def delete_organization_superadmin(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_main_superadmin(current_user)
    org = db.query(Organization).filter((Organization.id == org_id) | (Organization.slug == org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org_name = org.name
    org_id_val = org.id
    purge_organization_data(db, org_id_val)

    audit = AuditEvent(
        organization_id=None,
        actor_id=current_user.id,
        actor_email=current_user.email,
        action="SUPERADMIN_DELETE_ORGANIZATION",
        metadata_json=json.dumps({"deleted_org_id": org_id_val, "deleted_org_name": org_name})
    )
    db.add(audit)
    db.commit()

    return {"message": f"Organization '{org_name}' deleted successfully", "deleted_org_id": org_id_val}

def _legacy_delete_marker():
    pass'''

# Find until return {"message": f"Organization '{org_name}' deleted successfully", "deleted_org_id": org_id_val}
return_marker = 'return {"message": f"Organization \'{org_name}\' deleted successfully", "deleted_org_id": org_id_val}'
end_idx = code.find(return_marker)
start_idx = code.find('@router.delete("/organizations/{org_id}")', code.find('def cleanup_all_duplicate_free_organizations'))

if start_idx != -1 and end_idx != -1:
    code = code[:start_idx] + new_delete_body + code[end_idx + len(return_marker):]

with open('backend/app/platform/router.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: backend/app/platform/router.py updated!")

