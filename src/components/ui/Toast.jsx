/**
 * 3ONS Toast Component
 * Notification system with brand styling
 */
import { useEffect } from 'react'
import { CheckCircle, AlertCircle, Info, X, XCircle } from 'lucide-react'
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

export const Toast = ({
  id,
  variant = 'info',
  title,
  message,
  duration = 5000,
  onClose,
  position = 'top-right',
}) => {
  const { wrapper, icon, title: titleColor, message: messageColor, Icon } = variantStyles[variant]

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose?.(id)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, id, onClose])

  const positionStyles = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  }

  return (
    <div
      className={cn(
        'fixed z-50 w-full max-w-sm animate-slide-up',
        positionStyles[position]
      )}
    >
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
          wrapper
        )}
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
          {message && (
            <p className={cn('mt-1 text-sm', messageColor)}>
              {message}
            </p>
          )}
        </div>
        <button
          onClick={() => onClose?.(id)}
          className={cn(
            'flex-shrink-0 -mr-1 -mt-1 p-1 rounded-full',
            'hover:bg-black/5 transition-colors',
            icon
          )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Toast Container for managing multiple toasts
export const ToastContainer = ({ children, position = 'top-right' }) => {
  const positionStyles = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  }

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none',
        positionStyles[position]
      )}
    >
      {children}
    </div>
  )
}

export default Toast
