// Design System Components
export { Button, IconButton, LoadingButton } from "./Button"
export { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter,
  GlassCard,
  GradientCard 
} from "./Card"
export { AppShell, PageHeader } from "./AppShell"

// Design System Utilities
export const tokens = {
  colors: {
    gray: {
      50: 'var(--gray-50)',
      100: 'var(--gray-100)',
      200: 'var(--gray-200)',
      300: 'var(--gray-300)',
      500: 'var(--gray-500)',
      700: 'var(--gray-700)',
      900: 'var(--gray-900)',
    },
    blue: {
      500: 'var(--blue-500)',
      600: 'var(--blue-600)',
      700: 'var(--blue-700)',
    },
    status: {
      success: 'var(--green-500)',
      warning: 'var(--yellow-500)',
      error: 'var(--red-500)',
    }
  },
  spacing: {
    radius: 'var(--radius)',
  },
  shadows: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
  },
  gradients: {
    primary: 'var(--gradient-primary)',
    glass: 'var(--gradient-glass)',
  }
}
