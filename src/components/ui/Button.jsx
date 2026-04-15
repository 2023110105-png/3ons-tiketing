/**
 * 3ONS Button Component
 * Primary brand color: Red (#ef4444)
 */
import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/ui'

const variantStyles = {
  primary: 'bg-3ons-500 hover:bg-3ons-600 active:bg-3ons-700 text-white shadow-md hover:shadow-lg',
  secondary: 'bg-white hover:bg-secondary-50 text-secondary-700 border border-secondary-300 shadow-sm',
  outline: 'bg-transparent hover:bg-3ons-50 text-3ons-600 border-2 border-3ons-500',
  ghost: 'bg-transparent hover:bg-secondary-100 text-secondary-700',
  danger: 'bg-error-500 hover:bg-error-600 text-white shadow-md',
  success: 'bg-success-500 hover:bg-success-600 text-white shadow-md',
}

const sizeStyles = {
  xs: 'px-2.5 py-1.5 text-xs',
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
  xl: 'px-8 py-4 text-lg',
}

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-3ons-500 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {!loading && LeftIcon && <LeftIcon className="w-4 h-4 mr-2" />}
      {children}
      {RightIcon && <RightIcon className="w-4 h-4 ml-2" />}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
