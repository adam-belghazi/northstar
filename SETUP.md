# Northstar — connect Supabase + Vercel

About 30–40 minutes, once. Do the parts in order. Anything marked **(Claude)** is a step I do for you.

You'll end up with:
- `https://<your-app>.vercel.app`: the app, the same on desktop and phone
- Your data in Supabase, synced everywhere
- Contractor logins, file uploads, push notifications and the Sunday AI review

---

## Part A — Supabase (database, logins, files)

1. **Create the project.** Go to supabase.com/dashboard → **New project**. Name it `northstar`, pick the region closest to the UAE, and save the database password in a password manager.
2. **Create the tables.** Go to **SQL Editor** → **New query**. Open `supabase/schema.sql` from this folder and copy everything into the editor.
   - Near the top, check the line marked `-- OWNER EMAIL`. It must be the email **you** will log in with.
   - Click **Run**. You should see "Success. No rows returned".
3. **Create your login.** Go to **Authentication → Users → Add user → Create new user**. Enter your email, any password (you won't use it), and tick **Auto Confirm User**.
4. **Lock sign-ups.** Go to **Authentication → Sign In / Providers**. Turn **off** "Allow new users to sign up". Keep **Email** enabled. Now only you, and contractors you invite, can ever log in.
5. **Make the login email include a code.** Go to **Authentication → Emails → Templates → Magic Link** and replace the body with:
   ```html
   <h2>Your Northstar code</h2>
   <p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   <p>Type it in the app, or <a href="{{ .ConfirmationURL }}">tap here to sign in</a>.</p>
   <p>The code expires in 1 hour.</p>
   ```
   Codes work inside the installed phone app; links don't always open there.
6. **Copy three values** from **Project Settings → API** (or **API Keys**) into a note:
   - **Project URL**
   - **anon / publishable** key (safe for the browser)
   - **service_role / secret** key (**never share it**, and only paste it into Vercel)

## Part B — Resend + your domain (sends the login emails)

Supabase's built-in email only reaches your own address. To email contractors, use your domain.

1. Go to resend.com → **Domains → Add domain** and enter your domain (e.g. `pawminds.com`). Add the DNS records it shows at your domain registrar, then click **Verify**. It can take a few minutes.
2. Go to **API Keys → Create API key** with **Sending access**, and copy the key.
3. Back in Supabase, go to **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   | Field | Value |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | your Resend API key |
   | Sender email | `no-reply@yourdomain.com` |
   | Sender name | `Northstar` |

## Part C — Anthropic API (the weekly review)

1. Go to console.anthropic.com → **Billing** → add about $5 of credit. The review costs roughly $0.10–0.20 a week.
2. Go to **API Keys → Create key** and copy it.

## Part D — GitHub + Vercel (hosting)

Vercel builds the app from GitHub, so you don't need Node on your PC.

1. **GitHub.** Sign in at github.com (or create a free account), then go to **New repository**. Name it `northstar`, make it **Private**, and don't add a README. Copy its URL.
2. **(Claude)** Send me the repo URL. I'll commit the code and push it. The first push opens a GitHub sign-in window, which you approve.
3. **Vercel.** Go to vercel.com → **Add New → Project** → import the `northstar` repo.
   - Framework preset: **Other**. Leave the build and output settings empty.
   - Open **Environment Variables** and add all of these:

   | Name | Where it comes from |
   |---|---|
   | `SUPABASE_URL` | Part A step 6 |
   | `SUPABASE_ANON_KEY` | Part A step 6 |
   | `SUPABASE_SERVICE_ROLE_KEY` | Part A step 6 |
   | `ANTHROPIC_API_KEY` | Part C |
   | `VAPID_PUBLIC_KEY` | `.env.local` in this folder |
   | `VAPID_PRIVATE_KEY` | `.env.local` |
   | `VAPID_SUBJECT` | `.env.local` |
   | `CRON_SECRET` | `.env.local` |

   - Click **Deploy**. When it finishes, copy your URL (e.g. `northstar-abc.vercel.app`).
4. **Tell Supabase your URL.** In Supabase, go to **Authentication → URL Configuration**:
   - Site URL: `https://northstar-abc.vercel.app`
   - Redirect URLs: add `https://northstar-abc.vercel.app/**`

## Part E — First run

1. **Optional: bring your local data.** Open the local version (`index.html`) → **Settings → Export backup**.
2. Open your Vercel URL and sign in with your email and the 6-digit code.
3. Choose **Import a backup**, **Start fresh**, or **Explore with sample data**.
4. **iPhone:** open the URL in **Safari** → Share → **Add to Home Screen**. Open Northstar from the Home Screen → Settings → **Turn on notifications** → **Send a test**.
5. **Contractors:** go to Team → open the person → add their email and tick **Give them a portal** → Save. Then go to Contractor portals → open theirs → **Send login**. They sign in at the same URL and only ever see their own portal.

## What runs automatically

| When (UAE time) | What |
|---|---|
| Every day around 9pm | Push: check-in reminder, deadlines due tomorrow or overdue, renewals in the next 3 days |
| Sundays around 8pm | Claude writes your weekly review and pushes it to your phone |
| Any time a contractor acts | Push: what they finished, uploaded, moved or asked for |

## If something's off

| Symptom | Fix |
|---|---|
| "This email doesn't have access" | You didn't create your user (A3), or the OWNER EMAIL in the SQL is different. Re-run the SQL with the right email. |
| Login code email never arrives | Check the Resend domain is **Verified** and the SMTP settings (B3). Check spam. |
| "Can't reach the cloud" | `schema.sql` wasn't run, or a Vercel variable is missing or mistyped. Redeploy after fixing variables. |
| Weekly review says the API key is invalid | Check `ANTHROPIC_API_KEY` in Vercel, then redeploy. |
| No push on iPhone | It must be opened from the Home Screen icon (iOS 16.4+), with notifications allowed in iPhone Settings → Northstar. |
| A contractor sees "No access" | Their portal email must exactly match the email they sign in with, and "Give them a portal" must be ticked. |
