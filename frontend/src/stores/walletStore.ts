'use client'

import { create } from 'zustand'
import { PeraWalletConnect } from '@perawallet/connect'
import { decodeUnsignedTransaction } from 'algosdk'

const TESTNET_CHAIN_ID = 416002
const CONNECT_MODAL_CLOSED = 'CONNECT_MODAL_CLOSED'

const peraWallet = new PeraWalletConnect({
  chainId: TESTNET_CHAIN_ID,
})

function attachDisconnectListener(set: (state: Partial<WalletStore>) => void) {
  peraWallet.connector?.off('disconnect')
  peraWallet.connector?.on('disconnect', () => {
    set({ address: null, connected: false })
  })
}

interface WalletStore {
  address: string | null
  connected: boolean
  connect: () => Promise<string | null>
  disconnect: () => void
  signTransaction: (txnB64: string) => Promise<string | null>
}

export const useWalletStore = create<WalletStore>((set) => ({
  address: null,
  connected: false,

  connect: async () => {
    try {
      const accounts = await peraWallet.connect()
      attachDisconnectListener(set)
      set({ address: accounts[0] ?? null, connected: Boolean(accounts[0]) })
      return accounts[0] ?? null
    } catch (error) {
      const errorType = (error as { data?: { type?: string } })?.data?.type
      if (errorType !== CONNECT_MODAL_CLOSED) {
        try {
          await peraWallet.disconnect()
          const accounts = await peraWallet.connect()
          attachDisconnectListener(set)
          set({ address: accounts[0] ?? null, connected: Boolean(accounts[0]) })
          return accounts[0] ?? null
        } catch (retryError) {
          console.error('Pera wallet connect failed', retryError)
        }
      }
      return null
    }
  },

  disconnect: () => {
    void peraWallet.disconnect().catch(() => {})
    set({ address: null, connected: false })
  },

  signTransaction: async (txnB64: string) => {
    try {
      const txnBytes = Uint8Array.from(atob(txnB64), (c) => c.charCodeAt(0))
      const txn = decodeUnsignedTransaction(txnBytes)
      const signed = await peraWallet.signTransaction([[{ txn }]])
      return btoa(String.fromCharCode(...signed[0]))
    } catch {
      return null
    }
  },
}))

if (typeof window !== 'undefined') {
  peraWallet
    .reconnectSession()
    .then((accounts: string[]) => {
      if (accounts.length) {
        attachDisconnectListener(useWalletStore.setState)
        useWalletStore.setState({ address: accounts[0], connected: true })
      }
    })
    .catch(async () => {
      await peraWallet.disconnect().catch(() => {})
    })
}
