'use client'

interface DaySelectorProps {
  daysCount: number
  selectedDay: number
  onSelectDay: (day: number) => void
}

export default function DaySelector({ daysCount, selectedDay, onSelectDay }: DaySelectorProps) {
  return (
    <div className="flex gap-3 mb-8 flex-wrap">
      {Array.from({ length: daysCount }, (_, i) => i + 1).map((day) => (
        <button
          key={day}
          onClick={() => onSelectDay(day)}
          className={`px-5 py-3 rounded-lg font-semibold transition-all ${
            selectedDay === day
              ? 'bg-primary-500 text-white shadow-lg'
              : 'bg-white text-primary-500 border-2 border-primary-500 hover:bg-primary-50'
          }`}
        >
          Day {day}
        </button>
      ))}
    </div>
  )
}


