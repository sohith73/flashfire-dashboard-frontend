import type { ResumeDataType } from "../types/ResumeTypes";

/**
 * Copy / paste JSON for a resume.
 *
 * Ops staff copy a resume as JSON, another team edits it, and the edited JSON
 * is pasted back. This module is pure (no React, no network) so the rules can
 * be tested on their own.
 */

export const RESUME_JSON_FORMAT = "flashfire-resume";
export const RESUME_JSON_VERSION = 1;

export type CheckboxStates = {
    showSummary: boolean;
    showProjects: boolean;
    showLeadership: boolean;
    showPublications: boolean;
    showCertifications: boolean;
    showTherapeuticAreas: boolean;
};

export type SectionTitles = Record<string, string>;

export interface ResumeSnapshot {
    data: ResumeDataType;
    checkboxStates: CheckboxStates;
    sectionOrder: string[];
    sectionTitles: SectionTitles;
}

export interface ResumeExportEnvelope extends ResumeSnapshot {
    format: typeof RESUME_JSON_FORMAT;
    version: number;
    resumeId: string | null;
    exportedAt: string;
}

export interface ParsedResumeImport extends ResumeSnapshot {
    /** Id stored in the pasted envelope, or null for a bare resume object. */
    resumeId: string | null;
    fromEnvelope: boolean;
}

export interface ParseResult {
    ok: boolean;
    value: ParsedResumeImport | null;
    errors: string[];
    warnings: string[];
}

const CHECKBOX_KEYS: (keyof CheckboxStates)[] = [
    "showSummary",
    "showProjects",
    "showLeadership",
    "showPublications",
    "showCertifications",
    "showTherapeuticAreas",
];

/** Keys that live in the envelope, so they are not repeated inside `data`. */
const ENVELOPE_KEYS_IN_DATA = ["checkboxStates", "sectionOrder", "sectionTitles"];

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

/** Build the pretty-printed JSON text that Copy JSON puts on the clipboard. */
export function buildResumeExport(
    snapshot: ResumeSnapshot,
    resumeId: string | null,
    now: Date = new Date()
): string {
    const data: Record<string, unknown> = { ...(snapshot.data as unknown as Record<string, unknown>) };
    for (const key of ENVELOPE_KEYS_IN_DATA) delete data[key];

    const envelope = {
        format: RESUME_JSON_FORMAT,
        version: RESUME_JSON_VERSION,
        resumeId: resumeId || null,
        exportedAt: now.toISOString(),
        data,
        checkboxStates: snapshot.checkboxStates,
        sectionOrder: snapshot.sectionOrder,
        sectionTitles: snapshot.sectionTitles,
    };
    return JSON.stringify(envelope, null, 2);
}

