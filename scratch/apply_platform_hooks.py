with open('backend/app/platform/router.py', 'r', encoding='utf-8') as f:
    code = f.read()

target1 = '''    db.add(audit)
    db.commit()

    return {
        "message": f"Subscription updated for {org.name}",'''

replacement1 = '''    db.add(audit)
    db.commit()

    if req.plan_id != "free":
        try:
            owner_member = db.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org.id,
                OrganizationMember.role.in_(["owner", "admin"])
            ).first()
            if owner_member:
                cleanup_free_organizations_for_user(db, owner_member.user_id)
        except Exception as exc:
            print(f"Cleanup free orgs on sub update note: {exc}")

    return {
        "message": f"Subscription updated for {org.name}",'''

if target1 in code:
    code = code.replace(target1, replacement1, 1)
    print("target1 replaced!")
else:
    print("target1 already replaced or not found")

target2 = '''        db.add(audit)
        db.commit()'''

replacement2 = '''        db.add(audit)
        db.commit()

        if target_plan_id != "free" and org:
            try:
                owner_member = db.query(OrganizationMember).filter(
                    OrganizationMember.organization_id == org.id,
                    OrganizationMember.role.in_(["owner", "admin"])
                ).first()
                if owner_member:
                    cleanup_free_organizations_for_user(db, owner_member.user_id)
            except Exception as exc:
                print(f"Cleanup free orgs on payment verify note: {exc}")'''

if target2 in code:
    code = code.replace(target2, replacement2, 1)
    print("target2 replaced!")

with open('backend/app/platform/router.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: backend/app/platform/router.py updated with all hooks!")
