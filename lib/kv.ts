declare global {
  interface CloudflareEnv {
    BRIEF_CACHE: KVNamespace
  }
}

const REST_BASE = () =>
  `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/storage/kv/namespaces/${process.env.CF_KV_NAMESPACE_ID}`

const REST_AUTH = () => ({ Authorization: `Bearer ${process.env.CF_KV_API_TOKEN}` })

async function getNativeKV(): Promise<KVNamespace | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    const { env } = getCloudflareContext()
    return env.BRIEF_CACHE ?? null
  } catch {
    return null
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const kv = await getNativeKV()
  if (kv) {
    const value = await kv.get(key, "json")
    return value as T | null
  }
  const res = await fetch(`${REST_BASE()}/values/${encodeURIComponent(key)}`, {
    headers: REST_AUTH(),
    cache: "no-store",
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`KV GET failed: ${res.status}`)
  return res.json() as Promise<T>
}

export async function kvPut(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const kv = await getNativeKV()
  if (kv) {
    await kv.put(key, JSON.stringify(value), ttlSeconds ? { expirationTtl: ttlSeconds } : undefined)
    return
  }
  const url = new URL(`${REST_BASE()}/values/${encodeURIComponent(key)}`)
  if (ttlSeconds) url.searchParams.set("expiration_ttl", String(ttlSeconds))
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { ...REST_AUTH(), "Content-Type": "application/json" },
    body: JSON.stringify(value),
  })
  if (!res.ok) throw new Error(`KV PUT failed: ${res.status}`)
}

export async function kvDelete(key: string): Promise<void> {
  const kv = await getNativeKV()
  if (kv) {
    await kv.delete(key)
    return
  }
  await fetch(`${REST_BASE()}/values/${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: REST_AUTH(),
  })
}
