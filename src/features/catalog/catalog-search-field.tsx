import { useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { CloseIcon, SearchIcon } from '@/shared/ui/icons'

const DEBOUNCE_MS = 350

/**
 * Catalog search ("Explorar coleções"). Typing is debounced before it reaches the URL; the
 * URL stays the source of truth (back/forward or "limpar filtros" update the field).
 * Enter applies immediately.
 */
export function CatalogSearchField({
  id,
  value,
  onSearch,
  className,
}: {
  id: string
  value: string | undefined
  onSearch: (q: string | undefined) => void
  className?: string
}) {
  const [draft, setDraft] = useState(value ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastSent = useRef(value ?? '')

  useEffect(() => {
    // External change (history, clear filters): reflect it, unless it is our own echo.
    if ((value ?? '') !== lastSent.current) {
      lastSent.current = value ?? ''
      setDraft(value ?? '')
    }
  }, [value])

  useEffect(() => () => clearTimeout(timer.current), [])

  function send(next: string) {
    clearTimeout(timer.current)
    const normalized = next.trim()
    if (normalized === lastSent.current) return
    lastSent.current = normalized
    onSearch(normalized || undefined)
  }

  return (
    <form
      role="search"
      className={cn('relative flex items-center', className)}
      onSubmit={(event) => {
        event.preventDefault()
        send(draft)
      }}
    >
      <label htmlFor={id} className="sr-only">
        Buscar NFTs por nome, criador ou descrição
      </label>
      <SearchIcon className="pointer-events-none absolute left-3 size-5 text-text-muted" />
      <input
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={100}
        placeholder="Explorar coleções"
        value={draft}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => send(next), DEBOUNCE_MS)
        }}
        className="h-[45px] w-full rounded-[10px] border border-transparent bg-surface pr-10 pl-11 text-sm font-bold text-foreground placeholder:text-text-muted hover:border-line focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-brand-accent [&::-webkit-search-cancel-button]:hidden"
      />
      {draft ? (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            setDraft('')
            send('')
          }}
          className="absolute right-2 grid size-7 cursor-pointer place-content-center rounded-full text-text-secondary hover:text-foreground"
        >
          <CloseIcon className="size-4" />
        </button>
      ) : null}
    </form>
  )
}
