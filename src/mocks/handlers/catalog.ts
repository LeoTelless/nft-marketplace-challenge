import { http, HttpResponse } from 'msw'
import { endpoints, nftListQuerySchema, type FieldErrors, type NftListResponse } from '@/contracts'
import { compareEth } from '@/shared/lib/eth'
import { db, findNft } from '../db/store'
import { is } from '../scenarios'
import { api, MockHttpError, route, validationError } from './utils'

function parseListQuery(url: URL) {
  const params = url.searchParams
  const raw = {
    q: params.get('q') || undefined,
    category: params.getAll('category').length ? params.getAll('category') : undefined,
    minPrice: params.get('minPrice') || undefined,
    maxPrice: params.get('maxPrice') || undefined,
    availability: params.get('availability') || undefined,
    featured: params.has('featured') ? params.get('featured') === 'true' : undefined,
    sort: params.get('sort') || undefined,
    page: params.has('page') ? Number(params.get('page')) : undefined,
    pageSize: params.has('pageSize') ? Number(params.get('pageSize')) : undefined,
  }
  const parsed = nftListQuerySchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {}
    for (const issue of parsed.error.issues) (fieldErrors[String(issue.path[0] ?? '_')] ??= []).push(issue.message)
    validationError(fieldErrors, 'Invalid catalog query')
  }
  return parsed.data
}

export const catalogHandlers = [
  http.get(
    api(endpoints.nfts),
    route(({ request }) => {
      const query = parseListQuery(new URL(request.url))
      const term = query.q?.toLowerCase()

      let items = is('empty') ? [] : [...db().nfts]
      if (term) {
        items = items.filter((nft) =>
          [nft.name, nft.creator.name, nft.description].some((text) => text.toLowerCase().includes(term)),
        )
      }
      if (query.category?.length) items = items.filter((nft) => query.category!.includes(nft.category))
      if (query.minPrice) items = items.filter((nft) => compareEth(nft.minPrice, query.minPrice!) >= 0)
      if (query.maxPrice) items = items.filter((nft) => compareEth(nft.minPrice, query.maxPrice!) <= 0)
      if (query.availability === 'available') items = items.filter((nft) => nft.totalAvailable > 0)
      if (query.availability === 'sold_out') items = items.filter((nft) => nft.totalAvailable === 0)
      if (query.featured !== undefined) items = items.filter((nft) => nft.featured === query.featured)

      items.sort((a, b) => {
        switch (query.sort) {
          case 'price_asc':
            return compareEth(a.minPrice, b.minPrice) || a.id.localeCompare(b.id)
          case 'price_desc':
            return compareEth(b.minPrice, a.minPrice) || a.id.localeCompare(b.id)
          case 'name_asc':
            return a.name.localeCompare(b.name)
          case 'oldest':
            return a.createdAt.localeCompare(b.createdAt)
          default:
            return b.createdAt.localeCompare(a.createdAt)
        }
      })

      const total = items.length
      const start = (query.page - 1) * query.pageSize
      const body: NftListResponse = {
        items: items.slice(start, start + query.pageSize),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      }
      return HttpResponse.json(body)
    }),
  ),

  http.get(
    api(endpoints.nft(':id')),
    route<{ id: string }>(({ params }) => {
      const nft = is('empty') ? undefined : findNft(params.id)
      if (!nft) throw new MockHttpError(404, 'not_found', `NFT ${params.id} not found`)
      return HttpResponse.json(nft)
    }),
  ),
]
