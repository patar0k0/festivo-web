"use client";

import { forwardRef, memo } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/TurnstileWidget";

export type SignupTurnstileBlockProps = {
  onSuccess: (token: string) => void;
  onError: () => void;
  onExpire: () => void;
};

/** Isolated from SignupForm state updates so Turnstile does not remount on each keystroke. */
const SignupTurnstileBlockInner = forwardRef<TurnstileWidgetHandle, SignupTurnstileBlockProps>(
  function SignupTurnstileBlockInner({ onSuccess, onError, onExpire }, ref) {
    return (
      <div className="flex min-h-[65px] justify-center">
        <TurnstileWidget ref={ref} onSuccess={onSuccess} onError={onError} onExpire={onExpire} />
      </div>
    );
  },
);

SignupTurnstileBlockInner.displayName = "SignupTurnstileBlockInner";

export const SignupTurnstileBlock = memo(SignupTurnstileBlockInner);
