'use client'

import { useEffect, useState } from 'react'
import { PeraWalletConnect } from '@perawallet/connect'

const peraWallet = new PeraWalletConnect()

export function usePeraWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    peraWallet
      .reconnectSession()
      .then((accounts: string[]) => {
        if (accounts.length) {
          setAddress(accounts[0])
          setConnected(true)
        }
      })
      .catch(() => {})
  }, [])

  const connect = async (): Promise<string | null> => {
    try {
      const accounts = await peraWallet.connect()
      setAddress(accounts[0] ?? null)
      setConnected(Boolean(accounts[0]))
      return accounts[0] ?? null
    } catch {
      return null
    }
  }

  const disconnect = () => {
    peraWallet.disconnect()
    setAddress(null)
    setConnected(false)
  }

  const signTransaction = async (txnB64: string): Promise<string | null> => {
    try {
      const txnBytes = Uint8Array.from(atob(txnB64), (c) => c.charCodeAt(0))
      const signedTxns = await peraWallet.signTransaction([[{ txn: txnBytes }]])
      return btoa(String.fromCharCode(...signedTxns[0]))
    } catch (e) {
      console.error('Pera signing failed:', e)
      return null
    }
  }

  return { address, connected, connect, disconnect, signTransaction }
}
