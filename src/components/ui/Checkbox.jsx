/**
 * 3ONS Checkbox Component
 * Checkbox with label and indeterminate state
 */
import { forwardRef } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '../../lib/ui'

const Checkbox = forwardRef(({
  label,
  indeterminate = false,
  error,
  helper,
  className,
  ...props
}, ref) => {
  // Handle indeterminate state via ref
  const handleRef = (element) => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(element)
      } else {
        ref.current = element
      }
    }
    if (element) {
      element.indeterminate = indeterminate
    }
  }

  return (
    <div className={className}>
      <label className="flex items-start gap-3 cursor-pointer">
        <div className="relative flex items-center">
          <input
            type="checkbox"
            ref={handleRef}
            className="peer sr-only"
            {...props}
          />
          <div className={cn(
            'w-5 h-5 rounded border-2 transition-all duration-200',
            'border-secondary-300 bg-white',
            'peer-checked:bg-3ons-500 peer-checked:border-3ons-500',
            'peer-indeterminate:bg-3ons-500 peer-indeterminate:border-3ons-500',
            'peer-focus:ring-2 peer-focus:ring-3ons-500 peer-focus:ring-offset-2',
            'peer-disabled:opacity-50 peer-disabled:cursor-not-allowed',
            error && 'border-error-500'
          )}>
            {/* Check Icon */}
            <Check className={cn(
              'w-3 h-3 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'opacity-0 transition-opacity',
              'peer-checked:opacity-100'
            )} />
            {/* Indeterminate Icon */}
            <Minus className={cn(
              'w-3 h-3 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'opacity-0 transition-opacity',
              'peer-indeterminate:opacity-100'
            )} />
          </div>
        </div>
        
        {label && (
          <div className="flex-1">
            <span className={cn(
              'text-sm text-secondary-700',
              props.disabled && 'opacity-50'
            )}>
              {label}
            </span>
            {helper && !error && (
              <p className="mt-0.5 text-xs text-secondary-500">{helper}</p>
            )}
            {error && (
              <p className="mt-0.5 text-xs text-error-600">{error}</p>
            )}
          </div>
        )}
      </label>
    </div>
  )
})

Checkbox.displayName = 'Checkbox'
export default Checkbox
