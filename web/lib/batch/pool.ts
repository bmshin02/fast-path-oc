// Run async jobs with a concurrency limit, in submission order, with one retry per job.
// Used by the browser batch runner. Shared, no platform APIs.

export type JobResult<R> = { ok: true; value: R } | { ok: false; error: string };

export async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  opts: { retries?: number; onSettled?: (index: number, result: JobResult<R>) => void; signal?: AbortSignal } = {},
): Promise<JobResult<R>[]> {
  const results: JobResult<R>[] = new Array(items.length);
  const retries = opts.retries ?? 1;
  let next = 0;

  async function lane() {
    for (;;) {
      if (opts.signal?.aborted) return;
      const i = next++;
      if (i >= items.length) return;
      let result: JobResult<R> = { ok: false, error: "not run" };
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (opts.signal?.aborted) {
          result = { ok: false, error: "cancelled" };
          break;
        }
        try {
          result = { ok: true, value: await worker(items[i], i) };
          break;
        } catch (e) {
          result = { ok: false, error: e instanceof Error ? e.message : String(e) };
          // A message written for the user (e.g. "too large") won't get better on retry.
          if (e instanceof Error && (e as Error & { permanent?: boolean }).permanent) break;
        }
      }
      results[i] = result;
      opts.onSettled?.(i, result);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane));
  return results;
}
