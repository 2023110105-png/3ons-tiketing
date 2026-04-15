/**
 * 3ONS Badge Component
 * Status indicators with brand colors
 */
import { forwardRef } from 'react'
import { cn } from '../../lib/ui'

const variantStyles = {
  default: 'bg-secondary-100 text-secondary-800',
  primary: 'bg-3ons-100 text-3ons-800',
  success: 'bg-success-100 text-success-800',
  warning: 'bg-warning-100 text-warning-800',
  error: 'bg-error-100 text-error-800',
  info: 'bg-info-100 text-info-800',
  // Outlined variants
  'outline-default': 'bg-transparent border border-secondary-300 text-secondary-700',
  'outline-primary': 'bg-transparent border border-3ons-500 text-3ons-600',
  'outline-success': 'bg-transparent border border-success-500 text-success-600',
  'outline-warning': 'bg-transparent border border-warning-500 text-warning-600',
  'outline-error': 'bg-transparent border border-error-500 text-error-600',
  // Soft variants with dots
  'soft-success': 'bg-success-50 text-success-700',
  'soft-warning': 'bg-warning-50 text-warning-700',
  'soft-error': 'bg-error-50 text-error-700',
}

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
}

const dotColors = {
  default: 'bg-secondary-500',
  primary: 'bg-3ons-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  info: 'bg-info-500',
}

const Badge = forwardRef(({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  pulse = false,
  className,
  ...props
}, ref) => {
  const dotColor = dotColors[variant.replace('outline-', '').replace('soft-', '')] || dotColors.default

  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', dotColor, pulse && 'animate-pulse')} />
      )}
      {children}
    </span>
  )
})

Badge.displayName = 'Badge'

export default Badge
