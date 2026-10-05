# Northstar — Product Spec (draft v1)

> Name: **Northstar**.
> Two sections: **Life** (Personal OS) and **HQ** (PawMinds Headquarters).
> Build path: Phase 1 as a local prototype (browser storage), then connect Supabase for sync + contractor logins.
>
> **Status (5 Oct 2026):** Phases 1–3 are built. Cloud mode is waiting on setup (see SETUP.md).
>
> **Design v2:** sharp and disciplined. Light and dark (follows the device, with a toggle). Monochrome plus one accent, indigo-violet `#3F2A9E`. Categories use shades of that purple plus greys; red only for overdue and destructive actions. Barlow Condensed bold uppercase headings with Inter body text. 6–8px corners, flat cards with 1px borders, airy spacing, subtle levels, a small completion animation. Bottom tab bar on phones (Today · Life · Check-in · HQ). HQ pages get an accent eyebrow. Wordmark-only logo: NORTHSTAR.

Style: bold dark dashboard — big numbers, progress rings, game-style progress bars. Web app that works on desktop and phone (installable to the home screen). Cloud-synced. Private to you, except contractor portals.

---

## 1. Home — Focus view

What opens first. Answers "what should I be doing right now?"

- **Top 3 priorities** across Life + HQ
- **Today's next actions** (due today / overdue)
- **Blockers** — anything stuck, and what it's waiting on
- **Critical-path alert** (see §3.3): "Stop — finish X first, everything else depends on it"
- **Today's check-in** status (done / not done)
- **Money gate progress** — e.g. `18,400 / 40,000 AED from door-to-door`

---

## 2. Life (Personal OS)

### 2.1 Goals
Four areas, each with its own **level bar** (video-game style):
**Health · Relationship · Learning · Habits**

Each goal has:
| Field | Notes |
|---|---|
| Title | |
| Area | Health / Relationship / Learning / Habits |
| Status | Not started · In progress · Done |
| Start date / Due date | |
| Progress | Auto-calculated from subtasks (or manual %) |
| "Where are we?" | One-line current status, always visible on the card |
| Notes | |
| Subtasks | Checklist; each can have its own due date |

Views:
- **Board** — goals grouped by area with progress bars
- **Timeline** — horizontal bars from start → due date, "today" line, shows what ends when
- **Calendar** — due dates and subtask deadlines by month

### 2.2 Daily check-in (the "bad week" detector)
A 60-second end-of-day log built from your own list:

| Item | Type |
|---|---|
| Woke up on time | yes/no + time |
| Slept on time | yes/no + time |
| Hours slept | number |
| Door-to-door sales done | yes/no + amount earned (AED) |
| Followed up with people | yes/no + count |
| Peace of mind | 1–5 |
| Meditated | yes/no |
| Trained | yes/no |
| Hit calorie goal | yes/no |
| Prayers | 5 checkboxes (Fajr, Dhuhr, Asr, Maghrib, Isha) |
| Attended to girlfriend on time | yes/no |
| Where did the day go? | rough hours per bucket (sales, PawMinds, training, rest, social, wasted) |

Fully editable — add/remove items later. Feeds habit streaks, the area level bars and the weekly review.

### 2.3 Weekly review (AI — Phase 3)
A consultant-style analysis of the week:
- Where your time actually went vs. where you said it should go
- Streaks kept and broken; which "bad week" signals showed up
- Progress recap, readiness gaps, top 3 priorities for next week
- Honest pushback (spreading thin, avoiding the critical path, etc.)

### 2.4 Gear Wishlist
Grid of cards grouped by **category folders**.

| Field | Notes |
|---|---|
| Name | |
| Image | from image URL, shown on the card |
| Category | the folder (replaces Notion hashtag) |
| Price + currency | enter in AED **or** USD |
| Price (USD) / Price (AED) | **auto-calculated** |
| Priority | High / Medium / Low |
| Buy link | big **Buy now** button |
| Bought | checkbox |

- **AED ⇄ USD toggle** at the top switches every price and total.
- Conversion uses the official peg (**1 USD = 3.6725 AED**), which is fixed — always correct, no live API needed.
- Totals per category and overall: *remaining to buy* vs. *already bought*.

---

## 3. HQ (PawMinds Headquarters)

### 3.1 Pipeline (execution board)
Kanban of everything that has to get done, business-wise.

Columns (task stages):
`Backlog → Building → Waiting on → On hold: money → Done`

Each task:
| Field | Notes |
|---|---|
| Name | |
| Created | auto |
| Start date / Deadline | |
| Owner | You or a contractor |
| Priority | High / Medium / Low |
| Stage | the column |
| Waiting on | another task or a person (only when stage = Waiting on) |
| Money-gated | yes/no — needs the money gate to unlock |
| Attachments | files |
| Notes | |
| Subtasks → each with its own mini checklist + due date | Task → Subtask → Checklist, three levels |

