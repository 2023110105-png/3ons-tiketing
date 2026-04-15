/**
 * 3ONS Alert Component
 * Alert messages with brand styling
 */
import { forwardRef } from 'react'
import { CheckCircle, AlertCircle, Info, XCircle, X } from 'lucide-react'
import { cn } from '../../lib/ui'

const variantStyles = {
  success: {
    wrapper: 'bg-success-50 border-success-200',
    icon: 'text-success-500',
    title: 'text-success-800',
    message: 'text-success-700',
    Icon: CheckCircle,
  },
  error: {
    wrapper: 'bg-error-50 border-error-200',
    icon: 'text-error-500',
    title: 'text-error-800',
    message: 'text-error-700',
    Icon: XCircle,
  },
  warning: {
    wrapper: 'bg-warning-50 border-warning-200',
    icon: 'text-warning-500',
    title: 'text-warning-800',
    message: 'text-warning-700',
    Icon: AlertCircle,
  },
  info: {
    wrapper: 'bg-info-50 border-info-200',
    icon: 'text-info-500',
    title: 'text-info-800',
    message: 'text-info-700',
    Icon: Info,
  },
}

const Alert = forwardRef(({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className,
  ...props
}, ref) => {
  const { wrapper, icon, title: titleColor, message: messageColor, Icon } = variantStyles[variant]

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border',
        wrapper,
        className
      )}
      role="alert"
      {...props}
    >
      <div className={cn('flex-shrink-0', icon)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className={cn('text-sm font-semibold', titleColor)}>
            {title}
          </h4>
        )}
        {children && (
          <div className={cn('mt-1 text-sm', messageColor)}>
            {children}
          </div>
        )}
      </div>
      {dismissible && (
        <button
          onClick={onDismiss}
          className={cn(
            'flex-shrink-0 -mr-1 -mt-1 p-1 rounded-full',
            'hover:bg-black/5 transition-colors',
            icon
          )}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
})

Alert.displayName = 'Alert'

export default Alert
