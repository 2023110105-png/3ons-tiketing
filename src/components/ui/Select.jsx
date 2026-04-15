/**
 * 3ONS Select Component
 * Dropdown select with search
 */
import { forwardRef, useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Search } from 'lucide-react'
import { cn } from '../../lib/ui'

const Select = forwardRef(({
  label,
  placeholder = 'Select option...',
  options = [],
  value,
  onChange,
  error,
  helper,
  searchable = false,
  clearable = false,
  disabled = false,
  fullWidth = false,
  className,
  ...props
}, ref) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(opt => opt.value === value)
  
  const filteredOptions = searchable
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options

  const handleSelect = (optionValue) => {
    onChange?.(optionValue)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange?.('')
  }

  return (
    <div className={cn(fullWidth && 'w-full')} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-secondary-700 mb-1.5">
          {label}
        </label>
      )}
      
      {/* Trigger */}
      <div
        ref={ref}
        className={cn(
          'relative bg-white border border-secondary-300 rounded-lg',
          'px-4 py-2.5 cursor-pointer',
          'transition-all duration-200',
          'hover:border-secondary-400',
          isOpen && 'border-3ons-500 ring-2 ring-3ons-500',
          error && 'border-error-500',
          disabled && 'bg-secondary-100 cursor-not-allowed opacity-50',
          className
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        {...props}
      >
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-sm',
            selectedOption ? 'text-secondary-900' : 'text-secondary-400'
          )}>
            {selectedOption?.label || placeholder}
          </span>
          
          <div className="flex items-center gap-1">
            {clearable && selectedOption && (
              <button
                onClick={handleClear}
                className="p-0.5 rounded-full hover:bg-secondary-100"
              >
                <X className="w-4 h-4 text-secondary-400" />
              </button>
            )}
            <ChevronDown className={cn(
              'w-5 h-5 text-secondary-400 transition-transform',
              isOpen && 'rotate-180'
            )} />
          </div>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-secondary-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {/* Search */}
          {searchable && (
            <div className="p-2 border-b border-secondary-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-3ons-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
          
          {/* Options */}
          <div className="py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-2 text-sm text-secondary-500 text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm',
                    'hover:bg-secondary-50 transition-colors',
                    value === option.value && 'bg-3ons-50 text-3ons-700 font-medium'
                  )}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Error / Helper */}
      {error && (
        <p className="mt-1.5 text-sm text-error-600">{error}</p>
      )}
      {helper && !error && (
        <p className="mt-1.5 text-sm text-secondary-500">{helper}</p>
      )}
    </div>
  )
})

Select.displayName = 'Select'
export default Select
