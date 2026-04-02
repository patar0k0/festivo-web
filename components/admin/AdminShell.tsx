import AdminSidebarNav from "@/components/admin/AdminSidebarNav";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";

export default function AdminShell({ children, email }: { children: React.ReactNode; email?: string | null }) {
  return (
    <WorkspaceShell
      density="admin-c"
      eyebrow="Festivo админ"
      email={email ?? "admin"}
      sidebar={<AdminSidebarNav />}
    >
      <div className="mx-auto w-full max-w-[1600px]">{children}</div>
    </WorkspaceShell>
  );
}

