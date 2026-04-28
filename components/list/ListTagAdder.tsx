import { ChevronDown, Plus, Tag } from "lucide-react";
import { Badge } from "../ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { ScrollArea } from "../ui/scroll-area";


const ListBadge = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge variant="outline" className="hover:cursor-pointer">
          <Tag />
          Add tag
          <ChevronDown />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-40" align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Existing Tags</DropdownMenuLabel>
          <ScrollArea className="h-24">
            <DropdownMenuItem>Personal</DropdownMenuItem>
            <DropdownMenuItem>Work</DropdownMenuItem>
            <DropdownMenuItem>Personal</DropdownMenuItem>
            <DropdownMenuItem>Work</DropdownMenuItem>
            <DropdownMenuItem>Personal</DropdownMenuItem>
            <DropdownMenuItem>Work</DropdownMenuItem>
            <DropdownMenuItem>Personal</DropdownMenuItem>
            <DropdownMenuItem>Work</DropdownMenuItem>
            <DropdownMenuItem>Personal</DropdownMenuItem>
            <DropdownMenuItem>Work</DropdownMenuItem>
          </ScrollArea>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <div className="flex gap-0.5 items-center">
              <Plus className="scale-75" />
              Create new tag
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ListBadge;