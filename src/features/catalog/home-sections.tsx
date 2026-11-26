import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { Nft, NftImage as NftImageData } from '@/contracts'
import { formatEth } from '@/shared/lib/eth'
import { cn } from '@/shared/lib/utils'
import { ArrowRightIcon } from '@/shared/ui/icons'
import { NftImage } from '@/shared/ui/nft-image'
import { buttonVariants } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { useMediaQuery } from '@/shared/lib/use-media-query'
import { FEATURED_QUERY, useNftList } from './queries'

/** Shown until the featured NFTs arrive: same file as the first featured NFT (no swap flash). */
const HERO_PLACEHOLDER: NftImageData = { url: '/images/nft/emerald-ape-800.webp', alt: '', width: 800, height: 800 }
/** Mobile frame: the small square artwork is a different piece (sage-nomad) from the main one. */
const HERO_SECONDARY_FALLBACK: NftImageData = {
  url: '/images/nft/sage-nomad-256.webp',
  alt: '',
  width: 256,
  height: 256,
}

function useFeatured() {
  return useNftList(FEATURED_QUERY)
}

/**
 * Hero ("Destaques"): welcome copy and a carousel of featured NFTs (the three dots of the
 * layout select the slide). No autoplay: content never moves on its own.
 * Desktop/tablet follow the desktop frame; mobile follows the gradient card of the mobile frame.
 */
