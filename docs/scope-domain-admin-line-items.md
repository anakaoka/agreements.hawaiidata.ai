# Scope Update — Domain Admin Line-Item Permissions

Captured before deprecating `agreements.hawaiidata.ai`. This is the last
agreed scope change before the site was wound down.

## 1. Role expansion

### Domain Administrator (updated capabilities)

Domain Admins now have full quote-composition control, including direct
manipulation of line items.

New capabilities:

- Create quotes
- Add / edit / delete line items
- Override pricing and totals
- Respond to customer revision requests
- Approve and finalize quotes
- Manage legal terms
- Assign editors

## 2. Line-item management

### 2.1 Line-item fields

Each line item must support:

- `description` (string)
- `quantity` (numeric)
- `unit_price` (currency)
- `total_price` (auto-calculated OR override-enabled)
- `notes` (internal or customer-visible toggle)
- `editable_flag` (whether customer can request changes)
- `status`: `Active`, `Modified`, `Pending Revision`, `Locked`

### 2.2 Admin-level controls

Domain Admins can:

- Add new line items at any time (even after quote is sent → triggers
  "Revised" state)
- Edit price / quantity / description
- Remove line items
- Lock line items (prevent further customer revision requests)
- Mark line items as `Non-negotiable` or `Informational only`

### 2.3 Override logic

Admins can override line-item totals and entire quote totals.

When override is used, the system must log:

- Original calculated value
- Overridden value
- User who made the change
- Timestamp

## 3. Revision workflow impact

**Before**: Customer requests change → Editor responds.

**Now**: Customer requests change → Assigned Editor *or* Domain Admin can
respond.

### 3.1 Admin priority control

Admins can:

- Override editor responses
- Close revision requests without changes
- Modify multiple line items in one revision cycle

## 4. Permissions matrix

| Action | Editor | Domain Admin |
| --- | --- | --- |
| Create Quote | ✅ | ✅ |
| Add Line Items | ✅ | ✅ |
| Edit Line Items | ✅ | ✅ |
| Delete Line Items | ⚠️ (optional restriction) | ✅ |
| Override Pricing | ❌ | ✅ |
| Lock Line Items | ❌ | ✅ |
| Approve Quote | ❌ | ✅ |
| Manage Legal Terms | ❌ | ✅ |
| Assign Users | ❌ | ✅ |

## 5. Audit requirements

Every line-item change by a Domain Admin must log:

- `action_type`: `add` / `edit` / `delete` / `override`
- `previous_value`
- `new_value`
- `user_id`
- `role` (must indicate admin vs editor)
- `timestamp`

## 6. UI requirements

### A. Line-item controls

- Inline editable table
- Add line item button
- Delete (trash icon)
- Lock toggle
- Override toggle

### B. Visual indicators

- Highlight overridden values
- Show revision history per line item
- Badges: "Admin Modified", "Locked", "Pending Customer Review"

## 7. Quote state changes

Admin actions can trigger:

- Adding/editing line item → `Revised`
- Locking items → remains in current state
- Final approval → `Ready for Acceptance`

## 8. Constraints & safeguards

- Soft delete required (prevent accidental permanent removal)
- Confirmation required for: price overrides, final approval
- Optional / future: dual approval for high-value quotes

## 9. Acceptance criteria

Domain Admin can:

- Add, edit, delete line items at any stage
- Override pricing with audit logs

Admin changes:

- Are immediately reflected in the customer view (after resend)

Revision requests:

- Can be handled by Admin or Editor

All admin actions are logged, traceable, and visible in audit history.

## Next-level detail (if rebuilt)

- Exact DB schema for `line_items` + revision tracking
- API endpoints for admin overrides
- UI wireframe for line-item editing and revision handling
