/**
 * @shared/ui
 *
 * Shared Radix-based component primitives for customer-facing surfaces.
 * Consumed by: front/apps/marketing, front/apps/portal.
 *
 * NOT consumed by: platform-sg/apps/admin-console (operator UI uses its own design).
 *
 * Add a component here only when it is already used by two front/ apps
 * and has no business logic tied to one app.
 */

export { Button, type ButtonProps } from "./button/Button";
export { Badge, type BadgeProps } from "./badge/Badge";
export { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog/Dialog";
