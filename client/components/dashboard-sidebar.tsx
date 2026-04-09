"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useSettings } from "@/lib/settings-context"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Settings,
  Plus,
  Menu,
  ChevronLeft,
  ChevronRight,
  Code2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { isSchoolBuild } from "@/lib/school-build"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles?: string[] // If empty, shown to all
}

interface DashboardSidebarProps {
  isCollapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

export function DashboardSidebar({ isCollapsed, onCollapsedChange }: DashboardSidebarProps) {
  const { user } = useAuth()
  const { settings, isSubmitterRole, getRoleLabel } = useSettings()
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  if (!user) return null

  const isSubmitter = isSubmitterRole(user.role)
  // Match settings page: only the highest role level in tenant config (e.g. registrar), not every level ≥ 2
  const maxRoleLevel = Math.max(0, ...(settings?.rolesConfig?.map((r) => Number(r.level)) ?? []))
  const canAccessOrgSettings =
    !isSubmitter &&
    Boolean(
      user &&
        settings?.rolesConfig?.some(
          (r) => r.key === user.role && Number(r.level) === maxRoleLevel
        )
    )

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: isSubmitter ? "/dashboard" : "/admin",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    ...(isSubmitter
      ? [
          {
            label: "New Ticket",
            href: "/ticket/new",
            icon: <Plus className="h-5 w-5" />,
          },
        ]
      : []),
    ...(!isSubmitter
      ? [
          {
            label: "Analytics",
            href: "/analytics",
            icon: <BarChart3 className="h-5 w-5" />,
          },
        ]
      : []),
    ...(canAccessOrgSettings && !isSchoolBuild()
      ? [
          {
            label: "Settings",
            href: "/settings",
            icon: <Settings className="h-5 w-5" />,
          },
          {
            label: "Developer",
            href: "/settings/developer",
            icon: <Code2 className="h-5 w-5" />,
          },
        ]
      : []),
  ]

  const isActive = (href: string) => {
    if (href === "/dashboard" || href === "/admin") {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5",
        isCollapsed && !isMobile && "justify-center px-2"
      )}>
        <div className="flex-shrink-0">
          <Image
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            className="w-8 h-8 rounded-md object-contain"
          />
        </div>
        {(!isCollapsed || isMobile) && (
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {settings.organizationName}
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              {getRoleLabel(user.role)}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => isMobile && setIsMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive(item.href)
                  ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:shadow-sm",
                isCollapsed && !isMobile && "justify-center px-2"
              )}
            >
              {item.icon}
              {(!isCollapsed || isMobile) && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>
      </ScrollArea>

      {/* Collapse Toggle (desktop only) */}
      {!isMobile && (
        <div className="border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCollapsedChange(!isCollapsed)}
            className="w-full justify-center"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile trigger — placed in header area */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 shadow-md bg-background">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SidebarContent isMobile />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-40 bg-background/80 backdrop-blur-xl border-r border-border/50 shadow-[1px_0_10px_rgba(0,0,0,0.02)] transition-all duration-300",
          isCollapsed ? "lg:w-[70px]" : "lg:w-64"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
