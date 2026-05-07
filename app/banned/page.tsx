import Link from "next/link";

export default function BannedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4f0] px-4 text-[#0c0e14]">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-black">Акаунтът е блокиран</h1>
        <p className="mt-3 text-sm text-black/65">
          Достъпът до този акаунт е ограничен. Свържете се с поддръжка, ако имате въпроси.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium text-[#0c0e14] transition hover:bg-black/[0.03]"
        >
          Към началото
        </Link>
      </div>
    </div>
  );
}
