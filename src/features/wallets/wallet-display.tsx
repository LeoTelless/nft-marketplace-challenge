import { Wallet as WalletIcon } from 'lucide-react'
import type { Wallet } from '@/contracts'
import { cn } from '@/shared/lib/utils'

/** Provider badge of the payment frame: "W", "M" letters and the Coinbase wallet glyph. */
export function ProviderMark({ provider, className }: { provider: Wallet['provider']; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-10 shrink-0 place-content-center rounded-full border border-line bg-surface-raised text-[15px] font-bold text-brand-accent',
        className,
      )}
    >
      {provider === 'walletconnect' ? 'W' : provider === 'metamask' ? 'M' : <WalletIcon className="size-5" />}
    </span>
  )
}
