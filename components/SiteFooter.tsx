import BuildStamp from "@/app/_components/BuildStamp";
import Container from "@/components/ui/Container";
import Text from "@/components/ui/Text";

export default function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-white">
      <Container className="py-10">
        <div className="flex flex-col gap-3 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <Text variant="muted" size="sm" className="text-xs">
            Festivo · Безплатни фестивали в България.
          </Text>
          <Text variant="muted" size="sm" className="text-xs">
            Open in app to save to plan.
          </Text>
        </div>
        <BuildStamp />
      </Container>
    </footer>
  );
}
