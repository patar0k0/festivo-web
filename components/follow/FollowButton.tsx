"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fbqTrackCustom } from "@/lib/pixel";

type FollowButtonProps = {
  /** API route that exposes GET (status) + POST/DELETE (toggle). */
  endpoint: string;
  /** Query/body key for the entity id, e.g. "city_slug" or "organizer_id". */
  paramKey: string;
  /** The entity identifier value (slug or id). */
  paramValue: string;
  labelIdle: string;
  labelActive: string;
  loginLabel: string;
  icon: "heart" | "star";
  /** Optional Meta Pixel custom event fired on follow (not unfollow). */
  pixelEvent?: string;
  /**
   * When the caller already knows the state (e.g. the profile follows list),
   * pass these to skip the initial GET round-trip.
   */
  initialAuthenticated?: boolean;
  initialFollowing?: boolean;
};

function FollowIcon({ icon, filled }: { icon: "heart" | "star"; filled: boolean }) {
  if (icon === "star") {
    return filled ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 17.27l5.18 3.12-1.37-5.9 4.58-3.97-6.04-.52L12 4.5 9.65 9.99l-6.04.52 4.58 3.97-1.37 5.9L12 17.27z" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 17.27l5.18 3.12-1.37-5.9 4.58-3.97-6.04-.52L12 4.5 9.65 9.99l-6.04.52 4.58 3.97-1.37 5.9L12 17.27z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return filled ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const PILL_BASE =
  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/30 disabled:cursor-not-allowed disabled:opacity-50";

export default function FollowButton({
  endpoint,
  paramKey,
  paramValue,
  labelIdle,
  labelActive,
  loginLabel,
  icon,
  pixelEvent,
  initialAuthenticated,
  initialFollowing,
}: FollowButtonProps) {
  const hasInitial = typeof initialAuthenticated === "boolean";
  const [ready, setReady] = useState(hasInitial);
  const [authenticated, setAuthenticated] = useState(Boolean(initialAuthenticated));
  const [following, setFollowing] = useState(Boolean(initialFollowing));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasInitial) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${endpoint}?${paramKey}=${encodeURIComponent(paramValue)}`, {
          credentials: "include",
        });
        const data = (await res.json()) as { authenticated?: boolean; following?: boolean };
        if (!active) return;
        setAuthenticated(Boolean(data.authenticated));
        setFollowing(Boolean(data.following));
      } catch {
        // Network hiccup — leave defaults (treated as logged-out CTA).
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [endpoint, paramKey, paramValue, hasInitial]);

  const toggle = async () => {
    const next = !following;
    setPending(true);
    setError(null);
    setFollowing(next); // optimistic
    try {
      const res = await fetch(endpoint, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [paramKey]: paramValue }),
      });
      if (!res.ok) {
        setFollowing(!next);
        if (res.status === 401) {
          setAuthenticated(false);
        } else {
          setError("Възникна грешка. Опитай пак.");
        }
        return;
      }
      if (next && pixelEvent) {
        fbqTrackCustom(pixelEvent, { [paramKey]: paramValue });
      }
    } catch {
      setFollowing(!next);
      setError("Възникна грешка. Опитай пак.");
    } finally {
      setPending(false);
    }
  };

  if (!ready) {
    return (
      <span className={`${PILL_BASE} border-black/[0.12] bg-white text-black/40`} aria-hidden>
        <FollowIcon icon={icon} filled={false} />
        {labelIdle}
      </span>
    );
  }

  if (!authenticated) {
    return (
      <Link
        href="/login"
        className={`${PILL_BASE} border-black/[0.12] bg-white text-[#0c0e14] hover:bg-[#f7f6f3]`}
      >
        <FollowIcon icon={icon} filled={false} />
        {loginLabel}
      </Link>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={pending}
        aria-pressed={following}
        className={`${PILL_BASE} ${
          following
            ? "border-[#7c2d12] bg-[#7c2d12] text-white hover:bg-[#6a2610]"
            : "border-black/[0.12] bg-white text-[#0c0e14] hover:bg-[#f7f6f3]"
        }`}
      >
        <FollowIcon icon={icon} filled={following} />
        {pending ? "…" : following ? labelActive : labelIdle}
      </button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
