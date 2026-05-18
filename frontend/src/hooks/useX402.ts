'use client'

/**
 * useX402.ts — x402 Price Lock browser handshake hook.
 *
 * Implements the x402 v2 protocol (NOT the legacy v1 X-PAYMENT header).
 *
 * Flow:
 *   1. GET /api/v1/x402/initiate  →  402 + PAYMENT-REQUIRED header (base64 JSON)
 *   2. Decode PAYMENT-REQUIRED JSON → extract amount, recipient, accepted requirements
 *   3. Build algosdk PaymentTxn, sign via Pera Wallet
 *   4. Encode signed txn as base64 → wrap in PaymentPayload JSON → base64-encode
 *   5. Retry GET /api/v1/x402/initiate with PAYMENT-SIGNATURE: <base64(PaymentPayload JSON)>
 *   6. 200 → store PriceLockPayload, status = 'locked'
 *
 * Header names (x402 v2 SDK constants):
 *   Request:  PAYMENT-SIGNATURE  (was X-PAYMENT in v1)
 *   Response: PAYMENT-REQUIRED   (was X-402-Payment-Request in old docs)
 *
 * DO NOT use @x402-avm/fetch here — that package is Node.js only.
 * Browser wallets must sign manually via Pera as shown below.
 */

import { useState } from 'react'
import algosdk from 'algosdk'

/**
 * Type of the signTransaction helper returned by usePeraWallet.
 * Accepts a base64 msgpack-encoded unsigned transaction + signer address.
 * Returns the signed bytes as a number[] or null if the user rejected.
 */
type SignFn = (txnB64: string, signerAddress: string) => Promise<number[] | null>

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PriceLockPayload {
  product_id:          string
  verified_price:      number
  verified_at:         string   // ISO-8601
  lock_expires_at:     string   // ISO-8601
  facilitator_receipt: string   // Algorand tx ID
  explorer_link:       string   // algonode testnet link
}

export type X402Status =
  | 'idle'
  | 'awaiting_payment'
  | 'signing'
  | 'confirming'
  | 'locked'
  | 'failed'

export interface X402State {
  status:    X402Status
  priceLock: PriceLockPayload | null
  error:     string | null
}

// ── x402 v2 header constants (must match x402/http/constants.py) ─────────────
// The x402 Python SDK uses these exact strings (case-sensitive for HTTP/2,
// but browsers normalise response headers to lowercase).
const PAYMENT_REQUIRED_HEADER  = 'payment-required'   // 402 response header
const PAYMENT_SIGNATURE_HEADER = 'PAYMENT-SIGNATURE'  // request header (not lowercased)

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a Uint8Array to a standard Base64 string using only web-native
 * browser APIs.  This avoids adding a `buffer` polyfill to the Next.js bundle.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const binaryString = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join('')
  return btoa(binaryString)
}

/**
 * Base64-decode and JSON-parse the PAYMENT-REQUIRED header value.
 * The x402 Python SDK encodes it as: base64(json(PaymentRequired)).
 *
 * Returns the parsed object or throws if the header is malformed.
 */
