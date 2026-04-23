'use client'

import { useEffect, useState } from 'react'
import { PeraWalletConnect } from '@perawallet/connect'
import algosdk from 'algosdk'

// Module-level singleton so all components share the same Pera session.
const peraWallet = new PeraWalletConnect()

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
      // Convert Uint8Array directly to a numbered array to bypass all Base64 translation errors
      return Array.from(signedTxns[0])
    } catch (e: any) {
      console.warn('Pera signing failed:', e)
      const msg = e?.message?.toLowerCase() || ''
      if (msg.includes('user rejected') || msg.includes('cancelled') || msg.includes('declined')) {
        return null // Silently cancel
      }
      throw e // Raise the error up!
    }
  }

  return { address, connected, connect, disconnect, signTransaction }
}
