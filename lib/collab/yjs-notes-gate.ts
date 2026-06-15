export function isYjsNotesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_YJS_NOTES_ENABLED === "true";
}