function decodePaymentRequired(headerValue: string): Record<string, unknown> {
  try {
    const json = atob(headerValue)
    return JSON.parse(json) as Record<string, unknown>
  } catch (e) {
    throw new Error(`Failed to decode PAYMENT-REQUIRED header: ${e}`)
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useX402() {
  const [x402State, setX402State] = useState<X402State>({
    status:    'idle',
    priceLock: null,
    error:     null,
  })

  /**
   * Initiate the full x402 v2 price-lock handshake for a winning product.
   *
   * @param productId    - The product's identifier (used as query param).
   * @param signFn       - The signTransaction helper from usePeraWallet.
   *                       Using this (not peraWallet directly) ensures the
   *                       WalletConnect session is alive before signing and
   *                       handles the algosdk v3 → Pera v1.5.x compatibility.
   * @param activeAddress - The currently connected Algorand wallet address.
   */
  const initiateVerification = async (
    productId:     string,
    signFn:        SignFn,
    activeAddress: string,
    productPrice?: number,
  ): Promise<void> => {
    setX402State({ status: 'awaiting_payment', priceLock: null, error: null })

    // Guard: wallet must be connected before we can build a transaction.
    if (!activeAddress) {
      setX402State({
        status: 'failed',
        priceLock: null,
        error: 'Wallet not connected. Please connect your Pera Wallet first.',
      })
      return
    }

    try {
      // ── Step 1: Initial request (expect 402) ────────────────────────────────
      // Build the URL once — reuse for both the 402 probe and the signed retry.
      // product_price is only read by the route handler on the SECOND request
      // (the first is intercepted by the x402 middleware which returns 402 early).
      const endpointUrl = new URL(`${API}/api/v1/x402/initiate`)
      endpointUrl.searchParams.set('product_id', productId)
      if (productPrice != null && productPrice > 0) {
        endpointUrl.searchParams.set('product_price', String(productPrice))
      }
      const initRes = await fetch(endpointUrl.toString())

      if (initRes.ok) {
        // Endpoint was already paid (e.g. cached session) — skip signing.
        const data: PriceLockPayload = await initRes.json()
        setX402State({ status: 'locked', priceLock: data, error: null })
        return
      }

      if (initRes.status !== 402) {
        throw new Error(
          `Unexpected response ${initRes.status} from /api/v1/x402/initiate`,
        )
      }

      // ── Step 2: Decode the x402 v2 PAYMENT-REQUIRED header ──────────────────
      // The x402 Python SDK sends: PAYMENT-REQUIRED: base64(json(PaymentRequired))
      // Browsers normalise response header names to lowercase.
      const paymentRequiredHeader = initRes.headers.get(PAYMENT_REQUIRED_HEADER)
      if (!paymentRequiredHeader) {
        // Provide a detailed error to help diagnose CORS / middleware issues.
        const allHeaders: string[] = []
        initRes.headers.forEach((v, k) => allHeaders.push(`${k}: ${v}`))
        throw new Error(
          `Server returned 402 but ${PAYMENT_REQUIRED_HEADER} header is missing. ` +
          `Available headers: [${allHeaders.join(', ')}]. ` +
          `Check that KARTIQ_MERCHANT_WALLET is set on the backend and ` +
          `Access-Control-Expose-Headers includes "PAYMENT-REQUIRED".`,
        )
      }

      const paymentRequired = decodePaymentRequired(paymentRequiredHeader)

      // Extract payment details from the first accepted requirement.
      const accepts = paymentRequired['accepts'] as Array<Record<string, unknown>>
      if (!accepts || accepts.length === 0) {
        throw new Error('PAYMENT-REQUIRED header contains no accepted payment options.')
      }
      const firstAccepted = accepts[0]

      const amountMicro = parseInt(String(firstAccepted['amount'] ?? '100000'), 10)
      const recipient = (
        (firstAccepted['payTo'] as string | undefined) ??
        (firstAccepted['pay_to'] as string | undefined) ??
        process.env.NEXT_PUBLIC_KARTIQ_MERCHANT_WALLET
      )

      if (!recipient) {
        throw new Error(
          'No payTo address in PAYMENT-REQUIRED and NEXT_PUBLIC_KARTIQ_MERCHANT_WALLET is not set.',
        )
      }

      // ── Step 3: Build the unsigned ASA transfer (axfer) transaction ─────────
      // The x402-avm facilitator REQUIRES an axfer (ASA/USDC transfer), NOT a
      // native ALGO pay transaction. The facilitator's verify() rejects `pay`
      // type transactions with ERR_INVALID_ASSET_ID at the "must be axfer" check.
      setX402State((prev) => ({ ...prev, status: 'signing' }))

      const assetId  = parseInt(String(firstAccepted['asset'] ?? '10458941'), 10)

      const algodClient = new algosdk.Algodv2(
        '',
        'https://testnet-api.algonode.cloud',
        '',
      )
      const suggestedParams = await algodClient.getTransactionParams().do()

      // algosdk v3 axfer: makeAssetTransferTxnWithSuggestedParamsFromObject
      // Parameters: sender, receiver → assetSender (opt-in uses sender=receiver)
      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender:          activeAddress,
        receiver:        recipient,
        assetIndex:      assetId,
        amount:          amountMicro,
        suggestedParams: suggestedParams,
      })

      // ── Step 4: Sign via Pera Wallet ────────────────────────────────────────
      // We use the signFn from usePeraWallet (not peraWallet.signTransaction directly)
      // because the helper:
      //   1. Checks peraWallet.isConnected and calls reconnectSession() if the
      //      WalletConnect session dropped between connect and sign — fixing the
      //      "Please launch Pera Wallet" / no mobile notification bug.
      //   2. Already applies the algosdk v3→v2 encode/decode round-trip that
      //      Pera Wallet Connect v1.5.x needs to encode the transaction correctly.
      //   3. Distinguishes user-rejected (returns null) from real errors (throws).
      //
      // Encode the algosdk v3 Transaction to standard base64 msgpack bytes — the
      // same format usePeraWallet.signTransaction() expects as its first argument.
      const txnMsgpack = algosdk.encodeUnsignedTransaction(txn)
      const txnB64     = uint8ArrayToBase64(txnMsgpack)

      const signedNumberArray = await signFn(txnB64, activeAddress)
      if (!signedNumberArray) {
        // User rejected the signing request in Pera Wallet.
        setX402State({ status: 'idle', priceLock: null, error: null })
        return
      }
      const signedBytes = Uint8Array.from(signedNumberArray)

      // ── Step 5: Build the x402 v2 PaymentPayload JSON and base64-encode it ──
      // x402 v2 protocol: PAYMENT-SIGNATURE = base64(json(PaymentPayload))
      // PaymentPayload structure:
      //   { x402Version: 2,
      //     payload: { paymentGroup: ["<base64-signed-txn>"], paymentIndex: 0 },
      //     accepted: <the chosen PaymentRequirements object>,
      //     resource: <optional ResourceInfo> }
      const signedTxnBase64 = uint8ArrayToBase64(signedBytes)

      const paymentPayload = {
        x402Version: 2,
        payload: {
          paymentGroup: [signedTxnBase64],
          paymentIndex: 0,
        },
        accepted: firstAccepted,
        resource: paymentRequired['resource'] ?? null,
      }

      const paymentSignatureHeader = btoa(
        JSON.stringify(paymentPayload)
      )

      // ── Step 6: Retry with PAYMENT-SIGNATURE header ──────────────────────
      // Re-use the same URL (including product_price) — the route handler
      // reads product_price from this request to return the real INR price.
      setX402State((prev) => ({ ...prev, status: 'confirming' }))

      const verifyRes = await fetch(endpointUrl.toString(), {
        headers: {
          [PAYMENT_SIGNATURE_HEADER]: paymentSignatureHeader,
        },
      })

      if (!verifyRes.ok) {
        const errBody = await verifyRes.text().catch(() => '')
        throw new Error(
          `Facilitator rejected payment (HTTP ${verifyRes.status}): ${errBody}`,
        )
      }

      // ── Step 7: Store the price lock payload ────────────────────────────────
      // The backend body contains a placeholder receipt ("pending:...") because
      // the settlement tx ID is only available after the middleware runs
      // process_settlement() — which happens AFTER the route handler returns.
      // The middleware adds PAYMENT-RESPONSE to the 200 response headers, which
      // contains the real SettleResponse (base64 JSON) including the tx ID.
      const priceLock: PriceLockPayload = await verifyRes.json()

      // Patch the receipt with the real tx ID from PAYMENT-RESPONSE header
      const paymentResponseHeader = verifyRes.headers.get('payment-response')
      if (paymentResponseHeader) {
        try {
          const settleResponse = JSON.parse(atob(paymentResponseHeader))
          const txId = settleResponse?.transaction ?? settleResponse?.tx_id ?? ''
          if (txId) {
            priceLock.facilitator_receipt = txId
            priceLock.explorer_link = `https://testnet.explorer.algonode.cloud/tx/${txId}`
          }
        } catch {
          // Header present but malformed — keep the placeholder
        }
      }

      setX402State({ status: 'locked', priceLock, error: null })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error during x402 flow'
      setX402State({ status: 'failed', priceLock: null, error: message })
    }
  }

  /** Reset back to idle so the user can retry. */
  const reset = () =>
    setX402State({ status: 'idle', priceLock: null, error: null })

  return { x402State, initiateVerification, reset }
}
