import { createContext, useContext } from 'react'

export interface ToastItem {
  id: number
  message: string
  action?: { label: string; run: () => void }
  tone?: 'default' | 'warn'
}

export type Push = (message: string, opts?: { action?: ToastItem['action']; tone?: ToastItem['tone']; ms?: number }) => void

export const ToastContext = createContext<Push>(() => {})

export const useToast = () => useContext(ToastContext)
