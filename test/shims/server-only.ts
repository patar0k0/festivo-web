// No-op shim for the "server-only" package under vitest. Next.js's webpack/
// Turbopack build special-cases the bare `import "server-only"` specifier so
// it never actually executes the real package's code in a server bundle; the
// real package unconditionally throws when its index.js is executed (it's
// designed to fire that error only when accidentally pulled into a client
// bundle). Vitest has no equivalent build-time special-casing, so this alias
// (see vitest.config.ts) substitutes this empty module whenever a test
// transitively imports a "server-only"-marked file.
export {};