export function HomeHero() {
  const featured = useFeatured()
  const slides = featured.data?.items.slice(0, 3) ?? []
  const [index, setIndex] = useState(0)
  const current: Nft | undefined = slides[index]
  const image = current?.images[0] ?? HERO_PLACEHOLDER
  // Secondary artwork of the mobile banner: the next featured piece with a different image
  // (featured NFTs may share an artwork), else the frame's own second artwork.
  const secondary =
    [...slides.slice(index + 1), ...slides.slice(0, index)].find((slide) => slide.images[0]?.url !== image.url)
      ?.images[0] ?? HERO_SECONDARY_FALLBACK
  // One variant is rendered (not both hidden by CSS), so only one hero image is downloaded.
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const dots =
    slides.length > 1 ? (
      // 24px hit areas side by side (WCAG 2.5.8): the visible dots keep the frame's size and color.
      <div role="group" aria-label="Destaques" className="flex items-center">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Destaque ${i + 1} de ${slides.length}: ${slide.name}`}
            aria-pressed={i === index}
            className="grid size-6 cursor-pointer place-content-center rounded-full"
          >
            <span
              aria-hidden="true"
              className={cn(
                'block size-[7px] rounded-full bg-brand transition-all md:size-2',
                i === index && 'w-5 md:w-5',
              )}
            />
          </button>
        ))}
      </div>
    ) : (
      <div className="h-6" aria-hidden="true" />
    )

  const artwork = (sizes: string, className: string) =>
    current ? (
      <Link
        to="/nft/$nftId"
        params={{ nftId: current.id }}
        className={cn('block overflow-hidden', className)}
        aria-label={`Ver destaque: ${current.name}, ${formatEth(current.minPrice)}`}
      >
        <NftImage image={image} sizes={sizes} priority alt={current.images[0].alt} />
      </Link>
    ) : (
      <div className={cn('overflow-hidden', className)}>
        <NftImage image={image} sizes={sizes} priority />
      </div>
    )

  return (
    <section aria-label="Boas-vindas e destaques" className="container-page">
      {!isDesktop ? (
        // Frame: 366x190 banner, content 6px from the top and 16px from the sides, 16px to the dots,
        // dots 5px from the bottom. In flow, so narrower screens grow instead of cutting the copy.
        <div className="relative overflow-hidden rounded-[30px] bg-linear-120 from-brand/20 to-brand/10 px-4 pt-1.5 pb-[5px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-8 -left-20 size-[248px] rounded-full bg-linear-150 from-[#DD9A5F]/45 to-brand/5"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-2.5 left-[73px] size-[248px] rounded-full bg-linear-150 from-[#DD9A5F]/35 to-transparent"
          />
          <div className="relative flex gap-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-xs leading-4 font-medium text-foreground">Bem-vindo à Kurio</p>
              <h1 className="mt-1.5 text-lg leading-[29px] font-bold text-foreground uppercase max-[359px]:text-base max-[359px]:leading-6">
                Seja dono da
                <br />
                cultura digital
              </h1>
              <p className="mt-1.5 text-xs leading-[18px] text-text-secondary">
                Descubra NFTs selecionados de criadores do mundo todo.
              </p>
              <Link
                from="/"
                to="."
                search={(prev) => prev}
                hash="catalogo"
                activeOptions={{ includeHash: true }}
                className="-my-1 inline-flex w-fit items-center gap-2 py-1 text-xs leading-4 font-bold text-brand-accent"
              >
                EXPLORAR <ArrowRightIcon className="size-4" />
              </Link>
            </div>
            {/* Below 360px the artwork shrinks so the headline keeps short lines. */}
            <div className="relative w-[138px] shrink-0 pt-[5px] max-[359px]:w-28">
              {artwork('138px', 'size-[138px] rounded-[16px] max-[359px]:size-28')}
              <div
                aria-hidden="true"
                className="absolute top-[93px] left-[14px] size-[58px] overflow-hidden rounded-[16px] max-[359px]:top-[77px] max-[359px]:size-12"
              >
                <NftImage image={secondary} sizes="58px" alt="" />
              </div>
            </div>
          </div>
          <div className="relative mt-4 flex h-[7px] items-center justify-center">{dots}</div>
        </div>
      ) : (
        <div className="flex items-center gap-10 lg:gap-[110px] lg:pl-10">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-sm leading-4 font-medium tracking-[0.1em] text-foreground">Bem-vindo à Kurio</p>
            <h1 className="mt-2 text-[28px] leading-[44px] font-bold text-foreground uppercase lg:text-[43px] lg:leading-[70px]">
              Seja dono do futuro
              <br />
              da arte digital
            </h1>
            <p className="mt-1 max-w-[557px] text-sm leading-6 text-text-secondary">
              Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie
              artistas e tenha uma parte da cultura da internet.
            </p>
            <Link
              from="/"
              to="."
              search={(prev) => prev}
              hash="catalogo"
              activeOptions={{ includeHash: true }}
              className={cn(buttonVariants(), 'mt-8 h-10 w-[140px] pr-9 pl-7 text-base font-bold')}
            >
              EXPLORAR
            </Link>
            {/* 8px row as in the frame; the 24px hit areas overflow it without adding height. */}
            <div className="mt-6 flex h-2 items-center justify-end lg:mt-11">{dots}</div>
          </div>
          {artwork('(min-width: 1024px) 450px, 300px', 'aspect-square w-[300px] shrink-0 rounded-3xl lg:w-[450px]')}
        </div>
      )}
    </section>
  )
}

/** "NFT EM DESTAQUE / OFERTA LIMITADA" banner below the sidebar filters. */
export function FeaturedBanner() {
  const featured = useFeatured()
  const nft = featured.data?.items[1] ?? featured.data?.items[0]
  return (
    <section
      aria-labelledby="featured-banner-title"
      className="flex flex-col gap-4 bg-linear-to-b from-brand/10 to-brand/[0.03] pt-6 pb-1"
    >
      <h2 id="featured-banner-title" className="px-5 text-2xl leading-8 font-bold text-brand-accent">
        NFT EM DESTAQUE
      </h2>
      <p className="px-5 text-center text-[22px] leading-4 font-bold text-foreground">OFERTA LIMITADA</p>
      {nft ? (
        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.id }}
          className="block aspect-[310/368] overflow-hidden rounded-[22px]"
          aria-label={`${nft.name}, ${formatEth(nft.minPrice)}`}
        >
          <NftImage image={nft.images[0]} sizes="310px" alt="" className="object-[center_30%]" />
        </Link>
      ) : (
        <Skeleton className="aspect-[310/368] rounded-[22px]" />
      )}
    </section>
  )
}

const PROMOS = [
  {
    title: ['Lançamentos gênesis', 'de edição limitada'],
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: 'emerald-ape',
    search: { featured: true },
    label: 'Explorar lançamentos em alta',
  },
  {
    title: ['Arte digital selecionada', 'e muito mais'],
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: 'ivory-baron',
    search: { category: ['art' as const] },
    label: 'Explorar arte digital',
  },
] as const

export function HomePromos() {
  return (
    <section aria-label="Coleções em destaque" className="container-page grid gap-7 lg:grid-cols-2">
      {PROMOS.map((promo) => (
        // Mobile: the height grows with the text (a fixed 220px cut the copy and the CTA at 320-414px).
        <article
          key={promo.image}
          className="flex min-h-[220px] overflow-hidden rounded-md bg-surface md:min-h-[250px]"
        >
          {/* Frame: 287-292px artwork + ~265px right-aligned text column with 30px right padding. */}
          <div className="relative w-[42%] shrink-0 md:w-[287px]">
            <NftImage
              image={{ url: `/images/nft/${promo.image}-800.webp`, alt: '', width: 800, height: 800 }}
              sizes="(min-width: 768px) 287px, 40vw"
              alt=""
              className="absolute inset-0 rounded-[18px]"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-end p-4 text-right md:pt-[37px] md:pr-[30px] md:pb-[30px] md:pl-1">
            <h3 className="text-base leading-6 font-bold text-foreground md:text-lg">
              {promo.title[0]}
              <br />
              {promo.title[1]}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-text-secondary md:text-sm">{promo.text}</p>
            <Link
              to="/"
              search={{ ...promo.search }}
              hash="catalogo"
              activeOptions={{ includeHash: true }}
              aria-label={promo.label}
              className={cn(buttonVariants(), 'mt-auto h-10 w-[140px] shrink-0 font-medium')}
            >
              Explorar <ArrowRightIcon className="size-[18px]" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  {
    date: '12 de setembro',
    read: 6,
    title: 'Como funciona a propriedade de NFTs',
    text: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    image: 'ivory-baron',
  },
  {
    date: '13 de setembro',
    read: 2,
    title: '10 artistas digitais para acompanhar',
    text: 'Conheça criadores que moldam a cultura digital.',
    image: 'emerald-ape',
  },
  {
    date: '15 de setembro',
    read: 3,
    title: 'Raridade, atributos e procedência',
    text: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    image: 'sage-nomad',
  },
  {
    date: '15 de setembro',
    read: 2,
    title: 'Como proteger sua carteira',
    text: 'Proteja sua carteira, seus ativos e sua identidade.',
    image: 'golden-beat',
  },
] as const

/**
 * "Diário da Cunhagem": editorial content is out of scope (see the brief), so the cards are
 * previews without links; "Em breve" replaces "Ler mais" instead of pretending to work.
 */
export function HomeJournal() {
  return (
    <section aria-labelledby="journal-title" className="container-page flex flex-col gap-10">
      <header className="flex flex-col gap-3 text-center">
        <h2 id="journal-title" className="text-2xl leading-9 font-bold text-foreground md:text-[28px]">
          Diário da Cunhagem
        </h2>
        <p className="text-sm leading-[18px] text-text-secondary">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-md bg-surface">
              <div className="h-[195px]">
                <NftImage
                  image={{ url: `/images/nft/${post.image}-800.webp`, alt: '', width: 800, height: 800 }}
                  sizes="(min-width: 1024px) 290px, (min-width: 640px) 50vw, 100vw"
                  alt=""
                  className="object-[center_25%]"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
                <p className="text-xs leading-4 font-medium text-text-secondary">
                  {post.date} <span aria-hidden="true">&nbsp;|&nbsp;</span>
                  <span className="sr-only">, </span>Leitura de {post.read} min
                </p>
                {/* Two title lines reserved in the 4-column row, so the descriptions line up across cards. */}
                <h3 className="text-base leading-[21px] font-bold text-foreground lg:min-h-[42px]">{post.title}</h3>
                <p className="text-xs leading-4 font-medium text-text-secondary">{post.text}</p>
                <p className="mt-auto text-xs leading-[14px] font-bold text-text-muted">Em breve</p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
