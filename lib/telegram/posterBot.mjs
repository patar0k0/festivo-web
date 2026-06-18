import crypto from "node:crypto";

export function verifyWebhookSecret(headerSecret, expected) {
  return Boolean(expected) && headerSecret === expected;
}

export function buildPosterDedupeKey(chatId, fileUniqueId) {
  const raw = `${chatId}::${String(fileUniqueId).trim()}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/** Largest photo size = best OCR. Telegram sends ascending sizes; pick the last with a file_id. */
function pickLargestPhoto(photo) {
  if (!Array.isArray(photo) || photo.length === 0) return null;
  let best = null;
  for (const p of photo) {
    if (p && typeof p.file_id === "string") {
      if (!best || (p.width ?? 0) >= (best.width ?? 0)) best = p;
    }
  }
  return best;
}

// Maps a raw Telegram update to a discrete poster-bot action.
export function mapPosterUpdate(update) {
  const cq = update?.callback_query;
  if (cq) {
    const parts = String(cq.data || "").split(":");
    if (parts[0] === "poster") {
      return {
        kind: "dup-decision",
        chatId: cq.message?.chat?.id,
        userId: cq.from?.id,
        callbackQueryId: cq.id,
        jobId: parts[1],
        decision: parts[2], // "create" | "discard"
      };
    }
    return { kind: "ignore" };
  }

  const msg = update?.message;
  const photo = pickLargestPhoto(msg?.photo);
  if (msg && photo) {
    return {
      kind: "photo",
      chatId: msg.chat?.id,
      userId: msg.from?.id,
      fileId: photo.file_id,
      fileUniqueId: photo.file_unique_id,
      caption: typeof msg.caption === "string" ? msg.caption.trim() : "",
    };
  }

  return { kind: "ignore" };
}

export function formatInserted({ pendingId, title, needsReview, baseUrl }) {
  const link = `${String(baseUrl).replace(/\/$/, "")}/admin/pending-festivals/${pendingId}`;
  const head = needsReview ? "⚠️ Създаден чернова (нужен преглед)" : "✅ Създаден чернова";
  return `${head}\n„${title}"\nЗа преглед и одобрение: ${link}`;
}

export function dupKeyboard(jobId) {
  return {
    inline_keyboard: [
      [
        { text: "Все пак създай", callback_data: `poster:${jobId}:create` },
        { text: "Откажи", callback_data: `poster:${jobId}:discard` },
      ],
    ],
  };
}

export function reprocessKeyboard(jobId) {
  return {
    inline_keyboard: [
      [{ text: "🔄 Преработи отново", callback_data: `poster:${jobId}:reprocess` }],
    ],
  };
}

export function formatAlreadyDone({ pendingId, baseUrl }) {
  const link = pendingId
    ? `${String(baseUrl).replace(/\/$/, "")}/admin/pending-festivals/${pendingId}`
    : null;
  return link
    ? `ℹ️ Плакатът вече е обработен.\nПреглед: ${link}`
    : `ℹ️ Плакатът вече е обработен.`;
}

export function formatRejected({ pendingId, baseUrl }) {
  const link = pendingId
    ? `${String(baseUrl).replace(/\/$/, "")}/admin/pending-festivals/${pendingId}`
    : null;
  return link
    ? `⛔ Черновата от този плакат е отхвърлена.\nПреглед: ${link}\n\nИскаш ли да я преработиш отново?`
    : `⛔ Черновата от този плакат е отхвърлена. Искаш ли да я преработиш отново?`;
}

export function formatDuplicate(matches, baseUrl) {
  const base = String(baseUrl).replace(/\/$/, "");
  const lines = (matches || []).slice(0, 5).map((m) => `• ${m.title} — ${base}${m.href}`);
  return `⚠️ Възможен дубликат:\n${lines.join("\n")}\n\nДа създам ли въпреки това?`;
}
