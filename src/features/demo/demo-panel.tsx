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
        className="fixed top-1/2 right-0 z-30 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-l-full border border-r-0 border-line bg-surface-raised/95 px-2 text-xs font-medium text-text-secondary opacity-80 shadow-raised hover:border-brand hover:text-brand-accent hover:opacity-100 md:top-auto md:right-auto md:bottom-4 md:left-4 md:rounded-full md:border-r md:px-3 md:opacity-100"
      >
        <FlaskConical className="size-4" aria-hidden="true" />
        <span className="max-md:sr-only">Demo</span>
        <span className="sr-only">: painel de cenários simulados</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>Painel de demonstração</SheetTitle>
          <SheetDescription>
            Controla o servidor simulado (MSW + Socket.IO). As mudanças chegam à interface pela API e pelos eventos, como em
            produção.
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
