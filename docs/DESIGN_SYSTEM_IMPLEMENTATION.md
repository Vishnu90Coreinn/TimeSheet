# Design System Implementation Summary

## Files Created

| File | Purpose |
|---|---|
| `apps/web/src/styles/design-system.css` | CSS custom properties (tokens) + all reusable component classes |
| `apps/web/src/components/AppShell.tsx` | Sticky top nav + sidebar layout wrapping all authenticated pages |
| `docs/DESIGN_SYSTEM.md` | Design system reference documentation |
| `docs/DESIGN_SYSTEM_IMPLEMENTATION.md` | This file |

## Files Modified

| File | Change |
|---|---|
| `apps/web/index.html` | Updated Google Fonts from DM Sans → Plus Jakarta Sans + Inter |
| `apps/web/src/main.tsx` | Added `import './styles/design-system.css'` before legacy styles |
| `apps/web/src/App.tsx` | Replaced inline header/nav with `<AppShell>` component |
| `apps/web/src/styles.css` | Replaced all hardcoded values with CSS variables; kept AttendanceWidget styles |
| `apps/web/src/components/Login.tsx` | Updated scoped `font-family` strings to `var(--font-display)` |
| `apps/web/src/components/Dashboard.tsx` | Heading styled with design system variables |
| `apps/web/src/components/Notifications.tsx` | Replaced inline styles with design system variables; redesigned dropdown |
| `apps/web/src/components/Approvals.tsx` | Applied `.table-base`, `.btn-*`, `.badge-*`, `.input-field`, `.page-title` |
| `apps/web/src/components/Leave.tsx` | Applied full design system: form labels, table, badges, alert, buttons |
| `apps/web/src/components/Reports.tsx` | Applied `.table-base`, `.btn-*`, `.form-label`, `.input-field`, `.card` |
| `apps/web/src/components/Admin/Projects.tsx` | Applied all design system classes; removed all inline styles |
| `apps/web/src/components/Admin/Categories.tsx` | Applied all design system classes; removed all inline styles |
| `apps/web/src/components/Admin/Users.tsx` | Applied all design system classes; removed all inline styles |
| `apps/web/src/components/Admin/Holidays.tsx` | Applied all design system classes; removed all inline styles |

> Note: `Timesheets.tsx` and `AttendanceWidget.tsx` use scoped `<style>` template literals.
> Their CSS variables (`var(--font-display)`, `var(--color-primary)`, etc.) correctly resolve
> from `design-system.css` since it is globally imported. A future refactor could extract
> these into `design-system.css` as well.

## Pages/Components Not Fully Migrated

| Component | Reason |
|---|---|
| `Timesheets.tsx` | Uses scoped inline `<style>` string (Task 3 implementation). Variables are used but classes are local. Full migration deferred. |
| `AttendanceWidget.tsx` | Uses scoped inline `<style>` string (Task 4 implementation). Same as above. |
| `Dashboard.tsx` | Dashboard content is a raw `<pre>` JSON dump — no structured UI to style. Full redesign is a separate task. |

## Design Decisions

- **No new framework introduced.** All styling uses the single `design-system.css` file.
- **`AppShell` replaces the old flat header.** The sidebar groups nav items by role (Main / Management / Admin) with SVG icons.
- **Font changed:** DM Sans → Plus Jakarta Sans (`--font-display`). Scoped styles in Login and Timesheets updated to use `var(--font-display)`.
- **Legacy `.card` class** is kept in `styles.css` with `display:flex; flex-direction:column; gap:var(--space-4)` for backward compatibility with components that rely on that flex behaviour.
- **Table headers** in all admin/manager pages now use `.table-base` with uppercase, letter-spaced column headers and row hover.
- **Badges** replace plain text for status fields (active/inactive, approved/rejected, billable/non-billable, recurring/one-time).
