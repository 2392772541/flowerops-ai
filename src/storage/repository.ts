import type { AppState } from '../domain/types'
import { demoState } from '../data/demoData'

const STORAGE_KEY = 'flowerops-state-v1'
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(demoState)
    const parsed = JSON.parse(raw) as AppState
    return parsed.schemaVersion === 1 ? parsed : structuredClone(demoState)
  } catch { return structuredClone(demoState) }
}
export function saveState(state: AppState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }
export function resetState() { localStorage.removeItem(STORAGE_KEY); return structuredClone(demoState) }
export function exportState(state: AppState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = 'flowerops-demo-data.json'; link.click(); URL.revokeObjectURL(url)
}
