import { useId, useState, type ReactNode } from 'react'
import { useCart } from '@/features/cart/use-cart'
import { useOrders } from '@/features/orders/use-order'
import { notify } from '@/shared/feedback/notifications'
import { multiplyEth, percentOfEth } from '@/shared/lib/eth'
import { Button } from '@/shared/ui/button'

function mocks() {
  const control = window.__mocks
  if (!control) throw new Error('Mocks are not enabled')
  return control
}

function run(label: string, action: () => void) {
  try {
    action()
    notify({ tone: 'info', title: `Demo: ${label}`, key: 'demo' })
  } catch (error) {
    notify({ tone: 'error', title: 'Demo: ação não aplicada', description: error instanceof Error ? error.message : String(error), key: 'demo' })
  }
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line px-4 py-4">
      <h3 className="text-sm font-bold">{title}</h3>
      {children}
    </section>
  )
}

/** Controls of the demonstration panel (lazy-loaded). */
export default function DemoControls() {
  const control = mocks()
  const [scenario, setScenario] = useState(control.getScenario())
  const scenarioId = useId()
  const cart = useCart()
  const orders = useOrders()
  const items = cart.data?.items ?? []
  const [target, setTarget] = useState('')
  const selected = items.find((item) => item.id === target) ?? items[0]
  const pending = orders.data?.items.filter((order) => order.status === 'pending') ?? []

  return (
    <div className="flex flex-col pb-6">
      <Group title="Cenário">
        <label htmlFor={scenarioId} className="text-xs text-text-secondary">
          Cenário ativo (persistido; os de uso único são rearmados ao aplicar)
        </label>
        <select
          id={scenarioId}
          value={scenario}
          onChange={(event) => setScenario(event.target.value as typeof scenario)}
          className="h-10 rounded-sm border border-line bg-surface-dark px-2 text-sm"
        >
          {Object.entries(control.scenarios).map(([id, description]) => (
            <option key={id} value={id} title={description}>
              {id}
            </option>
          ))}
        </select>
        <p className="text-xs text-text-muted">{control.scenarios[scenario]}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => run(`cenário "${scenario}" ativo`, () => control.setScenario(scenario))}>
            Aplicar cenário
          </Button>
          <Button size="sm" variant="secondary" onClick={() => location.reload()}>
            Recarregar página
          </Button>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            control.reset()
            location.reload()
          }}
        >
          Restaurar dados iniciais (reset)
        </Button>
      </Group>

      <Group title="Catálogo (nft.updated)">
        {items.length === 0 ? (
          <p className="text-xs text-text-muted">Adicione um NFT ao carrinho para alterar preço ou estoque dele por aqui.</p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              Item do carrinho
              <select
                value={selected?.id}
                onChange={(event) => setTarget(event.target.value)}
                className="h-10 rounded-sm border border-line bg-surface-dark px-2 text-sm text-foreground"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nftName} ({item.editionName})
                  </option>
                ))}
              </select>
            </label>
            {selected ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    run('preço +15%', () => control.updateNft(selected.nftId, { editionId: selected.editionId, price: percentOfEth(selected.unitPrice, 115) }))
                  }
                >
                  Preço +15%
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    run('preço −10%', () => control.updateNft(selected.nftId, { editionId: selected.editionId, price: percentOfEth(selected.unitPrice, 90) }))
                  }
                >
                  Preço −10%
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    run('estoque reduzido a 1', () => control.updateNft(selected.nftId, { editionId: selected.editionId, available: 1 }))
                  }
                >
                  Deixar 1 unidade
                </Button>
                <Button size="sm" variant="secondary" onClick={() => run('edição esgotada', () => control.updateNft(selected.nftId, { editionId: selected.editionId, available: 0 }))}>
                  Esgotar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    run('estoque reposto', () => control.updateNft(selected.nftId, { editionId: selected.editionId, available: Math.max(selected.quantity * 5, 10) }))
                  }
                >
                  Repor estoque
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-text-muted">Total do item agora: {selected ? multiplyEth(selected.unitPrice, selected.quantity) : '—'} ETH</p>
          </>
        )}
      </Group>

      <Group title="Pedidos pendentes (order.updated)">
        {pending.length === 0 ? (
          <p className="text-xs text-text-muted">
            Nenhum pedido pendente. Use o cenário <code>order-pending</code> para que os pedidos esperem a resolução manual.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="flex-1">{order.id}</span>
                <Button size="xs" onClick={() => run(`pedido ${order.id} confirmado`, () => control.resolveOrder(order.id, 'confirmed'))}>
                  Confirmar
                </Button>
                <Button size="xs" variant="destructive" onClick={() => run(`pedido ${order.id} recusado`, () => control.resolveOrder(order.id, 'rejected'))}>
                  Recusar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Group>

      <Group title="Sessão e conexão">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => run('sessões expiradas no servidor', () => control.expireSessions())}>
            Expirar sessão
          </Button>
          <Button size="sm" variant="secondary" onClick={() => run('socket derrubado', () => control.dropSocket())}>
            Derrubar Socket.IO
          </Button>
          <Button size="sm" variant="secondary" onClick={() => run('socket restaurado', () => control.restoreSocket())}>
            Restaurar Socket.IO
          </Button>
        </div>
      </Group>
    </div>
  )
}
