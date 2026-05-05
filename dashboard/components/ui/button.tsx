import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kammaren-strong ' +
    'focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-kammaren-strong text-kammaren-cream hover:bg-kammaren-bg-warm shadow-sm',
        outline:
          'border border-kammaren-strong/20 bg-white/60 text-kammaren-strong hover:bg-white/90',
        ghost: 'text-kammaren-strong hover:bg-kammaren-cream-mid',
        accent:
          'bg-kammaren-tamber text-kammaren-strong hover:bg-kammaren-tamber/90 shadow-sm',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 px-3',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
