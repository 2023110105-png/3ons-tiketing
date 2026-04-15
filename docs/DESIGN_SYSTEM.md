# 🎨 3ONS Design System

> **Version**: 2.0.0  
> **Brand**: 3ONS Ticketing  
> **Primary Color**: Red (Passion, Energy, Action)

---

## 🎯 Brand Philosophy

**3ONS** represents:
- **Speed**: Fast check-in process
- **Reliability**: 99.9% uptime
- **Simplicity**: Easy-to-use interface

The red color symbolizes energy, urgency, and the excitement of events.

---

## 🎨 Color Palette

### Primary Colors (3ONS Red)

| Token | Hex | Usage |
|-------|-----|-------|
| `3ons-50` | `#fef2f2` | Light backgrounds |
| `3ons-100` | `#fee2e2` | Subtle highlights |
| `3ons-200` | `#fecaca` | Borders, dividers |
| `3ons-500` | `#ef4444` | **Primary brand color** |
| `3ons-600` | `#dc2626` | Hover states |
| `3ons-700` | `#b91c1c` | Active states |
| `3ons-900` | `#7f1d1d` | Text on light backgrounds |

### Neutral Colors (Secondary)

| Token | Hex | Usage |
|-------|-----|-------|
| `secondary-50` | `#f8fafc` | Page background |
| `secondary-100` | `#f1f5f9` | Card backgrounds |
| `secondary-200` | `#e2e8f0` | Borders |
| `secondary-500` | `#64748b` | Muted text |
| `secondary-700` | `#334155` | Body text |
| `secondary-900` | `#0f172a` | Headings |

### Status Colors

| Status | Color | Usage |
|--------|-------|-------|
| **Success** | `#22c55e` | Check-in successful, positive actions |
| **Warning** | `#f59e0b` | Pending, requires attention |
| **Error** | `#ef4444` | Check-in failed, errors |
| **Info** | `#3b82f6` | Informational messages |

### Gate-Specific Colors

| Gate | Color | Hex |
|------|-------|-----|
| **Front Gate** | Blue | `#0ea5e9` |
| **Back Gate** | Purple | `#8b5cf6` |

---

## 🔤 Typography

### Font Family
```css
font-family: 'Inter', system-ui, sans-serif;
```

### Type Scale

| Style | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| **Display** | 40px | 1.2 | 700 | Page titles |
| **Display-sm** | 32px | 1.2 | 700 | Section headers |
| **Title** | 24px | 1.3 | 600 | Card titles |
| **Subtitle** | 18px | 1.4 | 500 | Sub-headings |
| **Body** | 16px | 1.5 | 400 | Paragraphs |
| **Caption** | 14px | 1.4 | 400 | Labels, metadata |
| **Small** | 12px | 1.4 | 400 | Fine print |

---

## 🧩 Components

### Button

```jsx
// Primary (Default)
<Button variant="primary">Submit</Button>

// Variants
<Button variant="secondary">Cancel</Button>
<Button variant="outline">Learn More</Button>
<Button variant="ghost">Back</Button>
<Button variant="danger">Delete</Button>
<Button variant="success">Confirm</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// States
<Button loading>Loading...</Button>
<Button disabled>Disabled</Button>
<Button fullWidth>Full Width</Button>

// With icons
<Button leftIcon={PlusIcon}>Add New</Button>
<Button rightIcon={ArrowRight}>Next</Button>
```

**Button Anatomy**:
- Border radius: `8px` (rounded-lg)
- Shadow: `shadow-md` (subtle elevation)
- Focus ring: `ring-2 ring-3ons-500`
- Loading spinner: `animate-spin`

---

### Card

```jsx
// Basic card
<Card>Content here</Card>

// With padding options
<Card padding="sm">Small padding</Card>
<Card padding="lg">Large padding</Card>

// With shadow
<Card shadow="sm">Subtle shadow</Card>
<Card shadow="lg">Elevated shadow</Card>

// Hover effect
<Card hover>Hover me</Card>

// Card with sections
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>Card content...</CardContent>
  <CardFooter>Footer actions</CardFooter>
</Card>
```

**Card Anatomy**:
- Background: white
- Border radius: `12px` (rounded-xl)
- Shadow: `shadow-md`
- Padding: `16px` default (p-4)

---

### Badge

