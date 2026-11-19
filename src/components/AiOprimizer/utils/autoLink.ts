/**
 * What the resume-maker backend reports after it tries to link a NEW resume to
 * the dashboard client whose login email is written on it.
 */
export type AutoLinkStatus = "linked" | "no_match" | "ambiguous" | "already_linked" | "error";

export interface AutoLinkResult {
    status: AutoLinkStatus;
    email: string | null;
    name?: string | null;
}

export interface AutoLinkNotice {
    tone: "success" | "info" | "warning";
    text: string;
}

/**
 * Plain one-line message for the operator, or null when there is nothing worth
 * saying (an older backend that sends no autoLink, or a resume with no email).
 */
export function describeAutoLink(autoLink: AutoLinkResult | null | undefined): AutoLinkNotice | null {
    if (!autoLink || !autoLink.email) return null;
    const who = autoLink.name || autoLink.email;
    switch (autoLink.status) {
        case "linked":
            return { tone: "success", text: `Linked to ${who}'s dashboard` };
        case "no_match":
            return { tone: "info", text: `No dashboard client with ${autoLink.email}` };
        case "ambiguous":
            return { tone: "warning", text: `More than one dashboard client has ${autoLink.email}, so this resume was not linked` };
        case "already_linked":
            return { tone: "info", text: `${who} already has a resume on their dashboard, so this one was not linked` };
        case "error":
            return { tone: "warning", text: "Resume saved, but the dashboard match could not be checked" };
        default:
            return null;
    }
}
