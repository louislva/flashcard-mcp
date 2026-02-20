import { Redis } from "@upstash/redis";
import type { Store, StoreBackend } from "./store.js";

const STORE_KEY = "flashcards";

export class KVStore implements StoreBackend {
  private redis: Redis;

  constructor() {
    this.redis = Redis.fromEnv();
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
