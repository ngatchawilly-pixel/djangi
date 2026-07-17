import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: number, currency = 'XAF') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(
    typeof value === 'string' ? new Date(value) : value,
  )
}

export function fullName(m: { first_name: string; last_name: string }) {
  return `${m.first_name} ${m.last_name}`.trim()
}
