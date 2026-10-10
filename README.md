# Northstar

Personal OS (**Life**) + PawMinds headquarters (**HQ**).

- **Local mode:** open `index.html`. Data stays in this browser.
- **Cloud mode:** deploy to Vercel with Supabase. Follow **[SETUP.md](SETUP.md)**. You get sync, contractor logins, uploads, push notifications and the AI weekly review.

## Structure
| Path | What |
|---|---|
| `index.html`, `css/`, `js/` | The app. Plain HTML/CSS/JS, no build step |
| `js/store.js` | Data model, sample data, readiness and critical-path logic |
| `js/cloud.js` | Supabase auth, sync (owner state, tasks, doors), files, push, reviews, offline start |
| `js/doors.js` | Door-to-door rules: statuses, WhatsApp templates, text queue (day 2/5/9), walk-ins, clashes |
| `js/views-*.js` | Pages (Life, HQ, Door-to-door, portals, home and settings) |
| `js/app.js` | Shell, routing, login, first run |
| `api/` | Vercel functions: config, invite, activity, notify (daily cron), weekly-review (Sunday cron, Claude Opus 5.5), doors-tick (every 5 min via Supabase pg_cron), calendar (private iPhone calendar feed) |
| `supabase/schema.sql` | Tables, row-level security, storage bucket |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable app + push |
| `tools/serve.ps1` | Local preview server (`powershell -File tools/serve.ps1`) |
| `tools/mock-cloud.html` | Dev-only fake Supabase for testing cloud flows (`?as=owner` / `?as=contractor`, add `&reset=1` to wipe) |

`.env.local` holds generated push keys and the cron secret. It's git-ignored; copy the values into Vercel.
