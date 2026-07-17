import * as React from 'react'

import { cn } from '@/lib/utils'

/*
 * Kit minimal maison plutôt que shadcn/ui : le CLI shadcn n'est pas encore
 * stabilisé sur Tailwind v4 + Next 16, et la v1 n'a besoin que de six
 * primitives. Le remplacement par shadcn/ui reste possible sans toucher aux
 * pages, les props suivant les mêmes conventions.
 */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        // min-h-11 = 44px : exigence 19.3 (cible tactile minimale).
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-colors disabled:pointer-events-none disabled:opacity-50',
        size === 'md' ? 'min-h-11 px-4 text-sm' : 'min-h-9 px-3 text-sm',
        variant === 'primary' &&
          'bg-primary-500 text-white hover:bg-primary-600',
        variant === 'secondary' &&
          'border border-border bg-card hover:bg-muted',
        variant === 'ghost' && 'hover:bg-muted',
        variant === 'danger' && 'bg-error-500 text-white hover:bg-error-600',
        className,
      )}
      {...props}
    />
  )
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm',
        'placeholder:text-muted-foreground',
        'aria-[invalid=true]:border-error-500',
        className,
      )}
      {...props}
    />
  )
})

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm',
        className,
      )}
      {...props}
    />
  )
})

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-border bg-card p-3 text-sm',
        className,
      )}
      {...props}
    />
  )
})

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 block text-sm font-medium', className)}
      {...props}
    />
  )
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'success' | 'warning' | 'error'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-muted text-muted-foreground',
        tone === 'success' && 'bg-success-500/15 text-success-600',
        tone === 'warning' && 'bg-warning-500/15 text-warning-500',
        tone === 'error' && 'bg-error-500/15 text-error-600',
        className,
      )}
      {...props}
    />
  )
}

/** Message d'erreur de formulaire. role="alert" : exigence 20.7. */
export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="mt-1 text-sm text-error-600">
      {children}
    </p>
  )
}

export function Alert({
  children,
  tone = 'error',
}: {
  children: React.ReactNode
  tone?: 'error' | 'success'
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border p-3 text-sm',
        tone === 'error' && 'border-error-500/30 bg-error-500/10 text-error-600',
        tone === 'success' &&
          'border-success-500/30 bg-success-500/10 text-success-600',
      )}
    >
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
