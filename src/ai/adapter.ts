import type { AppState } from '../domain/types'

export interface AIAnswer {
  title: string
  answer: string
  evidence: string[]
  query: string
}

export interface AIProvider {
  readonly id: string
  readonly label: string
  readonly requiresApiKey: boolean
  askBusiness(state: AppState, question: string): Promise<AIAnswer>
}
