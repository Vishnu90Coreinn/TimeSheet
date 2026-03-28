# Sprint 40 — Branding Page UX Overhaul

**Date:** 2026-03-28
**Branch:** `feature/sprint-40-branding-ux`
**Status:** Approved — ready for implementation planning
**Goal:** Rebuild the Branding admin page from a flat form into a professional, tab-structured settings page with a custom colour picker, drag-and-drop asset uploads, live multi-screen preview, brand preset templates, and an unsaved-changes banner.

---

## Sprint Decomposition Context

The full branding roadmap spans three sprints:

| Sprint | Theme | Scope |
|--------|-------|-------|
| **40** | Branding UX Foundation | This spec |
| 41 | Extended Brand Controls | Secondary/accent colours, dark mode variants, typography, custom CSS, JSON import/export |
| 42 | Enterprise Branding | Email template branding, login page customisation, branding history/version control, multi-locale names |

---

## Sprint 40 Scope

### In scope
- 6-tab page layout (Identity / Colors / Assets / Login / Emails / Advanced)
- Custom colour picker: saturation/brightness square + hue strip + WCAG AA/AAA contrast badge
- 6 brand colour preset templates (client-side, no backend)
- Drag-and-drop logo + favicon upload with dual-background (light + dark) thumbnail preview
- Live preview panel with Sidebar / Dashboard / Login screen switcher
- Single shared form state via `useBrandingForm` hook
- Unsaved changes sticky banner with Discard + Save actions
- No backend schema changes required

### Out of scope (Sprint 41+)
- Secondary, accent, background, text colours
- Dark mode logo/colour variants
- Typography / font selector
- Custom CSS override
- JSON branding export/import
- Email template branding
- Login page background/tagline customisation
- Branding history / version control
- Multi-locale app names

---

## Architecture

### Component structure

```
components/Admin/Branding/
├── TenantBranding.tsx          ← page shell: tab bar, header, dirty banner, Save button
├── useBrandingForm.ts          ← all form state, dirty tracking, load/save/reset logic
├── BrandingPreview.tsx         ← right panel: screen switcher (Sidebar | Dashboard | Login)
├── ColorPicker.tsx             ← saturation square + hue strip + hex input + WCAG badge
├── tabs/
│   ├── IdentityTab.tsx         ← App Name only
│   ├── ColorsTab.tsx           ← ColorPicker + brand preset grid
│   ├── AssetsTab.tsx           ← drag-and-drop Logo + Favicon upload
│   ├── LoginTab.tsx            ← placeholder (Sprint 42)
│   ├── EmailsTab.tsx           ← placeholder (Sprint 42)
│   └── AdvancedTab.tsx         ← Custom Domain (active) + CSS/JSON stubs (locked)
```

The existing `TenantBranding.tsx` (390 lines, single file) is replaced by this folder. The old file is deleted.

### Page layout (Option B)

Horizontal tab bar spans the top of the form card. Left column holds the active tab's fields. Right column (fixed, ~360px) holds `BrandingPreview` at all times. Both columns are visible simultaneously on lg+ screens; on mobile the preview collapses below the form.

```
┌─────────────────────────────────────────────────────────────────┐
│  Branding                              [You have unsaved changes] │
│  Customise your organisation's appearance       [Save Branding ▶] │
├──────────────────────────────────────┬──────────────────────────┤
│ Identity | Colors | Assets | Login*  │  LIVE PREVIEW            │
│          | Emails* | Advanced        │  [Sidebar][Dashboard][Login]│
├──────────────────────────────────────┤                          │
│  <active tab content>                │  <preview mockup>        │
│                                      │                          │
└──────────────────────────────────────┴──────────────────────────┘
* = placeholder tab (Sprint 42)
```

---

## `useBrandingForm` Hook

**Responsibilities:** fetch settings on mount, hold all mutable form state, expose `setField()`, `setLogoFile()`, `setFaviconFile()`, `save()`, `reset()`, and `isDirty` flag.

**State shape:**
```typescript
interface BrandingFormState {
  appName: string;
  primaryColor: string;
  customDomain: string;
  logoFile: File | null;
  faviconFile: File | null;
  currentLogoUrl: string | null;
  currentFaviconUrl: string | null;
}
```

