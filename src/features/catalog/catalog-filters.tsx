import { useId, useState, type FormEvent } from 'react'
import type { NftAvailabilityFilter, NftCategory } from '@/contracts'
import { compareEth, isEthAmount } from '@/shared/lib/eth'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { Slider } from '@/shared/ui/slider'
import { AVAILABILITY_LABELS, CATEGORIES_ALPHABETICAL, CATEGORY_LABELS, type CatalogSearch } from './catalog-search'
import { useCategoryCounts } from './queries'

/** Slider domain (ETH). Lowest NFT prices go from 0.0042 to 12.5 ETH. */
const PRICE_MIN = 0
const PRICE_MAX = 13
const PRICE_STEP = 0.01

type Update = (patch: Partial<CatalogSearch>) => void

/**
 * Sidebar filters ("Coleções", "Faixa de preço", "Disponibilidade"). Same component in the
 * desktop sidebar and in the mobile/tablet sheet. Every filter writes to the URL.
 */
export function CatalogFilters({
  search,
  update,
  idPrefix,
}: {
  search: CatalogSearch
  update: Update
  idPrefix: string
}) {
  return (
    <div className="flex flex-col gap-10">
      <CollectionsFilter
        selected={search.category ?? []}
        onChange={(category) => update({ category: category.length ? category : undefined })}
      />
      <PriceFilter
        // Remounted when the URL changes (history, "limpar filtros"): the draft restarts from it.
        key={`${search.minPrice ?? ''}-${search.maxPrice ?? ''}`}
        idPrefix={idPrefix}
        minPrice={search.minPrice}
        maxPrice={search.maxPrice}
        onApply={(minPrice, maxPrice) => update({ minPrice, maxPrice })}
      />
      <AvailabilityFilter
        value={search.availability}
        onChange={(availability) => update({ availability })}
        idPrefix={idPrefix}
      />
    </div>
  )
}

function FilterTitle({ id, children }: { id: string; children: string }) {
  return (
    <h3 id={id} className="text-lg leading-4 font-bold text-foreground">
      {children}
    </h3>
  )
}

