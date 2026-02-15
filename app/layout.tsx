import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import AppHeader from '@/components/AppHeader'
import ErrorBoundary from '@/components/ErrorBoundary'
import RootLoading from './loading'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_APP_NAME ?? 'Pay Simul',
    template: `%s | ${process.env.NEXT_PUBLIC_APP_NAME ?? 'Pay Simul'}`,
  },
  description:
    'Payment flow simulation platform — simulate card, wire, UPI, SEPA, and agentic AI payments across 9 countries with real-time validation, ISO 20022 payloads, and full audit trails.',
  metadataBase: process.env.VERCEL_URL
    ? new URL(`https://${process.env.VERCEL_URL}`)
    : new URL('http://localhost:3000'),
  openGraph: {
    title: process.env.NEXT_PUBLIC_APP_NAME ?? 'Pay Simul',
    description:
      'Simulate payment flows across multiple rails, countries, and protocols. Includes agentic payments with AP2 & ACT protocol support.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: process.env.NEXT_PUBLIC_APP_NAME ?? 'Pay Simul',
    description: 'Payment flow simulation platform with agentic payments protocol support.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className={`${inter.className} h-full min-h-screen antialiased bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100`}>
        <noscript>
          <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
            <p className="text-gray-800">Pay Simul requires JavaScript to run.</p>
          </div>
        </noscript>
        <ErrorBoundary>
          <div className="flex min-h-screen w-full bg-gray-50 dark:bg-gray-950" role="application" aria-label="Pay Simul">
            <Sidebar />
            <main className="flex min-h-screen flex-1 flex-col overflow-y-auto md:pl-[260px] bg-gray-50 dark:bg-gray-950">
              <AppHeader />
              <div className="mx-auto w-full max-w-6xl flex-1 flex min-h-[60vh] flex-col gap-6 bg-transparent p-4 pt-4 md:p-6">
                {children ?? <RootLoading />}
              </div>
            </main>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  )
}
