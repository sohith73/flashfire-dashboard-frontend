import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, ClipboardPaste, X } from "lucide-react";
import {
    parseResumeImport,
    type ParsedResumeImport,
    type ResumeSnapshot,
} from "../utils/resumeJson";

interface ResumeJsonModalProps {
    open: boolean;
    onClose: () => void;
    /** What is in the editor right now. Used for fallbacks and for warnings. */
    current: ResumeSnapshot & { resumeId: string | null };
    /** Name the open resume was loaded or last saved with, or null if unsaved. */
    loadedName: string | null;
    /** Save the parsed resume. Reject with an Error to show its message. */
    onSave: (value: ParsedResumeImport) => Promise<void>;
    /** Optional starting text. Mostly useful for previews and tests. */
    initialText?: string;
}

const FOCUSABLE =
    'button:not([disabled]), textarea:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ResumeJsonModal({
    open,
    onClose,
    current,
    loadedName,
    onSave,
    initialText = "",
}: ResumeJsonModalProps) {
    const [text, setText] = useState(initialText);
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleId = useId();
    const helpId = useId();

    // Reset each time the modal opens, and put the cursor in the box.
    useEffect(() => {
        if (!open) return;
        setText(initialText);
        setSaving(false);
        setServerError(null);
        textareaRef.current?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const result = useMemo(
        () => (text.trim() ? parseResumeImport(text, current) : null),
        [text, current]
    );

    const pastedName = result?.value?.data.personalInfo?.name?.trim() ?? "";
    const nameChanged =
        !!result?.ok && loadedName !== null && pastedName !== loadedName.trim();

    if (!open) return null;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape" && !saving) {
            e.stopPropagation();
            onClose();
            return;
        }
        if (e.key === "Tab") {
            const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
            if (!nodes || nodes.length === 0) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    const handleSave = async () => {
        if (saving || !text.trim()) return;
        const parsed = parseResumeImport(text, current);
        if (!parsed.ok || !parsed.value) {
            textareaRef.current?.focus();
            return;
        }
        setSaving(true);
        setServerError(null);
        try {
            await onSave(parsed.value);
            setSaving(false);
            onClose();
        } catch (err) {
            setSaving(false);
            setServerError(err instanceof Error && err.message ? err.message : "Could not save the resume.");
            // The textarea was disabled while saving, which dropped focus.
            setTimeout(() => textareaRef.current?.focus(), 0);
        }
    };

    const errors = result && !result.ok ? result.errors : [];
    const warnings = result?.ok ? result.warnings : [];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[999] flex items-center justify-center p-4">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={helpId}
                onKeyDown={handleKeyDown}
                className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            >
                <div className="flex items-start justify-between gap-4 px-6 pt-6">
                    <div>
                        <h3 id={titleId} className="text-xl font-bold text-gray-800">
                            Paste resume JSON
                        </h3>
                        <p id={helpId} className="text-sm text-gray-500 mt-1">
                            Paste the JSON you got back. Saving replaces this resume in the editor and
                            saves it, the same as the Save Resume button.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        aria-label="Close"
                        className="p-1 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 pt-4 pb-2 overflow-y-auto">
                    <label htmlFor={`${titleId}-text`} className="sr-only">
                        Resume JSON
                    </label>
                    <textarea
                        id={`${titleId}-text`}
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value);
                            setServerError(null);
                        }}
                        disabled={saving}
                        spellCheck={false}
                        rows={12}
                        placeholder='{ "format": "flashfire-resume", "version": 1, "data": { ... } }'
                        aria-invalid={errors.length > 0}
                        className={`w-full rounded-md border px-3 py-2 font-mono text-xs leading-relaxed text-gray-800 focus:outline-none focus:ring-2 disabled:bg-gray-50 ${
                            errors.length
                                ? "border-red-400 focus:ring-red-300"
                                : "border-gray-300 focus:ring-blue-300"
                        }`}
                    />

                    <div aria-live="polite" className="mt-3 space-y-3">
                        {errors.length > 0 && (
                            <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3">
                                <p className="text-sm font-semibold text-red-700">
                                    Fix {errors.length === 1 ? "this problem" : `these ${errors.length} problems`} before saving
                                </p>
                                <ul className="mt-1 list-disc pl-5 text-sm text-red-700 space-y-0.5">
                                    {errors.slice(0, 8).map((e, i) => (
                                        <li key={i}>{e}</li>
                                    ))}
                                </ul>
                                {errors.length > 8 && (
                                    <p className="mt-1 text-sm text-red-700">and {errors.length - 8} more.</p>
                                )}
                            </div>
                        )}

                        {nameChanged && (
                            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                                <p>
                                    <span className="font-semibold">Name changed, this will save as a new resume.</span>{" "}
                                    The open resume is "{loadedName?.trim()}" but the pasted name is "{pastedName}". The
                                    open resume will not be updated.
                                </p>
                            </div>
                        )}

                        {warnings.map((w, i) => (
                            <div
                                key={i}
                                className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
                            >
                                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                                <p>{w}</p>
                            </div>
                        ))}

                        {serverError && (
                            <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                <p>
                                    <span className="font-semibold">Save failed:</span> {serverError}
                                </p>
                                <p className="mt-1">Your pasted text is still here, so you can try again.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !text.trim() || errors.length > 0}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ClipboardPaste size={16} aria-hidden="true" />
                        {saving ? "Saving..." : nameChanged ? "Save as new resume" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}
