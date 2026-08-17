import { cn } from '../utils/cn';
import type { ReactNode } from 'react';

interface NavHeaderProps {
  title: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

function NavHeader({ title, left, right, className }: NavHeaderProps) {
  const isStringTitle = typeof title === 'string';

  return (
    <div className={cn('w-full box-border px-3 h-[52px] bg-surface rounded-b-[6px]', className)}>
      {isStringTitle ? (
        <div className="relative flex h-full items-center">
          <div className="flex w-10 shrink-0 items-center justify-start">{left}</div>
          <div className="pointer-events-none absolute inset-x-0 flex justify-center px-14">
            <span className="block truncate text-[17px] tracking-[-0.17px] font-normal text-text text-center">
              {title}
            </span>
          </div>
          <div className="ml-auto flex w-10 shrink-0 items-center justify-end">{right}</div>
        </div>
      ) : (
        <div className="flex h-full items-center w-full">
          {left ? (
            <div className="flex items-center gap-2 shrink-0 min-w-[40px] mr-2">{left}</div>
          ) : null}
          <div className="flex flex-1 min-w-0 items-center justify-center">
            <div className="w-full min-w-0">
              {title}
            </div>
          </div>
          {right ? (
            <div className="flex items-center gap-2 justify-end shrink-0 min-w-[40px] ml-2">{right}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export { NavHeader };
export type { NavHeaderProps };
