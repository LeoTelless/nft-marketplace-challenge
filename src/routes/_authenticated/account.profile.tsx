import { createFileRoute } from '@tanstack/react-router'
import { AccountLayout } from '@/features/account/account-layout'
import { ProfilePage } from '@/features/profile/components/profile-page'

export const Route = createFileRoute('/_authenticated/account/profile')({
  head: () => ({ meta: [{ title: 'Perfil | KURIO' }] }),
  component: () => (
    <AccountLayout>
      <ProfilePage />
    </AccountLayout>
  ),
})
