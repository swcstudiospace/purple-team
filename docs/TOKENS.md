# Purple Team UI design tokens

`docs/assets/tokens.css` holds the single `:root` custom-property block for
the static UI. All pages and the shared shell consume these variables; no
other file under `docs/` may carry literal colors.

## Planner defaults (flagged)

Programming-desk ships no light theme, so there was no upstream light palette
to inherit. The values below are planner-chosen defaults for this milestone,
picked for a white compartmentalized console with one red accent:

- White surfaces step down gently (background, surface, alternate surface)
  with a single neutral border, so cards read as compartments without chrome.
- Body copy stays near-black or mid-gray; red-as-text uses a darkened red
  that holds contrast on white. Bright red never sets body copy.
- Red is reserved for accents, active states, primary actions, and danger.
  Status uses its own hues (green, amber, blue) as full-color text on a
  low-alpha tinted surface — the opacity pattern — so status never competes
  with the single red accent.
- Focus is always visible with a two-pixel ring in the accent red; reduced
  motion removes transitions and animations entirely.

## Rules for contributors

- Add a color by adding a variable in `tokens.css`, then reference it with
  the `var()` function. Never write a literal color in a page, a script, or
  a stylesheet outside `tokens.css`.
- Keep red usage to accents, active states, primary actions, and danger.
- Status tints pair full-color text with the matching low-alpha surface.
- Honor reduced motion and the collapsed-nav breakpoint when adding layout.

## v1.1 component-system additions

Added for the complete redesign (buttons, inputs, cards, badges/chips, nav
drawer, modals, toasts, tabs) without touching the frozen palette:

- `--surface-raised` / `--surface-overlay` (`#FFFFFF`): cards that lift above
  the quiet `--surface` compartments, plus modal/drawer overlays.
- `--border-strong` (`#D4D4D4`): input and button borders that stay visible
  on white without adding chrome.
- `--text-faint` (`#8A8A8A`): group labels and placeholders only — never
  body copy.
- `--accent-red-crisp` (`#DC2626`): brand mark and the active-nav bar. Bright
  red never sets body copy; text accents stay on the darkened reds.
- `--success` / `--warning` with `--tint-success` / `--tint-warning`: plain
  aliases of the `--ok` / `--warn` hues in the same 12%-opacity pattern, so
  new component classes read without forking the status scale.
- `--shadow-raised` / `--shadow-pop`: the two elevation steps above the base
  `--shadow` (cards on hover, drawers, modals, toasts).
- `--radius-sm` / `--radius-lg`, `--space-1/2/3/4/6/8`, `--fs-display/title/
  h/body/small/xs/micro`: one type scale and spacing rhythm for every
  component.
- `--touch` (`44px`), `--trans-fast/med/slow` (150/200/250ms) with
  `--ease-out`: motion and target-size budgets — transitions animate
  color/opacity/transform only, and every one dies under the single
  `prefers-reduced-motion` block.
