"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Tag, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
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

type TagColor =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink";

type TagValue = {
  id: string;
  name: string;
  color: TagColor;
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

const DEFAULT_TAGS: TagValue[] = [
  { id: "tag-1", name: "Urgent", color: "red" },
  { id: "tag-2", name: "Work", color: "blue" },
  { id: "tag-3", name: "Personal", color: "green" },
  { id: "tag-4", name: "School", color: "purple" },
  { id: "tag-5", name: "Shopping", color: "orange" },
  { id: "tag-6", name: "Ideas", color: "yellow" },
];

export default function ListTagPicker() {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<TagValue[]>(DEFAULT_TAGS);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([
    "tag-1",
    "tag-2",
  ]);
  const [search, setSearch] = useState("");

  const selectedTags = useMemo(() => {
    return tags.filter((tag) => selectedTagIds.includes(tag.id));
  }, [tags, selectedTagIds]);

  const filteredTags = useMemo(() => {
    return tags.filter((tag) =>
      tag.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [tags, search]);

  const exactTagExists = tags.some(
    (tag) => tag.name.toLowerCase() === search.trim().toLowerCase()
  );

  const toggleTag = (tagId: string) => {
    const isSelected = selectedTagIds.includes(tagId);

    if (isSelected) {
      setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId));
      return;
    }

    setSelectedTagIds([...selectedTagIds, tagId]);
  };

  const removeTag = (tagId: string) => {
    setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId));
  };

  const updateTagColor = (tagId: string, color: TagColor) => {
    setTags((currentTags) =>
      currentTags.map((tag) => {
        if (tag.id !== tagId) return tag;

        return {
          ...tag,
          color,
        };
      })
    );
  };

  const createTag = () => {
    const name = search.trim();
    if (!name || exactTagExists) return;

    const newTag: TagValue = {
      id: crypto.randomUUID(),
      name,
      color: "gray",
    };

    setTags((currentTags) => [...currentTags, newTag]);
    setSelectedTagIds((currentIds) => [...currentIds, newTag.id]);
    setSearch("");
    setOpen(false);
  };

  const deleteTag = (tagId: string) => {
    setTags((currentTags) => currentTags.filter((tag) => tag.id !== tagId));
    setSelectedTagIds((currentIds) => currentIds.filter((id) => id !== tagId));
  };

  const isCreatingNewTag = search.trim() && !exactTagExists;

  return (
    <div className="flex w-full flex-wrap items-center gap-1">
      {selectedTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className={cn(
            "h-5 gap-1 rounded-full border px-1.5 text-[11px] hover:cursor-default",
            TAG_COLOR_CLASSES[tag.color]
          )}
        >
          {tag.name}

          <button
            type="button"
            onClick={() => removeTag(tag.id)}
            className="rounded-full opacity-70 transition hover:opacity-100 hover:cursor-pointer"
          >
            <X className="size-2.5" />
          </button>
        </Badge>
      ))}

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Badge
            variant="outline"
            className="h-5 gap-1 rounded-full border px-1.5 text-[11px]"
          >
            <Tag className="size-2.5" />
            Tags
          </Badge>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="center"
          className="w-64 p-0"
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
              <CommandEmpty className="px-2 py-2.5 text-xs text-muted-foreground">
                No tags found.
              </CommandEmpty>

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
                        className="group/tag-row flex items-center gap-1 px-1 py-0.5"
                      >
                        <CommandItem
                          value={tag.name}
                          onSelect={() => toggleTag(tag.id)}
                          className="flex h-7 flex-1 cursor-pointer items-center justify-between rounded-sm px-1 text-xs [&>svg:last-child]:hidden"
                        >
                          <div className="flex flex-1 items-center gap-1.5">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate">{tag.name}</span>
                            </div>

                            <Check
                              className={cn(
                                "size-3.5 shrink-0",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </div>
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
                              "h-5 w-5 text-muted-foreground transition",
                              "hover:bg-destructive/10 hover:text-destructive",
                              "md:flex md:opacity-0 md:group-hover/tag-row:opacity-100"
                            )}
                            aria-label={`Delete ${tag.name} tag`}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </CommandItem>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="size-5 shrink-0"
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
                            className="w-32 p-1.5"
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
                                      isCurrentColor &&
                                      "ring-2 ring-ring ring-offset-1"
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

              {search.trim() && !exactTagExists && (
                <CommandGroup heading="Create new">
                  <CommandItem
                    value={search}
                    onSelect={createTag}
                    className="h-7 cursor-pointer gap-1 px-1.5 text-xs"
                  >
                    <Plus className="size-3" />
                    Create “{search.trim()}”
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