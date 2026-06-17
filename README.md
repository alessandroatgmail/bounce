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
  - This check takes priority over the capacity check.

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
| `contribution_cancelled_email` | Contribution cancelled due to missed payment |
| `contribution_expiry_reminder_email` | Payment deadline approaching (2 days) |
