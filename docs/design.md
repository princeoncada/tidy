# Tidy Design System

This document is the single source of truth for Tidy UI and design contracts.
Normative statements use **must**, **must not**, **required**, or explicit token
tables. Explanatory text gives rationale but does not weaken those contracts.

This document includes target contracts for later phases. A target described
here is not evidence that the runtime already implements it.

## Contract Maturity

- **Current**: implemented in the product and checked for design parity.
- **Target: X.Y.Z**: normative for the named implementation phase but not yet
  Current.
- **Deferred: X.Y.Z**: intentionally outside the active contract; the named
  phase owns its product behavior and detailed design.

Runtime-facing sections must carry one of these labels. An implementation phase
changes a Target contract to Current only after its controller-run validation
and design-parity review succeed.

| Contract | Maturity |
| --- | --- |
| Semantic tokens and dark mode | Current |
| Collapsible sidebar and canvas shell | Target: 3.2.1 |
| Workspace navigation in the shell | Target: 3.2.2 |
| Item detail panel and existing notes integration | Deferred: 3.3.0 |
| Item status and assignee properties | Deferred: 3.3.1 |
| Board, sharing polish, presence, and rollups | Deferred: 3.4.x |

## Design Principles

1. **Content first.** Lists, items, and collaboration state take priority over
   ornamental chrome.
2. **Low visual noise.** Use restrained decoration, clear hierarchy, and a
   small number of meaningful emphasis levels.
3. **Semantic consistency.** Shared roles and states use system tokens and
   component contracts, not page-specific colors or spacing.
4. **Accessible by contract.** Keyboard operation, visible focus, sufficient
   contrast, responsive behavior, and reduced motion are requirements.
5. **Local-first feedback.** Visual feedback must preserve Tidy's optimistic
   interaction model. Design work must not add blocking server round trips,
   reintroduce retired render paths, or imply persistence before the existing
   synchronization contracts provide it.

## Semantic Token Contract

**Maturity: Current**

Feature code must consume semantic roles rather than raw color names or values.
Phase 3.2.0 owns the runtime variable names and final color values. If those
implementation choices alter this contract, it must update this document in the
same phase.

### Color Roles

| Role | Required use |
| --- | --- |
| canvas | App/page background and lowest visual layer |
| surface | Primary content surfaces |
| surface-raised | Menus, popovers, dialogs, and elevated panels |
| surface-muted | Subdued regions and secondary controls |
| text | Primary readable content |
| text-muted | Secondary information that remains legible |
| text-inverse | Text placed on strong or inverse backgrounds |
| border | Standard boundaries and separators |
| border-strong | Emphasized boundaries without using focus styling |
| accent | Primary action and active emphasis |
| accent-foreground | Content placed on the accent role |
| success | Successful or completed status |
| warning | Caution requiring attention but not destructive action |
| destructive | Destructive actions and errors |
| focus | Keyboard focus indicator only |
| selection | Selected rows, navigation, or text-adjacent selection state |
| overlay | Backdrop separating modal content from the canvas |

Every role must define light and dark values. Theme pairs must preserve the
same semantic hierarchy rather than mechanically invert luminance. Text,
interactive controls, status indicators, and focus rings must meet applicable
WCAG contrast expectations. Muted and disabled styling must remain legible and
must not rely on color alone to communicate meaning.

### Runtime Color Values

The semantic layer is additive over the existing shadcn variables. The logical
`accent` and `accent-foreground` roles use `--accent-role` and
`--accent-foreground-role` at runtime to avoid colliding with shadcn's
`--accent` variables. The `border` and `destructive` roles intentionally reuse
the existing `--border` and `--destructive` variables.

