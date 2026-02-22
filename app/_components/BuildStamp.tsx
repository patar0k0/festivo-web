export default function BuildStamp() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const fallback = new Date().toISOString();
  const stamp = sha ?? fallback;

  return <span className="text-[10px] text-muted">build: {stamp}</span>;
}
