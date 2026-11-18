/**
 * Copy text to the clipboard. Uses the async Clipboard API where the page is a
 * secure context, and falls back to a hidden textarea plus execCommand for
 * plain http pages. Resolves true on success, false if both routes fail.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
        if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (err) {
        console.warn("navigator.clipboard.writeText failed, trying fallback:", err);
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    try {
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        return document.execCommand("copy");
    } catch (err) {
        console.error("Clipboard fallback failed:", err);
        return false;
    } finally {
        document.body.removeChild(textarea);
        previouslyFocused?.focus?.();
    }
}
