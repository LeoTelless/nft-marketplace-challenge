import type { NftSort } from '@/contracts'
import { cn } from '@/shared/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { CATALOG_VIEWS, SORT_OPTIONS, type CatalogView } from './catalog-search'

/**
 * Catalog views (the three tabs of the layout) and the sort select. Views are toggle buttons
 * (`aria-pressed`): they filter the same grid, they are not tab panels.
 */
export function CatalogViews({
  view,
  onChange,
  className,
}: {
  view: CatalogView
  onChange: (view: CatalogView) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Visualização do catálogo"
      className={cn('scrollbar-none flex items-center gap-4 overflow-x-auto md:gap-5', className)}
    >
      {CATALOG_VIEWS.map((item) => {
        const active = item.value === view
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative shrink-0 cursor-pointer pb-1 text-sm leading-4 whitespace-nowrap transition-colors md:pb-1.5 md:text-[15px] md:font-medium',
              'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand after:transition-opacity',
              active
                ? 'font-bold text-brand-accent after:opacity-100'
                : 'text-foreground after:opacity-0 hover:text-brand-accent',
            )}
          >
            {item.label}
          </button>
        )
      })}
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
