'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
}

export default function Combobox({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = value
    ? suggestions.filter((s) =>
        s.toLowerCase().includes(value.toLowerCase())
      )
    : suggestions

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(-1)
  }, [value])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  const select = useCallback(
    (val: string) => {
      onChange(val)
      setOpen(false)
      setHighlightIndex(-1)
    },
    [onChange]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }

    if (!open) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex((i) => (i < filtered.length - 1 ? i + 1 : i))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex((i) => (i > 0 ? i - 1 : i))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          select(filtered[highlightIndex])
        }
        break
      case 'Escape':
        setOpen(false)
        setHighlightIndex(-1)
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={
          className ??
          'w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:outline-none text-sm'
        }
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg"
        >
          {filtered.map((item, i) => (
            <li
              key={item}
              onMouseDown={() => select(item)}
              className={`px-3 py-2 cursor-pointer text-sm ${
                i === highlightIndex
                  ? 'bg-primary-100 text-primary-800'
                  : 'hover:bg-gray-50'
              }`}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
