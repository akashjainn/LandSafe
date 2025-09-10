import { ReactNode } from "react"
import { Navbar } from "@/components/Navbar"
import { QuotaDisplay } from "@/components/quota-display"

interface AppShellProps {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
  showQuota?: boolean
}

export function AppShell({ 
  children, 
  title, 
  subtitle, 
  actions, 
  showQuota = true 
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <Navbar />
      
      {(title || actions || showQuota) && (
        <div className="bg-gradient-to-r from-[var(--blue-600)] to-[var(--blue-700)] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-between">
              <div>
                {title && (
                  <h1 className="text-3xl font-bold">{title}</h1>
                )}
                {subtitle && (
                  <p className="mt-2 text-blue-100">{subtitle}</p>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                {showQuota && <QuotaDisplay />}
                {actions}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

export function PageHeader({ 
  title, 
  subtitle, 
  actions 
}: { 
  title: string
  subtitle?: string 
  actions?: ReactNode 
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--gray-900)]">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-[var(--gray-500)]">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
