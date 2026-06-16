import * as Y from "yjs";

export const NOTE_TEXT_KEY = "notes";

export function createNoteDoc(): Y.Doc {
  const doc = new Y.Doc();
  doc.getText(NOTE_TEXT_KEY);
  return doc;
}

export function getNoteText(doc: Y.Doc): Y.Text {
  return doc.getText(NOTE_TEXT_KEY);
}

export function applyNoteUpdate(
  doc: Y.Doc,
  update: Uint8Array,
  origin?: unknown,
): void {
  Y.applyUpdate(doc, update, origin);
}

export function encodeNoteState(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

export function flattenNoteText(doc: Y.Doc): string {
  return getNoteText(doc).toString();
}

export function replaceNoteText(doc: Y.Doc, nextValue: string): void {
  const text = getNoteText(doc);
  const currentValue = text.toString();
  if (currentValue === nextValue) return;

  let prefixLength = 0;
  const sharedLength = Math.min(currentValue.length, nextValue.length);
  while (
    prefixLength < sharedLength &&
    currentValue[prefixLength] === nextValue[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < sharedLength - prefixLength &&
    currentValue[currentValue.length - suffixLength - 1] ===
      nextValue[nextValue.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  const deleteLength =
    currentValue.length - prefixLength - suffixLength;
  const insertedText = nextValue.slice(
    prefixLength,
    nextValue.length - suffixLength,
  );

  doc.transact(() => {
    if (deleteLength > 0) {
      text.delete(prefixLength, deleteLength);
    }
    if (insertedText.length > 0) {
      text.insert(prefixLength, insertedText);
    }
  });
}
