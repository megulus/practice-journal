import AppShell from '@/components/layout/AppShell'

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
