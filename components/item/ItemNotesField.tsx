"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
import { createClient } from "@/lib/supabase/client";

export function ItemNotesField({
  itemId,
  canEdit,
  initialNotes,
  onTypingChange,
}: {
  itemId: string;
  canEdit: boolean;
  initialNotes: string;
  onTypingChange?: (typing: boolean) => void;
}) {
  const { doc } = useMemo(() => ({ itemId, doc: createNoteDoc() }), [itemId]);
  const providerRef = useRef<NoteProviderTeardown | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [value, setValue] = useState(initialNotes);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  function clearTypingTimer() {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }

  function markTyping() {
    if (!canEdit || !loaded) return;

    onTypingChange?.(true);
    clearTypingTimer();
    typingTimeoutRef.current = window.setTimeout(() => {
      typingTimeoutRef.current = null;
      onTypingChange?.(false);
    }, 1_500);
  }

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

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      onTypingChange?.(false);
    };
  }, [onTypingChange]);

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
      className="min-h-40 resize-y text-sm"
      onChange={(event) => {
        replaceNoteText(doc, event.target.value);
        markTyping();
      }}
      onBlur={() => {
        clearTypingTimer();
        onTypingChange?.(false);
        void providerRef.current?.flush().catch(() => {});
      }}
    />
  );
}
