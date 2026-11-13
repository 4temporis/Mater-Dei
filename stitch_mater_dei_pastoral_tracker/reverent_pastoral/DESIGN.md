---
name: Reverent Pastoral
colors:
  surface: '#f8f9ff'
  surface-dim: '#d7dae2'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3fc'
  surface-container: '#ebeef6'
  surface-container-high: '#e5e8f0'
  surface-container-highest: '#dfe2eb'
  on-surface: '#181c22'
  on-surface-variant: '#44474e'
  inverse-surface: '#2d3137'
  inverse-on-surface: '#eef1f9'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#465f88'
  primary: '#002046'
  on-primary: '#ffffff'
  primary-container: '#1b365d'
  on-primary-container: '#87a0cd'
  inverse-primary: '#aec7f7'
  secondary: '#815432'
  on-secondary: '#ffffff'
  secondary-container: '#ffc299'
  on-secondary-container: '#7a4e2d'
  tertiary: '#00270a'
  on-tertiary: '#ffffff'
  tertiary-container: '#043f16'
  on-tertiary-container: '#74ac77'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#aec7f7'
  on-primary-fixed: '#001b3d'
  on-primary-fixed-variant: '#2e476f'
  secondary-fixed: '#ffdcc5'
  secondary-fixed-dim: '#f6ba91'
  on-secondary-fixed: '#301400'
  on-secondary-fixed-variant: '#663d1d'
  tertiary-fixed: '#b6f1b6'
  tertiary-fixed-dim: '#9bd59c'
  on-tertiary-fixed: '#002107'
  on-tertiary-fixed-variant: '#1b5125'
  background: '#f8f9ff'
  on-background: '#181c22'
  surface-variant: '#dfe2eb'
typography:
  display-lg:
    fontFamily: Merriweather
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 44px
  headline-lg:
    fontFamily: Merriweather
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg-mobile:
    fontFamily: Merriweather
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Merriweather
    fontSize: 22px
    fontWeight: '400'
    lineHeight: 28px
  headline-sm:
    fontFamily: Merriweather
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.5rem
  margin: 1rem
  margin-tablet: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The visual identity embodies pastoral warmth, sacramental reverence, and steadfast dignity. Designed primarily for Eucharistic Ministers, pastoral visitors, parish staff, and care recipients, the aesthetic avoids corporate coldness and casual playfulness. Instead, it balances modern Android design language with the timeless grace of sacred tradition.

The design movement synthesizes Material You clarity with dignified sacred warmth:
- **Clean Structure:** Generous whitespace, grounded functional cards, and clear visual hierarchy ensure that volunteers and older parishioners can navigate urgent home visits or prayer intentions without cognitive strain.
- **Sacred Presence:** Rich Marian blues paired with warm architectural woods bring emotional solemnity and comfort.
- **Accessibility & Contrast:** High-contrast text, clear iconography, and intentional touch targets accommodate field conditions in hospital rooms, dimly lit chapels, and private homes.

## Colors

The color palette reflects ecclesiastical symbolism and liturgical grounding:
- **Primary (`#1B365D` - Marian Blue):** Conveys fidelity, grace, and authority. Used for prominent app bars, primary action buttons, key indicators, and active navigation targets.
- **Secondary (`#7A4E2D` - Warm Altar Wood):** Evokes cedar pews, parish hearth, and grounding human service. Applied to secondary chips, ministry assignment badges, and contextual highlights.
- **Tertiary (`#316638` - Liturgical Olive Green):** Symbolizes spiritual growth, pastoral healing, and renewed life. Used for completed pastoral visits, prayer confirmations, active statuses, and vital ministry indicators.
- **Neutral (`#5A5E65` - Weathered Stone):** A balanced, warm slate gray ensuring high legibility, clean dividers, and understated structural framing.

### Surface System
- **Surface (`#FDFBF7`):** Warm parchment-tinted white serving as the primary canvas, eliminating clinical glare.
- **Surface Container Low (`#F4EFEA`):** Used for elevated cards, schedule sections, and homebound parishioner logs.
- **Surface Container Highest (`#E5DFD7`):** Outline strokes, subtle input field backgrounds, and disabled states.

## Typography

The type system blends formal editorial reverence with crisp digital readability:
- **Headlines (`Merriweather`):** Applied to parishioner names, liturgical dates, feast day notices, and scripture headers. Merriweather provides warm serifs and dignified presence while retaining modern digital rendering across screens.
- **Body & Functional UI (`Inter`):** Powers addresses, clinical notes for sick visits, schedule details, form controls, and labels. Its tall x-height and neutral clarity prevent eye fatigue and maintain legibility at low brightness.
- **Scale Usage:** Liturgical headers and pastoral titles use `headline-lg` and `headline-md`. Clinical and pastoral notes prioritize `body-lg` to accommodate ministers reading in varied lighting.

