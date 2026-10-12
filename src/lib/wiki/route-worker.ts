/// <reference lib="webworker" />

import { buildWikiDataset } from "./dataset";
import { createRouteSolver, type RouteOptions, type RouteSlice } from "./routes";
import type { RecipeNode, WikiDataset } from "./types";

/**
 * One piece of a route solve, as the pool asks for it.
 *
 * The pool sends the plan and a range of that plan's covers rather than anything
 * pre-built: the worker holds its own dataset (built once, 15 ms) and re-derives
 * the same context the caller has — the covers of a plan are a pure function of the
 * data and the plan, so two threads enumerating them agree without a word.
 */
export interface RouteWorkerRequest {
  /** Echoed back, so one worker can answer several solves without mixing them up. */
  id: number;
  /** The plan, as `planTrees` built it — plain data, safe to send. */
  trees: RecipeNode[];
  options: RouteOptions;
  /** Half-open range of covers to solve. */
  from: number;
  to: number;
}

export type RouteWorkerReply =
  | { id: number; ok: true; slice: RouteSlice }
  | { id: number; ok: false; error: string };

/**
 * The dataset, built once per worker and kept: it cannot change while the page is
 * open, and rebuilding it per solve would cost more than small solves do.
 */
let dataset: WikiDataset | null = null;

/**
 * Solves one slice and answers with it.
 *
 * A worker never throws into the void: a failure is reported as a reply, because the
 * pool's job is to fall back to the main thread rather than to leave a route list
 * pending forever. Nothing here knows what the routes are *for* — the answer goes
 * back as plain data and the caller ranks and renders it.
 */
self.addEventListener("message", (event: MessageEvent<RouteWorkerRequest>) => {
  const { id, trees, options, from, to } = event.data;

  try {
    dataset ??= buildWikiDataset();
    const solver = createRouteSolver(dataset, trees, options);
    self.postMessage({ id, ok: true, slice: solver.solveCovers(from, to) } satisfies RouteWorkerReply);
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies RouteWorkerReply);
  }
});
