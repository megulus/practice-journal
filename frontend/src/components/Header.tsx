'use client'

import { UserButton, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export default function Header() {
  const { isSignedIn } = useUser()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Parse the pathname to create breadcrumbs
  const getBreadcrumbs = () => {
    if (!pathname || pathname === '/') return []
    
    const segments = pathname.split('/').filter(Boolean)
    const breadcrumbs: { label: string; href: string }[] = []
    
    // First segment is usually the instrument
    if (segments[0] && segments[0] !== 'sign-in' && segments[0] !== 'sign-up') {
      const instrumentName = decodeURIComponent(segments[0])
      const displayName = instrumentName.charAt(0).toUpperCase() + instrumentName.slice(1)
      breadcrumbs.push({ label: displayName, href: `/${instrumentName}` })
      
      // Second segment is the specific page (plan, log, history)
      if (segments[1]) {
        const pageLabels: { [key: string]: string } = {
          'plan': 'Practice Plan',
          'log': 'Log Practice',
          'history': 'History'
        }
        breadcrumbs.push({
          label: pageLabels[segments[1]] || segments[1],
          href: `/${instrumentName}/${segments[1]}`
        })
      }
    }
    
    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Link 
              href="/" 
              className="text-xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex-shrink-0"
              title="Practice Journal Home"
            >
              <span className="hidden sm:inline">🎼 Practice Journal</span>
              <span className="sm:hidden">🎼 PJ</span>
            </Link>
            
            {/* Breadcrumb Navigation */}
            {breadcrumbs.length > 0 && (
              <nav className="flex items-center gap-2 text-sm overflow-x-auto flex-1 min-w-0">
                <span className="text-gray-400 flex-shrink-0">/</span>
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.href} className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={crumb.href}
                      className={`hover:text-indigo-600 transition-colors truncate ${
                        index === breadcrumbs.length - 1
                          ? 'text-gray-900 font-semibold'
                          : 'text-gray-600'
                      }`}
                      title={crumb.label}
                    >
                      {crumb.label}
                    </Link>
                    {index < breadcrumbs.length - 1 && (
                      <span className="text-gray-400">/</span>
                    )}
                  </div>
                ))}
              </nav>
            )}
          </div>

          {/* Mobile Menu Button (only show when signed in) */}
          {isSignedIn && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md flex-shrink-0"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          )}
          
          {/* Desktop User Button */}
          <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
            {isSignedIn ? (
              <UserButton afterSignOutUrl="/" />
            ) : (
              <Link
                href="/sign-in"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && isSignedIn && (
          <div className="sm:hidden border-t border-gray-200 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Account</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

