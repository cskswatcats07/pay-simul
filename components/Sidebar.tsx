'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { PAYMENT_METHODS } from '@/config/rails'
import { getMethodTags, recordMethodUsage } from '@/lib/store/method-usage'

const navigation = [
  { name: 'Dashboard', href: '/' },
  { name: 'Simulate Payment', href: '/payments', hasSubmenu: true },
  { name: 'Agentic Payments', href: '/agentic' },
  { name: 'Transactions Log', href: '/transactions' },
  { name: 'Settings', href: '/settings' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false)
  const [methodTags, setMethodTags] = useState<Record<string, string | null>>({})

  // Load method usage tags
  useEffect(() => {
    const methods = PAYMENT_METHODS.map((m) => m.value)
    setMethodTags(getMethodTags(methods))
  }, [])

  // Refresh tags when navigating
  const refreshTags = useCallback(() => {
    const methods = PAYMENT_METHODS.map((m) => m.value)
    setMethodTags(getMethodTags(methods))
  }, [])

  const handleMethodClick = (methodValue: string) => {
    recordMethodUsage(methodValue)
    refreshTags()
    setMobileOpen(false)
    router.push(`/payments?method=${methodValue}`)
  }

  const nav = (
    <nav className="flex-1">
      <ul className="space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const isPaymentSub = item.hasSubmenu

          return (
            <li key={item.name}>
              {isPaymentSub ? (
                <div>
                  <div className="flex items-center">
                    <Link
                      href={item.href}
                      onClick={() => {
                        setMobileOpen(false)
                      }}
                      className={`flex-1 block rounded-l-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#2563EB] text-white dark:bg-blue-600 dark:text-white'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                      }`}
                    >
                      {item.name}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPaymentMenuOpen(!paymentMenuOpen)}
                      className={`flex items-center justify-center rounded-r-2xl px-2 py-2.5 transition-colors ${
                        isActive
                          ? 'bg-[#2563EB] text-white hover:bg-[#1d4ed8] dark:bg-blue-600 dark:hover:bg-blue-700'
                          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300'
                      }`}
                      aria-label="Toggle payment methods"
                    >
                      <svg
                        className={`h-4 w-4 transition-transform duration-200 ${
                          paymentMenuOpen ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Payment Methods Dropdown */}
                  <div
                    className={`overflow-hidden transition-all duration-200 ease-in-out ${
                      paymentMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <ul className="mt-1 space-y-0.5 pl-3">
                      {PAYMENT_METHODS.map((method) => {
                        const tag = methodTags[method.value]
                        return (
                          <li key={method.value}>
                            <button
                              type="button"
                              onClick={() => handleMethodClick(method.value)}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                            >
                              <span className="text-base leading-none">{method.icon}</span>
                              <span className="flex-1 truncate">{method.label}</span>
                              {tag && (
                                <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                  {tag}
                                </span>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              ) : (
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#2563EB] text-white dark:bg-blue-600 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                  }`}
                >
                  {item.name}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-2xl border border-gray-200 bg-white p-2 shadow-md dark:border-gray-700 dark:bg-gray-800 md:hidden"
        aria-label="Open menu"
      >
        <svg className="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[260px] flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } transition-transform duration-200`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">Pay Simul</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
              aria-label="Close menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {nav}
          <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500">Version 0.1.0</p>
          </div>
        </div>
      </aside>
    </>
  )
}
