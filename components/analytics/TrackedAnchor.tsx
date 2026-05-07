"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";

type TrackedAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  eventType: string;
  eventMeta?: Record<string, unknown>;
};

export default function TrackedAnchor({ eventType, eventMeta, onClick, ...props }: TrackedAnchorProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) {
      return;
    }

    void fetch("/api/track/event", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: eventType,
        meta: eventMeta ?? {},
      }),
      keepalive: true,
    }).catch(() => {
      // Tracking should never block primary user intent.
    });
  };

  return <a {...props} onClick={handleClick} />;
}
