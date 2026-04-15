'use client'

import { useEffect, useState } from 'react'
import { PeraWalletConnect } from '@perawallet/connect'
import algosdk from 'algosdk'

// Module-level singleton so all components share the same Pera session.
const peraWallet = new PeraWalletConnect()

export function usePeraWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Try to restore a previous session on mount.
    peraWallet
      .reconnectSession()
      .then((accounts: string[]) => {
        if (accounts.length) {
          setAddress(accounts[0])
          setConnected(true)
        }
      })
      .catch(() => {
        // No prior session saved — that's fine.
      })

    // Keep React state in sync if the user disconnects from the Pera mobile app.
    const handleDisconnect = () => {
      setAddress(null)
      setConnected(false)
    }

    // The Pera SDK exposes a WalletConnect connector underneath.
    const connector = (peraWallet as unknown as { connector?: { on: (event: string, cb: () => void) => void } }).connector
    if (connector?.on) {
      connector.on('disconnect', handleDisconnect)
    }

    return () => {
      // Cleanup is not strictly needed for module-level singletons
      // but avoids memory leaks in dev hot-reloads.
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
      setAddress(first)
      setConnected(Boolean(first))
      return first
    } catch {
      // User cancelled the modal — not an error.
      return null
    }
  }

  /** Disconnect and clear local state. */
  const disconnect = () => {
    peraWallet.disconnect()
    setAddress(null)
    setConnected(false)
  }

  /**
   * Sign a base64-encoded unsigned transaction with the connected Pera account.
   * The txnB64 must be the raw msgpack bytes encoded as standard base64
   * (produced by algosdk.encodeUnsignedTransaction on the backend).
   *
   * Returns the signed transaction as base64, or null on failure.
   */
  const signTransaction = async (txnB64: string, signerAddress: string): Promise<string | null> => {
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

      const txnBytes = Uint8Array.from(atob(txnB64), (c) => c.charCodeAt(0))
      const txn = algosdk.decodeUnsignedTransaction(txnBytes)

      // Pera expects [[{ txn, signers }]] — explicitly provide the connected address 
      // as the signer to ensure correct routing to the mobile app.
      const signedTxns = await peraWallet.signTransaction([[{ txn, signers: [signerAddress] }]])
      return btoa(String.fromCharCode(...signedTxns[0]))
    } catch (e) {
      // Don't use console.error in Next 14+; it triggers the dev overlay even for handled errors
      console.warn('Pera signing failed or user cancelled:', e)
      return null
    }
  }

  return { address, connected, connect, disconnect, signTransaction }
}
