export function isAuthorizedJobRequest(request: Request): boolean {
  if (request.headers.get("x-vercel-cron")) {
    return true;
  }

  const expectedSecret = process.env.JOBS_SECRET;
  const providedSecret = request.headers.get("x-job-secret");
  return Boolean(expectedSecret && providedSecret && expectedSecret === providedSecret);
}
