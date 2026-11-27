import React, { useEffect, useRef } from "react";
import { AD_PLACEMENTS, ADSENSE_CLIENT_ID } from "./adConfig";

/**
 * Reusable AdSlot Component
 * Supports Adsterra (Social Bar, Native Banner, Display Banners)
 * and falls back to Google AdSense when Adsterra invoke URLs are not yet configured.
 *
 * When `show` is false (e.g., paid users on dashboard), renders nothing and loads no scripts.
 */
export default function AdSlot({
  placement,
  show = true,
  label = "Sponsored",
  onUpgradeClick = null,
  style = {},
  className = ""
}) {
  const containerRef = useRef(null);
  const cfg = AD_PLACEMENTS[placement];

  // Global script placements (Social Bar)
  useEffect(() => {
    if (!show || !cfg) return;
    if (cfg.type !== "social_bar") return;
    if (!cfg.scriptSrc) return;

    const existing = document.querySelector(`script[data-ad-placement="${cfg.id}"]`);
    if (existing) return;

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = cfg.scriptSrc;
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.setAttribute("data-ad-placement", cfg.id);
    script.setAttribute("data-ad-name", cfg.name);
    document.body.appendChild(script);

    return () => {
      const node = document.querySelector(`script[data-ad-placement="${cfg.id}"]`);
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    };
  }, [show, cfg]);

  // Inline placements (Banner / Native)
  useEffect(() => {
    if (!show || !cfg || !containerRef.current) return;
    if (cfg.type !== "banner" && cfg.type !== "native") return;

    const el = containerRef.current;
    el.innerHTML = "";

    if (cfg.type === "native" && cfg.scriptSrc) {
      const targetDiv = document.createElement("div");
      targetDiv.id = cfg.containerId || `container-${cfg.id}`;
      el.appendChild(targetDiv);

      const script = document.createElement("script");
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      script.src = cfg.scriptSrc;
      el.appendChild(script);
      return;
    }

    if (cfg.type === "banner" && cfg.scriptSrc && cfg.key) {
      // Isolate Adsterra atOptions inside a sandboxed iframe so multiple banners can coexist on the same page
      const iframe = document.createElement("iframe");
      iframe.width = String(cfg.width);
      iframe.height = String(cfg.height);
      iframe.style.border = "none";
      iframe.style.overflow = "hidden";
      iframe.style.display = "block";
      iframe.scrolling = "no";
      iframe.title = cfg.name;
      el.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <body style="margin:0;padding:0;overflow:hidden;background:transparent;">
              <script type="text/javascript">
                atOptions = {
                  'key': '${cfg.key}',
                  'format': 'iframe',
                  'height': ${cfg.height},
                  'width': ${cfg.width},
                  'params': {}
                };
              <\/script>
              <script data-cfasync="false" type="text/javascript" src="${cfg.scriptSrc}"><\/script>
            </body>
          </html>
        `);
        doc.close();
      }
      return;
    }

    // Fallback: Google AdSense responsive/sized slot (script already loaded in index.html)
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "inline-block";
    if (cfg.width && cfg.height) {
      ins.style.width = `${cfg.width}px`;
      ins.style.height = `${cfg.height}px`;
      ins.style.maxWidth = "100%";
    } else {
      ins.style.display = "block";
      ins.setAttribute("data-ad-format", "auto");
      ins.setAttribute("data-full-width-responsive", "true");
    }
    ins.setAttribute("data-ad-client", ADSENSE_CLIENT_ID);
    ins.setAttribute("data-ad-slot", cfg.id);
    el.appendChild(ins);

    try {
      if (window.adsbygoogle) {
        window.adsbygoogle.push({});
      }
    } catch {
      // Ignore AdSense push errors in dev/adblock environments
    }
  }, [show, cfg]);

  if (!show || !cfg) return null;

  if (cfg.type === "social_bar") {
    return null;
  }

  return (
    <div
      className={className}
      data-ad-unit={cfg.name}
      data-placement-id={cfg.id}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        margin: "16px auto",
        maxWidth: "100%",
        ...style
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          width: cfg.width ? `${Math.min(cfg.width, 468)}px` : "100%",
          maxWidth: "100%",
          marginBottom: "4px",
          fontSize: "10px",
          color: "#94a3b8",
          letterSpacing: "0.4px",
          textTransform: "uppercase",
          fontWeight: "600"
        }}
      >
        <span>{label}</span>
        {onUpgradeClick && (
          <button
            type="button"
            onClick={onUpgradeClick}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "#2563eb",
              fontSize: "10px",
              fontWeight: "700",
              cursor: "pointer",
              textTransform: "none",
              letterSpacing: 0
            }}
          >
            Remove ads →
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        style={{
          width: cfg.width ? `${cfg.width}px` : "100%",
          maxWidth: "100%",
          minHeight: cfg.height ? `${cfg.height}px` : "90px",
          background: "#f8fafc",
          border: "1px dashed #e2e8f0",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
      />
    </div>
  );
}