## Layout & Spacing

The layout is built on an adaptive Android fluid grid:
- **Mobile Handsets (<600dp):** Single column fluid architecture with 16dp (`margin`) page margins and 16dp (`gutter`) gutters. All high-frequency actions stay within bottom-thumb reach.
- **Foldables & Tablets (600dp - 840dp+):** Expands to a multi-pane split view (e.g., patient route directory on the left, pastoral details and sacramental log on the right) with 32dp (`margin-tablet`) screen margins and 24dp (`gutter-tablet`) gutters.
- **Spacing Rhythm:** Based on an 8dp baseline grid (with 4dp micro-spacing). Internal card padding uses `space-md` (16dp) or `space-lg` (24dp) to give confidential pastoral information visual breathing room.

## Elevation & Depth

Visual hierarchy uses warm, ambient diffusion inspired by soft candlelight and stone structures rather than sharp industrial drop-shadows:
- **Level 0 (Flat):** Parchment base canvas (`#FDFBF7`) without shadows.
- **Level 1 (Cards & Patient Tiles):** Container tint (`#F4EFEA`) with a subtle 1dp hairline border (`#E5DFD7`) and an ambient shadow: `0px 2px 6px -1px rgba(27, 54, 93, 0.06)`. This subtle Marian blue undertone avoids mudiness.
- **Level 2 (Active Dialogs & Ministry Bottom Sheets):** Elevated container with `0px 8px 20px -3px rgba(27, 54, 93, 0.12)`, grounding modal prayer forms and dispatch updates.
- **Level 3 (Floating Action Button & Urgent Sacramental Alerts):** Lifted with `0px 12px 28px -4px rgba(27, 54, 93, 0.18)` for clear accessibility in time-critical pastoral care situations.

## Shapes

The shape system adopts a rounded approach (Level 2: 8dp base, 16dp large, 24dp extra-large):
- **Base Components (8dp / 0.5rem):** Buttons, text fields, notification banners, and status chips.
- **Containers & Cards (16dp / 1rem):** Visit cards, parishioner profiles, communion route itineraries, and liturgical readings.
- **Dialogs & Bottom Sheets (24dp / 1.5rem):** Top corners of modal sheets and dialog surfaces evoke soft, arched architectural motifs typical of sacred Romanesque and Mission-style architecture.

## Components

### Buttons
- **Primary Filled Button:** 48dp height minimum for touch compliance. Marian deep blue background (`#1B365D`), white label text (`Inter` SemiBold), 8dp border radius. Pressed state reveals a subtle warm gold/terracotta tint overlay.
- **Secondary Outlined Button:** 1.5dp border in warm terracotta (`#7A4E2D`), transparent fill, `#7A4E2D` text. Used for secondary pastoral actions like "Add Care Note" or "Reschedule".
- **Tonal Button:** Olive green surface container (`#E8EFE8`) with deep olive green text (`#316638`) for affirming positive milestones (e.g., "Communion Administered").

### Cards
- **Parishioner Care Card:** Rounded 16dp corners, `#F4EFEA` background, hairline border (`#E5DFD7`). Features Merriweather serif title for parishioner names, Inter body for addresses and medical/spiritual cautions, and prominent pastoral icon chips.

### Chips & Badges
- **Status Chips:** Rounded 8dp chips. Liturgical Green (`#316638` tint) indicates completed visits; Terracotta (`#7A4E2D` tint) indicates pending follow-up; Marian Blue indicates scheduled liturgy.
- **Sacramental Badges:** Compact visual markers indicating specific ministry needs (e.g., Anointing Needed, Viaticum, Pyx Recharged).

### Form Controls (Inputs, Checkboxes, Radios)
- **Input Fields:** Filled style with a warm `#F4EFEA` background, 8dp top radius, and an active 2dp Marian Blue bottom indicator line. Error states leverage a solemn deep crimson rather than a jarring neon red.
- **Checkboxes & Radios:** Colored with `#1B365D` when active, with smooth Material transitions. Checkboxes on liturgical checklists (e.g., purificator, corporal, ritual book verified) provide clear visual verification.

### Pastoral Domain Components
- **Ritual & Scripture Reader Tile:** Full-width card with increased line-height (`Merriweather` text) optimized for bedside prayer delivery, equipped with high-contrast text and a quick-toggle font scaler.
- **Emergency Sacramental Dispatch Banner:** High-visibility banner featuring a deep Marian Blue background, white serif callout, and direct phone link to the priest on duty.