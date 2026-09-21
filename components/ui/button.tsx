'use client';

import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from 'react';
import { Link } from 'next-view-transitions';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 select-none whitespace-nowrap rounded-r2 border font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(.2,.7,.2,1)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink border-accent hover:bg-accent-strong hover:border-accent-strong shadow-[0_1px_0_rgba(255,255,255,.18)_inset,0_1px_2px_rgba(0,0,0,.4),0_8px_20px_-10px_var(--accent-glow)]',
  secondary: 'bg-bg-2 text-fg border-line-strong hover:bg-bg-3 hover:text-fg hover:border-[rgba(236,232,225,0.26)] shadow-[var(--inset-hi)]',
  ghost: 'bg-transparent text-fg-1 border-transparent hover:bg-bg-2 hover:text-fg',
  danger: 'bg-bad-dim text-bad border-[rgba(229,101,79,0.3)] hover:bg-[rgba(229,101,79,0.22)] hover:text-[#ff8b78]',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant = 'secondary', size = 'md', type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} className={cn(base, variants[variant], sizes[size], className)} {...rest} />;
});

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ className, variant = 'secondary', size = 'md', href, ...rest }: ButtonLinkProps) {
  return <Link href={href} className={cn(base, variants[variant], sizes[size], 'hit', className)} {...rest} />;
}

/** Icon-only button: requires an aria-label. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { 'aria-label': string }>(function IconButton({ className, variant = 'ghost', size = 'md', ...rest }, ref) {
  const dims = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  return <button ref={ref} type="button" className={cn(base, variants[variant], dims, 'px-0', className)} {...rest} />;
});
