import { useRealtimeStatus } from '@/shared/realtime/realtime-provider'
import type { RealtimeStatus } from '@/shared/realtime/realtime-client'
import { cn } from '@/shared/lib/utils'

const LABELS: Record<RealtimeStatus, string> = {
  idle: 'Tempo real: inativo',
  connecting: 'Tempo real: conectando…',
  connected: 'Tempo real: conectado',
  reconnecting: 'Tempo real: reconectando…',
  unauthorized: 'Tempo real: sessão inválida',
}

/**
 * Discreet connection status of the Socket.IO channel (prices and availability update live
 * while connected; on reconnection the data is reconciled). Text + shape, not color alone.
 */
export function RealtimeIndicator() {
  const status = useRealtimeStatus()
  const connected = status === 'connected'
  return (
    <p data-testid="realtime-status" data-status={status} className="inline-flex items-center gap-2 text-xs leading-5 text-text-secondary">
      <span
        aria-hidden="true"
        className={cn('size-2 rounded-full', connected ? 'bg-success' : 'border border-amber bg-transparent')}
      />
      {LABELS[status]}
    </p>
  )
}
