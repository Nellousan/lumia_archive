import {
  buildRoutesCached,
  createRouteSolver,
  type RouteOptions,
  type RoutePlanSet,
  type RouteSlice,
} from "./routes";
import type { RouteWorkerReply, RouteWorkerRequest } from "./route-worker";
import type { RecipeNode, WikiDataset } from "./types";

/**
 * The route solver, spread over a few threads.
 *
 * A solve is one independent job per set of areas, and a wide plan has a hundred of
 * them: that is the shape parallelism wants, and it is also the shape that keeps the
 * page alive — the work leaves the main thread entirely, so the island, the lock,
 * manual tracing and the spinner keep running while the routes are computed.
 *
 * The main thread keeps what only it can do: derive the plan's context (which covers
 * exist, what is assumed, which areas are worth visiting — milliseconds), split those
 * covers, hand out the slices, and merge what comes back through the same comparator
 * the single-threaded solve uses. The seam is `solveCovers`/`assemble` in `routes.ts`,
 * so the two paths cannot drift: the fallback below is literally the single-threaded
 * solver.
 *
 * Nothing is shared with a worker but plain data — the plan and a range of covers in,
 * routes out — so a worker that dies costs a fallback rather than a corrupted answer.
 */

/**
 * Threads to use. One core is left for the page: a pool that saturates every core
 * makes the spinner stutter, which is the thing it exists to avoid.
 */
const MAX_WORKERS = 4;

/** Plans remembered, in the spirit of the single-threaded cache. */
const MAX_SOLVED = 24;

interface Task {
  request: RouteWorkerRequest;
  resolve: (slice: RouteSlice) => void;
  reject: (error: Error) => void;
}

interface Slot {
  worker: Worker;
  /** The task this worker is on; `null` when it is idle. */
  current: Task | null;
}

let slots: Slot[] | null = null;
/** Set once workers have proven unusable, so every later solve goes to the fallback. */
let unavailable = false;
/** Tasks with nowhere to go yet: every worker busy, or the pool gone. */
const waiting: Task[] = [];
const solved = new Map<string, Promise<RoutePlanSet>>();
let nextRequestId = 1;

/**
 * The pool, built on first use and kept for the life of the page.
 *
 * Built lazily and defensively: this module is imported by a component the server
 * also renders, `Worker` does not exist there, and a browser may refuse it (a policy,
 * a bundling surprise). Both cases are the same answer — no pool, solve on this
 * thread — so nothing here throws.
 */
function pool(): Slot[] | null {
  if (unavailable || typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (slots !== null) return slots;

  const cores = navigator.hardwareConcurrency ?? 4;
  const size = Math.max(1, Math.min(MAX_WORKERS, cores - 1));

  try {
    slots = Array.from({ length: size }, () => {
      const worker = new Worker(new URL("./route-worker.ts", import.meta.url), { type: "module" });
      const slot: Slot = { worker, current: null };

      worker.addEventListener("message", (event: MessageEvent<RouteWorkerReply>) => {
        const task = slot.current;
        slot.current = null;
        if (!task || event.data.id !== task.request.id) return;
        if (event.data.ok) task.resolve(event.data.slice);
        else task.reject(new Error(event.data.error));
        hand(slot);
      });

      // A worker that cannot be constructed, or dies mid-solve, is a fallback rather
      // than an error the reader could act on.
      worker.addEventListener("error", () => {
        const task = slot.current;
        slot.current = null;
        fail(new Error("the route worker stopped"));
        task?.reject(new Error("the route worker stopped"));
      });

      return slot;
    });
    return slots;
  } catch {
    unavailable = true;
    slots = null;
    return null;
  }
}

/** Gives an idle slot the next queued task, if there is one. */
function hand(slot: Slot): void {
  if (slot.current !== null) return;
  const next = waiting.shift();
  if (!next) return;
  slot.current = next;
  slot.worker.postMessage(next.request);
}

/**
 * Marks the pool dead and hands every queued task to its fallback.
 *
 * Called when a worker errors: the promises waiting on slices reject, and the solve
 * catches that and re-runs on this thread. The pool is not rebuilt — a thread that
 * died once is not worth a second chance in the middle of a session.
 */
function fail(error: Error): void {
  unavailable = true;
  for (const slot of slots ?? []) slot.worker.terminate();
  slots = null;
  const pending = waiting.splice(0, waiting.length);
  for (const task of pending) task.reject(error);
}

/** One slice, queued behind whatever the pool is already doing. */
function requestSlice(request: RouteWorkerRequest): Promise<RouteSlice> {
  const queue = pool();
  if (queue === null) return Promise.reject(new Error("no route workers"));

  return new Promise((resolve, reject) => {
    const task: Task = { request, resolve, reject };
    const idle = queue.find((slot) => slot.current === null);
    if (idle) {
      idle.current = task;
      idle.worker.postMessage(request);
    } else {
      waiting.push(task);
    }
  });
}

/** Plan and settings, as the two caches key them. */
function cacheKey(trees: RecipeNode[], options: RouteOptions): string {
  const plan = trees.map((tree) => `${tree.item.id}x${tree.quantity}`).join("|");
  const settings = `${options.startingClothes ?? ""}#${options.mode ?? "fastest"}#${options.lookAhead ?? ""}`;
  return `${plan}#${settings}`;
}

/**
 * The routes for a plan, solved off the main thread when there is one to solve on.
 *
 * Cached by plan and settings, **in flight included**: two renders asking the same
 * question share one set of slices, and a mode switched away and back is answered
 * from the promise rather than solved twice. A pool that is missing or has failed
 * falls through to the single-threaded solver, which answers the same thing — the
 * page is merely busy for as long as it takes.
 */
/**
 * Lets the browser paint once before a solve that is going to take the thread.
 *
 * Only the fallback needs this: without it, the click that asked for greedy and the
 * section's own "solving" state stay unpainted until the solver is done, which is the
 * one thing worse than a slow answer — a page that looks like it ignored the click.
 * One frame is not enough for the spinner's own delay, so the fallback still cannot
 * show one; what it can do is show that the click landed.
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

export function solveRoutes(
  dataset: WikiDataset,
  trees: RecipeNode[],
  options: RouteOptions = {},
): Promise<RoutePlanSet> {
  const key = cacheKey(trees, options);
  const cached = solved.get(key);
  if (cached) return cached;

  const run = (async (): Promise<RoutePlanSet> => {
    // The context is this thread's: one enumeration of the covers, and the merge at
    // the end. Everything between the two leaves the thread.
    const solver = createRouteSolver(dataset, trees, options);
    if (solver.covers === 0) return buildRoutesCached(dataset, trees, options);
    if (pool() === null) {
      await nextFrame();
      return buildRoutesCached(dataset, trees, options);
    }

    const workers = (slots ?? []).length;
    const size = Math.ceil(solver.covers / workers);

    try {
      const slices = await Promise.all(
        Array.from({ length: workers }, (_, index) => {
          const from = index * size;
          const to = Math.min(from + size, solver.covers);
          if (from >= to) {
            return Promise.resolve<RouteSlice>({ routes: [], unreachable: 0, truncated: false });
          }
          return requestSlice({ id: nextRequestId++, trees, options, from, to });
        }),
      );
      return solver.assemble(slices);
    } catch {
      return buildRoutesCached(dataset, trees, options);
    }
  })();

  solved.set(key, run);
  if (solved.size > MAX_SOLVED) solved.delete(solved.keys().next().value as string);
  return run;
}
