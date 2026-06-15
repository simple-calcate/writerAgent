import type OpenAI from 'openai'
import { chapterToolDefinitions } from './chapter-tools'
import { outlineToolDefinitions } from './outline-tools'
import { skillToolDefinitions } from './skill-tools'
import { reasoningToolDefinitions } from './reasoning-tools'
import { searchToolDefinitions } from './search-tools'

export function getDialogueTools(): OpenAI.ChatCompletionTool[] {
  return [
    ...chapterToolDefinitions,
    ...outlineToolDefinitions,
    ...skillToolDefinitions,
    ...reasoningToolDefinitions,
    ...searchToolDefinitions
  ]
}
