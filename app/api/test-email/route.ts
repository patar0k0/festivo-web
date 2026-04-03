import { NextResponse } from "next/server";
import { createElement } from "react";

import { TestEmail } from "@/emails/templates/TestEmail";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/sendEmail";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to")?.trim();
  if (!to) {
    return NextResponse.json(
      { ok: false, error: "Missing query parameter: to" },
      { status: 400 },
    );
  }

  const name = searchParams.get("name")?.trim() || "приятел";
  const { html, text } = await renderEmail(
    createElement(TestEmail, { name }),
  );

  const result = await sendEmail({
    to,
    subject: "Festivo — тестов имейл",
    html,
    text,
  });

  return NextResponse.json({ ok: result.ok });
}
