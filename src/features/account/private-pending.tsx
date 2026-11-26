import { useRouterState } from '@tanstack/react-router'
import { OrderCardSkeleton } from '@/features/orders/components/order-card'
import { ProfileSkeleton } from '@/features/profile/components/profile-page'
import { WalletsSkeleton } from '@/features/wallets/components/wallets-page'
import { Skeleton } from '@/shared/ui/skeleton'
import { AccountLayout } from './account-layout'

/**
 * Pending screen of the private area while the stored session is validated (`GET /session` in
 * the `_authenticated` guard): the header and footer of the root layout stay visible and the
 * page shows the skeleton of the requested screen with its final sizes, so nothing jumps when
 * the content arrives.
 */
export function PrivatePending() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (pathname === '/checkout') return <CheckoutSkeleton />
  if (/^\/orders\/[^/]+$/.test(pathname)) return <OrderCardSkeleton />
  return (
    <AccountLayout>
      {pathname === '/account/profile' ? (
        <ProfileSkeleton />
      ) : pathname === '/account/wallets' ? (
        <WalletsSkeleton />
      ) : (
        // Atividade and Lista de interesse: heading and description, then the list.
        <div aria-busy="true" aria-label="Carregando" className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[15px] w-full max-w-md" />
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[136px] w-full sm:h-20" />
            ))}
          </div>
        </div>
      )}
    </AccountLayout>
  )
}

function CheckoutSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando pagamento" className="container-page min-h-dvh pt-8 max-md:[--page-gutter:1.75rem]">
      <Skeleton className="h-4 w-60 max-md:hidden" />
      <Skeleton className="mb-[9px] h-[35px] w-2/3 md:hidden" />
      <div className="mt-4 flex flex-col gap-8 md:mt-8 lg:flex-row">
        <div className="grid flex-1 gap-x-6 gap-y-3 md:grid-cols-2 lg:max-w-[763px]">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-[69px] w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-3 lg:w-[405px]">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[70px] w-full" />
          ))}
          <Skeleton className="h-[180px] w-full" />
        </div>
      </div>
    </div>
  )
}
