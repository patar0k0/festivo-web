import Link from "next/link";

export default function AccountDeletedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4f0] px-4 text-[#0c0e14]">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-black">Акаунтът е изтрит</h1>
        <p className="mt-3 text-sm text-black/65">
          Този профил е деактивиран и вече не може да се използва. Ако смятате, че това е грешка, свържете се с
          поддръжка.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-[#7c2d12] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Към началото
        </Link>
      </div>
    </div>
  );
}
