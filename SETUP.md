# Northstar — go-live checklist

## Already done (by Claude)
- [x] Supabase project **northstar** created (Mumbai, free plan)
- [x] Database tables, security rules and file storage installed
- [x] Vercel project **northstar** created (Mumbai), public settings added
- [x] Push-notification keys generated (`.env.local`, never uploaded)
- [x] Code committed to git, ready to push

## Your steps (about 20 minutes)

### 1. Supabase: 4 clicks-worth of settings
Open supabase.com/dashboard → project **northstar**.

1. **Authentication → Users → Add user → Create new user**
   - Email: the email you'll log in with (the database expects `belghazi.ab.adam@gmail.com`)
   - Password: anything (you won't use it)
   - Tick **Auto Confirm User** → **Create user**
2. **Authentication → Sign In / Providers**: switch **Allow new users to sign up** to **off** → **Save**.
3. **Authentication → Emails → Templates → Magic Link**: replace the message body with the following, then **Save**:
   ```html
   <h2>Your Northstar code</h2>
   <p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   <p>Type it in the app, or <a href="{{ .ConfirmationURL }}">tap here to sign in</a>.</p>
   ```
4. **Project Settings → API Keys**: reveal and copy the **secret** key (`sb_secret_…`, or the legacy `service_role`). You'll paste it in step 4. Don't paste it in chat.

### 2. Anthropic: the weekly review key
console.anthropic.com → **Billing** → add $5 → **API Keys → Create key** → copy it.

### 3. GitHub: a home for the code
github.com → sign up or sign in → **+** (top right) → **New repository**
- Name `northstar` · **Private** · leave everything else unticked → **Create repository**
- Copy the URL (e.g. `https://github.com/yourname/northstar`) and **send it to Claude**.
- Claude pushes the code. A GitHub sign-in window pops up once: approve it.

### 4. Vercel: connect GitHub and add the secrets
vercel.com → project **northstar**

1. **Settings → Git → Connect Git Repository → GitHub**. If asked, **Install** the Vercel app and give it access to the `northstar` repo, then pick **northstar**.
2. **Settings → Environment Variables**. Add these four, ticking all environments and **Sensitive**:

   | Key | Value |
   |---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | the Supabase secret key from step 1.4 |
   | `ANTHROPIC_API_KEY` | from step 2 |
   | `VAPID_PRIVATE_KEY` | from `.env.local` in the Northstar folder |
   | `CRON_SECRET` | from `.env.local` |

3. Tell Claude "done". Claude deploys, tests every endpoint, and gives you the live link.

### 5. Supabase: tell it the live address (after step 4)
**Authentication → URL Configuration**
- Site URL: the live link Claude gives you
- Redirect URLs → **Add URL** → `<live link>/**`

### 6. Start using it
1. Open the live link → enter your email → type the 6-digit code from your inbox.
2. Choose **Start fresh**, **Import a backup**, or **Explore with sample data**.
3. **iPhone:** open the link in **Safari** → Share → **Add to Home Screen** → open Northstar from the icon → **Settings → Turn on notifications → Send a test**.
4. **Desktop:** in Chrome or Edge, click the install icon in the address bar to get it as an app.

### 7. Contractor logins (when you hire)
Login emails to *other people* need your own domain:
1. Tell Claude your domain. Claude adds it to Resend and gives you the DNS records to add at your registrar.
2. resend.com → **API Keys → Create** (Sending access) → copy it.
3. Supabase → **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   host `smtp.resend.com`, port `465`, user `resend`, password = Resend key, sender `no-reply@yourdomain`, name `Northstar` → **Save**.
4. In Northstar: **Team** → open the person → add their email, tick **Give them a portal** → Save → **Contractor portals** → open theirs → **Send login**.

## What runs on its own
| When (UAE time) | What |
|---|---|
| Daily around 9pm | Push: check-in reminder, deadlines, renewals |
| Sundays around 8pm | Claude writes your weekly review and pushes it |
| When a contractor acts | Push: what they did |

## If something's off
| Symptom | Fix |
|---|---|
| "This email doesn't have access" | Step 1.1 not done, or you used a different email than the owner email |
| No code email | Check spam. Until step 7 is done, Supabase only emails addresses that are members of your Supabase organization. |
| Weekly review error | Check `ANTHROPIC_API_KEY` and credit, then ask Claude to redeploy |
| No push on iPhone | Open it from the Home Screen icon (iOS 16.4+), allow notifications |
