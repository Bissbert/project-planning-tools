# Design System

Project Planning Tools uses the **Assembly Line** aesthetic with a **Warm Steel** color palette.

---

## Philosophy

The UI follows a factory/assembly line visual metaphor:

- **Stations** - Distinct sections with badge identifiers (A, B, C)
- **Track Lines** - Vertical connectors showing workflow progression
- **Numbered Items** - Sequential identifiers (01, 02, 03) for items within stations
- **Panels** - Modular card-based components
- **Status Indicators** - Clear state communication without animation

**Core Principles:**
1. Content appears immediately (no staggered loading delays)
2. Animations only for interactive feedback (hover, click)
3. Industrial precision over organic softness
4. Information density with clear hierarchy

---

## Color Palette: Warm Steel

A gray-purple palette with soft lavender accents.

### Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#101014` | Page background |
| `--bg-secondary` | `#18181f` | Cards, panels |
| `--bg-tertiary` | `#202028` | Elevated elements, headers |
| `--bg-hover` | `#282832` | Hover states |
| `--bg-elevated` | `#1c1c24` | Floating elements |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `#2e2e3a` | Default borders |
| `--border-subtle` | `#242430` | Subtle dividers |
| `--border-strong` | `#3a3a48` | Emphasized borders, hover |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#e8e8ec` | Headings, primary content |
| `--text-secondary` | `#9898a8` | Body text, descriptions |
| `--text-muted` | `#5c5c6c` | Labels, hints, disabled |
| `--text-accent` | `#c4b5fd` | Links, highlighted text |

### Accent Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | `#a78bfa` | Primary accent (buttons, badges, focus) |
| `--accent-bright` | `#c4b5fd` | Hover states, code highlights |
| `--accent-dim` | `#7c3aed` | Active/pressed states |
| `--accent-glow` | `rgba(167, 139, 250, 0.4)` | Glow effects |
| `--accent-subtle` | `rgba(167, 139, 250, 0.12)` | Subtle backgrounds |

### Status Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--status-success` | `#4ade80` | Complete, online, positive |
| `--status-warning` | `#fbbf24` | Pending, caution |
| `--status-error` | `#f87171` | Error, blocked, negative |
| `--status-info` | `#a78bfa` | Information, neutral highlight |

Each status color has a `-subtle` variant for backgrounds (e.g., `--status-success-subtle`).

### Assembly Line Specific

| Token | Value | Usage |
|-------|-------|-------|
| `--track-color` | `#2e2e3a` | Track lines (inactive) |
| `--track-active` | `#a78bfa` | Track lines (active/hover) |
| `--station-bg` | `#1c1c24` | Station number background |
| `--station-border` | `#3a3a48` | Station number border |

---

## Typography

**Font Family:** JetBrains Mono (monospace)

### Scale

| Token | Size | Usage |
|-------|------|-------|
| `--font-xs` | 11px | Tiny labels, badges |
| `--font-sm` | 12px | Secondary text, captions |
| `--font-base` | 13px | Body text |
| `--font-md` | 14px | Emphasized body |
| `--font-lg` | 16px | Section titles |
| `--font-xl` | 20px | Card titles |
| `--font-2xl` | 24px | Page subtitles |
| `--font-3xl` | 32px | Page titles |
| `--font-4xl` | 40px | Hero text |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--leading-tight` | 1.2 | Headings |
| `--leading-normal` | 1.5 | Body text |
| `--leading-relaxed` | 1.7 | Long-form content |

### Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--tracking-tight` | -0.02em | Large headings |
| `--tracking-normal` | 0 | Body text |
| `--tracking-wide` | 0.05em | Small labels |
| `--tracking-wider` | 0.1em | Uppercase labels, badges |

---

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-xs` | 4px | Tight gaps |
| `--spacing-sm` | 8px | Related elements |
| `--spacing-md` | 12px | Default padding |
| `--spacing-lg` | 16px | Card padding |
| `--spacing-xl` | 24px | Section gaps |
| `--spacing-2xl` | 32px | Large sections |
| `--spacing-3xl` | 48px | Page sections |
| `--spacing-4xl` | 64px | Major divisions |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 2px | Badges, small elements |
| `--radius-md` | 4px | Buttons, inputs |
| `--radius-lg` | 6px | Cards |
| `--radius-xl` | 8px | Large cards |
| `--radius-2xl` | 12px | Modals, panels |

---

## Shadows

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Subtle elevation |
| `--shadow-md` | Cards, dropdowns |
| `--shadow-lg` | Modals, popovers |
| `--shadow-glow` | Focus states, accent glow |
| `--shadow-inset` | Pressed states, depth |

---

## Component Patterns

### Section Header

Every major section has a badge and uppercase title:

```html
<div class="section-header">
  <span class="section-header__badge">A</span>
  <h2>Section Title</h2>
