# UI Rules

## Visual Style

- Modern, professional, and clean.
- Palette: dark navy (`navy-*`), slate (`slate-*`), white, and blue accent (`accent-*`/`blue-*`).
- Good contrast and accessible colors (WCAG AA minimum).
- Consistent spacing (4/8/12/16/24px scale) and typography.
- Use Tailwind CSS utility classes; avoid inline styles except for dynamic values.

## Reusable Components

Always use (or create, if missing) reusable components for:

- `Button` — primary, secondary, danger, ghost variants; loading state
- `Input` — with label, error message, disabled state
- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `Badge` — for status indicators
- `Alert` — info, warning, error variants
- `Toast` — success, error, info; auto-dismiss
- File dropzone — drag-and-drop with progress
- Modal/dialog — with backdrop, focus trap, close on Escape
- Confirmation dialog — for destructive actions
- Data table — sortable columns, hover states
- Pagination — page numbers, prev/next
- Status badge — ENABLED/DISABLED, request statuses
- Empty state — icon + message + optional CTA
- Loading skeleton — matching the layout being loaded
- Search input with debounce
- Filter dropdown
- Date-range filter
- Dashboard statistics card
- Sidebar — collapsible on mobile
- Header — with user info and logout
- Device status switch/toggle
- Request action buttons (approve/reject)

## Layout

- Admin shell: fixed sidebar + scrollable main content area.
- Sidebar collapses to icons-only or off-canvas on mobile.
- Use responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) for stat cards.
- Tables: horizontally scrollable on small screens (`overflow-x-auto`).
- Mobile: consider card-based layouts for dense tables.

## Responsiveness

- Desktop, laptop, tablet, and mobile support.
- Collapsible sidebar on mobile (hamburger trigger).
- Responsive tables (scrollable or card-based on small screens).
- Touch-friendly controls (minimum 44×44px tap targets).

## States

Every interactive component must handle all states:
- **Loading** — skeleton or spinner (never blank)
- **Empty** — icon + helpful message
- **Success** — toast or success panel with relevant data
- **Error** — inline error alert or toast with actionable message

## Accessibility

- Semantic HTML: use `<button>`, `<label>`, `<table>`, `<nav>`, `<main>`, etc.
- All interactive elements keyboard-navigable.
- `aria-label` or `aria-labelledby` on icon-only buttons.
- Focus visible outlines not removed.
- Status changes communicated via `aria-live` or toast announcements.

## Forms

- Use React Hook Form with Zod resolvers where appropriate.
- Show inline field-level errors below each invalid input.
- Disable submit while submitting.
- Clear errors when user starts correcting input.
