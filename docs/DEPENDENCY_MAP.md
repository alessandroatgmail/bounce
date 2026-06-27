# Frontend Dependency Map

Generated from source analysis of `frontend/src/`.

---

## Route Table

Every route is wrapped by `Layout` → `Header` + `Footer` + `ScrollToTop`. `Header` uses `NotificationsBell`.

| URL | Page Component | Notes |
|---|---|---|
| `/` | `HomeRoute` (inline in routes.tsx) | Renders `StudentDashboard` if logged in, else `Home` |
| `/events` | `Events` | |
| `/login` | `Login` | |
| `/register` | `Register` | |
| `/activate/:uidb64/:token` | `Activate` | |
| `/forgot-password` | `ForgotPassword` | |
| `/reset-password/:uid/:token` | `ResetPassword` | |
| `/festival/:id` | `FestivalSchedulePage` | |
| `/checkout` | `CheckoutPage` | |
| `/payment/success` | `PaymentSuccess` | |
| `/admin` | `AdminDashboard` | |
| `*` | `NotFound` (inline) | 404 |

---

## Layout Shell

**`app/components/Layout.tsx`**
- Components: `Header`, `Footer`, `ScrollToTop`
- External: `sonner` (Toaster)

**`Header`** — `app/components/Header.tsx`
- Components: `NotificationsBell`
- Contexts: `useAuth`, `useLanguage`

**`NotificationsBell`** — `app/components/NotificationsBell.tsx`
- Contexts: `useAuth`, `useLanguage`
- External: `date-fns`
- Data: `mockNotifications` (mockData)

**`Footer`** — `app/components/Footer.tsx`
- Contexts: `useAuth`, `useLanguage`

**`ScrollToTop`** — `app/components/ScrollToTop.tsx`
- No dependencies (pure DOM scroll listener)

---

## Pages

### `Home` — `app/pages/Home.tsx`

- Components: `figma/ImageWithFallback`
- Contexts: `useLanguage`
- Hooks: `useEvents`

---

### `Events` — `app/pages/Events.tsx`

- Components: none (all inline; `EventCard` defined inline)
- Contexts: `useAuth`, `useLanguage`
- Hooks: `useEventsPaginated`, `useEventTypes`, `useLevels`, `useMemberships`
- Direct API:
  - `GET /api/auth/check-email/` — partner lookup
  - `POST /api/booking/my-memberships/` — booking
- **Also exports** `EventsBrowser` — re-used by `EventsSection` inside `StudentDashboard`

---

### `Login` — `app/pages/Login.tsx`

- Components: none
- Contexts: `useAuth` (calls `login()`), `useLanguage`

---

### `Register` — `app/pages/Register.tsx`

- Components: `CitySearch`
- Contexts: `useLanguage`
- Service: `apiUrl`
- Direct API: `POST /api/auth/register/`

---

### `Activate` — `app/pages/Activate.tsx`

- Components: none
- Contexts: `useLanguage`
- Service: `apiUrl`
- Direct API: `GET /api/auth/activate/:uidb64/:token/`

---

### `ForgotPassword` — `app/pages/ForgotPassword.tsx`

- Components: none
- Contexts: `useLanguage`
- Service: `apiUrl`
- Direct API: `POST /api/auth/password-reset/`

---

### `ResetPassword` — `app/pages/ResetPassword.tsx`

- Components: none
- Contexts: `useLanguage`
- Service: `apiUrl`
- Direct API: `POST /api/auth/password-reset/confirm/`

---

### `FestivalSchedulePage` — `app/pages/FestivalSchedulePage.tsx`

- Components: none (inline `DayScheduleGrid`, `RegistrationPanel`)
- Contexts: `useAuth`, `useLanguage`
- Hooks: `useEvents`, `useFestivalDays`
- Direct API: `POST /api/booking/my-memberships/`

---

### `CheckoutPage` — `app/pages/CheckoutPage.tsx`

- Components: none
- Contexts: `useAuth`, `useLanguage`
- Direct API: `POST /api/booking/checkout-session/` → redirects to Stripe URL
- **Also exports** `CheckoutItem` type — used by `PaymentsSection`

---

### `PaymentSuccess` — `app/pages/PaymentSuccess.tsx`

- Components: none
- Contexts: `useLanguage`
- Storage: clears `checkout_items` from `sessionStorage`

