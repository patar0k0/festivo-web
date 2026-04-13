"use client";

type OAuthProvider = "google" | "apple";

type OAuthButtonsProps = {
  oauthProvider: OAuthProvider | null;
  disabled: boolean;
  onContinue: (provider: OAuthProvider) => Promise<void> | void;
  /** `festivo` — primary terracotta Google pill + soft Apple outline (login / landing alignment). */
  variant?: "default" | "festivo";
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.7h5.5a4.9 4.9 0 01-2.1 3.2v2.7h3.4c2-1.8 3-4.6 3-7.6z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.4-2.7a6 6 0 01-9-3.2H2.7v2.8A10 10 0 0012 22z"
        fill="#34A853"
      />
      <path
        d="M6.2 13.7a6 6 0 010-3.5V7.4H2.7a10 10 0 000 9.1l3.5-2.8z"
        fill="#FBBC05"
      />
      <path
        d="M12 6a5.5 5.5 0 013.9 1.5l2.9-2.9A10 10 0 002.7 7.4l3.5 2.8A6 6 0 0112 6z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M16.4 12.8c0-2.1 1.8-3.1 1.8-3.2-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.4 1.1 8.6.8 1.1 1.6 2.3 2.8 2.3 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-.9 2.8-2 .9-1.2 1.2-2.4 1.2-2.4-.1 0-2.9-1.1-2.9-3.8zM14.3 6.6c.7-.8 1.2-1.9 1-3.1-1 .1-2.2.7-2.9 1.5-.7.7-1.3 1.9-1.1 3 1.1.1 2.2-.6 3-1.4z"
        fill="currentColor"
      />
    </svg>
  );
}

export function OAuthButtons({ oauthProvider, disabled, onContinue, variant = "default" }: OAuthButtonsProps) {
  if (variant === "festivo") {
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void onContinue("google")}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7c2d12] py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <GoogleIcon />
          <span>{oauthProvider === "google" ? "Пренасочване..." : "Продължи с Google"}</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void onContinue("apple")}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white py-3 text-sm font-medium text-[#0c0e14] transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <AppleIcon />
          <span>{oauthProvider === "apple" ? "Пренасочване..." : "Продължи с Apple"}</span>
        </button>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onContinue("google")}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.12] bg-white px-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#0c0e14] transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <GoogleIcon />
        <span>{oauthProvider === "google" ? "Пренасочване..." : "Продължи с Google"}</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onContinue("apple")}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.12] bg-white px-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#0c0e14] transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <AppleIcon />
        <span>{oauthProvider === "apple" ? "Пренасочване..." : "Продължи с Apple"}</span>
      </button>
    </>
  );
}
