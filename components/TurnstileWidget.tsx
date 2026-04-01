"use client";

import Script from "next/script";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement | string, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export type TurnstileWidgetHandle = {
  reset: () => void;
};

type TurnstileWidgetProps = {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  className?: string;
};

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(function TurnstileWidget(
  { onSuccess, onError, onExpire, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const [apiReady, setApiReady] = useState(false);
  const [containerMounted, setContainerMounted] = useState(false);

  const teardown = useCallback(() => {
    if (typeof window === "undefined" || !window.turnstile || !widgetIdRef.current) {
      widgetIdRef.current = null;
      return;
    }
    try {
      window.turnstile.remove(widgetIdRef.current);
    } catch {
      /* ignore */
    }
    widgetIdRef.current = null;
  }, []);

  const renderWidget = useCallback(() => {
    if (!siteKey || typeof window === "undefined" || !containerRef.current || !window.turnstile) {
      return;
    }
    teardown();
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onSuccess,
      "error-callback": onError,
      "expired-callback": onExpire,
    });
  }, [siteKey, onSuccess, onError, onExpire, teardown]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.turnstile) {
      setApiReady(true);
    }
  }, []);

  useEffect(() => {
    if (!apiReady || !siteKey || !containerMounted) {
      return;
    }
    renderWidget();
    return () => {
      teardown();
    };
  }, [apiReady, siteKey, containerMounted, renderWidget, teardown]);

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        if (!widgetIdRef.current || typeof window === "undefined" || !window.turnstile) {
          return;
        }
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          /* ignore */
        }
      },
    }),
    [],
  );

  if (!siteKey) {
    return null;
  }

  return (
    <>
      <Script src={TURNSTILE_SCRIPT} strategy="afterInteractive" onLoad={() => setApiReady(true)} />
      <div
        ref={(el) => {
          containerRef.current = el;
          setContainerMounted(Boolean(el));
        }}
        className={className}
      />
    </>
  );
});
