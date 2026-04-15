/**
 * 3ONS Input Component
 * Form input with brand styling
 */
import { forwardRef } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '../../lib/ui'

const Input = forwardRef(({
  label,
  error,
  helper,
  icon: Icon,
  rightIcon: RightIcon,
  onRightIconClick,
  type = 'text',
  size = 'md',
  fullWidth = false,
  required = false,
  disabled = false,
  className = '',
  labelClassName = '',
  ...props
}, ref) => {

  const sizeStyles = {
    sm: 'py-2 text-sm',
    md: 'py-2.5 text-sm',
    lg: 'py-3 text-base',
  }

  const baseStyles = cn(
    'w-full bg-white border border-gray-300 rounded-lg',
    'text-gray-900 placeholder:text-gray-400',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500',
    'hover:border-gray-400',
    'disabled:bg-gray-100 disabled:cursor-not-allowed',
    error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
    sizeStyles[size],
    // Horizontal padding: icon aware
    !Icon && !RightIcon && 'px-4',
    Icon && !RightIcon && 'pl-10 pr-4',
    !Icon && RightIcon && 'pl-4 pr-10',
    Icon && RightIcon && 'pl-10 pr-10',
    className
  )

  return (
    <div className={cn(fullWidth && 'w-full')}>
      {label && (
        <label className={cn('block text-sm font-medium text-gray-700 mb-1.5', labelClassName)}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(baseStyles)}
          disabled={disabled}
          {...props}
        />
        {RightIcon && (
          <button
            type="button"
            onClick={onRightIconClick}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            <RightIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      {error && (
        <div className="mt-1.5 flex items-center text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mr-1.5" />
          {error}
        </div>
      )}
      {helper && !error && (
        <p className="mt-2 text-xs text-gray-500 leading-relaxed">{helper}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