```jsx
// Variants
<Badge>Default</Badge>
<Badge variant="primary">Primary</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="error">Error</Badge>

// With dot
<Badge variant="success" dot>Live</Badge>
<Badge variant="error" dot pulse>Recording</Badge>

// Sizes
<Badge size="sm">Small</Badge>
<Badge size="lg">Large</Badge>

// Outlined
<Badge variant="outline-primary">Outlined</Badge>
```

**Badge Anatomy**:
- Border radius: full (rounded-full)
- Padding: `6px 10px` (px-2.5 py-1)
- Font size: `14px` (text-sm)
- Dot size: `6px` (w-1.5 h-1.5)

---

### Input

```jsx
// Basic input
<Input placeholder="Enter your name" />

// With label
<Input label="Username" required />

// With icon
<Input icon={SearchIcon} placeholder="Search..." />
<Input icon={MailIcon} type="email" label="Email" />

// Password with toggle
<Input type="password" label="Password" />

// Error state
<Input error="This field is required" />

// Helper text
<Input helper="We'll never share your email" />

// Sizes
<Input size="sm" placeholder="Small" />
<Input size="lg" placeholder="Large" />

// Full width
<Input fullWidth placeholder="Full width input" />
```

**Input Anatomy**:
- Border: `1px solid secondary-300`
- Border radius: `8px` (rounded-lg)
- Focus: `ring-2 ring-3ons-500`
- Error: `border-error-500`
- Icon position: left (pl-10), right (pr-10)

---

### Alert

```jsx
// Variants
<Alert variant="info">Information message</Alert>
<Alert variant="success">Operation successful!</Alert>
<Alert variant="warning">Please review your input</Alert>
<Alert variant="error">Something went wrong</Alert>

// With title
<Alert variant="success" title="Success!">
  Your changes have been saved.
</Alert>

// Dismissible
<Alert variant="info" dismissible onDismiss={handleDismiss}>
  This is a dismissible alert
</Alert>
```

**Alert Anatomy**:
- Background: variant color at 50 shade
- Border: `1px solid` at 200 shade
- Icon: `20px` (w-5 h-5)
- Padding: `16px` (p-4)
- Border radius: `8px` (rounded-lg)

---

### Toast

```jsx
// Usage with ToastContainer
<ToastContainer position="top-right">
  <Toast
    variant="success"
    title="Success!"
    message="Participant checked in"
  />
</ToastContainer>

// Different positions
<ToastContainer position="top-center" />
<ToastContainer position="bottom-right" />

// Auto-dismiss
<Toast
  variant="info"
  message="Processing..."
  duration={3000}
  onClose={handleClose}
/>
```

**Toast Anatomy**:
- Position: fixed, `16px` from edges
- Width: `384px` max (max-w-sm)
- Shadow: `shadow-lg`
- Animation: `animate-slide-up`
- Auto-dismiss: default `5000ms`

---

## 📐 Spacing System

### Spacing Scale (8px base)

| Token | Size | Usage |
|-------|------|-------|
| `0` | 0px | No space |
| `1` | 4px | Tight spacing |
| `2` | 8px | Default small |
| `3` | 12px | Compact |
| `4` | 16px | Default medium |
| `6` | 24px | Comfortable |
| `8` | 32px | Large sections |
| `10` | 40px | Major sections |
| `12` | 48px | Hero sections |

### Common Patterns

```
Page padding:      p-6 (24px)
Card padding:      p-4 (16px)
Section gap:       space-y-6 (24px)
Form field gap:    space-y-4 (16px)
Button group gap:  gap-3 (12px)
```

---

## 🎭 Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | 0 1px 2px 0 rgba(0,0,0,0.05) | Subtle elevation |
| `shadow` | 0 1px 3px 0 rgba(0,0,0,0.1) | Cards, inputs |
| `shadow-md` | 0 4px 6px -1px rgba(0,0,0,0.1) | Buttons, modals |
| `shadow-lg` | 0 10px 15px -3px rgba(0,0,0,0.1) | Dropdowns, toasts |
| `shadow-3ons` | 0 4px 14px 0 rgba(239,68,68,0.25) | Brand glow |

---

## 🎬 Animations

### Available Animations

```css
animate-fade-in      /* Opacity 0 → 1, 200ms */
animate-fade-out     /* Opacity 1 → 0, 200ms */
animate-slide-up     /* TranslateY 10px → 0, 300ms */
animate-slide-down   /* TranslateY -10px → 0, 300ms */
animate-scale-in     /* Scale 0.95 → 1, 200ms */
animate-bounce-soft  /* Subtle bounce */
animate-pulse-slow   /* Slow pulse, 3s loop */
```

