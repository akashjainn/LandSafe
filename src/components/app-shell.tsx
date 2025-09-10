"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Menu, 
  Search, 
  Sun, 
  Settings, 
  User, 
  BarChart3, 
  Plane, 
  Upload, 
  Bell,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface AppShellProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Flights', href: '/board', icon: Plane },
  { name: 'Upload', href: '/upload', icon: Upload },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 bg-gradient-to-b from-slate-900 via-slate-800 to-blue-900 shadow-2xl transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-64",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center px-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500 flex items-center justify-center shadow-lg">
                <Plane className="h-4 w-4 text-white" />
              </div>
              {!sidebarCollapsed && (
                <>
                  <span className="text-lg font-bold text-white">LandSafe</span>
                  <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">Pro</span>
                </>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 p-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 group",
                    isActive
                      ? "bg-white/20 text-white shadow-lg backdrop-blur-sm"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 flex-shrink-0 transition-transform duration-200",
                    "group-hover:scale-110"
                  )} />
                  {!sidebarCollapsed && (
                    <span className="font-semibold">{item.name}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Collapse toggle */}
          <div className="border-t border-white/10 p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full justify-center text-blue-200 hover:text-white hover:bg-white/10 transition-all duration-200"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-600/75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-16 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-between px-4">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>

              {/* Search */}
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search flights..."
                  className="w-64 pl-9"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <Button variant="ghost" size="sm">
                <Sun className="h-4 w-4" />
              </Button>

              {/* Notifications */}
              <Button variant="ghost" size="sm">
                <Bell className="h-4 w-4" />
              </Button>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