function CollectionsFilter({
  selected,
  onChange,
}: {
  selected: NftCategory[]
  onChange: (next: NftCategory[]) => void
}) {
  const titleId = useId()
  const counts = useCategoryCounts()
  return (
    <fieldset className="flex flex-col gap-3" aria-labelledby={titleId}>
      <FilterTitle id={titleId}>Coleções</FilterTitle>
      <ul className="flex flex-col px-3">
        {CATEGORIES_ALPHABETICAL.map((category) => {
          const checked = selected.includes(category)
          const inputId = `${titleId}-${category}`
          return (
            <li key={category} className="flex h-10 items-center gap-3">
              <Checkbox
                id={inputId}
                checked={checked}
                onCheckedChange={(value) =>
                  onChange(value === true ? [...selected, category] : selected.filter((c) => c !== category))
                }
              />
              <label
                htmlFor={inputId}
                className={cn(
                  'flex flex-1 cursor-pointer items-center justify-between gap-2 text-[15px] leading-10',
                  checked ? 'text-brand-accent' : 'text-text-secondary hover:text-foreground',
                )}
              >
                <span>{CATEGORY_LABELS[category]}</span>
                <span
                  className="font-bold"
                  aria-label={counts[category] === undefined ? undefined : `${counts[category]} NFTs`}
                >
                  {counts[category] === undefined ? '' : `(${counts[category]})`}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

function toNumber(value: string | undefined, fallback: number) {
  if (!value || !isEthAmount(value)) return fallback
  return Math.min(Math.max(Number(value), PRICE_MIN), PRICE_MAX)
}

const formatSliderValue = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2))

/**
 * Price range: the layout slider plus min/max fields (typing an exact value is easier than
 * dragging, and works with any input method). Applied with "Aplicar", as in the layout.
 */
function PriceFilter({
  idPrefix,
  minPrice,
  maxPrice,
  onApply,
}: {
  idPrefix: string
  minPrice?: string
  maxPrice?: string
  onApply: (min: string | undefined, max: string | undefined) => void
}) {
  const titleId = useId()
  const errorId = `${idPrefix}-price-error`
  const [draftMin, setDraftMin] = useState(minPrice ?? '')
  const [draftMax, setDraftMax] = useState(maxPrice ?? '')
  const [error, setError] = useState<string | null>(null)


  const sliderValue = [toNumber(draftMin, PRICE_MIN), toNumber(draftMax, PRICE_MAX)]

  function apply(event: FormEvent) {
    event.preventDefault()
    const min = draftMin.trim().replace(',', '.')
    const max = draftMax.trim().replace(',', '.')
    if ((min && !isEthAmount(min)) || (max && !isEthAmount(max))) {
      setError('Use números positivos, por exemplo 0,25.')
      return
    }
    if (min && max && compareEth(min, max) > 0) {
      setError('O preço mínimo deve ser menor ou igual ao máximo.')
      return
    }
    setError(null)
    onApply(min || undefined, max || undefined)
  }

  return (
    <form onSubmit={apply} aria-labelledby={titleId} className="flex flex-col gap-3" noValidate>
      <FilterTitle id={titleId}>Faixa de preço</FilterTitle>
      <div className="flex flex-col gap-3 pl-3">
        <Slider
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          minStepsBetweenThumbs={1}
          value={sliderValue}
          thumbLabels={['Preço mínimo', 'Preço máximo']}
          onValueChange={([min, max]) => {
            setDraftMin(min <= PRICE_MIN ? '' : formatSliderValue(min))
            setDraftMax(max >= PRICE_MAX ? '' : formatSliderValue(max))
          }}
        />
        <p className="text-[15px] leading-5 text-foreground" aria-live="polite">
          Preço: {formatSliderValue(sliderValue[0]).replace('.', ',')} -{' '}
          {draftMax ? formatSliderValue(sliderValue[1]).replace('.', ',') : `${PRICE_MAX}+`} ETH
        </p>
        <div className="grid grid-cols-2 gap-2">
          <PriceField
            id={`${idPrefix}-min-price`}
            label="Mínimo"
            value={draftMin}
            onChange={setDraftMin}
            errorId={error ? errorId : undefined}
          />
          <PriceField
            id={`${idPrefix}-max-price`}
            label="Máximo"
            value={draftMax}
            onChange={setDraftMax}
            errorId={error ? errorId : undefined}
          />
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-[13px] leading-5 text-coral">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="sm" className="w-fit px-3 text-base font-bold">
          Aplicar
        </Button>
      </div>
    </form>
  )
}

function PriceField({
  id,
  label,
  value,
  onChange,
  errorId,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  errorId?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] leading-4 text-text-secondary">
        {label} (ETH)
      </label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder={label === 'Mínimo' ? '0' : String(PRICE_MAX)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        className="h-9"
      />
    </div>
  )
}

/** Replaces the layout's "Rede" filter: the API has no network field (see DECISOES.md). */
function AvailabilityFilter({
  value,
  onChange,
  idPrefix,
}: {
  value: NftAvailabilityFilter
  onChange: (value: NftAvailabilityFilter) => void
  idPrefix: string
}) {
  const titleId = useId()
  return (
    <fieldset className="flex flex-col gap-3" aria-labelledby={titleId}>
      <FilterTitle id={titleId}>Disponibilidade</FilterTitle>
      <ul className="flex flex-col px-3">
        {(Object.keys(AVAILABILITY_LABELS) as NftAvailabilityFilter[]).map((option) => {
          const checked = value === option
          return (
            <li key={option}>
              <label
                className={cn(
                  'flex h-10 cursor-pointer items-center gap-3 text-[15px] leading-10',
                  checked ? 'text-brand-accent' : 'text-text-secondary hover:text-foreground',
                )}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-availability`}
                  value={option}
                  checked={checked}
                  onChange={() => onChange(option)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="grid size-[18px] place-content-center rounded-full border border-line-soft bg-surface-dark peer-checked:border-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-accent"
                >
                  <span className={cn('size-2 rounded-full', checked ? 'bg-brand' : 'bg-transparent')} />
                </span>
                {AVAILABILITY_LABELS[option]}
              </label>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
