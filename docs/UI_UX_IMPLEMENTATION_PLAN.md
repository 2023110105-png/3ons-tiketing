# 🚀 3ONS UI/UX Implementation Plan - Step by Step

> **Project**: 3ONS Ticketing v2.0.0  
> **Goal**: Structured UI/UX Development  
> **Timeline**: 4 Weeks

---

## 📋 Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION ROADMAP                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1        Phase 2         Phase 3         Phase 4        │
│  Foundation     Core            Pages           Polish         │
│  ┌─────┐       ┌─────┐         ┌─────┐         ┌─────┐        │
│  │WEEK │       │WEEK│         │WEEK│         │WEEK│        │
│  │  1  │       │ 2  │         │ 3  │         │ 4  │        │
│  └──┬──┘       └──┬──┘         └──┬──┘         └──┬──┘        │
│     │             │               │               │           │
│     ▼             ▼               ▼               ▼           │
│  ┌────────┐   ┌────────┐     ┌────────┐     ┌────────┐       │
│  │Tailwind│   │Badge   │     │Login   │     │Animation│       │
│  │Config  │   │Alert   │     │Gate    │     │A11y    │       │
│  │Button  │   │Toast   │     │Dashboard│    │Perf    │       │
│  │Input   │   │Modal   │     │Participant│   │QA      │       │
│  │Card    │   │Table   │     │         │     │        │       │
│  └────────┘   └────────┘     └────────┘     └────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1: FOUNDATION (Week 1)

### Day 1-2: Setup & Configuration

#### 1.1 Install Dependencies
```bash
# Core dependencies
npm install framer-motion lucide-react clsx tailwind-merge

# Chart library (for dashboard)
npm install chart.js react-chartjs-2

# Date formatting
npm install date-fns

# Form validation (optional)
npm install zod react-hook-form @hookform/resolvers
```

#### 1.2 Tailwind Configuration
**File**: `tailwind.config.js`

```javascript
import forms from '@tailwindcss/forms'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 3ONS BRAND COLORS
      colors: {
        '3ons': {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',    // PRIMARY
          600: '#dc2626',    // HOVER
          700: '#b91c1c',    // ACTIVE
          800: '#991b1b',
          900: '#7f1d1d',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        gate: {
          front: '#0ea5e9',
          back: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-soft': 'bounceSoft 0.5s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [forms],
}
```

#### 1.3 Utility Functions
**File**: `src/lib/ui.js`

```javascript
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind classes with conflict resolution
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Format date for display
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
 * Format number with thousand separator
 */
export function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num)
}

/**
 * Format percentage
 */
export function formatPercent(value, decimals = 1) {
  return `${value.toFixed(decimals)}%`
}
```

---

### Day 3-4: Button Component

#### 1.4 Button Component
**File**: `src/components/ui/Button.jsx`

```jsx
import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/ui'

const variantStyles = {
  primary: 'bg-3ons-500 hover:bg-3ons-600 active:bg-3ons-700 text-white shadow-md hover:shadow-lg',
  secondary: 'bg-white hover:bg-secondary-50 text-secondary-700 border border-secondary-300 shadow-sm',
  outline: 'bg-transparent hover:bg-3ons-50 text-3ons-600 border-2 border-3ons-500',
  ghost: 'bg-transparent hover:bg-secondary-100 text-secondary-700',
  danger: 'bg-error-500 hover:bg-error-600 text-white shadow-md',
  success: 'bg-success-500 hover:bg-success-600 text-white shadow-md',
}

const sizeStyles = {
  xs: 'px-2.5 py-1.5 text-xs',
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
  xl: 'px-8 py-4 text-lg',
}

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-3ons-500 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {!loading && LeftIcon && <LeftIcon className="w-4 h-4 mr-2" />}
      {children}
      {RightIcon && <RightIcon className="w-4 h-4 ml-2" />}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
```

---

### Day 5-7: Input & Card Components

#### 1.5 Input Component
**File**: `src/components/ui/Input.jsx`

