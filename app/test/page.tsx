import type { Metadata } from "next";
import TestVisualPrototype from "@/components/test/TestVisualPrototype";
import "../landing.css";
import "./test-sandbox.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "UI прототип (/test)",
  description: "Вътрешна демо страница — визуал и локална интерактивност без реални маршрути.",
  robots: { index: false, follow: false },
};

export default function TestVisualPage() {
  return <TestVisualPrototype />;
}
