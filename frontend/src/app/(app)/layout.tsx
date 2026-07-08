import AppShell from '@/components/layout/AppShell'
import SessionBootstrap from '@/components/SessionBootstrap'

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SessionBootstrap />
      <AppShell>{children}</AppShell>
    </>
  )
}
