import { Link } from '@tanstack/react-router'
import { ImageOff, LoaderCircle, TriangleAlert } from 'lucide-react'
import { StatusPage } from '@/shared/layout/status-page'
import { Button, buttonVariants } from '@/shared/ui/button'
import { NftCardSkeleton } from '@/features/catalog/nft-card'
import { Skeleton } from '@/shared/ui/skeleton'

/**
 * Skeleton with the final geometry of the whole page (gallery, information, "Detalhes do NFT"
 * and "Mais desta coleção"), so nothing below — the footer included — moves when the data
 * arrives (CLS). Heights follow the rendered blocks (title 37, description 72, editions 88…).
 */
export function NftDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando NFT" data-testid="nft-detail-skeleton">
      <div className="container-page md:pt-8">
        <Skeleton className="h-4 w-48 max-md:hidden" />
        <div className="flex flex-col md:mt-3 md:gap-8 lg:flex-row lg:gap-8">
          <div className="max-md:-mx-6 max-md:bg-surface max-md:px-7 max-md:pt-[66px] md:flex md:flex-col-reverse md:gap-4 md:max-lg:mx-auto md:max-lg:w-[480px] lg:w-[573px] lg:shrink-0 lg:flex-row lg:gap-7">
            <div className="hidden gap-4 md:flex md:justify-center lg:w-[100px] lg:flex-col">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="size-20 lg:size-[100px]" />
              ))}
            </div>
            <div className="md:rounded-sm md:bg-surface md:p-4 lg:w-[444px]">
              <Skeleton className="aspect-[361/356] rounded-3xl md:aspect-square" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 max-md:relative max-md:-mx-6 max-md:-mt-[30px] max-md:rounded-t-[31px] max-md:bg-surface max-md:px-6 max-md:pt-8 max-md:pb-6 md:gap-5">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-2/3 md:h-[37px]" />
              <Skeleton className="h-[37px] w-full max-md:hidden" />
            </div>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-40 max-md:hidden" />
              <Skeleton className="h-[72px] w-full" />
            </div>
            <div className="flex flex-col gap-2 md:gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-5 w-72 max-w-full" />
            </div>
            <Skeleton className="h-[50px] w-full max-w-md max-md:hidden" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="h-6 w-64 max-md:hidden" />
          </div>
        </div>
      </div>

      <section className="container-page mt-16 md:mt-24" aria-hidden="true">
        <div className="border-b border-brand/30 pb-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <Skeleton className="h-[72px] w-full" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full md:w-3/4" />
          ))}
        </div>
      </section>

      <section className="container-page mt-16 md:mt-24" aria-hidden="true">
        <div className="border-b border-brand/30 pb-3">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="scrollbar-none mt-8 flex gap-4 overflow-hidden pb-2 md:gap-6 lg:gap-7">
          {Array.from({ length: 5 }, (_, i) => (
            <NftCardSkeleton key={i} className="w-[175px] shrink-0 md:w-[220px] lg:w-[calc((100%-4*28px)/5)]" />
          ))}
        </div>
        <div className="mt-6 h-6" />
      </section>
    </div>
  )
}

/** Own screen for an id that does not exist (not the generic 404). */
export function NftNotFound({ nftId }: { nftId: string }) {
  return (
    <StatusPage
      icon={ImageOff}
      code="NFT NÃO ENCONTRADO"
      title="Este NFT não existe ou foi removido"
      testId="nft-not-found"
      actions={
        <Link to="/" hash="catalogo" activeOptions={{ includeHash: true }} className={buttonVariants()}>
          Explorar o catálogo
        </Link>
      }
    >
      <p>
        Não encontramos nenhum NFT com o identificador <code className="text-foreground">{nftId}</code>. Confira o link
        ou procure no catálogo.
      </p>
    </StatusPage>
  )
}

export function NftDetailError({
  message,
  onRetry,
  retrying,
}: {
  message: string
  onRetry: () => void
  retrying: boolean
}) {
  return (
    <div role="alert">
      <StatusPage
        icon={TriangleAlert}
        tone="error"
        title="Não foi possível carregar este NFT"
        testId="nft-detail-error"
        actions={
          <>
            <Button onClick={onRetry} disabled={retrying}>
              {retrying ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              Tentar novamente
            </Button>
            <Link to="/" className={buttonVariants({ variant: 'outline' })}>
              Voltar ao catálogo
            </Link>
          </>
        }
      >
        <p>{message}</p>
      </StatusPage>
    </div>
  )
}