---

### `StudentDashboard` — `app/pages/StudentDashboard.tsx`

- Components: `AppShell`
- Contexts: `useAuth`

**`AppShell`** → `EventsSection`, `PaymentsSection`, `ProfileSection`, `ContactsSection`, `QRCodeSection`

| Child Component | Key Dependencies |
|---|---|
| `EventsSection` | `EventsBrowser` (imported from `pages/Events`), `useAuth`, `useLanguage` |
| `PaymentsSection` | `useUserMemberships`, `useEvents`; `CheckoutItem` type (from `pages/CheckoutPage`) |
| `ProfileSection` | `CitySearch`; direct API: `PUT/PATCH /api/auth/me/`, `/me/password/`, `/me/deactivate/`, `/me/qrcode/` |
| `ContactsSection` | static content only |
| `QRCodeSection` | `GET /api/auth/me/qrcode/`, `useAuth`, `useLanguage` |

---

### `AdminDashboard` — `app/pages/AdminDashboard.tsx`

- Contexts: `useAuth`, `useLanguage`
- Service: `authFetch`, `authFetchFile`
- Hooks: `useStyles`, `useGenres`, `useArtistTypes`, `usePartnerRoles`, `useEventTypes`, `useArtists`, `useRooms`, `useLevels`, `useEvents`, `useEventsPaginated`, `useMemberships`

**Panel components and their dependencies:**

| Component | Sub-components | Key Hooks | API |
|---|---|---|---|
| `RegularClassForm` | — | — | — |
| `FestivalPanel` | `MultiSearchSelect`, `FestivalGrid` | `useEventsPaginated`, `useEventTypes`, `useRooms`, `useLevels`, `useArtists`, `useGenres`, `useStyles` | `authFetch` |
| `FestivalGrid` | `MultiSearchSelect` | `useEvents`, `useEventTypes`, `useRooms`, `useLevels`, `useArtists`, `useGenres`, `useStyles`, `useFestivalDays`, `useMemberships` | `POST/PUT/PATCH/DELETE /api/events/events/`, `/api/festival/…` |
| `WeeklyGrid` | `MultiSearchSelect` | `useEventsPaginated`, `useEventTypes`, `useArtists`, `useGenres`, `useStyles`, `useRooms`, `useLevels`, `usePartnerRoles` | `authFetch`, `authFetchFile` |
| `EventTypePanel` | `MultiSearchSelect` | `useEventTypes`, `usePartnerRoles` | `authFetch` |
| `LocationPanel` | — (inline CitySearch) | `useLocations` | `authFetch` |
| `RoomPanel` | — | `useRooms`, `useLocations` | `authFetch` |
| `SimpleNamePanel` | — | — | `authFetch` |
| `ArtistPanel` | — | `useArtists`, `useArtistTypes`, `useStyles`, `useGenres` | `authFetch` |
| `MembershipPanel` | — | `useMemberships`, `useEventTypes` | `authFetch` |
| `MembershipManagementPanel` | `StudentMembershipDialog` | `useUserList`, `useMemberships`, `useEvents` | `authFetch` |
| `StudentMembershipDialog` | `MultiSearchSelect` | `useContributions`, `useDiscounts`, `useMemberships`, `useEvents` | `authFetch` |
| `DiscountPanel` | — | `useDiscounts` | `authFetch` |
| `EmailTemplatesPanel` | `RichHtmlEditor` | `useEmailTemplates` | `authFetch` |
| `RichHtmlEditor` | — | — | — (Tiptap + CodeMirror editor) |
| `EmailsPanel` | — | `useEmails` | `authFetch` |
| `EmailLogsPanel` | — | `useEmailLogs` | `authFetch` |
| `MultiSearchSelect` | — | — | — (pure controlled component) |

---

## Shared Components

### `CitySearch` — `app/components/CitySearch.tsx`
Used by: `Register` (page), `ProfileSection` (component)
- Service: `apiUrl`
- Direct API: `GET /api/auth/cities/?q=…`

### `MultiSearchSelect` — `app/components/MultiSearchSelect.tsx`
Used by: `FestivalPanel`, `FestivalGrid`, `WeeklyGrid`, `EventTypePanel`, `StudentMembershipDialog`, `AdminDashboard` (directly)
- Pure controlled component, no API calls

