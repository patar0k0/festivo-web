import type { Metadata } from "next";
import RealHomePageSandbox from "@/components/home/RealHomePageSandbox";
import { firstHomeSearchParam, loadHomePageData } from "@/lib/home/loadHomePageData";
import "../landing.css";
import "./test-sandbox.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Начало (UI песочник)",
  description: "Вътрешна тестова страница за визуални промени по началото.",
  robots: { index: false, follow: false },
};

type HomeSearchParams = Record<string, string | string[] | undefined>;

export default async function TestHomeSandboxPage({
  searchParams,
}: {
  searchParams: HomeSearchParams;
}) {
  const city = firstHomeSearchParam(searchParams.city)?.trim();
  const props = await loadHomePageData(city);

  return (
    <div className="relative mx-auto min-h-screen max-w-6xl px-4 sm:px-6">
      <RealHomePageSandbox {...props} />
    </div>
  );
}
