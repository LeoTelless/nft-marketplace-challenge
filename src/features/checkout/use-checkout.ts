import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { quoteOutdatedDetailsSchema, type CreateOrderRequest, type Network, type Order, type Quote } from '@/contracts'
import { useCurrentUser } from '@/features/auth/session'
import { useCart } from '@/features/cart/use-cart'
import { putQuote, useQuote, useRevalidateQuote } from '@/features/cart/use-quote'
import { ordersApi } from '@/features/orders/api'
import { isApiError } from '@/shared/api/api-error'
import { queryKeys } from '@/shared/api/query-keys'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { userStorage } from '@/shared/session/user-storage'
import { purchaseAttempts, type PurchaseAttempt } from './purchase-attempt'
import { toCollector, type CheckoutFormValues } from './schema'

export type CheckoutStep = 'form' | 'review'

/**
 * Why the purchase cannot be confirmed right now (`null` = it can).
 * - `quote_changed`: price/availability/coupon/fee changed after the user reviewed it: the
 *   new values must be accepted explicitly (`acceptQuote`) before confirming;
 * - `quote_updating`: a new quote is being computed (e.g. right after `nft.updated`);
 * - `quote_issues`: some line is sold out / above availability (fix the cart first).
 */
export type ConfirmBlock = 'not_reviewed' | 'quote_updating' | 'quote_changed' | 'quote_issues' | 'wallet_disconnected' | 'empty_cart'

export type CheckoutOutcome =
  | { type: 'created'; order: Order }
  /** Repeated click while a confirmation is already running: nothing done. */
  | { type: 'ignored' }
  /** Nothing was sent: the quote changed (new values shown) and needs a new confirmation. */
  | { type: 'quote_changed'; quote: Quote }
  | { type: 'blocked'; reason: ConfirmBlock }
  /** No definitive answer (timeout/network/5xx): the attempt is kept; retry re-sends the same request. */
  | { type: 'unknown_result'; message: string }
  /** Definitive refusal (validation, conflict...). The caller maps field errors to the form. */
  | { type: 'failed'; error: unknown; message: string }

const DRAFT_ENTRY = 'checkout-draft'

/** Checkout form draft per user: survives refresh and session expiry (resumed after login). */
export const checkoutDraft = {
  get: (userId: string) => userStorage.get<CheckoutFormValues>(userId, DRAFT_ENTRY),
  set: (userId: string, values: CheckoutFormValues) => userStorage.set(userId, DRAFT_ENTRY, values),
  clear: (userId: string) => userStorage.remove(userId, DRAFT_ENTRY),
}

/**
 * Checkout orchestration (UI-agnostic):
 * 1. `review(values)`: the form is valid and the wallet connected; the current quote becomes
 *    the one the user agreed to (`acceptedFingerprint`).
 * 2. Any later change of the quote (socket `nft.updated`, coupon, network, revalidation)
 *    blocks the confirmation until `acceptQuote()`.
 * 3. `confirm(values)`: re-validates the quote with the API; if it differs nothing is sent.
 *    Otherwise creates the order with an idempotency key persisted *before* sending.
 *    Repeated clicks while sending are ignored; after a timeout the retry re-sends the same
 *    key and body, so the server returns the same order. Never retried automatically.
 * The order is created `pending`; the caller navigates to the order screen, which only shows
 * the confirmation once the simulation confirms it.
 */