/** Strip a ```json ... ``` fence if the text was pasted from a chat window. */
export function stripCodeFence(text: string): string {
    const trimmed = text.trim();
    const match = trimmed.match(/^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?\s*```$/);
    return (match ? match[1] : trimmed).trim();
}

const PERSONAL_STRING_FIELDS = [
    "title",
    "phone",
    "email",
    "location",
    "linkedin",
    "portfolio",
    "github",
    "publications",
];

/** Array sections: [key, string fields that must be strings if present]. */
const ARRAY_SECTIONS: [string, string[]][] = [
    ["workExperience", ["position", "company", "duration", "location", "roleType"]],
    ["projects", ["position", "company", "duration", "location", "roleType", "linkName", "linkUrl"]],
    ["leadership", ["title", "organization", "subtitle", "location", "duration"]],
    ["skills", ["category", "skills"]],
    ["education", ["institution", "location", "degree", "field", "duration", "additionalInfo"]],
    ["publications", ["details"]],
    ["customSections", ["title", "content"]],
    ["certifications", ["title", "issuer", "date"]],
];

/** Sections the editor needs as arrays; if missing they are filled with []. */
const REQUIRED_ARRAYS = [
    "workExperience",
    "projects",
    "leadership",
    "skills",
    "education",
    "publications",
];

const typeName = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "an array" : typeof v);

/** Validate the resume object itself. Returns a normalised copy (unknown fields kept). */
function validateResume(
    raw: Record<string, unknown>,
    errors: string[],
    warnings: string[]
): ResumeDataType | null {
    const data: Record<string, unknown> = { ...raw };
    for (const key of ENVELOPE_KEYS_IN_DATA) delete data[key];

    // personalInfo
    const pi = data.personalInfo;
    if (pi === undefined || pi === null) {
        errors.push("Missing personalInfo. The resume must have a personalInfo object with a name.");
        return null;
    }
    if (!isPlainObject(pi)) {
        errors.push(`personalInfo must be an object, got ${typeName(pi)}.`);
        return null;
    }
    if (typeof pi.name !== "string") {
        errors.push(
            pi.name === undefined
                ? "Missing personalInfo.name."
                : `personalInfo.name must be a string, got ${typeName(pi.name)}.`
        );
    } else if (pi.name.trim() === "") {
        errors.push("personalInfo.name is empty. A resume needs a name.");
    }
    for (const f of PERSONAL_STRING_FIELDS) {
        if (pi[f] !== undefined && typeof pi[f] !== "string") {
            errors.push(`personalInfo.${f} must be a string, got ${typeName(pi[f])}.`);
        }
    }
    if (pi.profileLinks !== undefined) {
        if (!Array.isArray(pi.profileLinks)) {
            errors.push(`personalInfo.profileLinks must be an array, got ${typeName(pi.profileLinks)}.`);
        } else {
            pi.profileLinks.forEach((l, i) => {
                if (!isPlainObject(l)) {
                    errors.push(`personalInfo.profileLinks[${i}] must be an object.`);
                    return;
                }
                for (const f of ["label", "url"]) {
                    if (l[f] !== undefined && typeof l[f] !== "string") {
                        errors.push(`personalInfo.profileLinks[${i}].${f} must be a string.`);
                    }
                }
            });
        }
    }

    // plain string fields
    for (const f of ["summary", "therapeuticAreas"]) {
        if (data[f] !== undefined && typeof data[f] !== "string") {
            errors.push(`${f} must be a string, got ${typeName(data[f])}.`);
        }
    }
    if (data.summary === undefined) {
        data.summary = "";
        warnings.push("summary is missing, so it will be saved as empty.");
    }

    // array sections
    for (const [key, stringFields] of ARRAY_SECTIONS) {
        const value = data[key];
        if (value === undefined) {
            if (REQUIRED_ARRAYS.includes(key)) {
                data[key] = [];
                warnings.push(`${key} is missing, so it will be saved as an empty list.`);
            }
            continue;
        }
        if (!Array.isArray(value)) {
            errors.push(`${key} must be an array, got ${typeName(value)}.`);
            continue;
        }
        const items = value.map((item, i) => {
            if (!isPlainObject(item)) {
                errors.push(`${key}[${i}] must be an object, got ${typeName(item)}.`);
                return item;
            }
            for (const f of stringFields) {
                if (item[f] !== undefined && typeof item[f] !== "string") {
                    errors.push(`${key}[${i}].${f} must be a string, got ${typeName(item[f])}.`);
                }
            }
            if (item.responsibilities !== undefined) {
                if (!Array.isArray(item.responsibilities)) {
                    errors.push(`${key}[${i}].responsibilities must be an array of strings.`);
                } else if (item.responsibilities.some((r) => typeof r !== "string")) {
                    errors.push(`${key}[${i}].responsibilities must contain only strings.`);
                }
            } else if (key === "workExperience" || key === "projects") {
                errors.push(`${key}[${i}].responsibilities is missing. Use an array of strings.`);
            }
            if (item.id === undefined) {
                // Hand edited JSON often forgets ids on new rows. The editor needs one.
                return { ...item, id: `imported-${key}-${i + 1}` };
            }
            if (typeof item.id !== "string") {
                errors.push(`${key}[${i}].id must be a string, got ${typeName(item.id)}.`);
            }
            return item;
        });
        data[key] = items;
    }

    return errors.length ? null : (data as unknown as ResumeDataType);
}

function validateCheckboxes(
    raw: unknown,
    fallback: CheckboxStates,
    errors: string[]
): CheckboxStates {
    if (raw === undefined) return fallback;
    if (!isPlainObject(raw)) {
        errors.push(`checkboxStates must be an object, got ${typeName(raw)}.`);
        return fallback;
    }
    const out: CheckboxStates = { ...fallback };
    for (const k of CHECKBOX_KEYS) {
        if (raw[k] === undefined) continue;
        if (typeof raw[k] !== "boolean") {
            errors.push(`checkboxStates.${k} must be true or false, got ${typeName(raw[k])}.`);
        } else {
            out[k] = raw[k] as boolean;
        }
    }
    return out;
}

/**
 * Parse pasted text. Accepts the export envelope or a bare resume object
 * (anything with personalInfo). Never throws.
 */
export function parseResumeImport(
    text: string,
    current: ResumeSnapshot & { resumeId: string | null }
): ParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    fail: {
        const cleaned = stripCodeFence(text || "");
        if (!cleaned) {
            errors.push("Nothing to save. Paste the resume JSON first.");
            break fail;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(cleaned);
        } catch (e) {
            errors.push(`This is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
            break fail;
        }
        if (!isPlainObject(parsed)) {
            errors.push(`Expected a JSON object, got ${typeName(parsed)}.`);
            break fail;
        }

        const isEnvelope = !("personalInfo" in parsed) && ("data" in parsed || "format" in parsed);
        let resumeObj: unknown = parsed;
        let resumeId: string | null = null;
        let checkboxRaw: unknown;
        let orderRaw: unknown;
        let titlesRaw: unknown;

        if (isEnvelope) {
            if (parsed.format !== RESUME_JSON_FORMAT) {
                errors.push(`format must be "${RESUME_JSON_FORMAT}", got ${JSON.stringify(parsed.format)}.`);
            }
            if (typeof parsed.version === "number" && parsed.version > RESUME_JSON_VERSION) {
                errors.push(
                    `This JSON is version ${parsed.version}, but this page only understands version ${RESUME_JSON_VERSION}.`
                );
            } else if (parsed.version !== undefined && typeof parsed.version !== "number") {
                errors.push(`version must be a number, got ${typeName(parsed.version)}.`);
            }
            if (!isPlainObject(parsed.data)) {
                errors.push(
                    parsed.data === undefined
                        ? "Missing data. The envelope needs a data object with the resume."
                        : `data must be an object, got ${typeName(parsed.data)}.`
                );
            }
            if (parsed.resumeId !== undefined && parsed.resumeId !== null) {
                if (typeof parsed.resumeId === "string") resumeId = parsed.resumeId;
                else errors.push(`resumeId must be a string or null, got ${typeName(parsed.resumeId)}.`);
            }
            resumeObj = parsed.data;
            checkboxRaw = parsed.checkboxStates;
            orderRaw = parsed.sectionOrder;
            titlesRaw = parsed.sectionTitles;
            if (errors.length) break fail;
        } else {
            checkboxRaw = parsed.checkboxStates;
            orderRaw = parsed.sectionOrder;
            titlesRaw = parsed.sectionTitles;
        }

        const data = validateResume(resumeObj as Record<string, unknown>, errors, warnings);

        const checkboxStates = validateCheckboxes(checkboxRaw, current.checkboxStates, errors);

        let sectionOrder = current.sectionOrder;
        if (orderRaw !== undefined) {
            if (!Array.isArray(orderRaw) || orderRaw.some((s) => typeof s !== "string")) {
                errors.push("sectionOrder must be an array of strings.");
            } else {
                sectionOrder = orderRaw as string[];
            }
        }

        let sectionTitles = current.sectionTitles;
        if (titlesRaw !== undefined) {
            if (!isPlainObject(titlesRaw) || Object.values(titlesRaw).some((s) => typeof s !== "string")) {
                errors.push("sectionTitles must be an object whose values are strings.");
            } else {
                sectionTitles = titlesRaw as SectionTitles;
            }
        }

        if (errors.length || !data) break fail;

        if (resumeId && current.resumeId && resumeId !== current.resumeId) {
            warnings.push(
                "This JSON was copied from a different resume than the one open now. Check the name before saving."
            );
        }

        return {
            ok: true,
            value: { data, checkboxStates, sectionOrder, sectionTitles, resumeId, fromEnvelope: isEnvelope },
            errors: [],
            warnings,
        };
    }
    return { ok: false, value: null, errors, warnings: [] };
}
