export default function BuildStamp() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const at = process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 10);
  return (
    <div className="mt-8 text-[11px] text-muted">
      build: {sha ?? "no-sha"} {at ? `• deploy: ${at}` : ""}
    </div>
  );
}
