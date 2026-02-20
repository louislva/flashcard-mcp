import { Redis } from "@upstash/redis";
import type { Store, StoreBackend } from "./store.js";

const STORE_KEY = "flashcards";

export class KVStore implements StoreBackend {
  private redis: Redis;

  constructor() {
    const url = process.env.STORAGE_REST_API_URL
      || process.env.KV_REST_API_URL
      || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.STORAGE_REST_API_TOKEN
      || process.env.KV_REST_API_TOKEN
      || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error("Missing Redis credentials env vars (tried STORAGE_*, KV_*, UPSTASH_REDIS_* prefixes)");
    }
    this.redis = new Redis({ url, token });
  }

  async load(): Promise<Store> {
    const data = await this.redis.get<Store>(STORE_KEY);
    if (!data) return { projects: [], flashcards: [] };
    if (!data.projects) data.projects = [];
    return data;
  }

  async save(store: Store): Promise<void> {
    await this.redis.set(STORE_KEY, store);
  }
}
