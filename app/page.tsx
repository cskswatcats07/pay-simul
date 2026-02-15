import { PageHeader } from '@/components/layout'
import { CardContainer, SectionTitle } from '@/components/ui'

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        subtitle="Payment flow simulation and testing."
      />
      <CardContainer className="p-6 dark:border-gray-800 dark:bg-gray-900/50">
        <SectionTitle className="mb-4 dark:text-gray-400">Overview</SectionTitle>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Use <strong>Simulate Payment</strong> to configure transactions, view message payloads, the payment flow (Merchant → Acquirer → Network → Issuer → Response → Settlement), ledger impact, and fee breakdown. View the last 20 simulations in <strong>Transactions Log</strong>.
        </p>
      </CardContainer>
    </div>
  )
}