export function useCheckout({ network, walletConnected }: { network: Network; walletConnected: boolean }) {
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const userId = user?.id ?? null
  const cart = useCart()
  const quote = useQuote(network)
  const revalidateQuote = useRevalidateQuote()

  const [step, setStep] = useState<CheckoutStep>('form')
  // The accepted quote belongs to a network: changing the network invalidates the review.
  const [accepted, setAccepted] = useState<{ network: Network; fingerprint: string } | null>(null)
  const acceptedFingerprint = accepted?.network === network ? accepted.fingerprint : null
  const effectiveStep: CheckoutStep = step === 'review' && acceptedFingerprint !== null ? 'review' : 'form'
  // The attempt lives in sessionStorage (per user); this tick re-renders after it changes.
  const [, setAttemptTick] = useState(0)
  const attempt = userId ? purchaseAttempts.get(userId) : null
  const refreshAttempt = useCallback(() => setAttemptTick((t) => t + 1), [])
  const sending = useRef(false)

  const currentQuote = quote.data
  const quoteChanged = acceptedFingerprint !== null && currentQuote !== undefined && currentQuote.fingerprint !== acceptedFingerprint

  const block: ConfirmBlock | null = !cart.data?.items.length
    ? 'empty_cart'
    : effectiveStep !== 'review' || acceptedFingerprint === null
      ? 'not_reviewed'
      : quote.isUpdating || !currentQuote
        ? 'quote_updating'
        : currentQuote.issues.length > 0
          ? 'quote_issues'
          : quoteChanged
            ? 'quote_changed'
            : !walletConnected
              ? 'wallet_disconnected'
              : null

  const create = useMutation({
    mutationKey: ['checkout', 'create-order'],
    retry: 0,
    mutationFn: (pending: PurchaseAttempt) => ordersApi.create(pending.body, pending.key),
  })

  const review = useCallback(() => {
    if (!currentQuote) return false
    setAccepted({ network, fingerprint: currentQuote.fingerprint })
    setStep('review')
    return true
  }, [currentQuote, network])

  const acceptQuote = useCallback(() => {
    if (currentQuote) setAccepted({ network, fingerprint: currentQuote.fingerprint })
  }, [currentQuote, network])

  const backToForm = useCallback(() => {
    setStep('form')
    setAccepted(null)
  }, [])

  const send = useCallback(
    async (pending: PurchaseAttempt): Promise<CheckoutOutcome> => {
      if (!userId) return { type: 'failed', error: null, message: apiErrorMessage(null) }
      try {
        const order = await create.mutateAsync(pending)
        purchaseAttempts.clear(userId)
        checkoutDraft.clear(userId)
        refreshAttempt()
        queryClient.setQueryData(queryKeys.user.order(userId, order.id), order)
        void queryClient.invalidateQueries({ queryKey: queryKeys.user.orders(userId), exact: true })
        return { type: 'created', order }
      } catch (error) {
        // No definitive answer, or the session expired: keep the attempt for an explicit retry.
        if (!isApiError(error) || error.isTransient || error.isUnauthorized) {
          return {
            type: 'unknown_result',
            message: isApiError(error) && error.isUnauthorized ? apiErrorMessage(error) : 'Não recebemos a resposta do servidor. Tente novamente: a mesma compra será recuperada, sem cobrança duplicada.',
          }
        }
        purchaseAttempts.clear(userId)
        refreshAttempt()
        if (error.code === 'quote_outdated' || error.code === 'availability_conflict') {
          const details = quoteOutdatedDetailsSchema.safeParse(error.details)
          if (details.success && quote.owner) {
            putQuote(queryClient, quote.owner, details.data.quote, quote.couponCode)
            void queryClient.invalidateQueries({ queryKey: queryKeys.cart.detail(quote.owner), exact: true })
            return { type: 'quote_changed', quote: details.data.quote }
          }
        }
        return { type: 'failed', error, message: apiErrorMessage(error) }
      }
    },
    [create, queryClient, quote.owner, quote.couponCode, userId, refreshAttempt],
  )

  const confirm = useCallback(
    async (values: CheckoutFormValues): Promise<CheckoutOutcome> => {
      if (sending.current) return { type: 'ignored' }
      sending.current = true
      try {
        if (!userId || !quote.owner) return { type: 'blocked', reason: 'not_reviewed' }
        // An attempt without a definitive answer is re-sent as is (same key, same body).
        const stored = purchaseAttempts.get(userId)
        if (stored) return await send(stored)

        if (block && block !== 'quote_updating') return { type: 'blocked', reason: block }
        const request = quote.couponCode ? { network, couponCode: quote.couponCode } : { network }
        const fresh = await revalidateQuote(quote.owner, request)
        if (fresh.issues.length > 0) return { type: 'blocked', reason: 'quote_issues' }
        if (fresh.fingerprint !== acceptedFingerprint) return { type: 'quote_changed', quote: fresh }

        const body: CreateOrderRequest = {
          quoteId: fresh.id,
          quoteFingerprint: fresh.fingerprint,
          walletId: values.walletId,
          network: values.network,
          collector: toCollector(values.collector),
        }
        const created = purchaseAttempts.create(userId, body)
        refreshAttempt()
        return await send(created)
      } catch (error) {
        return { type: 'failed', error, message: apiErrorMessage(error) }
      } finally {
        sending.current = false
      }
    },
    [userId, quote.owner, quote.couponCode, block, network, revalidateQuote, acceptedFingerprint, send, refreshAttempt],
  )

  /** Drops an unanswered attempt (only if the user explicitly gives up on it). */
  const discardAttempt = useCallback(() => {
    if (!userId) return
    purchaseAttempts.clear(userId)
    refreshAttempt()
  }, [userId, refreshAttempt])

  return {
    step: effectiveStep,
    review,
    backToForm,
    quote,
    acceptedFingerprint,
    quoteChanged,
    acceptQuote,
    block,
    /** A previous attempt without a definitive answer (timeout, refresh, expired session). */
    pendingAttempt: attempt,
    discardAttempt,
    confirm,
    isSubmitting: create.isPending,
  }
}
