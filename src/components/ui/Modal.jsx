/**
 * 3ONS Modal Component
 * Overlay dialogs with CSS animations
 */
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/ui'

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
}) => {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'bg-white rounded-xl shadow-2xl w-full pointer-events-auto animate-scale-in',
            sizeStyles[size]
          )}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between p-4 border-b border-secondary-200">
              <h3 className="text-lg font-semibold text-secondary-900">{title}</h3>
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-1 rounded-full hover:bg-secondary-100 transition-colors"
                >
                  <X className="w-5 h-5 text-secondary-500" />
                </button>
              )}
            </div>
          )}
          
          {/* Content */}
          <div className={cn('p-4', !title && showCloseButton && 'pt-6 relative')}>
            {!title && showCloseButton && (
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-secondary-100 transition-colors"
              >
                <X className="w-5 h-5 text-secondary-500" />
              </button>
            )}
            {children}
          </div>
        </div>
      </div>
    </>
  )
}

export default Modal
