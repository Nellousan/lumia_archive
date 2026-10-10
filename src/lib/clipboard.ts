/**
 * Puts text on the clipboard, reporting whether it worked.
 *
 * The async Clipboard API is the real one, but it is only there on a secure
 * origin and only answers a user gesture, so a click is expected either way. The
 * hidden-textarea path is the pre-2018 way of doing the same thing, kept because
 * a build served over plain HTTP on a LAN address has no `navigator.clipboard`
 * at all and losing the link silently would be worse than a deprecated call.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Denied, or no document focus: fall through to the old path.
  }

  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.setAttribute("aria-hidden", "true");
    // Off-screen rather than `display:none`, which is not selectable.
    field.style.position = "fixed";
    field.style.top = "-1000px";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  } catch {
    return false;
  }
}
