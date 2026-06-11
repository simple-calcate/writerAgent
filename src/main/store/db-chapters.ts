import { randomUUID } from 'crypto'
import type { Volume, Chapter, VersionSnapshot } from '../../shared/types'
import { getStore, save } from './db-core'

// ─── Volumes ───

export function getVolumes(projectId: string): Volume[] {
  return getStore().volumes
    .filter(v => v.projectId === projectId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

export function createVolume(projectId: string, name: string): Volume {
  const store = getStore()
  const now = new Date().toISOString()
  const maxOrder = store.volumes
    .filter(v => v.projectId === projectId)
    .reduce((max, v) => Math.max(max, v.orderIndex), -1)
  const volume: Volume = {
    id: randomUUID(),
    projectId,
    name,
    aiConfig: {},
    orderIndex: maxOrder + 1,
    createdAt: now,
    updatedAt: now
  }
  store.volumes.push(volume)
  save()
  return volume
}

export function renameVolume(id: string, name: string): void {
  const volume = getStore().volumes.find(v => v.id === id)
  if (!volume) return
  volume.name = name
  volume.updatedAt = new Date().toISOString()
  save()
}

export function updateVolume(id: string, data: Partial<Volume>): void {
  const volume = getStore().volumes.find(v => v.id === id)
  if (!volume) return
  if (data.name !== undefined) volume.name = data.name
  if (data.aiConfig !== undefined) volume.aiConfig = data.aiConfig
  volume.updatedAt = new Date().toISOString()
  save()
}

export function deleteVolume(id: string): void {
  const store = getStore()
  // 将下属章节的 volumeId 设为 null
  for (const ch of store.chapters) {
    if (ch.volumeId === id) ch.volumeId = null
  }
  store.outlines = store.outlines.filter(o => o.volumeId !== id)
  store.conversations = store.conversations.filter(c => c.volumeId !== id)
  store.volumes = store.volumes.filter(v => v.id !== id)
  save()
}

// ─── Chapters ───

export function getChapters(projectId: string): Chapter[] {
  return getStore().chapters
    .filter(c => c.projectId === projectId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

export function createChapter(projectId: string, title: string, volumeId?: string | null): Chapter | null {
  const store = getStore()
  // 检查同卷下是否有同名章节
  const duplicate = store.chapters.find(
    c => c.projectId === projectId && c.volumeId === (volumeId || null) && c.title === title
  )
  if (duplicate) return null

  const now = new Date().toISOString()
  const maxOrder = store.chapters
    .filter(c => c.projectId === projectId)
    .reduce((max, c) => Math.max(max, c.orderIndex), -1)
  const chapter: Chapter = {
    id: randomUUID(),
    projectId,
    volumeId: volumeId || null,
    title,
    content: '',
    polishingMarks: [],
    summaryResult: null,
    orderIndex: maxOrder + 1,
    createdAt: now,
    updatedAt: now
  }
  store.chapters.push(chapter)
  save()
  return chapter
}

export function renameChapter(id: string, title: string): void {
  const chapter = getStore().chapters.find(c => c.id === id)
  if (!chapter) return
  chapter.title = title
  chapter.updatedAt = new Date().toISOString()
  save()
}

export function updateChapter(id: string, data: Partial<Chapter>): void {
  const chapter = getStore().chapters.find(c => c.id === id)
  if (!chapter) return
  if (data.title !== undefined) chapter.title = data.title
  if (data.content !== undefined) chapter.content = data.content
  if (data.polishingMarks !== undefined) chapter.polishingMarks = data.polishingMarks
  if (data.volumeId !== undefined) chapter.volumeId = data.volumeId
  if (data.summaryResult !== undefined) chapter.summaryResult = data.summaryResult
  chapter.updatedAt = new Date().toISOString()
  save()
}

export function deleteChapter(id: string): void {
  const store = getStore()
  store.chapters = store.chapters.filter(c => c.id !== id)
  delete store.versions[id]
  store.outlines = store.outlines.filter(o => o.chapterId !== id)
  store.conversations = store.conversations.filter(c => c.chapterId !== id)
  save()
}

export function updateChapterSummary(chapterId: string, summary: string | null): void {
  const chapter = getStore().chapters.find(c => c.id === chapterId)
  if (!chapter) return
  chapter.summaryResult = summary
  chapter.updatedAt = new Date().toISOString()
  save()
}

// ─── Versions ───

export function getVersions(chapterId: string): VersionSnapshot[] {
  return getStore().versions[chapterId] || []
}

export function saveVersion(chapterId: string, version: VersionSnapshot): void {
  const store = getStore()
  if (!store.versions[chapterId]) store.versions[chapterId] = []
  store.versions[chapterId].push(version)
  save()
}

export function deleteVersion(chapterId: string, index: number): void {
  const store = getStore()
  if (!store.versions[chapterId]) return
  store.versions[chapterId].splice(index, 1)
  save()
}
