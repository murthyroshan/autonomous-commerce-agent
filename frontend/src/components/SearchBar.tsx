'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  loading: boolean
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [value, setValue] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed && !loading) onSearch(trimmed)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const trimmed = value.trim()
      if (trimmed && !loading) onSearch(trimmed)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-2xl items-center gap-0 rounded-2xl overflow-hidden"
      style={{
        border: '1px solid #333',
        background: '#111',
        boxShadow: '0 0 0 0 transparent',
        transition: 'box-shadow 0.2s ease',
      }}
      aria-label="Product search form"
      onFocus={(e) => {
        const form = e.currentTarget
        form.style.boxShadow = '0 0 0 2px rgba(124,58,237,0.5)'
        form.style.borderColor = '#7c3aed'
      }}
      onBlur={(e) => {
        // only remove focus ring when focus leaves the form entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          const form = e.currentTarget
          form.style.boxShadow = '0 0 0 0 transparent'
          form.style.borderColor = '#333'
        }
      }}
    >
      <input
        id="search-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find the best gaming laptop under ₹80,000..."
        disabled={loading}
        autoComplete="off"
        aria-label="Search query"
        className="flex-1 bg-transparent px-5 py-3.5 text-sm outline-none"
        style={{
          color: '#f5f5f5',
          caretColor: '#7c3aed',
        }}
      />

      <button
        id="search-submit"
        type="submit"
        disabled={loading || !value.trim()}
        className="flex items-center gap-2 px-6 py-3.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style={{
          background: '#7c3aed',
          color: '#fff',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          minWidth: '110px',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => {
          if (!loading && value.trim()) {
            e.currentTarget.style.background = '#6d28d9'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#7c3aed'
        }}
      >
        {loading ? (
          <>
            {/* Spinner SVG */}
            <svg
              className="animate-spin-slow"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12" cy="12" r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeOpacity="0.25"
              />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            Searching…
          </>
        ) : (
          'Search'
        )}
      </button>
    </form>
  )
}
