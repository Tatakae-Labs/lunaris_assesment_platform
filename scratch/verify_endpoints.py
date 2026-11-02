import sys, os
sys.path.insert(0, os.path.abspath("backend"))

from app.core.database import SessionLocal
from app.platform.router import get_public_site_settings_endpoint, get_public_stats_endpoint
from app.plans.router import list_plans

db = SessionLocal()
try:
    settings = get_public_site_settings_endpoint(db)
    print("Public Site Settings:", settings)

    stats = get_public_stats_endpoint(db)
    print("Public Stats:", stats)

    plans = list_plans(db)
    print(f"Plans Count: {len(plans)}")
    for p in plans:
        print(f" - Plan {p['id']}: {p['name']}, INR {p['price_inr']}/{p['billing_period']}")
    print("\nSUCCESS: All endpoints and database queries executed cleanly without error!")
finally:
    db.close()
