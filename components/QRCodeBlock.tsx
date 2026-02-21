"use client";

import { QRCodeSVG } from "qrcode.react";

export default function QRCodeBlock({ value }: { value: string }) {
  return (
    <div className="hidden items-center gap-4 rounded-2xl border border-ink/10 bg-white/80 p-4 text-xs text-muted md:flex">
      <QRCodeSVG value={value} size={72} bgColor="#ffffff" fgColor="#121417" />
      <div>
        <p className="font-semibold text-ink">Scan to open in app</p>
        <p>Save to plan instantly.</p>
      </div>
    </div>
  );
}
