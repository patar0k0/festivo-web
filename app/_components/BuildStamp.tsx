export default function BuildStamp({ compact = false }: { compact?: boolean }) {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const at = process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 10);
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  return (
    <div className={`${compact ? "" : "mt-8 "}text-[11px] text-muted`}>
      build: {sha ?? "no-sha"}
      {at ? ` • deploy: ${at}` : ""}
      {env ? ` • env: ${env}` : ""}
    </div>
  );
}
