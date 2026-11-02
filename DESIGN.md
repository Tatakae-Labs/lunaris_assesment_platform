# Lunaris Design System & Engineering Playbook (UI Skills Standard)

Curated design-engineering guidelines, tokens, and micro-rules for Lunaris Computer-Based Assessment SaaS, adhering to the [UI Skills Playbook](https://www.ui-skills.com/playbook) by Julien Thibeaut (@ibelick).

---

## 1. Design Tokens & Variables

### Color Palette (Strict Pure White Architecture & High-Contrast Accents)
| Token | Value | Role |
| :--- | :--- | :--- |
| `--bg-primary` | `#ffffff` | Pure white canvas root |
| `--bg-secondary` | `#f8fafc` | Subtle card background & sidebars |
| `--bg-surface` | `#ffffff` | Elevated surface / card canvas |
| `--border-subtle` | `#e2e8f0` | Quiet 1px dividers & borders |
| `--border-strong` | `#cbd5e1` | Input outlines & active borders |
| `--text-primary` | `#0f172a` | Primary headings & high-contrast text |
| `--text-secondary` | `#334155` | Body copy (optimized 65–72ch measure) |
| `--text-muted` | `#64748b` | Captions, metadata, and timestamps |
| `--accent-blue` | `#2563eb` | Primary brand call-to-actions |
| `--accent-emerald` | `#16a34a` | Success toasts, valid states, answered questions |
| `--accent-rose` | `#dc2626` | Critical flags, unvisited questions, danger |
| `--accent-purple` | `#9333ea` | Marked for review status |
| `--accent-amber` | `#d97706` | Live timer warning thresholds |

### Dark CBT Runner Palette (Authentic Indian NTA JEE Main Interface)
| Token | Value | Role |
| :--- | :--- | :--- |
| `--cbt-bg-root` | `#0a0f1d` | Fullscreen examination canvas |
| `--cbt-bg-header` | `#0f172a` | Official header bar |
| `--cbt-bg-tabs` | `#0b1329` | Subject selector strip |
| `--cbt-border` | `#1e293b` | Dark mode structural dividers |
| `--cbt-timer` | `#38bdf8` | High-visibility cyan authoritative clock |

---

## 2. Typography & Measure

- **Display Face**: `'Outfit', sans-serif` (Headings, hero titles, scorecards)
- **Interface Face**: `'Inter', -apple-system, sans-serif` (Controls, body copy, tables)
- **Monospace Face**: `'JetBrains Mono', monospace` (Timers, UIDs, equations, math formulas)

### UI Skills Typography Rules
1. **Balance Headings**:
   All `h1, h2, h3, h4, .hero-headline` have `text-wrap: balance` to prevent awkward single-word orphan line drops.
2. **Tabular Numbers for Live Data**:
   All clocks, remaining time displays, scores, candidate UIDs, and metrics use:
   ```css
   font-variant-numeric: tabular-nums;
   font-feature-settings: "tnum";
   ```
   This guarantees numerals share identical horizontal widths, preventing layout jitter as seconds tick down.
3. **Reading Measure**:
   Body paragraphs are constrained to a maximum width of `72ch` (`max-width: 72ch`) for comfortable human reading cadence.

---

## 3. UI Skills Playbook Guardrails

### A. Large Touch Targets & Tactile Ergonomics
- Clickable buttons, form controls, and tabs maintain a minimum touch target height of $\ge 40\text{px}$ to $44\text{px}$ (`touch-action: manipulation`).
- Interactive buttons feature physical press feedback:
  ```css
  button:active {
    transform: scale(0.985);
  }
  ```

### B. Visible & Unambiguous Focus Rings
- Keyboard users receive an unmistakable 2px focus ring with 2px offset:
  ```css
  *:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: 2px;
  }
  ```

### C. Prevention of Layout Shifts (CLS)
- Stage windows, video proctoring bubbles, and question palettes define reserved dimensions (`min-height` or explicit aspect ratio).
- Satellite overlays animate smoothly starting at `scale(0.96)` and `translateY(12px)` rather than popping in from zero.

### D. Motion Curves & Respect for Reduced Motion
- Micro-interactions use snappy, natural cubic beziers:
  ```css
  transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
  ```
- Complies strictly with `@media (prefers-reduced-motion: reduce)` by disabling transitions and loops for sensitive users.

### E. Explicit Form Field Labeling
- Every single text input, password field, and select element has an associated descriptive `<label>` or explicit `aria-label`.

---

## 4. Spacing Scale (4px Base Grid)

| Token | Pixels | Standard Application |
| :--- | :--- | :--- |
| `space-1` | `4px` | Pill padding, micro gaps, radio rings |
| `space-2` | `8px` | Traffic lights spacing, option row gaps |
| `space-3` | `12px` | Input internal padding, card margins |
| `space-4` | `16px` | Section padding, container gaps |
| `space-5` | `20px` | Header padding, card inner margins |
| `space-6` | `24px` | Card padding, bento grid gutters |
| `space-8` | `32px` | Section dividers, large modal gutters |
| `space-12` | `48px` | Section vertical rhythm |

---

## 5. Stageshow & Bento Grid Guidelines

- **Restraint Over Clutter**: One window per section running off the edge, rather than shrinking multiple full windows into cards.
- **Motion Has a Cause**: Every cursor movement represents an authentic user intent (Authoring → Syncing → Enrolling → Taking Test).
- **Physical Feel**: Ephemeral candidate passes and credentials sheets are presented as physical tactile cards with barcodes and security seals.

