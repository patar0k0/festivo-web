// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Защита срещу browser-преводачи (Google Translate и подобни), които мутират
// текстовите node-ове в DOM. След това React се опитва да премахне/вмъкне node,
// който преводачът вече е заместил, и хвърля
//   NotFoundError: Failed to execute 'removeChild' / 'insertBefore' on 'Node'
// (DOMException.code 8). Това не е наш бъг (вж. facebook/react#11538) — node-ът
// просто вече не е там, където React очаква. Правим операцията no-op в този
// случай, вместо да гръмне: и потребителят не вижда счупена страница, и Sentry
// не се залива с шум. Запазваме нормалното поведение за всички останали случаи.
if (typeof Node === "function" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChild<T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Прихваната removeChild грешка от browser-преводач", child);
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  } as typeof Node.prototype.removeChild;

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function insertBefore<T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Прихваната insertBefore грешка от browser-преводач", referenceNode);
      }
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  } as typeof Node.prototype.insertBefore;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Само реални deploy-и (Vercel production + preview, които са NODE_ENV=production)
  // пращат към Sentry. Локалната разработка (`next dev`, NODE_ENV=development) не
  // изпраща — иначе dev грешки (напр. curl на localhost преди .env.local) шумят и
  // хабят quota-та.
  enabled: process.env.NODE_ENV === "production",

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // 10% от transactions — достатъчно за production insights без излишни разходи
  tracesSampleRate: 0.1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Session replay — изключен за нормални сесии (GDPR и bandwidth)
  replaysSessionSampleRate: 0.0,

  // Session replay — включен само при част от грешките за debugging
  // (намален от 1.0, за да не изчерпва месечната replays квота)
  replaysOnErrorSampleRate: 0.5,

  // GDPR: не изпращаме PII (IP адреси, email адреси и т.н.)
  sendDefaultPii: false,

  // Шумови, неактивни грешки, които да не се изпращат към Sentry.
  // - "Connection closed" идва от прекъснат RSC stream / server action,
  //   когато потребителят навигира настрани преди заявката да приключи —
  //   Next.js я хваща сам (handled), потребителят не вижда нищо счупено.
  // - "Java object is gone" идва от Facebook in-app браузъра (Android WebView):
  //   неговият собствен инжектиран performance logger се опитва да postMessage
  //   към native Java bridge обект, който Web* е унищожил при затваряне/навигация.
  //   Не е наш код (целият stack е от app://navigation_performance_logger_*) и
  //   не можем да го поправим — само го заглушаваме.
  // - "Lock broken by another request with the 'steal' option" идва от
  //   @supabase/auth-js, който ползва navigator.locks със `steal` за token lock-а;
  //   при няколко конкурентни заявки (напр. тежката /admin/research) едната краде
  //   lock-а и другата отхвърля. Чуждо, бенигно (unhandledrejection без наш frame).
  ignoreErrors: [
    "Connection closed",
    "Java object is gone",
    "Lock broken by another request with the 'steal' option",
  ],

  // Грешки, произхождащи от скриптове, инжектирани от in-app браузъри
  // (Facebook, Instagram и др.) се сервират през app:// scheme и никога не са
  // наш код. Дропваме ги изцяло — нашите скриптове са винаги по https.
  denyUrls: [/^app:\/\//],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
