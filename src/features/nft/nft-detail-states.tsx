import { Link } from '@tanstack/react-router'
import { ImageOff, LoaderCircle, TriangleAlert } from 'lucide-react'
import { StatusPage } from '@/shared/layout/status-page'
import { Button, buttonVariants } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

/** Skeleton with the final geometry of `NftDetail` (gallery, title, price, editions, actions). */
export function NftDetailSkeleton() {
  return (
    <div className="container-page pt-4 md:pt-8" aria-busy="true" aria-label="Carregando NFT" data-testid="nft-detail-skeleton">
      <Skeleton className="h-4 w-48 max-md:hidden" />
      <div className="mt-3 flex flex-col gap-8 lg:flex-row lg:gap-8">
        <div className="flex flex-col-reverse gap-4 lg:w-[573px] lg:shrink-0 lg:flex-row lg:gap-7">
          <div className="flex gap-4 max-lg:justify-center lg:w-[100px] lg:flex-col">
            <Skeleton className="size-16 md:size-20 lg:size-[100px]" />
            <Skeleton className="size-16 md:size-20 lg:size-[100px]" />
          </div>
          <div className="bg-surface md:rounded-sm md:p-4 lg:w-[444px]">
            <Skeleton className="aspect-square rounded-3xl" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <Skeleton className="h-6 w-2/3 md:h-[37px]" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[66px] w-full" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-[50px] w-full max-w-md" />
          <Skeleton className="h-20 w-56" />
        </div>
      </div>
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
        <Link to="/" hash="catalogo" className={buttonVariants()}>
          Explorar o catálogo
        </Link>
      }
    >
      <p>
        Não encontramos nenhum NFT com o identificador <code className="text-foreground">{nftId}</code>. Confira o link ou
        procure no catálogo.
      </p>
    </StatusPage>
  )
}

export function NftDetailError({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
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