---

## Contexts

### `AuthContext` — `app/contexts/AuthContext.tsx`

Provides: `user`, `accessToken`, `login`, `logout`, `isAuthenticated`, `adminViewMode`, `setAdminViewMode`, `updateUser`

Internal API:
- `POST /api/auth/token/` — login
- `POST /api/auth/token/refresh/` — silent refresh (60 s before expiry)
- `GET /api/auth/me/` — profile enrichment after login/refresh

Token storage: `refresh_token` in `localStorage`; access token in React state only.

### `LanguageContext` — `app/contexts/LanguageContext.tsx`

Provides: `language` (`'it'|'en'`), `setLanguage`, `t` (key-based translation)

No API calls. Language persisted to `localStorage['app-language']`. Full IT/EN dictionary inline.

---

## `lib/api.ts`

| Export | Purpose |
|---|---|
| `apiUrl(path)` | Prepends `VITE_API_BASE_URL` (empty in dev → Vite proxy to `:8000`) |
| `authFetch(path, token, options)` | `fetch` with `Authorization: Bearer` + `Content-Type: application/json` |
| `authFetchFile(path, token, body, method)` | Multipart `fetch` with `Authorization: Bearer` only |

---

## Custom Hooks

All hooks live in `app/hooks/`. Each accepts `accessToken` and uses `authFetch` internally.

| Hook | Used by |
|---|---|
| `useArtists` | AdminDashboard, ArtistPanel, FestivalGrid, FestivalPanel, WeeklyGrid |
| `useArtistTypes` | AdminDashboard, ArtistPanel |
| `useContributions` | StudentMembershipDialog |
| `useDiscounts` | DiscountPanel, StudentMembershipDialog |
| `useEmailLogs` | EmailLogsPanel |
| `useEmails` | EmailsPanel |
| `useEmailTemplates` | EmailTemplatesPanel |
| `useEvents` | AdminDashboard, Events, FestivalSchedulePage, FestivalGrid, Home, MembershipManagementPanel, PaymentsSection, StudentMembershipDialog |
| `useEventsPaginated` | AdminDashboard, Events, FestivalPanel, WeeklyGrid |
| `useEventTypes` | AdminDashboard, Events, EventTypePanel, FestivalGrid, FestivalPanel, MembershipPanel, WeeklyGrid |
| `useFestivalDays` | FestivalSchedulePage, FestivalGrid |
| `useGenres` | AdminDashboard, ArtistPanel, FestivalGrid, FestivalPanel, WeeklyGrid |
| `useLevels` | AdminDashboard, Events, FestivalGrid, FestivalPanel, WeeklyGrid |
| `useLocations` | LocationPanel, RoomPanel |
| `useMemberships` | AdminDashboard, Events, FestivalGrid, MembershipManagementPanel, MembershipPanel, StudentMembershipDialog |
| `usePartnerRoles` | AdminDashboard, EventTypePanel, WeeklyGrid |
| `useRooms` | AdminDashboard, FestivalGrid, FestivalPanel, RoomPanel, WeeklyGrid |
| `useStyles` | AdminDashboard, ArtistPanel, FestivalGrid, FestivalPanel, WeeklyGrid |
| `useUserList` | MembershipManagementPanel |
| `useUserMemberships` | PaymentsSection |

---

## Dead Code

The following components exist in the repo but are **not imported by any active page or component**:

- `FestivalScheduleBuilder` — react-dnd based drag-and-drop builder, uses only mockData
- `FestivalWizard` — 3-step mock wizard, superseded by inline logic in `FestivalPanel`
- `FestivalEventForm` — superseded by `FestivalGrid`'s inline `EventSlotDialog`
- `MembershipCard` — mockData only
- `DirectMessages` — mockData + date-fns
- `Friends` — mockData
- `SocialFeed` — mockData + date-fns
- `Trips` — mockData + date-fns
- `Chatbot` — predefined responses, no API calls

---

## Cross-Import Notes

- `EventsSection` (a component) imports `EventsBrowser` from `pages/Events` — the only component→page import in the codebase.
- `PaymentsSection` imports `CheckoutItem` type from `pages/CheckoutPage`.
- `ProfileSection` imports `CitySearch` from `./CitySearch`; `LocationPanel` defines its own inline copy instead of reusing it.