```jsx
import { forwardRef, useState } from 'react'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/ui'

const Input = forwardRef(({
  label,
  error,
  helper,
  icon: Icon,
  type = 'text',
  size = 'md',
  fullWidth = false,
  required = false,
  disabled = false,
  className,
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

  return (
    <div className={cn(fullWidth && 'w-full')}>
      {label && (
        <label className="block text-sm font-medium text-secondary-700 mb-1.5">
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
          className={cn(
            'w-full bg-white border border-secondary-300 rounded-lg',
            'text-secondary-900 placeholder:text-secondary-400',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-3ons-500 focus:border-3ons-500',
            'hover:border-secondary-400',
            'disabled:bg-secondary-100 disabled:cursor-not-allowed',
            error && 'border-error-500 focus:ring-error-500 focus:border-error-500',
            Icon && 'pl-10',
            isPassword && 'pr-10',
            sizeStyles[size],
            className
          )}
          disabled={disabled}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
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
```

#### 1.6 Card Component
**File**: `src/components/ui/Card.jsx`

```jsx
import { forwardRef } from 'react'
import { cn } from '../../lib/ui'

const Card = forwardRef(({
  children,
  className,
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
      {...props}
    >
      {children}
    </div>
  )
})

Card.displayName = 'Card'
export default Card

export const CardHeader = ({ children, className }) => (
  <div className={cn('flex items-center justify-between mb-4', className)}>
    {children}
  </div>
)

export const CardTitle = ({ children, className }) => (
  <h3 className={cn('text-lg font-semibold text-secondary-900', className)}>
    {children}
  </h3>
)

export const CardContent = ({ children, className }) => (
  <div className={className}>{children}</div>
)

export const CardFooter = ({ children, className }) => (
  <div className={cn('mt-4 pt-4 border-t border-secondary-100', className)}>
    {children}
  </div>
)
```

---

## PHASE 1 CHECKLIST ✅

| Task | Status | File |
|------|--------|------|
| Install dependencies | ⬜ | package.json |
| Configure Tailwind | ⬜ | tailwind.config.js |
| Create ui.js utilities | ⬜ | src/lib/ui.js |
| Build Button component | ⬜ | src/components/ui/Button.jsx |
| Build Input component | ⬜ | src/components/ui/Input.jsx |
| Build Card component | ⬜ | src/components/ui/Card.jsx |
| Update component exports | ⬜ | src/components/index.js |

---

## PHASE 2: CORE COMPONENTS (Week 2)

### Day 1-2: Feedback Components

#### 2.1 Badge Component
**File**: `src/components/ui/Badge.jsx`

```jsx
import { forwardRef } from 'react'
import { cn } from '../../lib/ui'

const variantStyles = {
  default: 'bg-secondary-100 text-secondary-800',
  primary: 'bg-3ons-100 text-3ons-800',
  success: 'bg-success-100 text-success-800',
  warning: 'bg-warning-100 text-warning-800',
  error: 'bg-error-100 text-error-800',
  info: 'bg-info-100 text-info-800',
}

const Badge = forwardRef(({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  pulse = false,
  className,
  ...props
}, ref) => {
  const dotColor = variantStyles[variant].match(/bg-(\w+-\d+)/)?.[1] || 'secondary-500'

  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-sm',
        size === 'lg' && 'px-3 py-1.5 text-base',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', pulse && 'animate-pulse', `bg-${dotColor}`)} />
      )}
      {children}
    </span>
  )
})

Badge.displayName = 'Badge'
export default Badge
```

#### 2.2 Alert Component
**File**: `src/components/ui/Alert.jsx`

```jsx
import { forwardRef } from 'react'
import { CheckCircle, AlertCircle, Info, XCircle, X } from 'lucide-react'
import { cn } from '../../lib/ui'

const variantConfig = {
  success: { Icon: CheckCircle, className: 'bg-success-50 border-success-200 text-success-800' },
  error: { Icon: XCircle, className: 'bg-error-50 border-error-200 text-error-800' },
  warning: { Icon: AlertCircle, className: 'bg-warning-50 border-warning-200 text-warning-800' },
  info: { Icon: Info, className: 'bg-info-50 border-info-200 text-info-800' },
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
  const { Icon, className: variantClassName } = variantConfig[variant]

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border',
        variantClassName,
        className
      )}
      role="alert"
      {...props}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        {title && <h4 className="font-semibold">{title}</h4>}
        {children && <div className="mt-1 text-sm">{children}</div>}
      </div>
      {dismissible && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 -mr-1 -mt-1 p-1 rounded-full hover:bg-black/5"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
})

Alert.displayName = 'Alert'
export default Alert
```