Views:
- **Board** (Kanban, drag between columns)
- **Calendar / Timeline** — bars from start → deadline, color-coded by stage and owner, overdue in red

### 3.2 Launch readiness ("Is PawMinds ready for money?")
A dedicated view that answers your stage questions automatically:

- **What are we building?** — list of everything with status
- **Is it built?** — % of launch-critical tasks done
- **What are we waiting on?** — every *Waiting on* task and who/what it's blocked by
- **Readiness status**, computed:
  - 🟢 **Ready for money** — everything non-money-gated is done; only the money gate remains
  - 🟡 **Waiting on money, with work left** — money-gated *and* there are unfinished tasks before/after it
  - 🔴 **Building** — core work still incomplete
- Each item drills into its subtasks and checklists, so you always know the exact stage.

### 3.3 Money gate + critical path
- **Door-to-door tracker** — log earnings (from the daily check-in). Progress toward the gate: `X / 40,000 AED`.
- **Gate rule** — "Ads unlock at 40,000 AED." Tasks marked money-gated sit behind it.
- **Dependencies** — any task can be blocked by other tasks. The app finds the **critical path**: unfinished tasks that the most other things depend on.
- **Focus alert** — rule-based (works without AI): if a critical-path task is unfinished and doesn't need money, it's pinned to Home with: *"Stop — finish this first. N things depend on it, and it doesn't need money. When the 40k lands you'll know exactly where to plug it in."*
- Phase 3: AI explains the reasoning in plain language and reorders your week.

### 3.4 Team
Two tabs:

**Active team**
| Field |
|---|
| Name · Person ID · Role / what they handle · Est. cost (monthly) · Hiring link (where you found them) · Hire trigger (what made you hire) · Notes · Portal access (on/off) |

**Hiring bench** (people/roles you plan to hire)
| Field |
|---|
| Name or role · Why hire · Est. price · Hire trigger (when — e.g. "after 40k AED" or "when ads go live") · Source link · Notes · Status (Considering / Contacted / Ready to hire) |

"Hire" button moves someone from Bench → Active and creates their portal.

### 3.5 Subscriptions
| Field | Notes |
|---|---|
| Name | |
| Cost + currency | AED or USD |
| Cycle | Monthly / Yearly |
| Yearly cost | **auto** (monthly × 12) |
| Renews on | date; reminder before renewal |
| Status | Active / On hold / Cancelled |
| App link | |
| Notes | |

Totals: monthly burn and yearly burn (active only), in AED or USD.

### 3.6 Contractor portals
Each contractor gets their own private page and logs in with an **email magic link** (no password). They see **only their portal**, never the rest of HQ or Life.

Portal sections:
1. **Onboarding — "What you owe me"**: friendly checklist (Sign NDA, Sign contract, Payment info, Photo ID, …). They can upload each item and tick it off; you approve.
2. **"What I owe you"**: list of things you've promised them (access, assets, payment). **They can add requests here** ("I need the logo files"), and you mark them delivered.
3. **Files**: uploads straight into the portal, plus an optional embedded Google Drive folder for big files.
4. **Their task board**: Kanban filtered to tasks where they're the owner — synced with the main Pipeline, so when they move a card you see it in HQ.
5. **Brand kit** (shared across all portals): logos, product photos, brand colors, fonts, ad scripts, guidelines.

> **About "Asset Drop":** in your Notion this was a shared folder where you drop materials contractors need (logos, product photos, brand guidelines, scripts). Here it becomes the **Brand kit**: you upload once, and every contractor sees it inside their portal. It doesn't need its own section.

---

## 4. Notifications
- Daily check-in reminder (evening)
- Deadlines tomorrow / overdue
- Subscription renewing in 3 days
- Weekly review ready (Sunday)
- Contractor submitted something / made a request

Delivered by push (installed web app) and/or email.

---

## 5. Build phases

| Phase | Contents |
|---|---|
| **1 — Core** | App shell + design, Home focus view, Life: Goals (board/timeline/calendar), Daily check-in, Gear Wishlist. HQ: Pipeline (board + timeline, Task → Subtask → Checklist), Launch readiness, Money gate + dependencies + focus alert, Subscriptions, Team |
| **2 — Contractors** | Logins, portals, onboarding checklists, requests, files, brand kit, per-contractor boards |
| **3 — Intelligence** | AI weekly review, AI focus reasoning, time analysis, notifications |

## 6. Proposed tech
- **Next.js** web app, installable on your phone (PWA)
- **Supabase**: database, logins (magic links), file storage, and row-level security so contractors can only ever read their own portal
- **Vercel**: hosting (free tier)
- **Claude API**: weekly review + focus reasoning (a few cents a week)
- **Resend**: email notifications

Cost to run: about $0/month on free tiers, plus a small Claude API bill.
