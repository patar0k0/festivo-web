import BuildStamp from "@/app/_components/BuildStamp";

export default function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-white/80">
      <div className="container-page flex flex-col gap-3 py-10 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p>Festivo Web · Discover festivals in Bulgaria.</p>
          <BuildStamp />
        </div>
        <p>Open in app to save to plan.</p>
      </div>
    </footer>
  );
}
