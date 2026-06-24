# Booking affiliate monetization — design

**Дата:** 2026-06-24
**Статус:** одобрен дизайн, предстои имплементация

## Проблем

Картата „🏨 Настаняване наблизо" на страницата на фестивал
(`components/festival/FestivalNearbyBookingCard.tsx`) праща потребителя към
`booking.com/searchresults.html` **без affiliate ID**. Кликовете се проследяват
вътрешно (`/out` → `outbound_clicks`), но Booking не приписва никаква комисия —
сайтът не печели нищо от тези резервации.

## Цел

Връзките към Booking да носят комисия, без да чупим текущия UX или вътрешния
click-tracking, и без да зависим от одобрение на конкретна affiliate програма
(да можем да стартираме веднага).

## Ключово прозрение

Booking affiliate приписването става чрез добавяне на `aid` (и по желание `label`)
параметър към `booking.com` URL-а. Това важи **еднакво** за:

- **директен Booking.com Affiliate Partner Program** (изисква одобрение / праг трафик), и
- **Booking през Travelpayouts** (instant, без праг — дава ти Booking `aid` + `label`).

Тоест кодът е идентичен за двата канала — сменя се само стойността на `aid`,
която операторът поставя в env. Не е нужна продуктова логика за „избор на канал".

`app/out/route.ts` подава `url` параметъра непокътнат към `NextResponse.redirect`,
затова affiliate параметрите оцеляват през вътрешния redirect.

### За „и двете" (Travelpayouts + Booking директно)

Една и съща Booking връзка **не може** да минава едновременно през два канала —
Booking приписва само един `aid`. Затова за настаняване има **един** `aid` слот;
операторът решава дали стойността идва от Travelpayouts или от директен Booking
(и може да я смени с една env промяна, когато директният акаунт бъде одобрен).

Допълнителната стойност на Travelpayouts (коли под наем, транспорт, други
доставчици) идва от **отделни карти** и е **извън обхвата** на този PR.

## Дизайн

### Нов helper: `lib/outbound/affiliate.ts`

```ts
/**
 * Append Booking.com affiliate attribution (aid + label) to a clean
 * booking.com URL. No-op (returns the URL unchanged) when BOOKING_AFFILIATE_AID
 * is not configured, so the link still works before/without an affiliate account.
 *
 * The aid value may come from a direct Booking.com affiliate account OR from a
 * Travelpayouts Booking program — the URL shape is identical either way.
 */
export function withBookingAffiliate(rawUrl: string, festivalId?: string | null): string
```

Поведение:
- Чете `BOOKING_AFFILIATE_AID` (server env). Празно/липсва → връща URL-а непроменен.
- Добавя `aid=<BOOKING_AFFILIATE_AID>`.
- Добавя `label` за статистика по фестивал:
  `<BOOKING_AFFILIATE_LABEL_PREFIX|"festivo">-<festivalId|"site">`.
  `label`-ът се санитизира до позволените от Booking символи (alnum, `-`, `_`).
- Парсва с `new URL`; при невалиден вход връща оригинала (fail-safe, без хвърляне).
- Запазва съществуващите query параметри (`ss`, `checkin`, `checkout`).

### Промяна в `FestivalNearbyBookingCard.tsx`

Понеже компонентът е client component, а `aid`-ът е server env, опаковането става
**преди** да стигне до браузъра. Опции:
- `buildBookingSearchUrl` остава, но резултатът се прекарва през
  `withBookingAffiliate` на сървъра.

Тъй като картата днес сама строи URL-а в client компонента, преместваме
изграждането на affiliate URL-а нагоре (в server компонента/родителя, който вече
подава `place`, `startDate`, `endDate`, `festivalId`), и подаваме готовия
`bookingUrl` като prop. Картата само го обвива в `outboundClickHref` и го рендира.

> Бележка при имплементация: да се провери дали `FestivalDetailClient.tsx` (client)
> е мястото, или има server родител, който може да достъпи env. Ако цялата верига е
> client, helper-ът се извиква в server компонент по-нагоре и стойността се подава
> като prop. `NEXT_PUBLIC_*` НЕ се ползва — `aid` няма нужда да е публичен и не бива
> да се „замразява" в bundle-а.

### Env vars

| Var | Роля | Default |
|---|---|---|
| `BOOKING_AFFILIATE_AID` | Booking affiliate id (от Travelpayouts или директен Booking) | няма → fallback към чист URL |
| `BOOKING_AFFILIATE_LABEL_PREFIX` | Префикс на `label` за статистика | `festivo` |

Документират се в `README.md` и в таблицата с env vars в `CLAUDE.md`.

## Какво НЕ се пипа (запазен инвариант)

- Вътрешният click-tracking (`/out`, `outbound_clicks`, dedup, bot филтър) — без промяна.
- `outboundClickHref` договорът — без промяна.
- Видим UX на картата (текст, бутон, „Отваря се в Booking.com") — без промяна.

## Извън обхвата (отделни PR-и после)

- Карта за коли под наем / транспорт през Travelpayouts.
- Натиск върху organizer VIP / промоции (по-високи маржове, вече изградена инфраструктура).
- Билетни affiliate интеграции.

## Тестване

- Unit тест за `withBookingAffiliate`:
  - без `BOOKING_AFFILIATE_AID` → URL непроменен;
  - с `aid` → добавени `aid` и `label`;
  - `label` включва `festivalId` и е санитизиран;
  - невалиден вход → връща оригинала без хвърляне;
  - съществуващите query параметри се запазват.

## Risk / rollback

Нисък риск: при липса на env var поведението е идентично на сегашното. Rollback =
премахване на env var (моментално връща чисти URL-и) или revert на PR-а.
