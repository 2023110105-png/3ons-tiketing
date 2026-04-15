/**
 * 3ONS Card Component
 * Clean card design with subtle shadows
 */
import { forwardRef } from 'react'
import { cn } from '../../lib/ui'

const Card = forwardRef(({
  children,
  className = '',
  padding = 'md',
  shadow = 'md',
  hover = false,
  bordered = false,
  ...props
}, ref) => {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  }

  const shadowStyles = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  }

  return (
    <div
      ref={ref}
      className={cn(
        'bg-white rounded-xl',
        paddingStyles[padding],
        shadowStyles[shadow],
        hover && 'hover:shadow-lg transition-shadow duration-200',
        bordered && 'border border-secondary-200',
        className
      )}
      {...props}>
      {children}
    </div>
  )
})

Card.displayName = 'Card'

// Card Header subcomponent
export const CardHeader = ({ children, className, actions }) => (
  <div className={cn('flex items-center justify-between mb-4', className)}>
    <div className="flex-1">{children}</div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
)

// Card Title subcomponent
export const CardTitle = ({ children, className }) => (
  <h3 className={cn('text-lg font-semibold text-secondary-900', className)}>
    {children}
  </h3>
)

// Card Content subcomponent
export const CardContent = ({ children, className }) => (
  <div className={cn(className)}>{children}</div>
)

// Card Footer subcomponent
export const CardFooter = ({ children, className }) => (
  <div className={cn('mt-4 pt-4 border-t border-secondary-100', className)}>
    {children}
  </div>
)

export default Card
