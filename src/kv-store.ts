import { Redis } from "@upstash/redis";
import type { Store, StoreBackend } from "./store.js";

const STORE_KEY = "flashcards";

export class KVStore implements StoreBackend {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  }

  async load(): Promise<Store> {
    const data = await this.redis.get<Store>(STORE_KEY);
    if (!data) return { projects: [], flashcards: [] };
    if (!data.projects) data.projects = [];
    for (const p of data.projects) {
      if (p.memory === undefined) p.memory = "";
    }
    return data;
  }

  async save(store: Store): Promise<void> {
    await this.redis.set(STORE_KEY, store);
  }
}
