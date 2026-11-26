import { createFileRoute } from '@tanstack/react-router'
import { AccountLayout } from '@/features/account/account-layout'
import { WalletsPage } from '@/features/wallets/components/wallets-page'

export const Route = createFileRoute('/_authenticated/account/wallets')({
  head: () => ({ meta: [{ title: 'Carteiras | KURIO' }] }),
  component: () => (
    <AccountLayout>
      <WalletsPage />
    </AccountLayout>
  ),
})
