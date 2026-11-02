with open('frontend/src/index.css', 'r', encoding='utf-8') as f:
    c = f.read()

# Add global overflow containment at body rule
old_body = """body {
  font-family: var(--font-sans);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}"""

new_body = """html, body {
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
  position: relative;
}

body {
  font-family: var(--font-sans);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

#root {
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
}

img, video, canvas, svg {
  max-width: 100%;
  height: auto;
}"""

c = c.replace(old_body, new_body)

# Replace the media queries section with comprehensive mobile rules
old_media = """/* Stageshow Bento Grid Responsive Breakpoints */
@media (max-width: 960px) {
  .stageshow-window-wrapper {
    max-width: 100% !important;
  }
  div[style*="gridTemplateColumns: repeat(12, 1fr)"] {
    grid-template-columns: 1fr !important;
  }
  div[style*="gridColumn: span 8"],
  div[style*="gridColumn: span 4"] {
    grid-column: span 1 !important;
    grid-row: auto !important;
  }
}"""

new_media = """/* Stageshow Bento Grid Responsive Breakpoints */
@media (max-width: 960px) {
  .stageshow-window-wrapper {
    max-width: 100% !important;
  }
  .stageshow-bento-grid {
    grid-template-columns: 1fr !important;
    gap: 16px !important;
  }
  .stageshow-bento-tile {
    grid-column: span 1 !important;
    grid-row: auto !important;
    padding: 20px !important;
  }
}

/* Comprehensive Mobile & Touchscreen Adaptations (<= 768px) */
@media (max-width: 768px) {
  /* Prevent satellite badge blowout on phone screens */
  .stageshow-satellite {
    display: none !important;
  }

  /* Stageshow Hero Simulation */
  .stageshow-hero-screen-body {
    height: auto !important;
    min-height: 480px !important;
    overflow-y: auto !important;
  }
  .stageshow-cbt-header {
    height: auto !important;
    padding: 10px 12px !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 8px !important;
  }
  .stageshow-cbt-header > div {
    width: 100% !important;
    justify-content: space-between !important;
  }
  .stageshow-cbt-split {
    flex-direction: column !important;
    overflow: visible !important;
  }
  .stageshow-cbt-left {
    padding: 14px 12px !important;
    flex: unset !important;
    width: 100% !important;
  }
  .stageshow-cbt-right {
    width: 100% !important;
    border-left: none !important;
    border-top: 1px solid #1e293b !important;
    height: auto !important;
  }
  .stageshow-cbt-footer {
    flex-wrap: wrap !important;
    gap: 6px !important;
  }
  .stageshow-cbt-footer button {
    font-size: 11px !important;
    padding: 6px 10px !important;
  }
  .stageshow-modal-card {
    padding: 16px 14px !important;
    gap: 10px !important;
  }
  .stageshow-scorecard-grid {
    grid-template-columns: 1fr !important;
    gap: 8px !important;
  }
  .stageshow-step-pill {
    font-size: 10px !important;
    padding: 3px 8px !important;
  }

  /* Interactive Workbench (InteractiveModeDemos) */
  .interactive-tabs-container {
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
  }
  .interactive-tabs-container button {
    width: 100% !important;
    text-align: center !important;
  }
  .interactive-cbt-header {
    height: auto !important;
    padding: 10px 14px !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 8px !important;
  }
  .interactive-cbt-header > div {
    width: 100% !important;
    justify-content: space-between !important;
  }
  .interactive-cbt-split {
    flex-direction: column !important;
    min-height: auto !important;
  }
  .interactive-cbt-split > div:first-child {
    padding: 14px 12px !important;
  }
  .interactive-cbt-palette {
    width: 100% !important;
    border-left: none !important;
    border-top: 1px solid #1e293b !important;
  }
  .interactive-ai-header {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 12px !important;
  }
  .interactive-ai-controls {
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
  }
  .interactive-ai-controls select,
  .interactive-ai-controls button {
    width: 100% !important;
  }
  .interactive-proctor-split {
    grid-template-columns: 1fr !important;
    gap: 16px !important;
  }
  .interactive-proctor-camera {
    height: 200px !important;
  }
}"""

c = c.replace(old_media, new_media)

with open('frontend/src/index.css', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated frontend/src/index.css successfully')

