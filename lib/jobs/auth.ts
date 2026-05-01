export function isAuthorizedJobRequest(req: Request): boolean {
  const secret = req.headers.get("x-job-secret");
  const ua = req.headers.get("user-agent") || "";

  if (secret && secret === process.env.JOBS_SECRET) {
    return true;
  }

  // TEMP: allow Vercel cron without secret (Hobby plan limitation)
  if (ua.includes("vercel-cron")) {
    return true;
  }

  return false;
}
