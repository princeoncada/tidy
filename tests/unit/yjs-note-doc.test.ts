import { afterEach, describe, expect, it } from "vitest";

import {
  applyNoteUpdate,
  createNoteDoc,
  encodeNoteState,
  flattenNoteText,
  getNoteText,
  replaceNoteText,
} from "@/lib/collab/yjs-note-doc";
import { isYjsNotesEnabled } from "@/lib/collab/yjs-notes-gate";

describe("Yjs item note documents", () => {
  it("converges independent concurrent edits without losing either text", () => {
    const first = createNoteDoc();
    const second = createNoteDoc();

    replaceNoteText(first, "first edit");
    replaceNoteText(second, "second edit");

    const firstUpdate = encodeNoteState(first);
    const secondUpdate = encodeNoteState(second);
    applyNoteUpdate(first, secondUpdate);
    applyNoteUpdate(second, firstUpdate);

    expect(flattenNoteText(first)).toBe(flattenNoteText(second));
    expect(flattenNoteText(first)).toContain("first edit");
    expect(flattenNoteText(first)).toContain("second edit");

    first.destroy();
    second.destroy();
  });

  it("flattens the shared Y.Text to a plain string", () => {
    const doc = createNoteDoc();
    getNoteText(doc).insert(0, "line one\nline two");

    expect(flattenNoteText(doc)).toBe("line one\nline two");

    doc.destroy();
  });
});

describe("Yjs notes feature gate", () => {
  const originalValue = process.env.NEXT_PUBLIC_YJS_NOTES_ENABLED;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.NEXT_PUBLIC_YJS_NOTES_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_YJS_NOTES_ENABLED = originalValue;
    }
  });

  it("defaults off and enables only for the literal true value", () => {
    delete process.env.NEXT_PUBLIC_YJS_NOTES_ENABLED;
    expect(isYjsNotesEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_YJS_NOTES_ENABLED = "false";
    expect(isYjsNotesEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_YJS_NOTES_ENABLED = "true";
    expect(isYjsNotesEnabled()).toBe(true);
  });
});
