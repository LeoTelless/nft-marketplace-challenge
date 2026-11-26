import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * App-wide toasts (mutation feedback, realtime changes). Sonner renders them inside an
 * `aria-live="polite"` region (`<section aria-label="Notificações …">`), so screen readers
 * announce each one; `toast.error` uses the same region. Mount once, in the root layout.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      containerAriaLabel="Notificações"
      closeButton
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        info: <Info className="size-4 text-brand-accent" />,
        warning: <TriangleAlert className="size-4 text-amber" />,
        error: <CircleAlert className="size-4 text-coral" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
      }}
      toastOptions={{
        closeButtonAriaLabel: 'Fechar notificação',
        classNames: {
          toast:
            '!rounded-md !border !border-line !bg-surface-raised !font-sans !text-foreground !shadow-raised',
          title: '!text-sm !font-bold',
          description: '!text-[13px] !leading-5 !text-text-secondary',
          actionButton: '!bg-brand !text-ink !font-bold',
          cancelButton: '!bg-surface-dark !text-foreground',
          closeButton: '!border-line !bg-surface-dark !text-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
