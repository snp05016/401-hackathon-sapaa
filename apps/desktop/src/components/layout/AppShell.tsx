import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Sidebar, type NavPage } from "./Sidebar";
import { cn } from "../../lib/utils";

export function AppShell({
  page,
  onNavigate,
  children,
  ghostMarkLayoutId,
}: {
  page: NavPage;
  onNavigate: (page: NavPage) => void;
  children: ReactNode;
  ghostMarkLayoutId?: string;
}) {
  const scrollContainerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasContentAbove, setHasContentAbove] = useState(false);
  const [hasContentBelow, setHasContentBelow] = useState(false);

  const updateEdgeFades = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    setHasContentAbove(scrollContainer.scrollTop > 2);
    setHasContentBelow(
      scrollContainer.scrollTop + scrollContainer.clientHeight < scrollContainer.scrollHeight - 2,
    );
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const content = contentRef.current;
    if (!scrollContainer || !content) return;

    scrollContainer.scrollTop = 0;
    updateEdgeFades();

    const resizeObserver = new ResizeObserver(updateEdgeFades);
    resizeObserver.observe(scrollContainer);
    resizeObserver.observe(content);
    return () => resizeObserver.disconnect();
  }, [page, updateEdgeFades]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-paper text-ink sm:flex-row">
      <Sidebar page={page} onNavigate={onNavigate} ghostMarkLayoutId={ghostMarkLayoutId} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <main
          ref={scrollContainerRef}
          onScroll={updateEdgeFades}
          className="editorial font-sans h-full overflow-y-auto overflow-x-hidden px-5 py-7 sm:px-12 sm:py-11"
        >
          {/* No `layout` and no height animation in here: the ResizeObserver
              above drives the edge fades and would thrash. */}
          <div ref={contentRef}>
            {children}
          </div>
        </main>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-20 h-12 bg-gradient-to-t from-transparent to-paper transition-opacity duration-150 sm:h-16",
            hasContentAbove ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-gradient-to-b from-transparent to-paper transition-opacity duration-150 sm:h-16",
            hasContentBelow ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </div>
  );
}
