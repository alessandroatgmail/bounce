# bounce
bounce website 2.0

---

## Booking Flow

### Overview

Users book events by creating a **Contribution** via the `POST /api/booking/my-memberships/` endpoint. A contribution links a user to a membership and an event, and its status progresses through the lifecycle described below.

### Contribution lifecycle

```
RECEIVED → ACCEPTED → CONFIRMED → PAYED
         ↘ WAITING
         ↘ CANCELLED
```

### Single booking (no partner)

1. User submits a contribution with a `membership_id` and `event_id`.
2. A **registration email** (`booking_single_email`) is sent to the user.
3. **If there are available spots** (`event.available_spot > 1`):
   - Status → `ACCEPTED`
   - An **acceptance email** (`registration_accepted_email`) is sent to the user.
4. **If the event is at full capacity** (`event.available_spot < 1`):
   - Status → `WAITING`
   - A **waiting list email** (`waiting_list_max`) is sent to the user.

### Couple booking (with partner)

When `partner_id` and `role_id` are provided, the system creates **two linked contributions** — one for the registrant and one for the partner.

1. User submits a contribution with `membership_id`, `event_id`, `role_id`, and `partner_id`.
2. A **partner contribution** is automatically created, with roles swapped.
3. A **registration email** is sent to both the user (`booking_email`) and the partner (`booking_twin_email`).
4. **If there are available spots**:
   - Both contributions → `ACCEPTED`
   - An **acceptance email** (`registration_accepted_with_partner_email`) is sent to both.
   - Both receive the **COUPLE discount** automatically.
5. **If the event is at full capacity**:
   - Both contributions → `WAITING`
   - A **waiting list email** (`waiting_list_max`) is sent to both.

### Role restriction (accepted_roles)

An event can restrict which roles are currently open for booking via `Event.accepted_roles`.

- If the user's role is **not** in `event.accepted_roles` (and the field is non-empty):
  - Status → `WAITING`
  - A **waiting list for role email** (`waiting_list_for_role`) is sent to the user.
  - This check takes priority over the capacity check and the imbalance check.

### Role balance (extras)

For partner events (`event_type.partners > 1`), `Event.extras` controls how much one role can outnumber another before new bookings for the over-represented role are held back.

The check counts **ACCEPTED** contributions per role and compares the new booking's role against the least-booked role:

```
role_counts  = ACCEPTED contributions per role (roles with 0 bookings count as 0)
lower_count  = min(role_counts)
new_role_count = ACCEPTED count for the role being booked

if new_role_count > lower_count + event.extras → WAITING
```

Examples with `extras = 2`:

| Leaders (ACCEPTED) | Followers (ACCEPTED) | New booking | Result |
|---|---|---|---|
| 0 | 0 | Leader | Accepted (0 > 0+2 is false) |
| 2 | 0 | Leader | Accepted (2 > 0+2 is false) |
| 3 | 0 | Leader | Waiting (3 > 0+2) |
| 1 | 0 | Follower | Accepted (0 > 0+2 is false — minority role always allowed) |

- When a booking is put on waiting due to imbalance, a **waiting list for role email** (`waiting_list_for_role`) is sent to the user.
- `extras = 0` means strict parity: any lead by one role blocks further bookings for that role.
- This check is skipped when no role is provided or when `event_type.partners <= 1`.

### Spot available notification

When an **ACCEPTED** contribution is cancelled, the system checks whether to notify the next person on the waiting list.

**Condition:** `event.available_spot >= 1` (capacity minus PAYED count). If no physical spot is open, no one is notified.

**Who gets notified** depends on the current role balance at the time of cancellation:

- **Roles balanced** (or no partner roles): notify the oldest `WAITING` contribution for the event, regardless of role.
- **Roles imbalanced** (some role exceeds `lower_count + extras`): notify the oldest `WAITING` contribution for the **minority role** (the role with the lowest ACCEPTED count), to help restore balance.

Only one email is sent per cancellation event. The triggered email is `spot_available_email`.

### Email templates

| Template | Trigger |
|---|---|
| `booking_single_email` | Single registration received |
| `booking_email` | Couple registration received (registrant) |
| `booking_twin_email` | Couple registration received (partner) |
| `registration_accepted_email` | Single registration accepted |
| `registration_accepted_with_partner_email` | Couple registration accepted |
| `waiting_list_for_role` | Role not currently open on this event |
| `waiting_list_max` | Event at full capacity |
| `waiting_list_for_role` | Role imbalance exceeds `extras` threshold |
| `spot_available_email` | A spot opened and a waiting user should be notified |
| `contribution_cancelled_email` | Contribution cancelled due to missed payment |
| `contribution_expiry_reminder_email` | Payment deadline approaching (2 days) |
