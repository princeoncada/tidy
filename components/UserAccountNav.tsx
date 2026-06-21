

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "./theme/ThemeToggle";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";



const UserAccountNav = ({
  logout,
  collapsed = false,
  onRequestExpand,
}: {
  logout: () => void;
  collapsed?: boolean;
  onRequestExpand?: () => void;
}) => {

  const trpc = useTRPC();
  const { data } = useQuery(trpc.user.getUser.queryOptions());
  const user = data;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen && collapsed) {
          onRequestExpand?.();
        }
        setMenuOpen(nextOpen);
      }}
    >
      <DropdownMenuTrigger
        asChild
        className="overflow-visible"
      >
        <Button
          data-testid="account-menu-trigger"
          aria-label="Open account menu"
          className="rounded-full h-9 w-9 bg-surface-muted"
        >
          <Avatar className='relative h-7 w-7 md:h-9 md:w-9'>
            <AvatarFallback>
              <User className="scale-90 md:scale-100" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-testid="account-menu-content"
        side="top"
        className="w-56 p-1 m-1"
        align="start"
      >
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-0.5 leading-none min-w-0">
            {user && (
              <p className="truncate text-xs font-medium text-text">{user.email}</p>
            )}
          </div>
        </div>

        {/* <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <div>
            <Button
              className="w-full"
              variant="link"
              disabled
            >
              Placeholder
            </Button>
          </div>
        </DropdownMenuItem> */}

        <DropdownMenuSeparator />

        <ThemeToggle />

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onClick={logout} className="text-xs">
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserAccountNav;
