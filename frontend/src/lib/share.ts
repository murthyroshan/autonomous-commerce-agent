/**
 * Encodes a search result into a shareable URL.
 * All data is in the URL — no backend needed.
 * Format: /share?d={base64(json)}
 */

interface ShareData {
  query:          string
  winner:         {
    title:        string
    price:        number
    source:       string
    link:         string
    score:        number
    justification?: string
    rating?:      number
    review_count?: number
  }
  total_compared: number
  timestamp:      string
}

export function encodeShareData(data: ShareData): string {
  const json      = JSON.stringify(data)
  const encoded   = btoa(unescape(encodeURIComponent(json)))
  return encoded
}

export function decodeShareData(encoded: string): ShareData | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)))
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function buildShareUrl(data: ShareData): string {
  const encoded = encodeShareData(data)
  const base    = typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:3000'
  return `${base}/share?d=${encodeURIComponent(encoded)}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