#### 2.3 Toast Component
**File**: `src/components/ui/Toast.jsx`

```jsx
import { useEffect } from 'react'
import { CheckCircle, AlertCircle, Info, XCircle, X } from 'lucide-react'
import { cn } from '../../lib/ui'

const variantConfig = {
  success: { Icon: CheckCircle, className: 'bg-success-50 border-success-200' },
  error: { Icon: XCircle, className: 'bg-error-50 border-error-200' },
  warning: { Icon: AlertCircle, className: 'bg-warning-50 border-warning-200' },
  info: { Icon: Info, className: 'bg-info-50 border-info-200' },
}

export const Toast = ({
  id,
  variant = 'info',
  title,
  message,
  duration = 5000,
  onClose,
}) => {
  const { Icon, className } = variantConfig[variant]

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose?.(id), duration)
      return () => clearTimeout(timer)
    }
  }, [duration, id, onClose])

  return (
    <div className={cn('w-full max-w-sm animate-slide-up', className)}>
      <div className="flex items-start gap-3 p-4 rounded-lg border shadow-lg">
        <Icon className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {title && <h4 className="font-semibold">{title}</h4>}
          {message && <p className="mt-1 text-sm">{message}</p>}
        </div>
        <button onClick={() => onClose?.(id)} className="flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default Toast
```

---

### Day 3-5: Advanced Components

#### 2.4 Modal Component
**File**: `src/components/ui/Modal.jsx`

```jsx
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/ui'
import { motion, AnimatePresence } from 'framer-motion'

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}) => {
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
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                'bg-white rounded-xl shadow-xl w-full',
                sizeStyles[size]
              )}
            >
              {title && (
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-semibold">{title}</h3>
                  {showCloseButton && (
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-secondary-100">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
              <div className="p-4">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export default Modal
```

---

## PHASE 2 CHECKLIST ✅

| Task | Status | File |
|------|--------|------|
| Badge component | ⬜ | src/components/ui/Badge.jsx |
| Alert component | ⬜ | src/components/ui/Alert.jsx |
| Toast component | ⬜ | src/components/ui/Toast.jsx |
| Modal component | ⬜ | src/components/ui/Modal.jsx |
| Table component | ⬜ | src/components/ui/Table.jsx |
| Select component | ⬜ | src/components/ui/Select.jsx |

---

## PHASE 3: PAGE REDESIGN (Week 3)

### Day 1-3: Login & Gate

#### 3.1 Login Page Redesign
**File**: `src/pages/Login.jsx`

Structure:
```
Login Page
├── Background gradient (3ONS red tint)
├── Centered Card
│   ├── 3ONS Logo (large)
│   ├── Tagline
│   ├── Role Selector (Tabs)
│   │   ├── System Admin
│   │   ├── Tenant Admin
│   │   └── Gate User
│   ├── Login Form
│   │   ├── Username Input
│   │   ├── Password Input
│   │   ├── Remember Me Checkbox
│   │   └── Submit Button
│   ├── Error Alert
│   └── Version Info
└── Footer links
```

#### 3.2 Gate Interface Redesign
**File**: `src/pages/gate/FrontGate.jsx` & `BackGate.jsx`

Structure:
```
Gate Interface
├── Header (Fixed)
│   ├── Gate Badge (Front/Back)
│   ├── Connection Status
│   └── Today's Stats
├── Main Scanner Area
│   ├── QR Scanner (Camera view)
│   ├── Overlay Frame
│   └── Scan Line Animation
├── Result Overlay
│   ├── Success (Green)
│   ├── Error (Red)
│   └── Participant Info
├── Manual Entry (Bottom)
│   └── Input for code entry
└── Recent Scans (Side/Bottom)
```

---

### Day 4-7: Admin Dashboards

#### 3.3 System Admin Dashboard
**File**: `src/pages/admin-panel/Overview.jsx`