### Usage

```jsx
<div className="animate-fade-in">Fade in content</div>
<Toast className="animate-slide-up" />
<Badge dot pulse>Live</Badge>
```

---

## 🎨 Usage Examples

### Login Page

```jsx
<div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
  <Card padding="lg" className="w-full max-w-md">
    <div className="text-center mb-8">
      <h1 className="text-display-sm text-3ons-600">3ONS</h1>
      <p className="text-secondary-500 mt-2">Ticketing System</p>
    </div>
    
    <form className="space-y-4">
      <Input
        label="Username"
        icon={UserIcon}
        required
      />
      <Input
        type="password"
        label="Password"
        required
      />
      <Button variant="primary" fullWidth size="lg">
        Sign In
      </Button>
    </form>
  </Card>
</div>
```

### Dashboard Card

```jsx
<Card hover>
  <CardHeader>
    <CardTitle>Today's Check-ins</CardTitle>
    <Badge variant="success" dot>Live</Badge>
  </CardHeader>
  <CardContent>
    <div className="text-4xl font-bold text-3ons-600">1,234</div>
    <p className="text-secondary-500 mt-1">+12% from yesterday</p>
  </CardContent>
</Card>
```

### Gate Interface

```jsx
<div className="min-h-screen bg-secondary-900">
  <div className="p-4 flex items-center justify-between">
    <Badge variant="primary" size="lg">Front Gate</Badge>
    <Badge variant="success" dot pulse>Live</Badge>
  </div>
  
  <Alert variant="info" className="mx-4 mb-4">
    Scan QR code to check in participant
  </Alert>
  
  <div className="flex-1 flex items-center justify-center">
    {/* Scanner component */}
  </div>
</div>
```

---

## 🎯 Best Practices

### DO ✅
- Use `3ons-500` for primary actions
- Use `success-500` for positive feedback
- Use `error-500` for errors and warnings
- Maintain consistent spacing (8px grid)
- Use `shadow-md` for interactive elements
- Add focus rings for accessibility

### DON'T ❌
- Mix primary colors (stick to red)
- Use too many shadows (max 2 levels)
- Skip error states on forms
- Use pure black (`#000000`), use `secondary-900`
- Ignore mobile touch targets (min 48x48px)

---

## 📱 Responsive Breakpoints

```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Laptop */
xl: 1280px  /* Desktop */
2xl: 1536px /* Large desktop */
```

### Common Responsive Patterns

```jsx
// Stack on mobile, side by side on desktop
<div className="flex flex-col md:flex-row gap-4">

// Full width on mobile, constrained on desktop
<Card className="w-full lg:max-w-4xl">

// Hide on mobile, show on desktop
<div className="hidden md:block">

// Adjust padding
<Card className="p-4 md:p-6 lg:p-8">
```

---

## 🎨 Iconography

### Icon Library: Lucide React

```bash
npm install lucide-react
```

### Common Icons

| Usage | Icon |
|-------|------|
| Add | `Plus` |
| Edit | `Pencil` |
| Delete | `Trash2` |
| Search | `Search` |
| User | `User` |
| Settings | `Settings` |
| Check | `Check` |
| Close | `X` |
| Alert | `AlertCircle` |
| Info | `Info` |
| Success | `CheckCircle` |
| Error | `XCircle` |
| Menu | `Menu` |
| Arrow | `ChevronRight` |

### Icon Sizes

| Context | Size |
|---------|------|
| Buttons | `16px` (w-4 h-4) |
| Form inputs | `20px` (w-5 h-5) |
| Alerts/Toasts | `20px` (w-5 h-5) |
| Empty states | `48px` (w-12 h-12) |
| Feature icons | `24px` (w-6 h-6) |

---

## 📚 Resources

### Tailwind Classes Reference

| Property | Common Classes |
|----------|----------------|
| Layout | `flex`, `grid`, `block`, `hidden` |
| Spacing | `p-4`, `m-2`, `gap-4`, `space-y-4` |
| Sizing | `w-full`, `h-screen`, `max-w-md` |
| Typography | `text-sm`, `font-bold`, `text-center` |
| Colors | `bg-3ons-500`, `text-secondary-700` |
| Borders | `border`, `rounded-lg`, `border-secondary-300` |
| Effects | `shadow-md`, `hover:shadow-lg`, `transition-all` |

---

**Last Updated**: April 2026  
**Maintained by**: 3ONS Development Team

---

*This design system ensures consistency across all 3ONS Ticketing interfaces.*
