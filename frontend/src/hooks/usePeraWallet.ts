'use client'

import { useEffect, useState } from 'react'
import { PeraWalletConnect } from '@perawallet/connect'
import algosdk from 'algosdk'

// WalletConnect v2 requires a projectId and dApp metadata so Pera mobile
// knows what dApp it's connecting to ("dapp not responding" is caused when
// this is missing).  Register your own at https://cloud.walletconnect.com —
// the SDK has a built-in fallback but providing your own is recommended in
// production.
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? ''

// Module-level singleton so all components share the same Pera session.
// Exported so other hooks (e.g. useX402) can reuse the same instance.
export const peraWallet = new PeraWalletConnect({
  // Use chainId for testnet — must match the Algorand node the backend is connected to.
  // WalletConnect v2 project ID — required to avoid "dapp not responding".
  ...(WC_PROJECT_ID ? { projectId: WC_PROJECT_ID } : {}),
  // dApp metadata displayed inside the Pera Wallet mobile UI.
  chainId: 416002,  // Algorand testnet chain ID
})

let globalAddress: string | null = null
let globalConnected: boolean = false
const stateListeners = new Set<() => void>()

function updateGlobalState(addr: string | null, isConn: boolean) {
  if (globalAddress === addr && globalConnected === isConn) return
  globalAddress = addr
  globalConnected = isConn
  stateListeners.forEach((fn) => fn())
}

export function usePeraWallet() {
  const [address, setAddress] = useState<string | null>(globalAddress)
  const [connected, setConnected] = useState(globalConnected)

  useEffect(() => {
    const listener = () => {
      setAddress(globalAddress)
      setConnected(globalConnected)
    }
    stateListeners.add(listener)

    // Try to restore a previous session on mount.
    if (!globalConnected) {
      peraWallet
        .reconnectSession()
        .then((accounts: string[]) => {
          if (accounts.length) {
            updateGlobalState(accounts[0], true)
          }
        })
        .catch(() => {
          // No prior session saved — that's fine.
        })
    }

    // Keep React state in sync if the user disconnects from the Pera mobile app.
    const handleDisconnect = () => {
      updateGlobalState(null, false)
    }

    // The Pera SDK exposes a WalletConnect connector underneath.
    const connector = (peraWallet as unknown as { connector?: { on: (event: string, cb: () => void) => void } }).connector
    if (connector?.on) {
      connector.on('disconnect', handleDisconnect)
    }

    return () => {
      stateListeners.delete(listener)
    }
  }, [])

  /**
   * Open the Pera Wallet modal and connect.
   * Returns the first connected address on success, or null on cancel/error.
   */
  const connect = async (): Promise<string | null> => {
    try {
      const accounts = await peraWallet.connect()
      const first = accounts[0] ?? null
      updateGlobalState(first, Boolean(first))
      return first
    } catch {
      // User cancelled the modal — not an error.
      return null
    }
  }

  /** Disconnect and clear local state. */
  const disconnect = () => {
    peraWallet.disconnect()
    updateGlobalState(null, false)
  }

  /**
   * Sign a base64-encoded unsigned transaction with the connected Pera account.
   * The txnB64 must be the raw msgpack bytes encoded as standard base64
   * (produced by algosdk.encodeUnsignedTransaction on the backend).
   *
   * Returns the signed transaction as a number array, or null on failure.
   */
  const signTransaction = async (txnB64: string, signerAddress: string): Promise<number[] | null> => {
    if (!peraWallet.isConnected) {
      updateGlobalState(null, false)
      throw new Error('Pera wallet not connected. Please connect your wallet to sign.')
    }
    // We do not rely on the React state closures (`connected`, `address`) here because
    // if the user connects during the same render cycle (e.g. inside handleConfirm),
    // these values will be stale. We require the caller to pass the known good address.
    try {
      // If the module singleton was wiped by Next.js hot-reloading, or session dropped,
      // peraWallet.connector will be missing and signing will hard crash. Try to reconnect first.
      const connector = (peraWallet as unknown as { connector?: unknown }).connector
      if (!connector) {
        await peraWallet.reconnectSession()
      }

      if (!peraWallet.isConnected) {
        updateGlobalState(null, false)
        throw new Error('Pera wallet not connected. Please connect your wallet to sign.')
      }

      const txnBytes = Uint8Array.from(atob(txnB64), (c) => c.charCodeAt(0))
      const txn = algosdk.decodeUnsignedTransaction(txnBytes)

      // Pera expects [[{ txn, signers }]] — explicitly provide the connected address
      // as the signer to ensure correct routing to the mobile app.
      const signedTxns = await peraWallet.signTransaction([[{ txn, signers: [signerAddress] }]])
      if (!signedTxns || signedTxns.length === 0 || !signedTxns[0]) {
        return null // Treat as cancelled or empty response
      }
      // Convert Uint8Array directly to a numbered array to bypass all Base64 translation errors
      return Array.from(signedTxns[0])
    } catch (e: any) {
      console.warn('Pera signing failed:', e)
      const msg     = e?.message?.toLowerCase() || ''
      const code    = e?.data?.code ?? e?.code ?? 0

      // ── User cancelled — not an error ──────────────────────────────────────
      if (
        msg.includes('user rejected') ||
        msg.includes('cancelled') ||
        msg.includes('declined') ||
        code === 4001
      ) {
        return null
      }

      // ── Error 4100: another request is already pending in this WC session ──
      // This happens when the x402 signing completes but the WalletConnect v2
      // session hasn't fully settled before the next signing request arrives.
      // Fix: wait briefly, reconnect to flush the stale pending state, retry once.
      if (code === 4100 || msg.includes('transaction request pending') || msg.includes('4100')) {
        console.warn('Pera 4100: stale pending request — reconnecting and retrying...')
        try {
          // Give the mobile app 1.5 s to finalise the previous request
          await new Promise((r) => setTimeout(r, 1500))
          await peraWallet.reconnectSession()

          // Retry the signing once after reconnect
          const txnBytes2 = Uint8Array.from(atob(txnB64), (c) => c.charCodeAt(0))
          const txn2      = algosdk.decodeUnsignedTransaction(txnBytes2)
          const retried   = await peraWallet.signTransaction([[{ txn: txn2, signers: [signerAddress] }]])
          if (!retried || retried.length === 0 || !retried[0]) {
            return null
          }
          return Array.from(retried[0])
        } catch (retryErr: any) {
          const retryMsg = retryErr?.message?.toLowerCase() || ''
          if (
            retryMsg.includes('user rejected') ||
            retryMsg.includes('cancelled') ||
            retryMsg.includes('declined')
          ) {
            return null
          }
          throw new Error(
            'Pera Wallet has a pending request that could not be cleared. ' +
            'Please open Pera Wallet on your phone, dismiss any pending requests, ' +
            'then try again. If the problem persists, disconnect and reconnect your wallet.',
          )
        }
      }

      throw e // Re-raise unexpected errors
    }
  }

  return { address, connected, connect, disconnect, signTransaction }
}
