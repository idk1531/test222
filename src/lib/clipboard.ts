export type ClipboardCopyResult = "clipboard" | "legacy-copy" | "manual";

/**
 * Try the asynchronous Clipboard API first, then copy from the caller's visible
 * text field. On failure it tries to focus and select that visible field for manual copy.
 */
export async function copyTextWithFallback(
  text: string,
  field: HTMLTextAreaElement | null
): Promise<ClipboardCopyResult> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "clipboard";
    }
  } catch {
    // Permissions Policy and embedded WebViews can reject writeText even when
    // the API exists. Keep the value in the visible field and try legacy copy.
  }

  if (typeof document === "undefined" || !field) return "manual";

  try {
    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);
    if (document.execCommand("copy")) return "legacy-copy";
  } catch {
    // Some browsers disallow execCommand too; the selected field is still usable.
  }

  return "manual";
}
