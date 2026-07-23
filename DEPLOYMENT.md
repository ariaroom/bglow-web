# Love's Last Letter — Ticketing Setup

Static site + Vercel serverless functions + Supabase (Postgres) + Stripe Checkout.

## Rules implemented

| Rule | Where it's enforced |
|---|---|
| 1 product, 2 prices | `lib/config.js` |
| Early Bird capped at 14 **total** (all sessions combined) | `reserve_spots()` in Postgres |
| After 14 sold → General price automatically | `reserve_spots()` + `api/checkout.js` |
| 12 sessions (Aug 30 ×7, Aug 31 ×5) | `supabase/schema.sql` seed |
| 9 spots per session | `sessions.capacity` |
| Max 2 tickets per order | Client + `api/checkout.js` + SQL `check` constraint |
| Spots decrement on payment | `api/webhook.js` (`checkout.session.completed`) |
| Sold Out shown automatically | `api/availability.js` → frontend |
| Refund returns the spot to inventory | `api/webhook.js` (`charge.refunded`) |
| Refund policy shown on page + in Checkout | `REFUND_POLICY` in `lib/config.js` |

**No overselling:** spots are reserved the moment checkout starts (a `pending` hold),
inside a Postgres advisory lock. Holds expire after 30 minutes, and the Stripe
Checkout session expires at the same time, so abandoned carts release their spots.

---

## 1. Supabase

1. Create a project at supabase.com.
2. SQL Editor → paste **all of `supabase/schema.sql`** → Run.
3. Project Settings → **API Keys** → copy the **Project URL** and the **Secret key**.

Supabase renamed its keys. Take whichever your dashboard shows:

| New name | Legacy name | Use it? |
|---|---|---|
| **Secret key** (`sb_secret_…`) | `service_role` (JWT `eyJ…`) | ✅ this one |
| Publishable key (`sb_publishable_…`) | `anon` (JWT `eyJ…`) | ❌ RLS-limited, cannot write |

> The Secret key is server-only. It goes in Vercel env vars — never in the repo or browser.
> With the new key system you can also create several secret keys and rotate them one at a time.

## 2. Stripe

Prices are already wired in `lib/config.js`:

- Product `prod_Uvg8KzAoi2qcP2`
- Early Bird `price_1Tvolx3uIq1zFZFfdswnhFT2` ($29)
- General `price_1Tvolx3uIq1zFZFfQtFc4lme` ($32)

Get your **Secret key** from Dashboard → Developers → API keys.

## 3. Deploy to Vercel

```bash
npm i -g vercel
vercel            # first deploy, links the project
```

Then set env vars (Vercel → Project → Settings → Environment Variables):

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` (or `sk_test_…` while testing) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (from step 4) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` (or the legacy `service_role` JWT) |
| `SITE_URL` | *(optional — omit; the request host is used automatically)* |

Redeploy after adding them.

## 3b. Sales tax (currently OFF)

Tax is **disabled by default** and adds nothing to the charge. Turn it on only after
an accountant confirms the exhibition is taxable **and** you are registered as a
New York sales tax vendor — you cannot legally collect sales tax without registering.

Background: NY Tax Law §1105(f)(1) taxes admission to a "place of amusement" but
**exempts** admission to dramatic/musical arts performances; museum admissions are
generally untaxed too. An immersive exhibition with a live performance element sits
in a gray area, so get a written opinion before enabling this.

To enable:

1. Stripe Dashboard → Products → **Tax rates** → create a rate
   - Type: **Exclusive** (added on top of $29 / $32)
   - Rate: e.g. `8.875` — NYC combined
   - Display name: `Sales Tax`
   - Region: NY
2. Copy the rate id (`txr_…`) into the Vercel env var `STRIPE_TAX_RATE_ID`, redeploy.

That's it. `api/availability.js` reads the rate straight from Stripe, so the amount
shown to the buyer can never drift from what is charged. To turn tax back off,
delete the env var (or archive the rate) and redeploy.

> Tax is applied per line item and rounded the same way Stripe rounds, so a split
> order (1 Early Bird + 1 General) shows exactly what Stripe charges:
> `29 × 8.875% = 2.57` + `32 × 8.875% = 2.84` → `$5.41`, total `$66.41`.

## 4. Stripe webhook

Dashboard → Developers → Webhooks → **Add endpoint**

- URL: `https://bglow-web.vercel.app/api/webhook`
- Events: `checkout.session.completed`, `checkout.session.expired`, **`charge.refunded`**

Copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET`, then redeploy.

> Without the webhook, payments succeed but spots are never marked sold.
> Without `charge.refunded`, refunding money never frees the spot.

## Refund policy

Full refund up to 7 days before the session; within 7 days, exchange only.
The wording lives in one place — `REFUND_POLICY` in `lib/config.js` — and is shown
both on the ticket page and on the Stripe Checkout page.

Refunds are issued from the Stripe Dashboard (Payments → the payment → Refund).
The `charge.refunded` webhook then releases the spot automatically.
**Partial refunds are not auto-released** — the log warns and you adjust the hold
in Supabase by hand.

> Stripe does not return its processing fee on a refund (~$1.14 on a $29 ticket).

## 5. Test before going live

Use **test mode** keys, then buy with card `4242 4242 4242 4242` (any future expiry / any CVC).

Check:
- [ ] Spot count drops by the quantity purchased
- [ ] Buying the 9th spot makes the session show **Sold Out**
- [ ] After 14 Early Bird tickets, price switches to $32 automatically
- [ ] Buying 2 when only 1 Early Bird remains → $29 + $32 = $61
- [ ] Abandoning checkout releases the spots within 30 min

Local dev:

```bash
vercel dev
stripe listen --forward-to localhost:3000/api/webhook
```

---

## Endpoints

- `GET  /api/availability` — sessions, spots left, sold-out, Early Bird remaining
- `POST /api/checkout` — `{sessionId, quantity}` → reserves spots, returns Stripe URL
- `POST /api/webhook` — Stripe events; confirms or releases holds

## Useful queries

```sql
-- Tickets sold per session
select s.day_label, s.time_label, coalesce(sum(h.quantity),0) as sold, s.capacity
from sessions s left join holds h
  on h.session_id = s.id and h.status = 'paid'
group by s.id, s.day_label, s.time_label, s.sort_order, s.capacity
order by s.sort_order;

-- Early Bird used so far (cap 14)
select coalesce(sum(early_bird_qty),0) from holds where status = 'paid';

-- Release stuck holds manually
update holds set status='expired' where status='pending' and expires_at < now();
```

## Changing the schedule or capacity

Edit the `sessions` table — the frontend renders whatever is in it, no code change needed.

```sql
update sessions set capacity = 10 where id = '2026-08-30-1100';
```
