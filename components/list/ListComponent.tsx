"use client";

import { cn } from "@/lib/utils";
import { useRenderMeasure } from "@/lib/optimistic-debug";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from '@dnd-kit/react/sortable';
import {
  Calendar1,
  GripVertical,
  Plus,
  StickyNote,
  UserRoundPlus,
} from "lucide-react";
import { motion } from "motion/react";
import { memo, ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Textarea } from "../ui/textarea";
import ListInlineEdit from "./ListInlineEdit";
import ListMenu from "./ListMenu";
import ListTagPicker from "./ListTagPicker";
import { List, ListItem } from "./types";
import { useDashboardMutations } from "@/hooks/useDashboardMutations";
import { useReplicacheDashboard } from "@/hooks/useReplicacheDashboard";
import { keyBetween } from "@/lib/sync/fractional-index";
import { ShareDialog } from "@/components/sharing/ShareDialog";

interface ListComponentProps {
  children: ReactNode;
  listValues: List;
  index: number;
  activeDropTarget: {
    type: string;
    id: string;
  } | null;
  shouldRevealOnMount?: boolean,
  onRevealComplete: () => void;
  userId: string | null;
}

const ListComponent = ({
  children,
  listValues: list,
  index,
  activeDropTarget,
  shouldRevealOnMount,
  onRevealComplete,
  userId
}: ListComponentProps) => {

  useRenderMeasure(`ListComponent:${list.id}`);

  const [listDeleted, setListDeleted] = useState<boolean>(false);
  const [listRevealed, setListRevealed] = useState(!shouldRevealOnMount);

  useEffect(() => {
    if (!shouldRevealOnMount) return;

    const timeout = setTimeout(() => {
      setListRevealed(true);
      onRevealComplete?.();
    }, 0);

    return () => clearTimeout(timeout);
  }, [shouldRevealOnMount, onRevealComplete, list.id]);

  const [createListItemName, setCreateListItemName] = useState<string>('');
  const [viewListItemAdder, setViewListItemAdder] = useState<boolean>(false);
  const [newItemId, setNewItemId] = useState(() => crypto.randomUUID());
  const dashboardMutations = useDashboardMutations();
  const replicacheDashboard = useReplicacheDashboard();
  const accessRole =
    list.accessRole ?? (list.userId === userId ? "OWNER" : "VIEWER");
  const canEdit = accessRole === "OWNER" || accessRole === "EDITOR";
  const canManage = accessRole === "OWNER";
  const canDelete = list.userId === userId;

  const handleRenameList = (input: { id: string; name: string }) => {
    if (!userId || !dashboardMutations.mutate) return;

    void dashboardMutations.mutate.renameList({
      id: input.id,
      name: input.name,
      now: new Date().toISOString(),
    });
  };

  const deleteList = (listId: string) => {
    if (!userId || !dashboardMutations.mutate) return;

    void dashboardMutations.mutate.deleteList({ id: listId });
  };

  const handleCreateItem = () => {
    const itemId = newItemId;
    const itemName = createListItemName.trim();

    if (!itemName || !userId) return;

    setNewItemId(crypto.randomUUID());

    if (!dashboardMutations.mutate) return;

    const firstItemId = list.listItems[0]?.id;
    const firstOrderKey = firstItemId
      ? replicacheDashboard.orderKeys.listItems.get(firstItemId) ?? null
      : null;
    setCreateListItemName("");
    void dashboardMutations.mutate.createItem({
      id: itemId,
      listId: list.id,
      name: itemName,
      order: keyBetween(null, firstOrderKey),
      now: new Date().toISOString(),
    });
  };

  const { ref: listRef, handleRef, isDragging } = useSortable({
    id: `list-${list.id}`,
    index,
    type: "list",
    accept: "list",
    group: "lists",
    disabled: !canDelete,
  });

  const { ref: dropRef } = useDroppable({
    id: `list-drop-${list.id}`,
    type: "list-drop",
    accept: "list-item",
  });

  const completedItems = list.listItems.filter((item: ListItem) => item.completed === true).length;
  const totalItems = list.listItems.length;
  const listDropId = `list-drop-${list.id}`;
  const isListDropTarget = activeDropTarget?.id === listDropId;
  const isItemInsideThisListDropTarget = activeDropTarget?.type === "list-item" &&
    list.listItems.some(
      (item: ListItem) => `list-item-${item.id}` === activeDropTarget.id
    );
  const shouldHighlightList = isListDropTarget || isItemInsideThisListDropTarget;

  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleViewListItemAdder() {
    if (inputRef.current) {
      setViewListItemAdder(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }

  function handleDeleteList() {
    if (!userId) return;

    setListDeleted(true);

    setTimeout(() => {
      deleteList(list.id);
    }, 250);
  }

  return (
    <motion.div
      layout
      transition={{
        layout: {
          duration: 0.25,
          ease: "easeOut",
        },
      }}
      ref={listRef}
    >
      <div
        className={cn(
          "transition-all duration-300 ease-in-out h-full shrink-0",

          // creation
          !listDeleted && listRevealed && (
            "max-h-200 opacity-100 translate-y-0"
          ),

          // before reveal
          !listDeleted && !listRevealed && (
            "max-h-0 opacity-0"
          ),

          // deletion
          listDeleted && (
            "opacity-0 -translate-y-4"
          )
        )}
      >
          <Card data-testid="list-card" data-list-id={list.id} className={`transition-all duration-300 h-full min-h-96 flex flex-col ${isDragging ? "scale-[1.03] backdrop-blur-[5px] shadow-xl" : ""}`}>
          <CardContent className="px-0 flex flex-col flex-1">
            <div className="flex flex-col flex-1">
              <div className="flex items-start gap-2 px-4">
                <div
                  data-testid="list-drag-handle"
                  ref={canDelete ? handleRef : undefined}
                  className={cn(
                    "mt-0.5 -ml-1.5 shrink-0 touch-none select-none p-1.5",
                    canDelete
                      ? "cursor-grab active:cursor-grabbing"
                      : "cursor-default opacity-30",
                  )}
                >
                  <GripVertical />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <ListInlineEdit
                    displayTestId="list-title"
                    inputTestId="list-title-input"
                    className="block font-semibold leading-7! text-xl!"
                    inputClassName=""
                    displayClassName=""
                    id={list.id}
                    value={list.name}
                    onSave={handleRenameList}
                    disabled={!canEdit}
                  />

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar1 className="size-3.5 shrink-0" />
                    <span>{list.createdAt.toISOString().split("T")[0].replaceAll("-", "/")}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {canManage && (
                    <ShareDialog
                      resourceType="LIST"
                      resourceId={list.id}
                      title={list.name}
                      trigger={
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Share ${list.name}`}
                          title="Share list"
                        >
                          <UserRoundPlus />
                        </Button>
                      }
                    />
                  )}
                  {(canEdit || canDelete) && (
                    <ListMenu
                      handleViewListItemAdder={handleViewListItemAdder}
                      handleDeleteList={handleDeleteList}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                  )}
                </div>
              </div>

              <div className="mx-4 my-2">
                {canDelete ? (
                  <ListTagPicker
                    listId={list.id}
                    selectedListTags={list.listTags}
                    userId={userId}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Shared {accessRole.toLowerCase()}
                  </span>
                )}
              </div>

              <Separator />

              <div className={cn("border border-zinc-100 border-dashed rounded-lg duration-200 mx-2 my-1.5 flex-col", {
                "border-zinc-400": shouldHighlightList
              })}>

                <ScrollArea
                  data-testid="list-drop-zone"
                  ref={dropRef}
                  className={cn("h-60! min-h-45 w-full touch-pan-y relative")}
                >
                  {canEdit && <div
                    className={cn(
                      `flex items-start max-h-12 gap-1.5 pl-px py-px rounded-md pr-2 hover:bg-gray-50 hover:border-gray-100 overflow-hidden transition-[max-height,opacity,transform,padding,scale,shadow] duration-200 ease-in-out group`, {
                      "max-h-0 opacity-0 py-0": !viewListItemAdder,
                    }
                    )}
                  >
                    <div
                      data-testid="item-drag-handle-placeholder"
                      className="touch-none select-none p-1.5 -mt-px -mr-1 shrink-0 text-gray-400"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>

                    <Checkbox
                      className="w-4 h-4 shrink-0 hover:cursor-default! my-1"
                      disabled={true}
                    />

                    <div className="min-w-0 flex-1">
                      <Textarea
                        data-testid="create-item-input"
                        ref={inputRef}
                        value={createListItemName}
                        placeholder="Add new item here..."
                        className="rounded-md flex-1 min-h-5 resize-none overflow-hidden border-0 bg-transparent p-0 text-sm leading-6 shadow-none focus-visible:ring-0 break-normal!"
                        onChange={(e) => {
                          setCreateListItemName(e.target.value);
                        }}
                        onBlur={() => {
                          if (createListItemName.trim()) {
                            handleCreateItem();
                          }

                          setCreateListItemName("");
                          setViewListItemAdder(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();

                            if (!createListItemName.trim()) return;

                            handleCreateItem();
                          }

                          if (e.key === "Escape") {
                            setCreateListItemName("");
                            setViewListItemAdder(false);
                          }
                        }}
                      />
                    </div>
                    <Button
                      className="scale-80 shrink-0 self-start opacity-100 duration-100 transition-all"
                      variant="ghost"
                      size="icon-xs"
                      onMouseDown={(e) => {
                        e.preventDefault();

                        if (!createListItemName.trim()) return;

                        handleCreateItem();
                      }}
                    >
                      <Plus />
                    </Button>
                  </div>}
                  {children}
                  {totalItems == 0 &&
                    <div className="w-0 h-0 absolute flex items-center justify-center left-1/2 top-1/2">
                      <StickyNote className="overflow-clip text-zinc-400/80" />
                    </div>}
                </ScrollArea>
              </div>

            </div>

            <div className="mt-2 flex h-6 w-full items-center justify-center px-4 text-sm text-muted-foreground">
              {
                totalItems !== 0 &&
                <div className="text-center">
                  {completedItems} of {totalItems} completed
                </div>
              }
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>

  );
};

export default memo(ListComponent);

