/**
 * Decorative Bulgarian-style folk motif (rhombus + inner cross) for the home hero.
 * Stroke-only, low-contrast tiling on a ~40×40 diagonal diamond lattice.
 */
export default function HomeHeroFolkPattern() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full text-[#4a2814]"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id="festivoHeroFolkPattern"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          {/* Rhomb to tile corners — repeats as a diagonal lattice of identical diamonds */}
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            d="M 20 0 L 40 20 L 20 40 L 0 20 Z"
          />
          {/* Inner cross (типичен шевица елемент) */}
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="0.85"
            d="M 20 8 L 20 32 M 8 20 L 32 20"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#festivoHeroFolkPattern)" opacity="0.07" />
    </svg>
  );
}
