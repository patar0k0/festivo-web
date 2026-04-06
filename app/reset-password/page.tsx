import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen px-4 py-12 text-[#0c0e14]">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-black/[0.08] bg-white/85 p-6 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
