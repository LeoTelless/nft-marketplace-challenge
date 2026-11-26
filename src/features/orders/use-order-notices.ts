import { useEffect } from 'react'
import { notify } from '@/shared/feedback/notifications'
import { onRealtimeNotice } from '@/shared/realtime/realtime-client'

/**
 * Announces payment results pushed by `order.updated` (already deduplicated, version-checked
 * and filtered to the current user by the realtime client). Mounted once by the session provider.
 */
export function useOrderNotices() {
  useEffect(
    () =>
      onRealtimeNotice((notice) => {
        if (notice.type !== 'order.updated') return
        const order = notice.event.data
        if (order.status === 'confirmed') {
          notify({ tone: 'success', title: 'Pagamento confirmado.', description: 'Seus NFTs já estão na sua carteira.', key: `order-${order.id}` })
        } else if (order.status === 'rejected') {
          notify({
            tone: 'error',
            title: 'Pagamento recusado.',
            description: order.rejectionReason ?? 'Os itens continuam no seu carrinho.',
            key: `order-${order.id}`,
          })
        }
      }),
    [],
  )
}
