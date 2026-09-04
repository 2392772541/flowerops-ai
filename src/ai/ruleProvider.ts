import type { AIAnswer, AIProvider } from './adapter'
import type { AppState } from '../domain/types'
import { runSafeQuestion } from '../domain/engine'

export class RuleAIProvider implements AIProvider {
  readonly id = 'rule-demo'
  readonly label = '可解释规则 AI'
  readonly requiresApiKey = false

  preview(state: AppState, question: string): AIAnswer {
    return runSafeQuestion(state, question)
  }

  async askBusiness(state: AppState, question: string): Promise<AIAnswer> {
    await new Promise(resolve => setTimeout(resolve, 450))
    return this.preview(state, question)
  }
}

export const ruleAIProvider = new RuleAIProvider()
