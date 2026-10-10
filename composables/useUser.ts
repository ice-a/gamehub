import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'

export interface LocalUser {
  id: string
  username: string
  sign: string
  displayName: string
}

const STORAGE_KEY = 'gamehub_user'
const ANON_KEY = 'gamehub_anon_id'

const user = ref<LocalUser | null>(null)
const ready = ref(false)

function load() {
  if (ready.value) return
  if (import.meta.client) {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        user.value = JSON.parse(raw)
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }
  ready.value = true
}

function getAnonId(): string {
  if (!import.meta.client) return 'anon'
  let id = localStorage.getItem(ANON_KEY)
  if (!id) {
    id = 'anon:' + uuidv4()
    localStorage.setItem(ANON_KEY, id)
  }
  return id
}

export function useUser() {
  load()

  function persist() {
    if (import.meta.client && user.value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user.value))
    }
  }

  async function register(username: string, sign: string, displayName?: string) {
    const res = await $fetch<LocalUser>('/api/users', {
      method: 'POST',
      body: { username, sign, displayName: displayName || username }
    })
    user.value = { id: res.id, username: res.username, sign: res.sign, displayName: res.displayName }
    persist()
    return user.value
  }

  async function login(username: string, sign: string) {
    const res = await $fetch<{ id: string; username: string; displayName: string }>('/api/users/verify', {
      method: 'POST',
      body: { username, sign }
    })
    user.value = { id: res.id, username: res.username, sign, displayName: res.displayName }
    persist()
    return user.value
  }

  function logout() {
    user.value = null
    if (import.meta.client) localStorage.removeItem(STORAGE_KEY)
  }

  /** 用于游玩记录的玩家身份：登录用户用其 uuid，否则用匿名稳定 id */
  function playerId(): string {
    return user.value?.id || getAnonId()
  }

  return { user, ready, register, login, logout, persist, playerId }
}