</div>
```

Badges use sequential letters (A, B, C) or symbols ($, #).

### Station Numbers

Items within sections use numbered badges:

```html
<span class="station-number">01</span>
```

Numbers are zero-padded (01, 02, 03).

### Cards

Cards have consistent structure:

```html
<div class="card">
  <div class="card__header">
    <span class="card__number">01</span>
    <h3 class="card__title">Title</h3>
    <span class="card__status">Status</span>
  </div>
  <p class="card__description">Description text</p>
  <div class="card__tags">
    <span class="tag">Tag</span>
  </div>
</div>
```

### Track Lines

Vertical track lines connect related items:

```css
.track-line {
  position: absolute;
  left: 40px;
  top: 60px;
  bottom: 40px;
  width: 2px;
  background: var(--track-color);
}
```

Cards connect to track lines with horizontal connectors:

```css
.card::before {
  content: '';
  position: absolute;
  left: -36px;
  top: 50%;
  width: 34px;
  height: 2px;
  background: var(--track-color);
}
```

### Status Badges

```html
<span class="status status--success">Active</span>
<span class="status status--warning">Pending</span>
<span class="status status--error">Blocked</span>
```

---

## Animation Guidelines

### DO Use Animations For:

- **Hover feedback** - Border color, background, transform
- **State changes** - Selected, active, disabled transitions
- **Interactive elements** - Buttons, links, cards

### DON'T Use:

- **Continuous loops** - Blinking lights, pulsing indicators, rotating spinners (unless loading)
- **Staggered page loads** - All content should appear immediately
- **Decorative motion** - Animation that doesn't aid comprehension

### Timing

| Token | Duration | Usage |
|-------|----------|-------|
| `--transition-fast` | 0.1s | Color changes |
| `--transition-base` | 0.15s | Most transitions |
| `--transition-slow` | 0.2s | Transform, size changes |
| `--transition-slower` | 0.3s | Large movements |

### Easing

| Token | Curve | Usage |
|-------|-------|-------|
| `--ease-mechanical` | `cubic-bezier(0.2, 0, 0.2, 1)` | General mechanical feel |
| `--ease-snap` | `cubic-bezier(0.68, -0.1, 0.32, 1.1)` | Snappy with slight overshoot |
| `--ease-step-in` | `cubic-bezier(0.4, 0, 1, 1)` | Quick start |
| `--ease-step-out` | `cubic-bezier(0, 0, 0.2, 1)` | Quick end |

### Example: Card Hover

```css
.card {
  transition:
    transform 0.15s var(--ease-snap),
    background 0.1s var(--ease-step-out),
    border-color 0.1s var(--ease-step-out),
    box-shadow 0.15s var(--ease-mechanical);
}

.card:hover {
  transform: translateX(8px);
  background: var(--bg-elevated);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-lg);
}
```

---

## Do's and Don'ts

### Colors

- **DO** use `--bg-secondary` for cards on `--bg-primary` pages
- **DO** use `--text-secondary` for descriptions, `--text-muted` for labels
- **DON'T** use pure white (`#fff`) or pure black (`#000`)
- **DON'T** mix warm and cool grays

### Typography

- **DO** use uppercase with `--tracking-wider` for labels and badges
- **DO** use `--tracking-tight` for large headings
- **DON'T** use more than 3 font weights on one screen
- **DON'T** use font sizes outside the scale

### Layout

- **DO** align content to the station/track line system
- **DO** use consistent padding (`--spacing-lg` for cards, `--spacing-xl` for sections)
- **DON'T** break the grid without purpose
- **DON'T** use centered text except for special cases

### Components

- **DO** use station badges (A, B, C) for major sections
- **DO** use numbered items (01, 02, 03) within sections
- **DON'T** mix different badge styles
- **DON'T** skip numbers in sequences

---

## File Structure

```
shared/css/
├── tokens.css      # All CSS variables (colors, spacing, typography)
├── base.css        # Reset, body styles, scrollbars
├── buttons.css     # Button variants
├── forms.css       # Inputs, labels, selects
├── modals.css      # Modal dialogs
├── status.css      # Status messages
└── print.css       # Print styles

tools/<tool>/css/
├── <tool>-layout.css   # Grid, structure
├── <tool>-cells.css    # Cell/item styling
├── <tool>-edit.css     # Edit mode styles
└── <tool>-print.css    # Print overrides
```

---

## Adding New Components

1. Check if a shared component exists in `shared/css/`
2. Use design tokens for all values (never hardcode colors/sizes)
3. Follow the BEM-like naming: `.component`, `.component__element`, `.component--modifier`
4. Add hover states with mechanical transitions
5. Test in both normal and edit modes
6. Ensure print styles hide interactive elements

---

## Quick Reference

```css
/* Standard card */
.my-card {
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

/* Hover effect */
.my-card:hover {
  background: var(--bg-elevated);
  border-color: var(--border-strong);
  transform: translateX(4px);
}

/* Section badge */
.my-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--accent);
  color: var(--bg-primary);
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: var(--font-sm);
}

/* Station number */
.my-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--station-bg);
  border: 1px solid var(--station-border);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: var(--font-sm);
  color: var(--text-muted);
}

/* Status badge */
.my-status {
  font-size: var(--font-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.my-status--success {
  background: var(--status-success-subtle);
  color: var(--status-success);
}
```
