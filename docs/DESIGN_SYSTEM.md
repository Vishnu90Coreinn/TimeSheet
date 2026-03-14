# TimeSheet Design System — v1.0

## 1. Overview

**Design direction:** White/blue modern SaaS — clean, structured, and refined.
Think Notion meets Linear: strong typographic hierarchy, generous whitespace, purposeful colour use.

**Fonts:**
- Headings, labels, nav → `Plus Jakarta Sans` (via Google Fonts)
- Body text, inputs, tables → `Inter` (via Google Fonts)

**Palette:** White base, primary blue (#1E40AF), semantic status colours.

**Source file:** `apps/web/src/styles/design-system.css`
**Import point:** `apps/web/src/main.tsx` (before `styles.css`)

---

## 2. Colors

| Variable | Hex | Use |
|---|---|---|
| `--color-primary` | `#1E40AF` | Primary buttons, active nav, headings |
| `--color-primary-hover` | `#1D4ED8` | Primary button hover |
| `--color-primary-light` | `#3B82F6` | Links, focus rings, secondary borders |
| `--color-background` | `#FFFFFF` | Cards, inputs, nav, modal backgrounds |
| `--color-surface` | `#F8FAFC` | Page background, table row hover |
| `--color-surface-raised` | `#EFF6FF` | Active nav items, table headers, info banners |
| `--color-border` | `#DBEAFE` | Card borders, nav borders |
| `--color-border-subtle` | `#E2E8F0` | Input borders (default) |
| `--color-border-focus` | `#3B82F6` | Input focus border |
| `--color-text-primary` | `#0F172A` | Main body text, headings |
| `--color-text-secondary` | `#475569` | Supporting text, table cells |
| `--color-text-muted` | `#94A3B8` | Placeholders, timestamps, hints |
| `--color-text-on-primary` | `#FFFFFF` | Text on coloured buttons |
| `--color-error` | `#DC2626` | Errors, destructive actions |
| `--color-error-light` | `#FEE2E2` | Error background |
| `--color-success` | `#16A34A` | Success states |
| `--color-success-light` | `#DCFCE7` | Success background |
| `--color-warning` | `#D97706` | Warnings, pending states |
| `--color-warning-light` | `#FEF3C7` | Warning background |

---

## 3. Typography

| Variable | Value | Use |
|---|---|---|
| `--font-display` | `'Plus Jakarta Sans', sans-serif` | All headings, labels, nav items, buttons |
| `--font-body` | `'Inter', sans-serif` | Body text, input values, table cells |
| `--text-xs` | `0.75rem` | Badges, hints, timestamps |
| `--text-sm` | `0.875rem` | Body text, form labels, table content |
| `--text-base` | `1rem` | Standard inputs |
| `--text-lg` | `1.125rem` | Section titles |
| `--text-xl` | `1.25rem` | Sub-headings |
| `--text-2xl` | `1.5rem` | Page titles (`.page-title`) |
| `--text-3xl` | `1.875rem` | Hero/login headings |
| `--font-normal` | `400` | — |
| `--font-medium` | `500` | Nav items (default) |
| `--font-semibold` | `600` | Section titles, active nav |
| `--font-bold` | `700` | Page titles, logo, avatar initials |
| `--leading-tight` | `1.25` | Headings |
| `--leading-normal` | `1.5` | Body text |

**Rules:**
- Use `var(--font-display)` for anything that draws the eye first (titles, buttons, labels).
- Use `var(--font-body)` for supporting/readable content.
- Never set `font-family` to a raw string — always use a CSS variable.

---

## 4. Spacing

| Variable | Value | Typical use |
|---|---|---|
| `--space-1` | `0.25rem` | Tiny gaps (badge padding top/bottom) |
| `--space-2` | `0.5rem` | Icon gaps, tight row spacing |
| `--space-3` | `0.75rem` | Button padding, nav item padding |
| `--space-4` | `1rem` | Form field gap, card internal spacing |
| `--space-5` | `1.25rem` | — |
| `--space-6` | `1.5rem` | Card padding (flat), section gaps |
| `--space-8` | `2rem` | Card padding (raised), page padding |
| `--space-10` | `2.5rem` | — |
| `--space-12` | `3rem` | Large vertical gaps |
| `--space-16` | `4rem` | — |

---

## 5. Components

### `.btn-primary`
```html
<button class="btn-primary">Save</button>
<button class="btn-primary btn-full">Sign In</button>
```

### `.btn-secondary`
```html
<button class="btn-secondary">Cancel</button>
```

### `.btn-ghost`
```html
<button class="btn-ghost">Refresh</button>
```

### `.btn-danger`
```html
<button class="btn-danger">Delete</button>
```

### `.input-field` + `.form-label`
```html
<div class="form-field">
  <label class="form-label" for="username">
    Username <span class="required">*</span>
  </label>
  <input id="username" class="input-field" placeholder="admin" />
  <span class="field-hint">Your username or email address.</span>
</div>
```

### `.card` / `.card-flat`
```html
<div class="card">  <!-- white, shadow, border -->
  <h2 class="section-title">Section</h2>
  ...
</div>

<div class="card-flat">  <!-- surface bg, no shadow -->
  ...
</div>
```

### `.badge` variants
```html
<span class="badge badge-blue">pending</span>
<span class="badge badge-success">approved</span>
<span class="badge badge-error">rejected</span>
<span class="badge badge-warning">mismatch</span>
<span class="badge badge-neutral">inactive</span>
```

### `.table-base`
```html
<table class="table-base">
  <thead>
    <tr><th>Name</th><th>Status</th><th>Actions</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Project Alpha</td>
      <td><span class="badge badge-success">active</span></td>
      <td><button class="btn-ghost">Edit</button></td>
    </tr>
    <tr class="empty-row"><td colspan="3">No records.</td></tr>
  </tbody>
</table>
```

### Alert banners
```html
<div class="alert alert-error">Something went wrong.</div>
<div class="alert alert-success">Saved successfully.</div>
<div class="alert alert-warning">Check mismatch reason.</div>
<div class="alert alert-info">Your session will expire soon.</div>
```

---

## 6. Page Template

```html
<!-- Rendered by AppShell — this is the inner content only -->
<section style="display:flex; flex-direction:column; gap:var(--space-6)">

  <!-- Page header -->
  <div style="display:flex; align-items:center; justify-content:space-between">
    <h1 class="page-title">Page Name</h1>
    <button class="btn-primary">+ New Item</button>
  </div>

  <!-- Filter / controls row -->
  <div class="card-flat" style="display:flex; gap:var(--space-3)">
    <div class="form-field" style="flex:1">
      <label class="form-label" for="search">Search</label>
      <input id="search" class="input-field" placeholder="Filter…" />
    </div>
    <button class="btn-secondary">Apply</button>
  </div>

  <!-- Inline edit form (shown conditionally) -->
  <div class="card">
    <h2 class="section-title">Create Item</h2>
    <div class="form-field">
      <label class="form-label" for="name">Name <span class="required">*</span></label>
      <input id="name" class="input-field" />
      <span class="field-hint">Unique name for this item.</span>
    </div>
    <div class="flex gap-3 mt-4">
      <button class="btn-primary">Save</button>
      <button class="btn-ghost">Cancel</button>
    </div>
  </div>

  <!-- Data table -->
  <div class="card" style="padding:0; overflow:hidden">
    <table class="table-base">
      <thead>
        <tr><th>Name</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Alpha</td>
          <td><span class="badge badge-success">active</span></td>
          <td>
            <div class="flex gap-2">
              <button class="btn-ghost" style="font-size:var(--text-xs)">Edit</button>
              <button class="btn-danger">Delete</button>
            </div>
          </td>
        </tr>
        <tr class="empty-row"><td colspan="3">No items found.</td></tr>
      </tbody>
    </table>
  </div>

</section>
```

---

## 7. Rules for New Pages

- [ ] `design-system.css` is already globally imported — do **not** re-import or override it
- [ ] Use only CSS variables for colors, spacing, and radius — **no hardcoded values**
- [ ] Use `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-danger` for all buttons
- [ ] Use `.input-field` + `.form-label` (with `htmlFor`/`id`) for all form fields
- [ ] Wrap page content inside `AppShell` (handled by `App.tsx` — pages just render `<section>`)
- [ ] Use `.page-title` for the `<h1>` of the page
- [ ] Use `.section-title` for `<h2>` subheadings within a page
- [ ] Use `.card` or `.card-flat` for content panels
- [ ] Use `.table-base` for all data tables; add `class="empty-row"` on the no-data row
- [ ] Use `.badge` variants for status chips — never colour text directly
- [ ] Use `.alert` variants for inline messages — avoid plain `<p class="error">`
- [ ] Mark required fields with `<span class="required">*</span>` inside the label
- [ ] Test on mobile (min 375px width) — the sidebar hides on `max-width: 768px`
