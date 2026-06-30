# nXuu Trading Journal — v5.0

Full trading journal with auth, trade log, calendar, equity curve, stats and settings.

## Setup (required before deploying)

### Step 1 — Supabase

1. Go to supabase.com → create free account
2. New Project → name it `nxuuchecklist` → Singapore region
3. SQL Editor → New Query → paste contents of `schema.sql` → Run
4. Settings → API → copy **Project URL** and **anon public key**

### Step 2 — Add your keys

Open `js/supabase.js` and replace:

```js
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### Step 3 — Add your icons

Copy from your existing repo:
```
apple-touch-icon.png  → root /
img/favicon-32.png    → img/
img/icon-192.png      → img/
img/icon-512.png      → img/
```

### Step 4 — Deploy to Vercel

1. Push this folder to your GitHub repo (`nxuuchecklist`)
2. Go to vercel.com → Import project → select repo
3. Deploy — done in 30 seconds
4. Auto-deploys on every GitHub push

### Step 5 — Create your account

Visit your live URL → Sign Up → verify email → Sign In

### Step 6 — Add your checklist steps and models

Settings tab → Add your checklist steps and entry models.
These are saved per-user so each person has their own.

---

## Features

| Tab | What it does |
|-----|-------------|
| ✓ Check | Your custom checklist steps, per user |
| 📋 Log | Log trades: Win/Loss/BE + R value + $ PnL + notes |
| 📅 Calendar | Monthly view with $ PnL and trade count per day |
| 📈 Equity | Cumulative $ PnL curve + drawdown stats |
| 📊 Stats | Win rate, avg R, performance by model and session |
| ⚙ Settings | Manage steps, models, export CSV, sign out |

## File Structure

```
nxuuchecklist/
├── index.html
├── manifest.json
├── schema.sql          ← run this in Supabase once
├── apple-touch-icon.png
├── css/style.css
├── js/
│   ├── supabase.js     ← put your keys here
│   └── app.js
└── img/
    ├── favicon-32.png
    ├── icon-192.png
    └── icon-512.png
```
# journalbynxuu
