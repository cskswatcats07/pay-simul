import { PageHeader } from '@/components/layout'
import { CardContainer, SectionTitle } from '@/components/ui'
import { APP_NAME, APP_VERSION } from '@/config/app'

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        subtitle="Application preferences and configuration."
      />
      <CardContainer className="p-6 dark:border-gray-800 dark:bg-gray-900/50">
        <SectionTitle className="mb-4 dark:text-gray-400">General</SectionTitle>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-gray-400">App name</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{APP_NAME}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-gray-400">Version</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{APP_VERSION}</dd>
          </div>
        </dl>
      </CardContainer>
    </div>
  )
}
