import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cx } from '@/lib/cx'

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  value: ReactNode
  label: string
  /** Optional supporting lines below the label (Insights comparison cards). */
  children?: ReactNode
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  function StatCard({ value, label, children, className, style, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cx('rounded-lg bg-card-bg-inset', className)}
        style={{ padding: 12, ...style }}
        {...rest}
      >
        <div
          className="text-text-primary"
          style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.2 }}
        >
          {value}
        </div>
        <div
          className="text-text-secondary"
          style={{ fontSize: 11, fontWeight: 400, lineHeight: 1.4, marginTop: 4 }}
        >
          {label}
        </div>
        {children != null && children !== false && (
          <div style={{ marginTop: 6 }}>{children}</div>
        )}
      </div>
    )
  },
)
