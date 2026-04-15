# 🎨 3ONS UI/UX Architecture v2.0.0

> **Project**: 3ONS Ticketing  
> **Version**: 2.0.0 - Multi-Tenant SaaS  
> **Brand**: Red (#ef4444) - Energy, Speed, Action  
> **Status**: Development Phase

---

## 🏗️ UI Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           3ONS UI/UX ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    DESIGN SYSTEM (Foundation)                        │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │   │
│  │  │   Colors     │ │ Typography   │ │   Spacing    │               │   │
│  │  │  3ONS Red    │ │   Inter      │ │  8px Grid    │               │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘               │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │   │
│  │  │  Shadows     │ │ Animations   │ │  Icons       │               │   │
│  │  │ Brand Glow   │ │ Framer       │ │ Lucide       │               │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    COMPONENT LIBRARY (Atoms)                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │  │ Button   │ │  Input   │ │  Card    │ │  Badge   │ │  Alert   │ │   │
│  │  │ 6 var    │ │ 5 sizes  │ │ Hover    │ │ 7 var    │ │ 4 types  │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │  │  Toast   │ │  Modal   │ │  Table   │ │ Select   │ │ Checkbox │ │   │
│  │  │ Auto     │ │ Overlay  │ │ Sortable │ │ Search   │ │ Toggle   │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PAGE ARCHITECTURE (Templates)                   │   │
│  │                                                                    │   │
│  │  ┌──────────────────────────────────────────────────────────┐    │   │
│  │  │  🔐 LOGIN PAGE (Auth Entry)                              │    │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐       │    │   │
│  │  │  │ Brand Logo │  │ Login Form │  │ Version    │       │    │   │
│  │  │  │ 3ONS Red   │  │ User/Pass  │  │ v2.0.0     │       │    │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘       │    │   │
│  │  └──────────────────────────────────────────────────────────┘    │   │
│  │                                                                    │   │
│  │  ┌──────────────────────────────────────────────────────────┐    │   │
│  │  │  🎛️ SYSTEM ADMIN PANEL (/admin-panel)                    │    │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐       │    │   │
│  │  │  │ Overview   │  │ Tenants    │  │ Gate Users │       │    │   │
│  │  │  │ Dashboard  │  │ Management │  │ Management │       │    │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘       │    │   │
│  │  │  ┌────────────┐  ┌────────────┐                       │    │   │
│  │  │  │ Audit Log  │  │ Settings   │                       │    │   │
│  │  │  └────────────┘  └────────────┘                       │    │   │
│  │  └──────────────────────────────────────────────────────────┘    │   │
│  │                                                                    │   │
│  │  ┌──────────────────────────────────────────────────────────┐    │   │
│  │  │  🏢 TENANT ADMIN (/admin-tenant)                        │    │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐       │    │   │
│  │  │  │ Dashboard  │  │Participants│  │ Settings   │       │    │   │
│  │  │  │ Stats      │  │ QR/Barcode │  │ Event      │       │    │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘       │    │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐       │    │   │
│  │  │  │ Ops        │  │ Reports    │  │ Analytics  │       │    │   │
│  │  │  │ Monitor    │  │ Export     │  │ Charts     │       │    │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘       │    │   │
│  │  └──────────────────────────────────────────────────────────┘    │   │
│  │                                                                    │   │
│  │  ┌──────────────────────────────────────────────────────────┐    │   │
│  │  │  📱 GATE INTERFACE (/gate)                              │    │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐       │    │   │
│  │  │  │ QR Scanner │  │ Result     │  │ Stats      │       │    │   │
│  │  │  │ Camera     │  │ Overlay    │  │ Today      │       │    │   │
│  │  │  │ Viewfinder │  │ Success    │  │ Live       │       │    │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘       │    │   │
│  │  └──────────────────────────────────────────────────────────┘    │   │
│  │                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    LAYOUT SYSTEM                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  HEADER (Fixed)                                             │   │   │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │   │   │
│  │  │  │ Logo   │ │ Title  │ │ Badge  │ │ User   │            │   │   │
│  │  │  │ 3ONS   │ │ Page   │ │ Live   │ │ Menu   │            │   │   │
│  │  │  └────────┘ └────────┘ └────────┘ └────────┘            │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  SIDEBAR (Collapsible on mobile)                            │   │   │
│  │  │  ┌────────┐                                               │   │   │
│  │  │  │ Nav    │                                               │   │   │
│  │  │  │ Items  │                                               │   │   │
│  │  │  │ Role   │                                               │   │   │
│  │  │  │ Based  │                                               │   │   │
│  │  │  └────────┘                                               │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  MAIN CONTENT                                             │   │   │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐                        │   │   │
│  │  │  │ Cards  │ │ Tables │ │ Charts │                        │   │   │
│  │  │  └────────┘ └────────┘ └────────┘                        │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 UI Component Hierarchy

```
components/
├── ui/                          # Atomic components
│   ├── Button.jsx              # 6 variants, 5 sizes
│   ├── Input.jsx               # Label, error, helper, icons
│   ├── Card.jsx                # Header, content, footer
│   ├── Badge.jsx               # 7 variants, dot, pulse
│   ├── Alert.jsx               # 4 types, dismissible
│   ├── Toast.jsx               # Auto-dismiss, positions
│   ├── Modal.jsx               # Overlay, animations
│   ├── Table.jsx               # Sortable, filterable
│   ├── Select.jsx              # Searchable, clearable
│   ├── Checkbox.jsx            # Indeterminate
│   └── Radio.jsx               # Group, layout options
│
├── layout/                      # Layout components
│   ├── Layout.jsx              # Main app layout
│   ├── Header.jsx              # Top navigation
│   ├── Sidebar.jsx             # Side navigation
│   ├── Footer.jsx              # Bottom bar
│   └── Container.jsx           # Content wrapper
│
├── features/                    # Feature-specific
│   ├── ParticipantCard.jsx     # Participant display
│   ├── QRScanner.jsx           # QR scanning interface
│   ├── StatCard.jsx            # Dashboard stats
│   ├── ChartWidget.jsx         # Data visualization
│   └── EventStatus.jsx         # Event status indicator
│
└── index.js                     # Barrel exports
```

---

## 🎨 Design Tokens (3ONS Brand)

### Color System
```css
/* Primary - 3ONS Red */
--color-3ons-50: #fef2f2;
--color-3ons-100: #fee2e2;
--color-3ons-500: #ef4444;    /* Brand primary */
--color-3ons-600: #dc2626;    /* Hover */
--color-3ons-700: #b91c1c;    /* Active */

/* Secondary - Slate */
--color-secondary-50: #f8fafc;   /* Background */
--color-secondary-100: #f1f5f9; /* Card bg */
--color-secondary-700: #334155; /* Text */
--color-secondary-900: #0f172a;   /* Headings */

/* Status */
--color-success: #22c55e;   /* Check-in OK */
--color-warning: #f59e0b;   /* Pending */
--color-error: #ef4444;     /* Error */
--color-info: #3b82f6;      /* Info */

/* Gate Specific */
--color-gate-front: #0ea5e9;  /* Blue */
--color-gate-back: #8b5cf6;   /* Purple */
```

### Typography Scale
```css
/* Font */
--font-sans: 'Inter', system-ui, sans-serif;

/* Sizes */
--text-display: 2.5rem (40px)     /* Page titles */
--text-title: 1.5rem (24px)       /* Section headers */
--text-subtitle: 1.125rem (18px)  /* Sub-headings */
--text-body: 1rem (16px)          /* Body text */
--text-caption: 0.875rem (14px)   /* Labels */
--text-small: 0.75rem (12px)      /* Fine print */
```

### Spacing Scale
```css
/* 8px base grid */
--space-1: 0.25rem (4px)
--space-2: 0.5rem (8px)
--space-3: 0.75rem (12px)
--space-4: 1rem (16px)      /* Default */
--space-6: 1.5rem (24px)
--space-8: 2rem (32px)
--space-12: 3rem (48px)
```

### Shadow System
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
--shadow-3ons: 0 4px 14px rgba(239,68,68,0.25);  /* Brand glow */
```

---

## 🔄 UI State Management

### Loading States
```
┌─────────────────────────────────────────┐
│           LOADING PATTERNS              │
├─────────────────────────────────────────┤
│                                         │
│  Skeleton Loaders                        │
│  ┌─────────────────────────────────────┐ │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│  └─────────────────────────────────────┘ │
│  Usage: Tables, Cards, Content           │
│                                         │
│  Spinner Loaders                         │
│  ┌─────────────────────────────────────┐ │
│  │            ╭──────╮                 │ │
│  │            │  ↻   │                 │ │
│  │            ╰──────╯                 │ │
│  │         Loading...                  │ │
│  └─────────────────────────────────────┘ │
│  Usage: Buttons, Forms, Actions        │
│                                         │
│  Progress Loaders                        │
│  ┌─────────────────────────────────────┐ │
│  │ ████████████░░░░░░░░  60%         │ │
│  └─────────────────────────────────────┘ │
│  Usage: Uploads, Imports, Exports      │
│                                         │
└─────────────────────────────────────────┘
```

### Feedback States
```
┌─────────────────────────────────────────┐
│          FEEDBACK PATTERNS              │
├─────────────────────────────────────────┤
│                                         │
│  Toast Notifications (Auto-dismiss)      │
│  ┌──────────────────────────────────┐   │
│  │ ✅ Success! Saved successfully   │   │
│  └──────────────────────────────────┘   │
│                                         │
│  Alert Banners (Persistent)              │
│  ┌──────────────────────────────────┐   │
│  │ ⚠️ Warning: Check your input    │   │
│  └──────────────────────────────────┘   │
│                                         │
│  Inline Validation                       │
│  ┌──────────────────────────────────┐   │
│  │ Username                         │   │
│  │ ┌──────────────────────────────┐ │   │
│  │ │ johndoe                      │ │   │
│  │ └──────────────────────────────┘ │   │
│  │ ❌ Username is required         │   │
│  └──────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📱 Responsive Breakpoints

```
┌──────────────────────────────────────────────────────────────┐
│                    RESPONSIVE STRATEGY                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Mobile First Approach                                       │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  sm: 640px+    │  Tablet portrait, large phones       │ │
│  │  md: 768px+    │  Tablet landscape, small laptops     │ │
│  │  lg: 1024px+   │  Desktops, large tablets              │ │
│  │  xl: 1280px+   │  Large desktops                       │ │
│  │  2xl: 1536px+  │  Extra large screens                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Page-Specific Breakpoints                                   │
│                                                              │
│  ┌───────────────┬───────────────┬───────────────────────┐  │
│  │  Page         │  Primary      │  Secondary           │  │
│  ├───────────────┼───────────────┼───────────────────────┤  │
│  │  Login        │  All sizes    │  -                   │  │
│  │  Dashboard    │  lg+          │  md (tablet)         │  │
│  │  Gate         │  md+          │  sm (tablet portrait)│  │
│  │  Tables       │  lg+          │  md (scrollable)     │  │
│  └───────────────┴───────────────┴───────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎬 Animation System

### Transitions
```css
/* Standard transitions */
--transition-fast: 150ms ease-out;
--transition-normal: 200ms ease-out;
--transition-slow: 300ms ease-out;

/* Custom easings */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-expo: cubic-bezier(0.7, 0, 0.84, 0);
```

### Animations
```
┌─────────────────────────────────────────┐
│           ANIMATION CATALOG             │
├─────────────────────────────────────────┤
│                                         │
│  fade-in         │  Opacity 0 → 1       │
│  fade-out        │  Opacity 1 → 0       │
│  slide-up        │  Y +20px → 0         │
│  slide-down      │  Y -20px → 0         │
│  scale-in        │  Scale 0.9 → 1        │
│  bounce-soft     │  Subtle bounce       │
│  pulse           │  Opacity pulse       │
│  spin            │  360° rotation       │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🧩 Component API Standards

### Button API
```jsx
<Button
  variant="primary|secondary|outline|ghost|danger|success"
  size="xs|sm|md|lg|xl"
  loading={boolean}
  disabled={boolean}
  fullWidth={boolean}
  leftIcon={IconComponent}
  rightIcon={IconComponent}
  onClick={function}
>
  Button Text
</Button>
```

### Input API
```jsx
<Input
  type="text|password|email|number|tel"
  label={string}
  placeholder={string}
  value={string}
  onChange={function}
  error={string}
  helper={string}
  icon={IconComponent}
  rightIcon={IconComponent}
  size="sm|md|lg"
  fullWidth={boolean}
  required={boolean}
  disabled={boolean}
/>
```

### Card API
```jsx
<Card
  padding="none|sm|md|lg|xl"
  shadow="none|sm|md|lg|xl"
  hover={boolean}
  bordered={boolean}
>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardActions>
      <Button>Action</Button>
    </CardActions>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

---

## 📊 Development Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Setup Tailwind config with 3ONS colors
- [ ] Install Framer Motion, Lucide icons
- [ ] Build Button component (all variants)
- [ ] Build Input component
- [ ] Build Card component

### Phase 2: Core Components (Week 2)
- [ ] Build Badge, Alert, Toast
- [ ] Build Modal, Select, Checkbox
- [ ] Build Table component
- [ ] Create layout components

### Phase 3: Page Implementation (Week 3)
- [ ] Redesign Login page
- [ ] Redesign Gate interface
- [ ] Build Dashboard components
- [ ] Build Participant management

### Phase 4: Polish & QA (Week 4)
- [ ] Animations and transitions
- [ ] Responsive testing
- [ ] Accessibility audit
- [ ] Performance optimization

---

## 🎯 Success Metrics

| Metric | Target |
|--------|--------|
| Lighthouse Performance | > 90 |
| Lighthouse Accessibility | > 95 |
| Time to Interactive | < 3s |
| First Contentful Paint | < 1.5s |
| Button Click Response | < 100ms |
| Modal Open Animation | < 200ms |
| Page Transition | < 300ms |

---

**Last Updated**: April 2026  
**Version**: 2.0.0  
**Maintainer**: 3ONS Development Team

---

*This architecture ensures consistent, scalable, and beautiful UI across all 3ONS Ticketing interfaces.*
