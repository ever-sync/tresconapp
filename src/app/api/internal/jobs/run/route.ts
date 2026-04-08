import { NextRequest } from "next/server";

import { error, handleError, success } from "@/lib/api-response";
import { runAvailableBackgroundJobs } from "@/lib/background-job-runner";

export const runtime = "nodejs";
export const preferredRegion = "iad1";

const DEFAULT_JOB_LIMIT = 2;

function isAuthorized(request: NextRequest) {
  const internalSecret = process.env.INTERNAL_JOBS_SECRET?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!internalSecret && !cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const headerSecret = request.headers.get("x-internal-jobs-secret")?.trim();
  const bearerToken = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();

  return (
    (Boolean(internalSecret) &&
      (headerSecret === internalSecret || bearerToken === internalSecret)) ||
    (Boolean(cronSecret) && bearerToken === cronSecret)
  );
}

async function handleRunJobs(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return error("Nao autorizado", 401);
    }

    const url = new URL(request.url);
    const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 10)
        : DEFAULT_JOB_LIMIT;

    const results = await runAvailableBackgroundJobs(limit);

    return success({
      processed: results.length,
      results,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function GET(request: NextRequest) {
  return handleRunJobs(request);
}

export async function POST(request: NextRequest) {
  return handleRunJobs(request);
}
