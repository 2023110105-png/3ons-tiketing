/**
 * 3ONS UI Utilities
 * Helper functions for UI components
 */
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes with conflict resolution
 * @param {...string} inputs - Class names to merge
 * @returns {string} - Merged class names
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Format date for display (Indonesian locale)
 * @param {string|Date} date - Date to format
 * @param {object} options - Format options
 * @returns {string} - Formatted date
 */
export function formatDate(date, options = {}) {
  if (!date) return ''
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(new Date(date))
}

/**
 * Format date with time
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date with time
 */
export function formatDateTime(date) {
  if (!date) return ''
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

/**
 * Format number with thousand separator
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return ''
  return new Intl.NumberFormat('id-ID').format(num)
}

/**
 * Format percentage
 * @param {number} value - Value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} - Formatted percentage
 */
export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined) return ''
  return `${value.toFixed(decimals)}%`
}

/**
 * Format currency (IDR)
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return ''
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Generate unique ID
 * @param {string} prefix - ID prefix
 * @returns {string} - Unique ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Get status color based on status value
 * @param {string} status - Status value
 * @returns {string} - Color variant
 */
export function getStatusColor(status) {
  const statusMap = {
    active: 'success',
    inactive: 'secondary',
    pending: 'warning',
    error: 'error',
    success: 'success',
    checked_in: 'success',
    not_checked_in: 'secondary',
    front: 'info',
    back: 'info',
  }
  return statusMap[status] || 'default'
}

/**
 * Check if device is mobile
 * @returns {boolean} - True if mobile
 */
export function isMobile() {
  return window.innerWidth < 768
}

/**
 * Check if device is tablet
 * @returns {boolean} - True if tablet
 */
export function isTablet() {
  return window.innerWidth >= 768 && window.innerWidth < 1024
}
