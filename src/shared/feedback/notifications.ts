import { toast } from 'sonner'

/**
 * Feedback of mutations and realtime events (price changed, payment confirmed, favorite
 * failed...). Thin adapter over `sonner` (rendered by `<Toaster />` of `shared/ui/sonner`,
 * mounted once in the root layout, inside an `aria-live` region), so feature code does not
 * depend on the toast library and can publish from hooks or socket listeners alike.
 */
export type NoticeTone = 'info' | 'success' | 'warning' | 'error'

export interface NotifyInput {
  tone: NoticeTone
  title: string
  description?: string
  /** Notices with the same key replace each other (e.g. repeated price changes of one NFT). */
  key?: string
  /** Auto-dismiss delay in ms. Default 6 s (errors and warnings 9 s). */
  duration?: number
}

export function notify({ tone, title, description, key, duration }: NotifyInput): string | number {
  return toast[tone](title, {
    id: key,
    description,
    duration: duration ?? (tone === 'error' || tone === 'warning' ? 9_000 : 6_000),
  })
}

export function dismissNotice(id: string | number) {
  toast.dismiss(id)
}

/** Drops every notice (logout / user switch: nothing of the previous session may remain). */
export function clearNotices() {
  toast.dismiss()
}
