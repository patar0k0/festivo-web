import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="landing-bg min-h-screen px-4 py-12 text-[#0c0e14]">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-black/[0.08] bg-white/85 p-6 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Festivo</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Нова парола</h1>
        <p className="mt-2 text-sm text-black/65">Въведи нова парола за профила си.</p>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
