import Link from "next/link";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";

export default function Navbar() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <Container>
        <div className="flex flex-wrap items-center gap-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
            Festivo
          </Link>
          <div className="hidden flex-1 md:flex">
            <input
              placeholder="Search events, venues..."
              className="h-10 w-full rounded-xl border border-neutral-200 px-4 text-sm text-ink placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-ink">
              Register
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 text-sm text-neutral-600">
          <nav className="flex flex-wrap items-center gap-4">
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
            <Link href="/festivals" className="hover:text-ink">
              Browse
            </Link>
            <Link href="/map" className="hover:text-ink">
              Explore
            </Link>
            <Link href="/venues" className="hover:text-ink">
              Venues
            </Link>
            <Link href="/how-it-works" className="hover:text-ink">
              How it works
            </Link>
            <Link href="/blog" className="hover:text-ink">
              Blog
            </Link>
          </nav>
          <Button variant="primary" size="sm">
            Create event
          </Button>
        </div>
      </Container>
    </header>
  );
}
