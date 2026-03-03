import { DashboardLayout } from "@/components/dashboard-layout"

interface DashboardGroupProps {
  children: React.ReactNode
}

export default function DashboardRouteLayout({ children }: DashboardGroupProps) {
  return <DashboardLayout>{children}</DashboardLayout>
}
