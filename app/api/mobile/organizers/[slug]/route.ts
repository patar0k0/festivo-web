import { NextResponse } from "next/server";
import { getMobileDbClient, getMobileOrganizerBySlug } from "@/lib/mobile/organizers";
import { serializeMobileFestivalListItem } from "@/lib/api/mobile/festivalSerialization";
import { fetchUserSavedFestivalIdSet } from "@/lib/api/mobile/planSaved";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { FESTIVAL_SELECT_MIN, fixFestivalText } from "@/lib/queries";
import type { Festival } from "@/lib/types";
import { getFestivalTemporalState } from "@/lib/festival/temporal";

export const runtime = "nodejs";

type FestivalRowWithVerify = Festival & { is_verified?: boolean | null };

function getUtcIsoDateToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function sortOrganizerFestivals(rows: FestivalRowWithVerify[]): FestivalRowWithVerify[] {
  const rank = (festival: FestivalRowWithVerify): number => {
    const state = getFestivalTemporalState(festival);
    if (state === "upcoming") return 0;
    if (state === "ongoing") return 1;
    return 2;
  };

  const dateToTs = (d: string | null | undefined): number => {
    if (!d) return Number.MAX_SAFE_INTEGER;
    const ts = Date.parse(d);
    return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;
  };

  return [...rows].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return dateToTs(a.start_date) - dateToTs(b.start_date);
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) {
      return authErr;
    }

    const { organizer } = await getMobileOrganizerBySlug(slug);
    if (!organizer) {
      return NextResponse.json({ error: "Organizer not found" }, { status: 404 });
    }

    const today = getUtcIsoDateToday();
    const db = getMobileDbClient();
    if (!db) {
      return NextResponse.json({ error: "Organizer lookup failed" }, { status: 503 });
    }

    const linksRes = await db
      .from("festival_organizers")
      .select("festival_id")
      .eq("organizer_id", organizer.id)
      .returns<Array<{ festival_id: string | null }>>();

    if (linksRes.error) {
      throw new Error(linksRes.error.message);
    }

    let festivalIds = (linksRes.data ?? []).map((row) => row.festival_id).filter((id): id is string => Boolean(id));

    if (festivalIds.length === 0) {
      const legacyRes = await db
        .from("festivals")
        .select("id")
        .eq("organizer_id", organizer.id)
        .or("status.eq.published,status.eq.verified,is_verified.eq.true")
        .neq("status", "archived")
        .gte("end_date", today)
        .returns<Array<{ id: string }>>();

      if (legacyRes.error) {
        throw new Error(legacyRes.error.message);
      }
      festivalIds = (legacyRes.data ?? []).map((row) => row.id).filter(Boolean);
    }

    if (festivalIds.length > 0) {
      festivalIds = [...new Set(festivalIds)];
    }

    let festivals: FestivalRowWithVerify[] = [];
    if (festivalIds.length > 0) {
      const festivalsRes = await db
        .from("festivals")
        .select(`${FESTIVAL_SELECT_MIN},is_verified`)
        .in("id", festivalIds)
        .or("status.eq.published,status.eq.verified,is_verified.eq.true")
        .neq("status", "archived")
        .gte("end_date", today)
        .limit(30)
        .returns<FestivalRowWithVerify[]>();

      if (festivalsRes.error) {
        throw new Error(festivalsRes.error.message);
      }

      festivals = (festivalsRes.data ?? []).map((row) => fixFestivalText(row) as FestivalRowWithVerify);
      festivals = sortOrganizerFestivals(festivals).slice(0, 30);
    }

    const ids = festivals.map((festival) => String(festival.id));
    const savedSet =
      auth.user && ids.length > 0 ? await fetchUserSavedFestivalIdSet(auth.supabase, auth.user.id, ids) : new Set<string>();
    const festivalItems = festivals.map((festival) => {
      const listItem = serializeMobileFestivalListItem(festival, savedSet.has(String(festival.id)));
      return {
        ...listItem,
        festivalId: listItem.id,
        saved: listItem.is_saved,
        is_verified: festival.is_verified ?? null,
      };
    });

    return NextResponse.json({ organizer, festivals: festivalItems }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/mobile/organizers/[slug]] Lookup failed", {
      requestedSlug: slug,
      reason: "query_failed",
      error: message,
    });
    return NextResponse.json({ error: "Organizer lookup failed" }, { status: 500 });
  }
}

