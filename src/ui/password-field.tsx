'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function PasswordField({
  value,
  onChange,
  disabled,
  autoComplete,
  minLength,
  maxLength,
  required,
  id,
  name,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete']
  minLength?: number
  maxLength?: number
  required?: boolean
  id?: string
  name?: string
  className?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={`relative mt-1 ${className}`}>
      <input
        id={id}
        name={name}
        className="input-field mt-0 pr-10"
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--text-primary)] disabled:opacity-50"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        disabled={disabled}
        onClick={() => setVisible((open) => !open)}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
