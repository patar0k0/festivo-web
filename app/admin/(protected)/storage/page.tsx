import type { Metadata } from "next";
import StorageOrphansPanel from "@/components/admin/StorageOrphansPanel";

export const metadata: Metadata = { title: "Storage — Админ" };

export default function AdminStoragePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Storage — почистване</h1>
        <p className="text-sm text-black/60">
          Намира файлове в bucket-а <code>festival-hero-images</code>, които не се ползват от нито един запис,
          и позволява изтриването им. Изтриването е необратимо.
        </p>
      </header>
      <StorageOrphansPanel />
    </div>
  );
}
