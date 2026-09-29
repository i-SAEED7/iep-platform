# UI Redesign Baseline Checklist

Branch: `ui-professional-redesign`

## Current surfaces
- First-run system admin setup.
- Login.
- Main dashboard.
- Accounts management.
- Students and assignments placeholder.
- Level assessment placeholder.
- IEP placeholder.
- Guardians placeholder.
- Educational agent placeholder.
- Reports/printing placeholder.
- Settings.
- Mobile bottom navigation.
- Desktop side navigation.
- User drawer.
- Account create/edit modal.
- Password recovery information modal.
- Blocking loading overlay.
- Toast notifications.

## Current functional actions to preserve
- First system-admin creation.
- Email/password login.
- Logout.
- Permission-driven navigation visibility.
- Account list loading.
- Account filtering: all / active / inactive.
- Account create.
- Account edit.
- Account enable/disable.
- Per-account permissions selection.
- Online settings load/save.
- Blocking loading states tied to real async operations.
- Success/error toasts tied to actual outcomes.

## Protection constraints for this UI branch
- No database/schema/migration changes.
- No Supabase Edge Function changes.
- No auth changes.
- No RLS/policy changes.
- No API contract changes.
- No production-data writes for testing.
- No local/session storage reset.
- No changes to role/permission semantics.
- No changes to operational workflow order.

## Acceptance checks
- RTL remains correct.
- Mobile remains primary layout.
- Tablet/desktop expand without hiding data/actions.
- Keyboard focus is visible.
- Motion respects `prefers-reduced-motion`.
- Tables remain horizontally accessible on small screens.
- Modals/drawers remain usable.
- Existing IDs and JavaScript hooks remain unchanged.
- Existing async actions remain unchanged.
