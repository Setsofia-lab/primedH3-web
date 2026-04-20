'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center gap-2 font-medium leading-none rounded-full border border-transparent cursor-pointer transition-[background,border-color,color,transform] duration-150 select-none whitespace-nowrap no-underline disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-[0.5px]',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--color-accent-indigo)] text-white hover:bg-[var(--color-accent-indigo-600)]',
        dark: 'bg-[var(--color-ink-900)] text-white hover:bg-black',
        'outline-dark':
          'bg-transparent text-[var(--color-ink-900)] border-[var(--color-ink-900)] hover:bg-[var(--color-ink-900)] hover:text-white',
        outline:
          'bg-[var(--color-surface-0)] text-[var(--color-ink-900)] border-[var(--color-border)] hover:border-[var(--color-ink-300)] hover:bg-[var(--color-surface-50)]',
        ghost: 'bg-transparent text-[var(--color-ink-700)] hover:bg-[var(--color-surface-100)]',
        link: 'bg-transparent text-[var(--color-primary-blue)] !rounded-none !px-0 hover:text-[var(--color-primary-blue-600)] hover:underline',
      },
      size: {
        sm: 'px-[0.875rem] py-[0.5rem] text-[0.8125rem]',
        md: 'px-[1.25rem] py-[0.75rem] text-[0.9375rem]',
        lg: 'px-[1.5rem] py-[0.9375rem] text-[1rem]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
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
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  },
);
Button.displayName = 'Button';

export { buttonVariants };
