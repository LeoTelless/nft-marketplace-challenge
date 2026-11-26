import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { Cart } from '@/contracts'
import { queryKeys, type CartOwner } from '@/shared/api/query-keys'
import { notify } from '@/shared/feedback/notifications'
import { compareEth, formatEth } from '@/shared/lib/eth'
import { onRealtimeNotice } from '@/shared/realtime/realtime-client'

/**
 * While the cart or the checkout is open: announces price/availability changes of NFTs in
 * the cart, pushed by `nft.updated` (via socket.io-client; duplicates and stale versions were
 * already dropped). The cache itself is refreshed by the realtime layer (cart and quote are
 * invalidated), so the summary updates on its own; this hook only explains what changed.
 * The listener is removed on unmount.
 */
export function useCartChangeNotices(owner: CartOwner | null) {
  const queryClient = useQueryClient()
  const ownerRef = useRef(owner)
  useEffect(() => {
    ownerRef.current = owner
  }, [owner])

  useEffect(
    () =>
      onRealtimeNotice((notice) => {
        if (notice.type !== 'nft.updated' || !ownerRef.current) return
        // The cart in cache still holds the values before this event (it is being refetched).
        const cart = queryClient.getQueryData<Cart>(queryKeys.cart.detail(ownerRef.current))
        const nft = notice.event.data
        for (const item of cart?.items ?? []) {
          if (item.nftId !== nft.id) continue
          const edition = nft.editions.find((e) => e.id === item.editionId)
          if (!edition) continue
          const label = `${item.nftName} (${item.editionName})`
          if (compareEth(edition.price, item.unitPrice) !== 0) {
            notify({
              tone: 'warning',
              title: `O preço de ${label} mudou.`,
              description: `De ${formatEth(item.unitPrice)} para ${formatEth(edition.price)}. O resumo foi atualizado.`,
              key: `cart-change-price-${item.id}`,
            })
          }
          if (edition.available !== item.available && edition.available < item.quantity) {
            notify({
              tone: 'warning',
              title: edition.available === 0 ? `${label} esgotou.` : `Disponibilidade de ${label} mudou.`,
              description:
                edition.available === 0
                  ? 'Remova o item para finalizar a compra.'
                  : `Restam ${edition.available} unidade(s); ajuste a quantidade para finalizar.`,
              key: `cart-change-stock-${item.id}`,
            })
          }
        }
      }),
    [queryClient],
  )
}
