import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Sidebar, type NavPage } from "./Sidebar";
import { cn } from "../../lib/utils";

export function AppShell({
  page,
  onNavigate,
  children,
}: {
  page: NavPage;
  onNavigate: (page: NavPage) => void;
  children: ReactNode;
}) {
  const isResumes = page === "resumes";
  const scrollContainerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasContentBelow, setHasContentBelow] = useState(false);

  const updateBottomFade = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    setHasContentBelow(
      scrollContainer.scrollTop + scrollContainer.clientHeight < scrollContainer.scrollHeight - 2,
    );
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const content = contentRef.current;
    if (!scrollContainer || !content) return;

    scrollContainer.scrollTop = 0;
    updateBottomFade();

    const resizeObserver = new ResizeObserver(updateBottomFade);
    resizeObserver.observe(scrollContainer);
    resizeObserver.observe(content);
    return () => resizeObserver.disconnect();
  }, [page, updateBottomFade]);

  return (
    <div className={cn("flex h-screen w-screen flex-col overflow-hidden sm:flex-row", isResumes ? "bg-slate-100 text-slate-900" : "bg-paper text-ink")}>
      <Sidebar page={page} onNavigate={onNavigate} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <main
          ref={scrollContainerRef}
          onScroll={updateBottomFade}
          className={cn(
            "h-full overflow-y-auto overflow-x-hidden",
            isResumes ? "bg-slate-100 p-4 sm:p-6" : "editorial font-sans px-5 py-7 sm:px-12 sm:py-11",
          )}
        >
          <div ref={contentRef}>{children}</div>
        </main>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-gradient-to-b from-transparent transition-opacity duration-300 sm:h-16",
            isResumes ? "to-slate-100" : "to-paper",
            hasContentBelow ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </div>
  );
}
