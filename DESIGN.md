# HyperFrames Studio Design System

## 1. Product Tone

HyperFrames Studio is a focused video production workbench for turning scripts, documents, and WeChat articles into HyperFrames-ready video projects. It should feel clear, quick, and operational: a dark command center for creators who want to configure providers once, then move through a repeatable production flow.

Keywords: minimal, dark, precise, maker-oriented, calm under load.

## 2. Color Tokens

The interface is a dark workbench. Surfaces step up in lightness to signal elevation; a luminous emerald accent carries every interactive and status cue.

Surfaces and lines:

- `--canvas`: `#0b0c0e` (page, with a subtle radial graph toward the top-right)
- `--surface`: `#15171b`
- `--surface-2`: `#1c1f25`
- `--surface-3`: `#22262d`
- `--border`: `rgba(255,255,255,.08)`
- `--border-strong`: `rgba(255,255,255,.14)`
- `--highlight`: `rgba(255,255,255,.04)` (1px inset top highlight)

Text:

- `--text`: `#f3f4f6`
- `--text-muted`: `#9aa1ab`
- `--text-soft`: `#6b7280`

Accent and status (status colors use low-alpha fills over dark surfaces):

- `--accent`: `#34d39a`
- `--accent-strong`: `#10b981`
- `--accent-ink`: `#04140d` (text on accent fills)
- `--accent-soft`: `rgba(52,211,154,.12)`
- `--accent-line`: `rgba(52,211,154,.32)` (focus rings, selected borders)
- `--blue`: `#7cc4ff` / soft `rgba(124,196,255,.12)`
- `--amber`: `#f4c668` / soft `rgba(244,198,104,.13)`
- `--red`: `#ff8b7a` / soft `rgba(255,139,122,.12)`

Large surfaces use the dark neutrals. Accent color appears in primary actions, selected workflow steps and choices, provider status dots, focus rings, and small emphasis blocks. Prefer subtle inset highlights over heavy drop shadows.

## 3. Typography

- UI font: `SF Pro Display`, `Geist Sans`, `Helvetica Neue`, Arial, sans-serif
- Editorial font: `Newsreader`, Georgia, serif
- Mono font: `SF Mono`, `JetBrains Mono`, Menlo, monospace

Scale:

- `--text-xs`: `12px`, line height `16px`
- `--text-sm`: `14px`, line height `20px`
- `--text-md`: `16px`, line height `24px`
- `--text-lg`: `20px`, line height `28px`
- `--text-xl`: `28px`, line height `34px`
- `--text-display`: `44px`, line height `48px`

Letter spacing is `0` except uppercase metadata labels at `0.06em`.

## 4. Spacing And Layout

Base unit: `4px`.

- `--space-1`: `4px`
- `--space-2`: `8px`
- `--space-3`: `12px`
- `--space-4`: `16px`
- `--space-5`: `20px`
- `--space-6`: `24px`
- `--space-8`: `32px`
- `--space-10`: `40px`
- `--space-12`: `48px`

Workbench layout:

- Left sidebar: `248px`
- Main content: centered column, `max-width: 920px`, generous padding
- Right configuration panel: `372px`
- No cards: content sits on the canvas, organized by whitespace and hairline (`--border-soft`) dividers — never boxed panels or drop shadows.
- Inputs: `12px` radius, low-contrast `--field` fill, no visible border at rest.

## 5. Components

- App shell: three-column layout with persistent sidebar, central workflow editor, and provider/config panel. Columns are separated by single hairline borders, not fills.
- Page hero: large tight-tracked sans title (`-0.03em`) plus a one-line lede; no serif.
- Sections: open blocks separated by a top hairline and ~48px of space, each with a quiet header (title + mono meta), not a card.
- Step rail: minimal numbered nav with active, complete (check), warn, and idle states.
- Workflow timeline: connected dots with a status word (no filled pills).
- Provider tabs: underline-style segmented control; selected uses an `--accent` underline.
- Primary button: pill, `--accent` background, `--accent-ink` text.
- Secondary button: pill, transparent with `--border-strong`.
- Save bar: sticky panel footer showing dirty-state badge (`--amber`) or last-saved time, with the save action disabled when clean.
- Toasts: top-right transient notifications for save / draft / error feedback.
- Danger state: use `--red-soft` and `--red`; never bright red fills.

## 6. States

- Hover: background steps up one surface level, or to `--accent-soft` for selected controls.
- Focus: `--accent-line` border with a 3px `--accent-soft` ring.
- Disabled: opacity `0.5`, cursor `not-allowed`.
- Loading: skeleton placeholders for results; buttons show a spinner alongside a text label (e.g. 生成中…), never a spinner alone.
- Empty: useful prompt and one clear action.
- Error: inline message near the failed control, plus persistent status in the right panel.

## 7. Motion

Motion is quiet and functional. Use `transform` and `opacity` only:

- Page entry: fade in with `translateY(8px)` over `180ms`.
- Button active: `scale(0.98)` over `120ms`.
- Panel changes: opacity transition over `160ms`.

Respect `prefers-reduced-motion`.
