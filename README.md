# Glowi

> AI-powered skincare analysis. Scan your skin, understand it, fix it.

Glowi is a React Native app that analyzes photos of skin concerns with AI vision,
then delivers a personalized protocol: curated product recommendations with retailer
links, an evidence-based nutrition guide, and practical routines — plus a
memory-aware skincare chatbot that knows you across sessions.

**Status:** in active development. Full documentation lands with the v0.1 milestone.

## Stack

| Layer | Technology |
|---|---|
| Mobile | React Native · Expo · TypeScript · expo-router |
| Animation | Reanimated · React Native Skia |
| Backend | Supabase (Postgres · Auth · Storage · Edge Functions) |
| AI | Anthropic Claude (vision analysis + chat) with offline mock mode |

## Repository layout

```
mobile/      Expo application
supabase/    Database migrations, edge functions, seed data
docs/        Architecture, ADRs, system deep-dives
```

## License

MIT © 2026 Parthiv Paul
