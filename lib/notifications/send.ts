/**
 * Backward-compatible re-exports. Prefer `@/lib/push/sendPush` for new code.
 */

export {
  getFcmServerKey,
  invalidateDeadTokens,
  sendFcmToTokensInternal as sendFcmToTokens,
  type FcmLegacyResult,
} from "@/lib/push/sendPush";

export { PUSH_SEND_MAX_RETRIES as MAX_RETRIES } from "@/lib/push/constants";
