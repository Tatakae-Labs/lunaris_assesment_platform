with open('frontend/src/public/PublicWebsite.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

old_gsi = """  // Initialize Google Identity Services (GIS) when Google Script & Client ID are ready
  useEffect(() => {
    if (!googleClientId) return;

    function initGsi() {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false
          });
        } catch (e) {
          console.warn("Google GSI init notice:", e);
        }
      }
    }

    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGsi();
        clearInterval(timer);
      }
    }, 400);

    return () => clearInterval(timer);
  }, [googleClientId]);"""

new_gsi = """  // Initialize Google Identity Services (GIS) when Google Script & Client ID are ready
  useEffect(() => {
    if (!googleClientId) return;
    if (window.__lunaris_gsi_initialized === googleClientId) return;

    function initGsi() {
      if (window.google?.accounts?.id) {
        if (window.__lunaris_gsi_initialized === googleClientId) return;
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false
          });
          window.__lunaris_gsi_initialized = googleClientId;
        } catch (e) {
          console.warn("Google GSI init notice:", e);
        }
      }
    }

    if (window.google?.accounts?.id) {
      initGsi();
      return;
    }

    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGsi();
        clearInterval(timer);
      }
    }, 400);

    return () => clearInterval(timer);
  }, [googleClientId]);"""

c_norm = c.replace('\r\n', '\n')
if old_gsi in c_norm:
    c_norm = c_norm.replace(old_gsi, new_gsi)
    with open('frontend/src/public/PublicWebsite.jsx', 'w', encoding='utf-8') as f:
        f.write(c_norm)
    print("Updated PublicWebsite.jsx GSI initialization!")
else:
    print("old_gsi block not matched directly in PublicWebsite.jsx")

