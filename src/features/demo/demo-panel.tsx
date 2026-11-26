import { FlaskConical } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/ui/sheet'

const DemoControls = lazy(() => import('./demo-controls'))

/**
 * Demonstration panel (only when the simulated backend is active): a discreet floating button
 * that opens a sheet to pick a scenario, reset the mocks and trigger server-side changes
 * (price/stock, order resolution, socket outage). Everything goes through `window.__mocks`,
 * i.e. the simulated server: the app observes it through REST and Socket.IO, never directly.
 */
export function DemoPanel() {
  const [open, setOpen] = useState(false)
  if (typeof window === 'undefined' || !window.__mocks) return null
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        // Below 1440 px: an ordinary button at the end of the page (after the footer, inside the bottom-bar padding on
        // mobile), so it never covers cards, fields or totals. From 1440 px the page content is centred in 1200 px and
        // the floating button fits in the empty left margin.
        className="z-30 mx-auto mt-4 mb-4 flex h-9 w-fit cursor-pointer items-center justify-center gap-1.5 rounded-full border border-line bg-surface-raised/95 px-3 text-xs font-medium text-text-secondary shadow-raised hover:border-brand hover:text-brand-accent min-[1440px]:fixed min-[1440px]:bottom-4 min-[1440px]:left-4 min-[1440px]:m-0"
      >
        <FlaskConical className="size-4" aria-hidden="true" />
        <span>Demo</span>
        <span className="sr-only">: painel de cenários simulados</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>Painel de demonstração</SheetTitle>
          <SheetDescription>
            Controla o servidor simulado (MSW + Socket.IO). As mudanças chegam à interface pela API e pelos eventos,
            como em produção.
          </SheetDescription>
        </SheetHeader>
        {open ? (
          <Suspense fallback={<p className="px-4 text-sm">Carregando…</p>}>
            <DemoControls />
          </Suspense>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
