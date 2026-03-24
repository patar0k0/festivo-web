import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/authUser";
import { AuthCard } from "@/app/auth/_components/AuthCard";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : null;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const target = safeNext ?? "/";

  const user = await getOptionalUser();
  if (user) {
    redirect(target);
  }

  return (
    <AuthCard title="Регистрация" subtitle="Създай профил, за да ползваш Моят план и напомняния.">
      <SignupForm next={target} />
    </AuthCard>
  );
}
