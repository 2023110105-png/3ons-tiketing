/**
 * 3ONS Input Component
 * Form input with brand styling
 */
import { forwardRef, useState } from 'react'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/ui'

const Input = forwardRef(({
  label,
  error,
  helper,
  icon: Icon,
  rightIcon: RightIcon,
  type = 'text',
  size = 'md',
  fullWidth = false,
  required = false,
  disabled = false,
  className = '',
  labelClassName = '',
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  const sizeStyles = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-4 py-3 text-base',
  }

  const baseStyles = cn(
    'w-full bg-white border border-secondary-300 rounded-lg',
    'text-secondary-900 placeholder:text-secondary-400',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-3ons-500 focus:border-3ons-500',
    'hover:border-secondary-400',
    'disabled:bg-secondary-100 disabled:cursor-not-allowed',
    error && 'border-error-500 focus:ring-error-500 focus:border-error-500',
    Icon && 'pl-10',
    (RightIcon || isPassword) && 'pr-10',
    sizeStyles[size],
    className
  )

  return (
    <div className={cn(fullWidth && 'w-full')}>
      {label && (
        <label className={cn('block text-sm font-medium text-secondary-700 mb-1.5', labelClassName)}>
          {label}
          {required && <span className="text-3ons-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          ref={ref}
          type={inputType}
          className={cn(baseStyles)}
          disabled={disabled}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        )}
        {RightIcon && !isPassword && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400">
            <RightIcon className="w-5 h-5" />
          </div>
        )}
      </div>
      {error && (
        <div className="mt-1.5 flex items-center text-sm text-error-600">
          <AlertCircle className="w-4 h-4 mr-1.5" />
          {error}
        </div>
      )}
      {helper && !error && (
        <p className="mt-1.5 text-sm text-secondary-500">{helper}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
