# Production Env Vars Audit — festivo-web

> Run-through преди web launch (28 май 2026). Цел: всяка променлива от кода присъства в Vercel **Production** env, всяка production стойност няма случаен `localhost` / dev key.

## Как да провериш

1. Vercel Dashboard → Project `festivo-web` → Settings → Environment Variables
2. Филтрирай по **Production**
3. Cross-check със списъка по-долу
4. За всяка липсваща: добави. За всяка излишна: помисли дали все още се ползва

## Required в Production (без тях сайтът чупи)

| Env Var | Описание | Чувствителна |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | публична |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | публична |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin key | 🔐 **СЕКРЕТ** |
| `NEXT_PUBLIC_SITE_URL` | `https://festivo.bg` | публична |
| `RESEND_API_KEY` | Email sending | 🔐 |
| `RESEND_WEBHOOK_SECRET` | Verify Resend webhooks | 🔐 |
| `EMAIL_FROM` | напр. `noreply@festivo.bg` | |
| `EMAIL_REPLY_TO` | напр. `support@festivo.bg` | |
| `EMAIL_ADMIN` | вътрешни alert-и | |
| `EMAIL_ENABLED` | `true` в prod | |
| `JOBS_SECRET` | Защита на cron endpoints | 🔐 |
| `UPSTASH_REDIS_REST_URL` | Rate limiting | |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting | 🔐 |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (anti-bot) | 🔐 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile client | публична |
| `CSRF_ALLOWED_HOSTS` | напр. `festivo.bg,www.festivo.bg` | |
| `MOBILE_API_ALLOWED_ORIGINS` | Comma-separated browser origins позволени на `/api/mobile/*`. Native iOS/Android не пращат Origin → винаги минават. Остави **празно** в Production. За Expo web dev: `http://localhost:19006`. | |
| `GOOGLE_MAPS_API_KEY` | Maps на сайта | 🔐 (restrict by domain) |
| `GOOGLE_GEOCODING_API_KEY` | Geocoding | 🔐 |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel | публична |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Umami Cloud Website ID (UUID-формат). Без него Umami не зарежда. | публична |
| `NEXT_PUBLIC_UMAMI_SCRIPT_URL` | По желание — за self-hosted Umami. Default = `https://cloud.umami.is/script.js`. | публична |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | GA4 Measurement ID `G-XXXXXXXXXX`. Само ако GTM не се ползва. | публична |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager container `GTM-XXXXXXX`. Препоръчителен — зарежда GA4 + бъдещи pixels през GTM. | публична |

## Optional / feature-gated

| Env Var | Кога е нужна |
|---|---|
| `FESTIVO_PUBLIC_MODE` | `coming-soon` за soft launch; махни за public launch |
| `PREVIEW_TOKEN` | за достъп до неpublished фестивали |
| `PUSH_ENABLED`, `PUSH_PROVIDER`, `FCM_SERVER_KEY` | push (mobile, post-launch) |
| `REMINDER_LOOKAHEAD_MINUTES`, `REMINDER_TEST_MINUTES` | reminder tuning |
| `BOOKING_ACCOMMODATION_ENABLED`, `ACCOMMODATION_MOCK_*` | accommodation feature flag |

## Research / ingest (admin only — не нужни за public web launch)

`GEMINI_API_KEY`, `GEMINI_RESEARCH_MODEL`, `GEMINI_RESEARCH_TIMEOUT_MS`, `GEMINI_RESEARCH_DEBUG`, `GOOGLE_AI_API_KEY`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `SERPAPI_KEY`, `WEB_RESEARCH_*`, `FESTIVO_ADMIN_FB_IMAGE_COOKIE`, `FESTIVO_INGEST_DEBUG`, `FESTIVO_SETTLEMENT_UNKNOWNS_LOG`, `SUPABASE_HERO_IMAGES_BUCKET`, `SUPABASE_ORGANIZER_LOGOS_BUCKET`.

> Тези може да са само в Vercel **Preview** + admin машини, не в Production runtime — admin routes са защитени.

## Sentry (вече инсталиран)

| Env Var | Описание |
|---|---|
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | DSN |
| `SENTRY_AUTH_TOKEN` | За source map upload (build time) |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Build config |

## Sanity checks

- [ ] Всеки 🔐 в таблицата е маркиран **Sensitive** в Vercel (скрит view)
- [ ] `NEXT_PUBLIC_*` стойностите не съдържат secrets (всичко с този префикс ще се бъндлва в client)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` се ползва САМО в server code (`app/api/**`, `lib/server*`, никога в `'use client'` компонент). Бърз grep:
  ```bash
  grep -r "SUPABASE_SERVICE_ROLE_KEY" --include='*.tsx' app/ components/ | grep -v 'use server'
  ```
  Очаквано: 0 резултата.
- [ ] `JOBS_SECRET` се проверява на cron endpoints (Vercel Cron → `Authorization: Bearer ${JOBS_SECRET}`)
- [ ] Google Maps / Geocoding keys са **HTTP referrer restricted** на `https://festivo.bg/*` в Google Cloud Console
- [ ] Turnstile keys са от **production widget** (не sandbox `1x...` test keys)
- [ ] `EMAIL_ENABLED=true` в prod (default е true, но потвърди — иначе всички welcome/confirmation имейли пропадат тихо)
- [ ] `FESTIVO_PUBLIC_MODE` НЕ е `coming-soon` в production env когато launch-ваш

## Quick verification commands

```bash
# Vercel CLI (от локална машина с linked project)
vercel env ls production

# Сравни с актуалния списък в кода
grep -rhoE 'process\.env\.[A-Z_][A-Z0-9_]+' --include='*.ts' --include='*.tsx' \
  --include='*.js' --include='*.mjs' --exclude-dir=node_modules \
  --exclude-dir=.claude --exclude-dir=.next . | sort -u
```
