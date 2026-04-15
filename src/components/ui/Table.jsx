/**
 * 3ONS Table Component
 * Data tables with sorting and selection
 */
import { forwardRef } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/ui'

const Table = forwardRef(({ children, className, ...props }, ref) => (
  <div className="overflow-x-auto">
    <table
      ref={ref}
      className={cn('w-full text-left border-collapse', className)}
      {...props}
    >
      {children}
    </table>
  </div>
))

Table.displayName = 'Table'

export const TableHeader = forwardRef(({ children, className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('bg-secondary-50 border-b border-secondary-200', className)}
    {...props}
  >
    {children}
  </thead>
))

TableHeader.displayName = 'TableHeader'

export const TableBody = forwardRef(({ children, className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('divide-y divide-secondary-200', className)}
    {...props}
  >
    {children}
  </tbody>
))

TableBody.displayName = 'TableBody'

export const TableRow = forwardRef(({ children, className, selected, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'hover:bg-secondary-50 transition-colors',
      selected && 'bg-3ons-50 hover:bg-3ons-100',
      className
    )}
    {...props}
  >
    {children}
  </tr>
))

TableRow.displayName = 'TableRow'

export const TableHead = forwardRef(({ 
  children, 
  className, 
  sortable, 
  sortDirection,
  onSort,
  ...props 
}, ref) => (
  <th
    ref={ref}
    className={cn(
      'px-4 py-3 text-sm font-semibold text-secondary-700',
      sortable && 'cursor-pointer select-none hover:text-secondary-900',
      className
    )}
    onClick={sortable ? onSort : undefined}
    {...props}
  >
    <div className="flex items-center gap-1">
      {children}
      {sortable && (
        <span className="flex flex-col">
          <ChevronUp className={cn(
            'w-3 h-3 -mb-1',
            sortDirection === 'asc' ? 'text-3ons-500' : 'text-secondary-300'
          )} />
          <ChevronDown className={cn(
            'w-3 h-3 -mt-1',
            sortDirection === 'desc' ? 'text-3ons-500' : 'text-secondary-300'
          )} />
        </span>
      )}
    </div>
  </th>
))

TableHead.displayName = 'TableHead'

export const TableCell = forwardRef(({ children, className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-4 py-3 text-sm text-secondary-700', className)}
    {...props}
  >
    {children}
  </td>
))

TableCell.displayName = 'TableCell'

export const TableEmpty = ({ colSpan, message = 'No data available' }) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-8 text-center text-secondary-500">
      {message}
    </td>
  </tr>
)

export default Table
