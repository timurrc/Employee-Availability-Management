import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

/** Ширина контента 1200 px, поле страницы 24 (на мобильном 16) */
const Container = ({ children, className }: ContainerProps) => {
  return (
    <div className={cn("mx-auto w-full max-w-[1200px] px-4 md:px-6", className)}>{children}</div>
  );
};

export default Container;
