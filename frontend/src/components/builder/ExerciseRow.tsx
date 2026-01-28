'use client'

import { useState, useRef, useEffect } from 'react'

interface ExerciseRowProps {
  exerciseId: number
  text: string
  onUpdate: (id: number, newText: string) => void | Promise<void>
  onDelete: (id: number) => void | Promise<void>
}

export default function ExerciseRow({ exerciseId, text, onUpdate, onDelete }: ExerciseRowProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(text)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(text)
  }, [text])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function handleSave() {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed && trimmed !== text) {
      onUpdate(exerciseId, trimmed)
    } else {
      setValue(text)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setValue(text)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="text-gray-400">•</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 border-b border-gray-300 bg-transparent outline-none text-sm px-1 py-0.5"
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-1 group">
      <span className="text-gray-400">•</span>
      <span
        onClick={() => setEditing(true)}
        className="flex-1 text-sm text-gray-700 cursor-pointer hover:text-primary-600"
      >
        {text}
      </span>
      <button
        onClick={() => onDelete(exerciseId)}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-sm px-1 transition-opacity"
        title="Delete exercise"
      >
        ✕
      </button>
    </div>
  )
}
