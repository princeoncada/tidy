"use client";

import { StickyNote } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  connectNoteProvider,
  type NoteProviderTeardown,
} from "@/lib/collab/note-provider";
import {
  createNoteDoc,
  flattenNoteText,
  getNoteText,
  replaceNoteText,
} from "@/lib/collab/yjs-note-doc";
import { isYjsNotesEnabled } from "@/lib/collab/yjs-notes-gate";
import { createClient } from "@/lib/supabase/client";

function ConnectedItemNotesEditor({
  itemId,
  canEdit,
  initialNotes,
}: {
  itemId: string;
  canEdit: boolean;
  initialNotes: string;
}) {
  const doc = useMemo(() => createNoteDoc(), [itemId]);
  const providerRef = useRef<NoteProviderTeardown | null>(null);
  const [value, setValue] = useState(initialNotes);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const noteText = getNoteText(doc);
    const syncValue = () => setValue(flattenNoteText(doc));
    noteText.observe(syncValue);
    return () => noteText.unobserve(syncValue);
  }, [doc]);

  useEffect(() => {
    let disposed = false;

    void createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        const accessToken = session?.access_token;
        const userId = session?.user.id;
        if (!accessToken || !userId || disposed) return;

        return connectNoteProvider({
          itemId,
          doc,
          accessToken,
          userId,
          canEdit,
        });
      })
      .then((provider) => {
        if (!provider) {
          if (!disposed) setUnavailable(true);
          return;
        }
        if (disposed) {
          void provider();
        } else {
          providerRef.current = provider;
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!disposed) setUnavailable(true);
      });

    return () => {
      disposed = true;
      const provider = providerRef.current;
      providerRef.current = null;
      if (provider) {
        void provider();
      }
    };
  }, [canEdit, doc, itemId]);

  if (unavailable) {
    return (
      <p className="pb-1 text-xs text-muted-foreground">
        Notes are unavailable.
      </p>
    );
  }

  return (
    <Textarea
      aria-label="Item notes"
      data-testid="item-notes-input"
      value={value}
      readOnly={!canEdit || !loaded}
      placeholder={canEdit ? "Add collaborative notes..." : "No notes"}
      className="mb-1 min-h-16 resize-y text-xs"
      onChange={(event) => replaceNoteText(doc, event.target.value)}
      onBlur={() => {
        void providerRef.current?.flush().catch(() => {});
      }}
    />
  );
}

export function ItemNotesEditor({
  itemId,
  canEdit,
  initialNotes,
}: {
  itemId: string;
  canEdit: boolean;
  initialNotes: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!isYjsNotesEnabled()) return null;

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="h-5 px-1 text-muted-foreground"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <StickyNote />
        Notes
      </Button>
      {expanded && (
        <ConnectedItemNotesEditor
          itemId={itemId}
          canEdit={canEdit}
          initialNotes={initialNotes}
        />
      )}
    </div>
  );
}
