import { redirect } from "next/navigation";
import NewFestivalSubmissionClient from "./NewFestivalSubmissionClient";
import { requireActiveOrganizerPortalSession } from "@/lib/organizer/portal";

export const dynamic = "force-dynamic";

export default async function NewFestivalSubmissionPage() {
  const gate = await requireActiveOrganizerPortalSession("/organizer/festivals/new");
  if (gate.kind === "redirect") {
    redirect(gate.to);
  }
  if (gate.kind === "unavailable") {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-6 text-sm text-black/65 shadow-sm">
        Услугата е временно недостъпна. Опитайте по-късно.
      </div>
    );
  }

  return <NewFestivalSubmissionClient />;
}
