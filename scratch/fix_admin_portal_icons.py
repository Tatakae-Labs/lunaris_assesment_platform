with open('frontend/src/platform/PlatformAdminPortal.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('{ id: "organizations", label: "Organizations & Services", icon: "" }', '{ id: "organizations", label: "Organizations & Services", icon: BuildingIcon }')
c = c.replace('{ id: "plans", label: "Plans & Feature Quotas", icon: "" }', '{ id: "plans", label: "Plans & Feature Quotas", icon: CreditCardIcon }')
c = c.replace('{ id: "audit_logs", label: "System Audit Trail", icon: "" }', '{ id: "audit_logs", label: "System Audit Trail", icon: FileTextIcon }')
c = c.replace('{ id: "public_site", label: "Public Website CMS", icon: "" }', '{ id: "public_site", label: "Public Website CMS", icon: GlobeIcon }')

with open('frontend/src/platform/PlatformAdminPortal.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Replaced all empty icons in PlatformAdminPortal.jsx")
