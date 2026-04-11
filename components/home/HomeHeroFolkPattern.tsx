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
          width="72.8"
          height="72.8"
          patternUnits="userSpaceOnUse"
        >
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.17"
            d="M36.4 7.8 L65 36.4 L36.4 65 L7.8 36.4 Z"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="0.845"
            d="M36.4 20.8 L52 36.4 L36.4 52 L20.8 36.4 Z"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="0.585"
            d="M0 36.4h18.2M54.6 36.4H72.8M36.4 0v18.2M36.4 54.6V72.8"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="0.65"
            d="M36.4 0 L72.8 36.4 M0 36.4 L36.4 72.8 M72.8 36.4 L36.4 72.8 M36.4 0 L0 36.4"
            opacity="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#festivoHeroFolkPattern)" opacity="0.13" />
    </svg>
  );
}
