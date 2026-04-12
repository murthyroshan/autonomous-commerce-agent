'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface SearchBarProps {
  onSearch: (query: string) => void
  loading: boolean
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [value, setValue] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onSearch(trimmed)
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
      className="flex w-full max-w-3xl gap-2"
      aria-label="Product search form"
    >
      <Input
        id="search-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find the best gaming laptop under ₹80,000"
        disabled={loading}
        className="flex-1 text-sm h-11"
        aria-label="Search query"
        autoComplete="off"
      />
      <Button
        id="search-submit"
        type="submit"
        disabled={loading || !value.trim()}
        className="h-11 px-6 font-semibold"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Searching…
          </span>
        ) : (
          'Search'
        )}
      </Button>
    </form>
  )
}
