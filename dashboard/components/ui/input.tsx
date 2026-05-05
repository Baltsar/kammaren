import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-11 w-full rounded-md border border-kammaren-strong/20 bg-white/70 px-3 py-2 text-sm ' +
          'placeholder:text-kammaren-label-light focus-visible:outline-none focus-visible:ring-2 ' +
          'focus-visible:ring-kammaren-strong focus-visible:border-kammaren-strong ' +
          'disabled:cursor-not-allowed disabled:opacity-50 transition',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