Structure:
```
Admin Dashboard
├── Stats Cards Row
│   ├── Total Tenants
│   ├── Active Events
│   ├── Check-ins Today
│   └── System Health
├── Charts Section
│   ├── Daily Check-ins (Line Chart)
│   └── Tenant Distribution (Pie Chart)
└── Recent Activity Feed
```

#### 3.4 Tenant Admin Dashboard
**File**: `src/pages/admin-tenant/Dashboard.jsx`

Structure:
```
Tenant Dashboard
├── Event Status Banner
├── Quick Stats
│   ├── Total Participants
│   ├── Check-in Rate (Progress)
│   └── Gate Status
├── Quick Actions Grid
│   ├── Manage Participants
│   ├── Event Settings
│   └── Operations Monitor
└── Live Activity Feed
```

---

## PHASE 3 CHECKLIST ✅

| Page | Status | File |
|------|--------|------|
| Login redesign | ⬜ | src/pages/Login.jsx |
| Gate Front redesign | ⬜ | src/pages/gate/FrontGate.jsx |
| Gate Back redesign | ⬜ | src/pages/gate/BackGate.jsx |
| System Admin Dashboard | ⬜ | src/pages/admin-panel/Overview.jsx |
| Tenant Admin Dashboard | ⬜ | src/pages/admin-tenant/Dashboard.jsx |
| Participants management | ⬜ | src/pages/admin-tenant/Participants.jsx |

---

## PHASE 4: POLISH & QA (Week 4)

### Day 1-2: Animations

#### 4.1 Page Transitions
**File**: `src/components/PageTransition.jsx`

```jsx
import { motion } from 'framer-motion'

const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.div>
)

export default PageTransition
```

#### 4.2 Loading Skeletons
**File**: `src/components/ui/Skeleton.jsx`

```jsx
const Skeleton = ({ className, count = 1 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={cn('animate-pulse bg-secondary-200 rounded', className)}
      />
    ))}
  </>
)

export default Skeleton
```

---

### Day 3-4: Accessibility & Responsive

#### 4.3 Accessibility Checklist
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Color contrast WCAG AA compliant
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Screen reader tested

#### 4.4 Responsive Testing
- [ ] Mobile (320px-640px)
- [ ] Tablet (641px-1024px)
- [ ] Desktop (1025px-1440px)
- [ ] Large screens (1441px+)

---

### Day 5-7: Performance & QA

#### 4.5 Performance Optimization
- [ ] Lazy load heavy components
- [ ] Optimize images
- [ ] Code splitting routes
- [ ] Minimize bundle size

#### 4.6 QA Checklist
- [ ] All pages load correctly
- [ ] Navigation works smoothly
- [ ] Forms validate properly
- [ ] Error states display correctly
- [ ] Loading states work
- [ ] Responsive on all devices

---

## PHASE 4 CHECKLIST ✅

| Task | Status |
|------|--------|
| Page transitions | ⬜ |
| Loading skeletons | ⬜ |
| Accessibility audit | ⬜ |
| Responsive testing | ⬜ |
| Performance optimization | ⬜ |
| QA testing | ⬜ |
| Documentation update | ⬜ |

---

## 📊 Implementation Tracker

| Phase | Week | Progress | Status |
|-------|------|----------|--------|
| 1 - Foundation | Week 1 | 0/7 | 🔴 Not Started |
| 2 - Core | Week 2 | 0/6 | 🔴 Not Started |
| 3 - Pages | Week 3 | 0/6 | 🔴 Not Started |
| 4 - Polish | Week 4 | 0/7 | 🔴 Not Started |

---

## 🎯 Start Implementation

**Ready to start Phase 1?**

Run this command to begin:
```bash
npm install framer-motion lucide-react clsx tailwind-merge chart.js react-chartjs-2 date-fns
```

**Mau mulai dari mana?**
1. **Phase 1 Day 1** - Setup dependencies & Tailwind
2. **Phase 1 Day 3** - Build Button component
3. **Phase 1 complete** - All foundation components
4. **Show me all** - Complete implementation guide

---

**Last Updated**: April 2026  
**Version**: 2.0.0  
**Next**: Ready for Phase 1 implementation 🚀
