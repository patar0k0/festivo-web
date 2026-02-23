import Link from "next/link";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";

export default function Navbar() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <Container>
        <div className="flex flex-wrap items-center gap-4 py-5">
          <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
            Festivo
          </Link>
          <div className="hidden flex-1 md:flex">
            <input
              placeholder="Search events, venues..."
              className="h-10 w-full rounded-xl border border-neutral-200 px-4 text-sm text-ink placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-700">
            <Link href="/login" className="font-medium hover:text-orange-500">
              Sign in
            </Link>
            <Link href="/signup" className="font-medium hover:text-orange-500">
              Register
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 text-sm text-neutral-700">
          <nav className="flex flex-wrap items-center gap-4">
            <Link href="/" className="font-medium hover:text-orange-500">
              Home
            </Link>
            <Link href="/festivals" className="font-medium hover:text-orange-500">
              Browse
            </Link>
            <Link href="/map" className="font-medium hover:text-orange-500">
              Explore
            </Link>
            <Link href="/venues" className="font-medium hover:text-orange-500">
              Venues
            </Link>
            <Link href="/how-it-works" className="font-medium hover:text-orange-500">
              How it works
            </Link>
            <Link href="/blog" className="font-medium hover:text-orange-500">
              Blog
            </Link>
          </nav>
          <Button variant="primary" size="sm" className="rounded-lg px-4 py-2 shadow-sm">
            Create event
          </Button>
        </div>
      </Container>
    </header>
  );
}
