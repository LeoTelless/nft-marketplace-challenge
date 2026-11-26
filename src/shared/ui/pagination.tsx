import * as React from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * Pagination building blocks (35px squares, 4px radius, current page filled), router
 * agnostic: the caller renders its own links with `paginationItemClass` so pages are real,
 * shareable URLs.
 */
function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav data-slot="pagination" className={cn('flex', className)} {...props} />
}

function PaginationList({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot="pagination-list" className={cn('flex flex-wrap items-center gap-2', className)} {...props} />
}

function paginationItemClass({ current = false, disabled = false }: { current?: boolean; disabled?: boolean } = {}) {
  return cn(
    'grid h-[35px] min-w-[35px] place-content-center rounded-xs border px-2 text-lg leading-4 transition-colors',
    'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-brand-accent',
    current ? 'border-brand bg-brand font-bold text-ink' : 'border-line text-foreground hover:border-brand',
    disabled && 'pointer-events-none opacity-40',
  )
}

/** Page numbers to show, with `'…'` gaps: 1 … 4 5 6 … 12. */
function getPageRange(page: number, totalPages: number, siblings = 1): Array<number | '…'> {
  const pages = new Set<number>([1, totalPages])
  for (let p = page - siblings; p <= page + siblings; p++) if (p >= 1 && p <= totalPages) pages.add(p)
  const sorted = [...pages].filter((p) => p >= 1).sort((a, b) => a - b)
  const result: Array<number | '…'> = []
  for (const [index, p] of sorted.entries()) {
    const previous = sorted[index - 1]
    if (previous !== undefined && p - previous === 2) result.push(previous + 1)
    else if (previous !== undefined && p - previous > 2) result.push('…')
    result.push(p)
  }
  return result
}

export { Pagination, PaginationList, paginationItemClass, getPageRange }
