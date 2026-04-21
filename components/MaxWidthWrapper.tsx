import { ReactNode } from "react";

const MaxWidthWrapper = ({ children }: { children: ReactNode; }) => {
  return (
    <div className="w-full max-w-7xl flex items-center justify-center">
      {children}
    </div>
  );
};

export default MaxWidthWrapper;