"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Tag, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDashboardMutations } from "@/hooks/useDashboardMutations";
import { useReplicacheDashboard } from "@/hooks/useReplicacheDashboard";
import type { DashboardTag } from "@/lib/dashboard-cache";
import { useRenderMeasure } from "@/lib/optimistic-debug";
import { cn } from "@/lib/utils";
import type { Lists } from "./types";

type TagValue = DashboardTag;
type ListTagValue = Lists[number]["listTags"][number];
type TagColor = TagValue["color"];

type ListTagPickerProps = {
  listId: string;
  selectedListTags: ListTagValue[];
  userId: string | null;
};

const TAG_COLORS: TagColor[] = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
];

const TAG_COLOR_CLASSES: Record<TagColor, string> = {
  gray: "bg-zinc-100 text-zinc-700 border-zinc-200",
  red: "bg-red-100 text-red-700 border-red-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  green: "bg-green-100 text-green-700 border-green-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  pink: "bg-pink-100 text-pink-700 border-pink-200",
};

export default function ListTagPicker({
  listId,
  selectedListTags,
  userId,
}: ListTagPickerProps) {
  useRenderMeasure(`ListTagPicker:${listId}`);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const replicacheDashboard = useReplicacheDashboard();
  const dashboardMutations = useDashboardMutations();
  const tags = replicacheDashboard.tags;

  const selectedTagIds = useMemo(
    () => selectedListTags.map((listTag) => listTag.tagId),
    [selectedListTags]
  );

  const selectedTags = useMemo(
    () => selectedListTags.map((listTag) => listTag.tag),
    [selectedListTags]
  );

  const filteredTags = useMemo(() => {
    return tags.filter((tag) =>
      tag.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [tags, search]);

  const exactTagExists = tags.some(
    (tag) => tag.name.toLowerCase() === search.trim().toLowerCase()
  );

  const scheduleTagFlush = (
    tag: TagValue | ListTagValue["tag"],
    action: "add" | "remove"
  ) => {
    if (!userId || !dashboardMutations.mutate) return;

    const mutation = action === "add"
      ? dashboardMutations.mutate.attachListTag
      : dashboardMutations.mutate.detachListTag;
    void mutation({ listId, tagId: tag.id });
  };

  const toggleTag = (tag: TagValue) => {
    const isSelected = selectedTagIds.includes(tag.id);

    if (isSelected) {
      scheduleTagFlush(tag, "remove");
      return;
    }

    scheduleTagFlush(tag, "add");
  };

  const updateTagColor = (tagId: string, color: TagColor) => {
    if (!userId || !dashboardMutations.mutate) return;

    void dashboardMutations.mutate.updateTag({
      id: tagId,
      color,
      now: new Date().toISOString(),
    });
  };

  const createTag = async () => {
    const name = search.trim();
    if (!name || exactTagExists || !userId || !dashboardMutations.mutate) return;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    setSearch("");
    setOpen(false);

    await dashboardMutations.mutate.createTag({
      id,
      userId,
      name,
      color: "gray",
      now,
    });
    await dashboardMutations.mutate.attachListTag({
      listId,
      tagId: id,
    });
  };

  const deleteTag = (tagId: string) => {
    if (!userId || !dashboardMutations.mutate) return;

    void dashboardMutations.mutate.deleteTag({ id: tagId });
  };

  const isCreatingNewTag = search.trim() && !exactTagExists;

  return (
    <div className="flex w-full flex-wrap items-center gap-1">
      {selectedTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className={cn(
            "h-5 max-w-full min-w-0 justify-start gap-1 rounded-full border px-1.5 text-[11px] hover:cursor-default",
            TAG_COLOR_CLASSES[tag.color]
          )}
        >
          <span className="min-w-0 truncate">{tag.name}</span>

          <button
            type="button"
            aria-label={`Remove ${tag.name} tag`}
            onClick={() => scheduleTagFlush(tag, "remove")}
            className="shrink-0 rounded-full opacity-70 transition hover:cursor-pointer hover:opacity-100"
          >
            <X className="size-2.5" />
          </button>
        </Badge>
      ))}

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Badge
            data-testid="tag-selector"
            variant="outline"
            className="h-5 gap-1 rounded-full border px-1.5 text-[11px]"
          >
            <Tag className="size-2.5" />
            Tags
          </Badge>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="center"
          className="w-64 overflow-hidden p-0"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <Command>
            <CommandInput
              placeholder="Search or create tag..."
              value={search}
              onValueChange={setSearch}
              className="h-8 text-xs"
            />
            <CommandList className="overflow-y-hidden">
              <CommandEmpty className="px-2 py-2.5 text-xs text-muted-foreground text-start">
                No tags found.
              </CommandEmpty>

              {filteredTags.length > 0 && (
                <CommandGroup heading="Existing tags">
                  <ScrollArea
                    className={cn(
                      "max-h-36",
                      !isCreatingNewTag && "h-36"
                    )}
                  >
                    {filteredTags.map((tag) => {
                      const isSelected = selectedTagIds.includes(tag.id);

                      return (
                        <div
                          key={tag.id}
                          className="grid min-w-0 grid-cols-[minmax(0,1fr)_1.25rem_1.25rem] items-center gap-1 px-1 py-0.5"
                        >
                          <CommandItem
                            value={tag.name}
                            onSelect={() => toggleTag(tag)}
                            className="h-7 min-w-0 cursor-pointer overflow-hidden rounded-sm px-1 text-xs [&>svg:last-child]:hidden"
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="block min-w-0 flex-1 truncate pl-1.5">
                                {tag.name}
                              </span>

                              <Check
                                className={cn(
                                  "size-3.5 shrink-0",
                                  isSelected ? "opacity-100" : "opacity-0"
                                )}
                              />
                            </div>
                          </CommandItem>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              deleteTag(tag.id);
                            }}
                            className={cn(
                              "text-muted-foreground transition",
                              "hover:bg-destructive/10 hover:text-destructive"
                            )}
                            aria-label={`Delete ${tag.name} tag`}
                          >
                            <Trash2 className="size-3" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <span
                                  className={cn(
                                    "flex size-3 items-center justify-center rounded-full border",
                                    TAG_COLOR_CLASSES[tag.color],
                                    "ring-1 ring-muted ring-offset-1"
                                  )}
                                />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                              align="end"
                              className="w-32 p-2 flex flex-col gap-0.5"
                              onCloseAutoFocus={(event) =>
                                event.preventDefault()
                              }
                            >
                              <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                                Choose color
                              </p>

                              <div className="grid grid-cols-4 gap-1">
                                {TAG_COLORS.map((color) => {
                                  const isCurrentColor = tag.color === color;

                                  return (
                                    <button
                                      key={color}
                                      type="button"
                                      title={color}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateTagColor(tag.id, color);
                                      }}
                                      className={cn(
                                        "flex size-5 items-center justify-center rounded-full border transition hover:scale-105",
                                        TAG_COLOR_CLASSES[color],
                                        isCurrentColor
                                      )}
                                    >
                                      {isCurrentColor && (
                                        <Check className="size-2.5" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </ScrollArea>
                </CommandGroup>
              )}

              {search.trim() && !exactTagExists && (
                <CommandGroup heading="Create new">
                  <CommandItem
                    value={search}
                    onSelect={createTag}
                    className="h-7 min-w-0 cursor-pointer gap-1 px-1.5 text-xs"
                  >
                    <Plus className="size-3 shrink-0" />
                    <span className="min-w-0 truncate">
                      Create &quot;{search.trim()}&quot;
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
