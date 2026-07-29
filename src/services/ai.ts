export type ChatRole = 'system' | 'user' | 'assistant'
export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface AIProvider {
  id: string
  name: string
  type: 'cloud' | 'local'
  chat(messages: ChatMessage[]): Promise<string>
  listModels(): Promise<string[]>
}

// M0 占位：真实实现在 M3（云端经 Tauri 中转 / 本地 Ollama）。
class StubProvider implements AIProvider {
  id = 'stub'
  name = '占位（未接入）'
  type = 'local' as const
  async chat(): Promise<string> {
    return '（AI 尚未接入，将在 M3 实现云端/本地双通道）'
  }
  async listModels(): Promise<string[]> {
    return []
  }
}

export const aiProviders: AIProvider[] = [new StubProvider()]
export const defaultProvider = aiProviders[0]
