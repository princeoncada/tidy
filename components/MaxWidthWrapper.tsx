import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const MaxWidthWrapper = ({ children, singleItemPage = false, fullWidth = false }: { children: ReactNode; singleItemPage?: boolean; fullWidth?: boolean; }) => {
  return (
    <div data-testid={fullWidth ? "full-width-canvas" : undefined} className={cn("w-full min-h-full xl:px-0 px-2", fullWidth ? "max-w-none" : "max-w-7xl", {
      "flex items-center justify-center": singleItemPage
    })}>
      {children}
    </div>

  );
};

export default MaxWidthWrapper;
