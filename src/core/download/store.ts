import type { DownloadTaskInfo } from './types'

type Listener = (tasks: DownloadTaskInfo[]) => void

const listeners = new Set<Listener>()
let tasks: DownloadTaskInfo[] = []

const emit = () => {
  const snapshot = [...tasks]
  for (const listener of listeners) listener(snapshot)
}

export const getDownloadTasks = (): DownloadTaskInfo[] => {
  return [...tasks]
}

export const getDownloadTask = (id: string): DownloadTaskInfo | undefined => {
  return tasks.find(task => task.id === id)
}

export const subscribeDownloadTasks = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const upsertDownloadTask = (task: DownloadTaskInfo) => {
  const index = tasks.findIndex(t => t.id === task.id)
  if (index < 0) {
    tasks = [task, ...tasks]
  } else {
    tasks = [...tasks.slice(0, index), task, ...tasks.slice(index + 1)]
  }
  emit()
}

export const removeDownloadTask = (id: string) => {
  tasks = tasks.filter(task => task.id !== id)
  emit()
}
