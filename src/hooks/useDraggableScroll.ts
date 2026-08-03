import * as React from "react";

export function useDraggableScroll<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const isDown = React.useRef(false);
  const startX = React.useRef(0);
  const scrollLeft = React.useRef(0);

  const onMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    isDown.current = true;
    ref.current.classList.add("cursor-grabbing");
    startX.current = e.pageX - ref.current.offsetLeft;
    scrollLeft.current = ref.current.scrollLeft;
  }, []);

  const onMouseLeave = React.useCallback(() => {
    isDown.current = false;
    if (ref.current) {
      ref.current.classList.remove("cursor-grabbing");
    }
  }, []);

  const onMouseUp = React.useCallback(() => {
    isDown.current = false;
    if (ref.current) {
      ref.current.classList.remove("cursor-grabbing");
    }
  }, []);

  const onMouseMove = React.useCallback((e: React.MouseEvent) => {
    if (!isDown.current || !ref.current) return;
    // Don't preventDefault here, as it might block clicks on inner elements like buttons/links
    // e.preventDefault(); 
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX.current) * 2; // scroll-fast multiplier
    ref.current.scrollLeft = scrollLeft.current - walk;
  }, []);

  const onDragStart = React.useCallback((e: React.DragEvent) => {
    // Prevent default drag behaviors from taking over the mouse events
    e.preventDefault();
  }, []);

  return {
    ref,
    onMouseDown,
    onMouseLeave,
    onMouseUp,
    onMouseMove,
    onDragStart,
  };
}
