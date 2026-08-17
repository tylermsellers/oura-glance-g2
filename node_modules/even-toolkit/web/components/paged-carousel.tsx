import * as React from 'react';
import { cn } from '../utils/cn';

interface PagedCarouselProps {
  children: React.ReactNode;
  currentIndex?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  className?: string;
  viewportClassName?: string;
  trackClassName?: string;
  slideClassName?: string;
  allowWheel?: boolean;
  allowSwipe?: boolean;
}

interface CardCarouselProps extends PagedCarouselProps {}

function useCarouselIndex(
  slideCount: number,
  currentIndex?: number,
  defaultIndex?: number,
  onIndexChange?: (index: number) => void,
) {
  const [internalIndex, setInternalIndex] = React.useState(defaultIndex ?? 0);
  const controlled = typeof currentIndex === 'number';
  const activeIndex = controlled ? currentIndex! : internalIndex;

  const setIndex = React.useCallback((nextIndex: number) => {
    if (slideCount <= 0) return;
    const clamped = Math.max(0, Math.min(nextIndex, slideCount - 1));
    if (!controlled) setInternalIndex(clamped);
    onIndexChange?.(clamped);
  }, [controlled, onIndexChange, slideCount]);

  return { activeIndex, setIndex };
}

function PagedCarousel({
  children,
  currentIndex,
  defaultIndex = 0,
  onIndexChange,
  className,
  viewportClassName,
  trackClassName,
  slideClassName,
  allowWheel = true,
  allowSwipe = true,
}: PagedCarouselProps) {
  const slides = React.Children.toArray(children);
  const slideCount = slides.length;
  const { activeIndex, setIndex } = useCarouselIndex(slideCount, currentIndex, defaultIndex, onIndexChange);

  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const wheelLockRef = React.useRef(0);

  const moveBy = React.useCallback((delta: number) => {
    setIndex(activeIndex + delta);
  }, [activeIndex, setIndex]);

  const handleTouchStart = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!allowSwipe) return;
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [allowSwipe]);

  const handleTouchMove = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!allowSwipe) return;
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 32 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    touchStartRef.current = null;
    event.preventDefault();
    if (deltaX < 0) moveBy(1);
    else moveBy(-1);
  }, [allowSwipe, moveBy]);

  const handleTouchEnd = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!allowSwipe) return;
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 32 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    if (deltaX < 0) moveBy(1);
    else moveBy(-1);
  }, [allowSwipe, moveBy]);

  const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowSwipe) return;
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  }, [allowSwipe]);

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowSwipe) return;
    const start = pointerStartRef.current;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 32 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    pointerStartRef.current = null;
    if (deltaX < 0) moveBy(1);
    else moveBy(-1);
  }, [allowSwipe, moveBy]);

  const handlePointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!allowSwipe) return;
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 32 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    if (deltaX < 0) moveBy(1);
    else moveBy(-1);
  }, [allowSwipe, moveBy]);

  const handleWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!allowWheel) return;
    if (Math.abs(event.deltaX) < 18 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

    const now = Date.now();
    if (now - wheelLockRef.current < 280) return;
    wheelLockRef.current = now;

    event.preventDefault();
    if (event.deltaX > 0) moveBy(1);
    else moveBy(-1);
  }, [allowWheel, moveBy]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveBy(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveBy(-1);
    }
  }, [moveBy]);

  return (
    <div className={cn('min-w-0', className)}>
      <div
        role="region"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn('min-w-0 overflow-hidden outline-none', viewportClassName)}
        style={{ touchAction: 'none' }}
      >
        <div className={cn('min-w-0', trackClassName)}>
          <div
            key={activeIndex}
            className={cn('w-full min-w-0', slideClassName)}
            aria-hidden={false}
          >
            {slides[activeIndex] ?? null}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardCarousel(props: CardCarouselProps) {
  return (
    <PagedCarousel
      {...props}
      className={cn('min-w-0', props.className)}
      viewportClassName={cn('rounded-[6px]', props.viewportClassName)}
      slideClassName={cn('min-w-0', props.slideClassName)}
    />
  );
}

export { PagedCarousel, CardCarousel };
export type { PagedCarouselProps, CardCarouselProps };