| Role | Runtime variable | Light | Dark |
| --- | --- | --- | --- |
| canvas | `--canvas` | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` |
| surface | `--surface` | `oklch(1 0 0)` | `oklch(0.205 0 0)` |
| surface-raised | `--surface-raised` | `oklch(1 0 0)` | `oklch(0.245 0 0)` |
| surface-muted | `--surface-muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| text | `--text` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` |
| text-muted | `--text-muted` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` |
| text-inverse | `--text-inverse` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` |
| border | `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` |
| border-strong | `--border-strong` | `oklch(0.85 0 0)` | `oklch(1 0 0 / 22%)` |
| accent | `--accent-role` | `oklch(0.55 0.18 264)` | `oklch(0.62 0.17 264)` |
| accent-foreground | `--accent-foreground-role` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` |
| success | `--success` | `oklch(0.60 0.13 150)` | `oklch(0.68 0.14 150)` |
| warning | `--warning` | `oklch(0.75 0.15 80)` | `oklch(0.80 0.14 80)` |
| destructive | `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| focus | `--focus` | `oklch(0.55 0.18 264)` | `oklch(0.62 0.17 264)` |
| selection | `--selection` | `oklch(0.95 0.03 264)` | `oklch(0.30 0.05 264)` |
| overlay | `--overlay` | `oklch(0 0 0 / 40%)` | `oklch(0 0 0 / 55%)` |

### Typography

Use a system-oriented sans-serif stack unless a later approved design decision
changes it. The scale is `12`, `14`, `16`, `20`, `24`, and `32` CSS pixels.
Default body copy is `14/20`; compact metadata is `12/16`; primary reading copy
is `16/24`. Use weights `400`, `500`, `600`, and `700` only. Hierarchy must come
from role, size, weight, and spacing rather than arbitrary one-off values.

### Spacing and Sizing

The base spacing unit is 4 CSS pixels. The permitted scale is `0`, `4`, `8`,
`12`, `16`, `20`, `24`, `32`, `40`, `48`, and `64`. Prefer the smallest value
that clearly separates the intended groups. Standard interactive targets must
be at least 40 by 40 CSS pixels; compact controls may be 32 pixels only when an
adjacent layout preserves keyboard access and an adequate pointer target.

### Shape, Elevation, and Layers

- Radius scale: `0`, `4`, `8`, `12`, and `9999` CSS pixels. The pill radius is
  reserved for badges, avatars, and intentionally pill-shaped controls.
- Elevation levels: `none`, `raised`, and `modal`. Borders establish normal
  structure; shadows communicate actual elevation, not decoration.
- Layer levels: base content `0`, sticky shell `10`, menus/popovers `20`, modal
  backdrop `30`, modal content `40`, and transient notices `50`.

### Motion

Use durations `0`, `120`, `180`, and `240` milliseconds. Small state changes use
120ms, standard transitions 180ms, and structural transitions no more than
240ms. Motion must explain state or spatial continuity. It must not delay input
or persistence feedback. Reduced-motion mode must remove nonessential movement
and replace spatial transitions with immediate state changes or short fades.

### Layout Dimensions

The target expanded sidebar is 256 CSS pixels, with a supported range of
240-288 pixels. The collapsed desktop rail is 56 CSS pixels. Main content uses
16px gutters on small screens, 24px on standard desktop screens, and 32px on
wide screens. Reading-oriented content may set its own documented maximum
width; the task canvas must use available space without causing page-level
horizontal overflow.

## Dark-Mode Intent

**Maturity: Target: 3.2.0**

Dark mode is a first-class theme, not an inverted afterthought. It must preserve
surface depth, text hierarchy, interaction-state parity, visible focus, and
legible muted and disabled states. Success, warning, destructive, selection,
and accent roles must retain their meaning in both themes.

Theme provider behavior, persistence, system-theme detection, runtime CSS, and
the final light/dark values are explicitly deferred to 3.2.0.

## Sidebar and Canvas Shell

**Maturity: Target: 3.2.1**

On desktop, the sidebar and main canvas form one application shell. The sidebar
is persistent while expanded and becomes an icon rail when collapsed. Collapse
must preserve the user's current content and keyboard focus logically; it must
not remount or reset the dashboard data surface.

The canvas owns primary page scrolling unless a bounded component has a clear
independent-scroll contract. Sticky regions must not obscure focused content.
Focus order follows the visual reading order: shell controls, navigation, then
canvas content.

At widths where the expanded sidebar would make the canvas unusable, navigation
becomes an overlay/drawer and the canvas retains the full viewport width. The
overlay must trap focus while open, close predictably, and return focus to its
trigger. No supported viewport may introduce page-level horizontal overflow.

Workspace switching and navigation behavior are deferred to 3.2.2. This shell
contract does not claim that the shell exists before 3.2.1.

## Component Contracts

**Maturity: Target: 3.2.0 for shared primitives; later product phases own their
specialized surfaces**

All interactive components must define these applicable states:

- **default**: clear purpose and hierarchy;
- **hover**: supplemental pointer feedback, never the only affordance;
- **active**: immediate pressed or current-operation feedback;
- **focus-visible**: a persistent, unobscured focus token independent of hover;
- **disabled**: noninteractive, legible, and exposed semantically;
- **loading**: prevents duplicate action while retaining the control's identity;
- **selected**: distinct from hover and expressed beyond color alone;
- **validation error**: associated message plus destructive/error semantics;
- **destructive**: visually and textually clear before irreversible action.

Buttons and inputs must retain accessible names and predictable keyboard
behavior. Icon-only actions require accessible labels and tooltips where the
meaning is not universal. Icons supplement labels and state; they must not be
the sole carrier of essential meaning.

Cards and surfaces use the elevation hierarchy consistently. Menus, popovers,
dialogs, and panels must manage focus, dismissal, labelling, and stacking.
List rows and navigation items must provide consistent density, selection, and
action placement without shrinking required interaction targets.

These contracts govern presentation and interaction quality. They do not add
product behavior assigned to the item-panel, workspace, board, sharing, or
presence phases.

## Responsive, Accessibility, and Motion Rules

- Use semantic HTML before adding ARIA. ARIA supplements rather than replaces
  native semantics.
- Every action must be keyboard reachable and operable, with visible focus.
- Focus must not be hidden behind sticky content, overlays, or animation.
- Pointer targets follow the token sizing contract and must not overlap.
- Responsive layouts must preserve task order and meaning, not merely hide
  required actions.
- Supported widths must not cause page-level horizontal overflow; bounded data
  regions may scroll only when their contract makes that behavior clear.
- Status must not be communicated by color alone.
- `prefers-reduced-motion` must disable nonessential movement.
- Loading and optimistic states must not cause avoidable layout shifts or erase
  the user's latest local intent.

## Bidirectional Consistency Rule

Design and runtime implementation must remain consistent in both directions:

1. **Design to code.** A visual implementation phase must identify the applicable
   contracts in this document, implement them, and include controller-run parity
   checks in its validation plan.
2. **Code to design.** If an intentional runtime decision changes a token,
   component, shell, accessibility, or interaction contract, the same phase
   must update this document.
3. Proposed contracts remain Target or Deferred until implemented. Each
   implementation phase must explicitly identify the contracts it moves to
   Current.
4. Unintentional disagreement is drift. It must be reconciled before the phase
   closes; runtime code must not silently redefine the design system.

## Phase Ownership

| Phase | Owned design contracts | Required design proof |
| --- | --- | --- |
| 3.2.0 | Current: semantic token implementation, final light/dark values, theme behavior, shared primitive parity | Theme toggle manual proof, contrast/focus review, and token parity |
| 3.2.1 | Desktop/mobile shell, sidebar collapse, canvas sizing, responsive overflow and focus behavior | Collapse/expand and responsive manual proof plus shell parity |
| 3.2.2 | Workspace navigation inside the established shell | Workspace-switch proof plus navigation-state and accessibility parity |

Later phases must extend this table or document their specialized contracts
without pulling their product behavior into an earlier phase.

The sidebar/canvas-shell and workspace-navigation contracts remain Target for
3.2.1 and 3.2.2 respectively.

## Visual Phase Parity Checklist

- Identify the design contracts in scope and their maturity before editing.
- Use semantic tokens; record and reconcile any new role.
- Check light and dark states when theming is Current.
- Check default, hover, active, focus-visible, disabled, loading, selected,
  validation-error, and destructive states where applicable.
- Check keyboard operation, accessible names, contrast, reduced motion, and
  supported responsive widths.
- Confirm optimistic/local-first feedback and existing product invariants remain
  intact.
- Update this document for intentional contract changes.
- Move a Target contract to Current only after implementation and parity proof.

Phase 3.0.4 is documentation-only. It has no runtime integration, unit/E2E test
requirement, or manual product proof.
