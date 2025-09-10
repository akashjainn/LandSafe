import { cn } from "@/lib/utils"
import { forwardRef, ButtonHTMLAttributes } from "react"
import { Slot } from "@radix-ui/react-slot"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive"
  size?: "sm" | "md" | "lg"
}

// Unified Button Component using Design Tokens
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    return (
      <Comp
        className={cn(
          // Base styles using design tokens
          "inline-flex items-center justify-center rounded-[var(--radius)] font-medium transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)] focus:ring-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none",
          
          // Size variants
          {
            "h-8 px-3 text-sm": size === "sm",
            "h-10 px-4 text-sm": size === "md", 
            "h-12 px-6 text-base": size === "lg",
          },
          
          // Color variants using design tokens
          {
            "bg-[var(--blue-600)] text-white hover:bg-[var(--blue-700)] shadow-[var(--shadow-sm)]": variant === "primary",
            "bg-[var(--gray-100)] text-[var(--gray-900)] hover:bg-[var(--gray-200)]": variant === "secondary",
            "border border-[var(--gray-300)] bg-white text-[var(--gray-700)] hover:bg-[var(--gray-50)]": variant === "outline",
            "hover:bg-[var(--gray-100)] text-[var(--gray-700)]": variant === "ghost",
            "bg-[var(--red-500)] text-white hover:bg-red-600 shadow-[var(--shadow-sm)]": variant === "destructive",
          },
          
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

// Icon Button Variant
const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { icon: React.ReactNode }>(
  ({ icon, className, size = "md", ...props }, ref) => (
    <Button
      ref={ref}
      className={cn(
        "aspect-square p-0",
        {
          "w-8 h-8": size === "sm",
          "w-10 h-10": size === "md",
          "w-12 h-12": size === "lg",
        },
        className
      )}
      {...props}
    >
      {icon}
    </Button>
  )
)
IconButton.displayName = "IconButton"

// Loading Button Variant
const LoadingButton = forwardRef<HTMLButtonElement, ButtonProps & { loading?: boolean }>(
  ({ loading, children, disabled, ...props }, ref) => (
    <Button
      ref={ref}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </Button>
  )
)
LoadingButton.displayName = "LoadingButton"

export { Button, IconButton, LoadingButton }
