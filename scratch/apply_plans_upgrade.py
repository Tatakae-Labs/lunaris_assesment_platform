with open('backend/app/plans/router.py', 'r', encoding='utf-8') as f:
    code = f.read()

target = '''    db.commit()

    return {
        "message": f"Successfully activated {selected_plan.name} plan!",'''

replacement = '''    db.commit()

    # When an organization is upgraded to a paid plan, remove any free organization owned by this user
    if req.plan_code != "free":
        try:
            from app.platform.router import cleanup_free_organizations_for_user
            cleanup_free_organizations_for_user(db, current_user.id)
        except Exception as exc:
            print(f"Cleanup free orgs on upgrade note: {exc}")

    return {
        "message": f"Successfully activated {selected_plan.name} plan!",'''

if target not in code:
    raise ValueError("Target not found in plans/router.py!")

code = code.replace(target, replacement, 1)

with open('backend/app/plans/router.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: Updated plans/router.py with automatic free account removal on upgrade!")

