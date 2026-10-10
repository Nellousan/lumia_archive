/**
 * Scrolling that stays inside the pane it was asked about.
 *
 * `Element.scrollIntoView` is the obvious tool and the wrong one here. It walks
 * *every* scrollable ancestor, the document included, so bringing a route into
 * view could push the header off the top of the screen while the rail did exactly
 * what was asked — and a shared link then landed under the header rather than
 * against it. These helpers move one scroll container and nothing else, which is
 * also what makes them safe to reason about: the page itself never moves.
 */

/** The nearest ancestor that owns a scrollbar, or `null` when there is none. */
function nearestScroller(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    // `hidden` is deliberately left out: the shell clips its own content, and an
    // element asking to be revealed must never scroll that clip.
    if (overflow === "auto" || overflow === "scroll") return parent;
  }
  return null;
}

/**
 * Scrolls `node`'s own scroll container so that `node` sits at its top, or in its
 * middle. Returns false when the node has no scrollable ancestor to move.
 */
export function scrollWithinScroller(node: HTMLElement | null, block: "start" | "center"): boolean {
  if (node === null) return false;
  const scroller = nearestScroller(node);
  if (scroller === null) return false;

  const nodeBox = node.getBoundingClientRect();
  const box = scroller.getBoundingClientRect();
  const offset =
    block === "start"
      ? nodeBox.top - box.top
      : nodeBox.top + nodeBox.height / 2 - (box.top + box.height / 2);

  // The offset is measured fresh, so asking twice is harmless: the second call
  // finds the node already where the first one put it and moves nothing.
  scroller.scrollTop += offset;
  return true;
}
