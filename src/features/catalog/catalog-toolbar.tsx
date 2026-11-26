import type { NftSort } from '@/contracts'
import { cn } from '@/shared/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SORT_OPTIONS } from './catalog-search'

/**
 * "Todos os NFTs" / "Em alta" (featured) views and the sort select. Views are toggle buttons
 * (`aria-pressed`): they filter the same grid, they are not tab panels.
 */
export function CatalogViews({
  featured,
  onChange,
  className,
}: {
  featured: boolean
  onChange: (featured: boolean | undefined) => void
  className?: string
}) {
  const views = [
    { label: 'Todos os NFTs', active: !featured, value: undefined },
    { label: 'Em alta', active: featured, value: true },
  ] as const
  return (
    <div role="group" aria-label="Visualização do catálogo" className={cn('flex items-center gap-5', className)}>
      {views.map((view) => (
        <button
          key={view.label}
          type="button"
          aria-pressed={view.active}
          onClick={() => onChange(view.value)}
          className={cn(
            'relative cursor-pointer pb-1 text-sm leading-4 whitespace-nowrap transition-colors md:text-[15px]',
            'after:absolute after:inset-x-0 after:-bottom-[3px] after:h-0.5 after:bg-brand after:transition-opacity',
            view.active
              ? 'font-bold text-brand-accent after:opacity-100 md:font-medium'
              : 'text-foreground after:opacity-0 hover:text-brand-accent',
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  )
}

export function CatalogSort({
  value,
  onChange,
  id,
}: {
  value: NftSort
  onChange: (sort: NftSort) => void
  id: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-1 text-[15px] leading-5">
      <label htmlFor={id} id={`${id}-label`} className="whitespace-nowrap text-foreground max-[359px]:sr-only">
        Ordenar por:
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as NftSort)}>
        <SelectTrigger
          id={id}
          aria-labelledby={`${id}-label ${id}`}
          className="h-auto border-0 bg-transparent px-1 py-1 text-[15px] leading-5 hover:text-brand-accent"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
          {value === 'oldest' ? <SelectItem value="oldest">Mais antigos</SelectItem> : null}
        </SelectContent>
      </Select>
    </div>
  )
}