**Dirty tracking:** `isDirty` is `true` when any field differs from the last successfully saved snapshot. Resets to `false` after a successful save or after `reset()`.

**Save:** uses raw `fetch` with `FormData` (same pattern as existing code — `apiFetch` can't handle multipart). On success, updates the saved snapshot, calls `applyBrandColor()` and updates `document.title`.

**No navigation guard** in Sprint 40 — the unsaved-changes banner is sufficient. A `beforeunload` guard can be added in Sprint 41.

---

## Tab Specifications

### Tab 1 — Identity
- **App Name**: text input, `required`, max 100 chars. App name appears live in the preview sidebar and login card. `document.title` is only updated on save.

### Tab 2 — Colors
- **Primary Colour**: `ColorPicker` component (see below).
- **Brand Presets**: 3×2 grid of preset cards. Each card shows three colour swatches (500 / 400 / 200 stops), a name, and a tagline. Clicking applies the preset's hex-500 value to `primaryColor` immediately — the preview and picker update live.

Preset data (client-side constants, no backend):

| Name | Hex-500 | Tagline |
|------|---------|---------|
| Indigo | `#6366f1` | Default |
| Ocean Blue | `#0ea5e9` | Professional |
| Emerald | `#10b981` | Fresh |
| Amber | `#f59e0b` | Warm |
| Rose | `#f43f5e` | Bold |
| Slate | `#64748b` | Neutral |

### Tab 3 — Assets

**Logo upload zone:**
- Drag-and-drop target + click-to-browse fallback
- On file drop/select: show thumbnail on both a white background and a dark (`#1e1b4b`) background side-by-side — admins must verify the logo works on both
- Accept: `.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`
- Hint: "Recommended: 200×60 px PNG or SVG. Shown in the sidebar."
- Remove button clears the staged file or calls `DELETE /tenant/settings/logo` if a saved URL exists

**Favicon upload zone:**
- Same drag-and-drop pattern, single 32×32 thumbnail preview
- Accept: `.png`, `.ico`, `.svg`
- Hint: "Recommended: 32×32 px ICO or PNG."
- Remove button clears or calls `DELETE /tenant/settings/favicon`

### Tab 4 — Login Page *(placeholder)*
- "Coming soon" empty state with a lock icon and "Login page customisation ships in a future update."
- The Login screen in `BrandingPreview` is still active — it shows the current brand colour + logo on the login card even without this tab being functional.

### Tab 5 — Emails *(placeholder)*
- "Coming soon" empty state. Shows a static email preview mockup using current branding.

### Tab 6 — Advanced
- **Custom Domain**: text input, optional, max 255 chars, placeholder `app.yourcompany.com`. Hint: "Leave blank to use the default domain." Lives here only — not duplicated in Identity.
- **Custom CSS** (locked stub): greyed-out textarea with badge "Coming in Sprint 41". No interaction.
- **JSON Export / Import** (locked stub): greyed-out buttons with badge "Coming in Sprint 41". No interaction.

---

## `ColorPicker` Component

**Props:** `value: string` (hex), `onChange: (hex: string) => void`

**Internals (all client-side, no library needed):**
1. **Saturation/brightness square** — CSS gradient overlay (`white→hue` left-to-right, `transparent→black` top-to-bottom). Pointer events update saturation (x-axis) and brightness (y-axis). Uses `useRef` + `pointermove` for drag.
2. **Hue strip** — horizontal `linear-gradient` across all hues. Drag updates the hue channel.
3. **Hex input** — controlled text input, validates `/^#[0-9a-fA-F]{6}$/` on blur. Syncs back to the square/strip on valid input.
4. **WCAG badge** — calculates relative luminance of the chosen colour vs white (`#ffffff`). Contrast ratio formula per WCAG 2.1. Displays:
   - `AA ✓` (green) if ratio ≥ 4.5:1
   - `AA ✗` (yellow) if ratio 3:1–4.49:1
   - `Fail` (red) if ratio < 3:1
   - AAA note (ratio ≥ 7:1 shows `AAA ✓`)

All colour math is pure TypeScript — no external library. The existing `hexToHsl` / `hslToHex` / `buildScale` utilities in `TenantSettingsContext.tsx` are extracted to `utils/colorUtils.ts` and shared between `ColorPicker` and `applyBrandColor`.

---

## `BrandingPreview` Component

**Props:** receives live form state from `useBrandingForm` directly (passed down from `TenantBranding`).

**Screen switcher:** three pill buttons — `Sidebar`, `Dashboard`, `Login`. Active screen shown below.

**Sidebar screen:** mirrors the real `AppShell` sidebar — logo/monogram, app name, mock nav items with brand colour on the active item.

**Dashboard screen:** shows stat cards with brand colour on values and icon backgrounds, a primary CTA button, and a progress bar — all using the live `primaryColor`.

**Login screen:** centred card with logo/monogram, app name, two placeholder input fields, and a Sign In button in the brand colour.

All three screens apply colour via inline `style` props using `form.primaryColor` directly — they do **not** call `applyBrandColor()` (that would mutate the real app's CSS variables). `applyBrandColor()` is only called on save.

---

## Unsaved Changes Banner

Renders at the top of the page content area (below the page header, above the tabs) when `isDirty === true`.

```
┌──────────────────────────────────────────────────────────────────┐
│  ● You have unsaved changes          [Discard]  [Save Branding ▶] │
└──────────────────────────────────────────────────────────────────┘
```

- Yellow background (`bg-warning-subtle`), amber border
- **Discard** calls `reset()` — reverts all fields to last saved snapshot, clears staged files
- **Save Branding** calls `save()` — same as the header button
- Both buttons are also present in the page header at all times (Save always visible, Discard only in the banner)

---

## Backend Changes

**None required for Sprint 40.** The existing `TenantSettings` entity and endpoints are sufficient:

| Endpoint | Used for |
|----------|----------|
| `GET /api/v1/tenant/settings` | Load on mount |
| `PUT /api/v1/tenant/settings` (multipart) | Save all fields + file uploads |
| `DELETE /api/v1/tenant/settings/logo` | Remove logo |
| `DELETE /api/v1/tenant/settings/favicon` | Remove favicon |

---

## Files Changed / Created

| Action | Path |
|--------|------|
| Delete | `apps/web/src/components/Admin/TenantBranding.tsx` |
| Create | `apps/web/src/components/Admin/Branding/TenantBranding.tsx` |
| Create | `apps/web/src/components/Admin/Branding/useBrandingForm.ts` |
| Create | `apps/web/src/components/Admin/Branding/BrandingPreview.tsx` |
| Create | `apps/web/src/components/Admin/Branding/ColorPicker.tsx` |
| Create | `apps/web/src/components/Admin/Branding/tabs/IdentityTab.tsx` |
| Create | `apps/web/src/components/Admin/Branding/tabs/ColorsTab.tsx` |
| Create | `apps/web/src/components/Admin/Branding/tabs/AssetsTab.tsx` |
| Create | `apps/web/src/components/Admin/Branding/tabs/LoginTab.tsx` |
| Create | `apps/web/src/components/Admin/Branding/tabs/EmailsTab.tsx` |
| Create | `apps/web/src/components/Admin/Branding/tabs/AdvancedTab.tsx` |
| Create | `apps/web/src/utils/colorUtils.ts` |
| Update | `apps/web/src/contexts/TenantSettingsContext.tsx` (import colorUtils) |
| Update | `apps/web/src/App.tsx` (update import path for TenantBranding) |

---

## Acceptance Criteria

- [ ] Tab bar renders with all 6 tabs; Login and Emails tabs show placeholder states
- [ ] Colour picker: dragging the square or strip updates the hex field and live preview in real time
- [ ] WCAG badge updates on every colour change
- [ ] Clicking a brand preset updates the picker and live preview immediately
- [ ] Logo and favicon zones accept drag-and-drop and click-to-browse
- [ ] Logo preview shows on both white and dark backgrounds
- [ ] Live preview switches between Sidebar, Dashboard, and Login screens
- [ ] All three preview screens reflect `primaryColor`, logo, and app name live
- [ ] `isDirty` banner appears on first change; disappears after save or discard
- [ ] Save persists to backend, calls `applyBrandColor()`, and updates `document.title`
- [ ] Discard reverts all fields to last saved state
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No new backend migrations required
