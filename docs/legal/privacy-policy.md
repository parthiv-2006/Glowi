<!-- Mirror of mobile/src/lib/legal.ts (the source of truth rendered in-app and on the web export). Regenerate rather than editing here. -->

# Glowi Privacy Policy

**Draft — pending owner/legal review. Last updated 2026-07-11.**

Glowi is an AI-powered skincare app. This policy explains exactly what we collect, why,
where it goes, and the controls you have. The short version: your data exists to power
*your* coaching, it is never sold, and you can view, export, or permanently delete all
of it from inside the app.

## What we collect

- **Skin photos.** Photos you take or upload for scans and product comparisons. They are
  stored in a private bucket only your account can access and are kept until you delete
  the scan or your account.
- **Skin analysis results.** Scores, detected concerns, and summaries produced by AI
  analysis of your photos.
- **Chat messages.** Your conversations with the Glowi coach, plus "memories" — short
  facts the AI extracts from your chats (like your skin type or an ingredient that broke
  you out) so future advice stays personal. You can view and delete every memory in the
  app under Glowi's memory.
- **Health data (opt-in).** If you enable it, last night's sleep duration is read from
  Apple HealthKit or Android Health Connect — read-only, only to suggest a value in your
  daily check-in, and you confirm before anything is saved. If you enable cycle
  tracking, the cycle phase you log each day is stored with your check-in. Both are off
  by default, and cycle data is treated as sensitive (special-category) data: it is used
  only for your own trend correlations and coaching context.
- **Lifestyle logs.** The sleep/stress/water levels and diet flags you tap in the daily
  check-in.
- **Products and reactions.** Products you add to your Shelf, routines, and reactions
  you log (including symptoms).
- **Location (approximate).** If you set a location for the Skin Weather forecast, we
  store the city-level label and coordinates you chose. Typing a city uses a geocoding
  service; detecting it uses your device's location once, with your permission.
- **Push token.** If you allow notifications, your device's push token, so scheduled
  nudges can reach you.
- **Technical data.** Your IP address is processed transiently for signup rate limiting
  (abuse protection) and deleted within one day. Crash reports, if enabled in a future
  release, contain no photos and no email address.

We do **not** collect advertising identifiers, contacts, or precise background location,
and we do not sell or share your data for advertising.

## How AI processing works

Your scan photos, product photos, and chat content are sent to **Anthropic** (our AI
subprocessor) to generate analyses and coaching replies. Under Anthropic's API terms,
this data is **not used to train their models**. AI output describes cosmetic skin
appearance only — Glowi is not a medical device and does not diagnose (see the Terms).

## Guest accounts

"Continue as guest" creates a real account with no email attached. Guest data is treated
exactly like account data, and guests can delete their account in the app at any time.
Guest accounts untouched for **90 days** are automatically and permanently deleted,
including all photos.

## Your rights and controls

- **Delete everything:** Profile → Delete account permanently removes your photos, scans,
  chats, memories, logs, and account. This is immediate and unrecoverable.
- **Export your data:** Profile → Export my data produces a JSON file of everything
  Glowi holds about you.
- **See what the AI remembers:** the Glowi's memory screen lists every stored memory,
  each individually deletable.
- **Opt out any time:** health auto-fill, cycle tracking, location, and notifications are
  all individually controllable in the app.

If you are in the EU/UK, these controls implement your GDPR rights of erasure, access,
and portability; the legal basis for processing is the contract (providing the app) and
your consent for the opt-in categories. California residents have equivalent rights
under the CCPA. We do not "sell" or "share" personal information as the CCPA defines
those terms.

## Storage and security

Data lives in Supabase (Postgres + object storage) with row-level security so each
account can only ever read its own rows; photos live in a private per-user bucket
accessed through short-lived signed URLs. AI requests are made server-side — API keys
never ship in the app.

## Children

Glowi is not intended for children under 13 (or the higher minimum age in your region),
and we do not knowingly collect their data.

## Changes and contact

We will update this policy as the product evolves and change the date above. Questions
or requests: contact the developer through the app store listing.
