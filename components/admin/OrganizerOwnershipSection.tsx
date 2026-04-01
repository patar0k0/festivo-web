import Link from "next/link";

export type OrganizerOwnershipMember = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  contact_email: string | null;
  contact_phone: string | null;
};

const MEMBER_STATUS: Record<string, { text: string; className: string }> = {
  active: { text: "Активен", className: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90" },
  pending: { text: "Чакащ", className: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90" },
  revoked: { text: "Оттеглен", className: "bg-slate-100 text-slate-800 ring-1 ring-slate-200/90" },
};

const ORG_ROLE: Record<string, { text: string; className: string }> = {
  owner: { text: "Собственик", className: "bg-violet-100 text-violet-950 ring-1 ring-violet-200/90" },
  admin: { text: "Админ", className: "bg-sky-100 text-sky-950 ring-1 ring-sky-200/90" },
  editor: { text: "Редактор", className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]" },
};

function statusBadge(status: string) {
  return (
    MEMBER_STATUS[status] ?? {
      text: status,
      className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]",
    }
  );
}

function roleBadge(role: string) {
  return ORG_ROLE[role] ?? { text: role, className: "bg-black/[0.06] text-black/75 ring-1 ring-black/[0.1]" };
}

export default function OrganizerOwnershipSection({ members }: { members: OrganizerOwnershipMember[] }) {
  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white/90 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Собственост</h2>
      {members.length === 0 ? (
        <p className="mt-3 text-sm text-black/60">Няма свързани потребители</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-black/[0.08]">
          <table className="min-w-full text-sm">
            <thead className="bg-black/[0.03] text-left text-xs uppercase tracking-[0.12em] text-black/55">
              <tr>
                <th className="px-3 py-2">Роля</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2">Присъединен</th>
                <th className="px-3 py-2">Потребител</th>
                <th className="px-3 py-2">Контакт (вериф.)</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const st = statusBadge(m.status);
                const rb = roleBadge(m.role);
                return (
                  <tr key={m.id} className="border-t border-black/[0.06]">
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${rb.className}`}
                      >
                        {rb.text}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-tight ${st.className}`}
                      >
                        {st.text}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-black/70">
                      {m.created_at ? new Date(m.created_at).toLocaleString("bg-BG") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/users/${m.user_id}`}
                        className="text-xs font-semibold uppercase tracking-[0.1em] text-[#0c0e14] underline-offset-2 hover:underline"
                      >
                        Виж потребител
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-black/65">
                      <div className="break-all">{m.contact_email?.trim() || "—"}</div>
                      <div className="mt-0.5">{m.contact_phone?.trim() || "—"}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
