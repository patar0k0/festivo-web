/**
 * Decorative geometric background for the home hero (non-figurative, low contrast).
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
          width="56"
          height="56"
          patternUnits="userSpaceOnUse"
        >
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="0.9"
            d="M28 6 L50 28 L28 50 L6 28 Z"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="0.65"
            d="M28 16 L40 28 L28 40 L16 28 Z"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="0.45"
            d="M0 28h14M42 28H56M28 0v14M28 42V56"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            d="M28 0 L56 28 M0 28 L28 56 M56 28 L28 56 M28 0 L0 28"
            opacity="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#festivoHeroFolkPattern)" opacity="0.06" />
    </svg>
  );
}
