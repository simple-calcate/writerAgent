import type OpenAI from 'openai'
import { chapterToolDefinitions } from './definitions/chapter-tools'
import { outlineToolDefinitions } from './definitions/outline-tools'
import { skillToolDefinitions } from './definitions/skill-tools'
import { reasoningToolDefinitions } from './definitions/reasoning-tools'
import { searchToolDefinitions } from './definitions/search-tools'

export function getDialogueTools(): OpenAI.ChatCompletionTool[] {
  return [
    ...chapterToolDefinitions,
    ...outlineToolDefinitions,
    ...skillToolDefinitions,
    ...reasoningToolDefinitions,
    ...searchToolDefinitions
  ]
}
