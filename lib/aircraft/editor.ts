import {
  DOCUMENT_KINDS,
  DOCUMENT_PROBLEMS,
  PROBLEM_SECTION,
  SECTIONS,
  type DocumentKind,
  type Section,
} from "./catalog";

export type SectionState = "done" | "todo" | "waiting";

/**
 * Tick marks for the editor sections, from the listing problems. Equipment and requirements
 * are optional, so they're always done. Documents are "waiting" while an admin checks them.
 */
export function sectionStates(
  problems: string[],
  documents: { kind: DocumentKind; status: string }[],
): Record<Section, SectionState> {
  const states = Object.fromEntries(SECTIONS.map((s) => [s, "done"])) as Record<
    Section,
    SectionState
  >;
  for (const p of problems) {
    const section = PROBLEM_SECTION[p];
    if (section) states[section] = "todo";
  }
  const docProblems = problems.filter((p) => (DOCUMENT_PROBLEMS as readonly string[]).includes(p));
  if (docProblems.length) {
    const allSubmitted = DOCUMENT_KINDS.every((kind) =>
      documents.some((d) => d.kind === kind && d.status !== "rejected"),
    );
    states.documents = allSubmitted ? "waiting" : "todo";
  }
  return states;
}
