import { redirect } from "next/navigation";
import NewFestivalSubmissionClient from "./NewFestivalSubmissionClient";
import { requireActiveOrganizerPortalSession } from "@/lib/organizer/portal";
import "@/app/landing.css";

export const dynamic = "force-dynamic";

export default async function NewFestivalSubmissionPage() {
  const gate = await requireActiveOrganizerPortalSession("/organizer/festivals/new");
  if (gate.kind === "redirect") {
    redirect(gate.to);
  }
  if (gate.kind === "unavailable") {
    return (
      <div className="landing-bg min-h-screen px-4 py-10 text-[#0c0e14]">
        <div className="mx-auto max-w-lg rounded-2xl border border-black/[0.08] bg-white/90 p-6 text-sm text-black/65">
          Услугата е временно недостъпна. Опитайте по-късно.
        </div>
      </div>
    );
  }

  return <NewFestivalSubmissionClient />;
}
