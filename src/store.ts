import { readFileSync, writeFileSync, existsSync } from "fs";

export interface Flashcard {
  id: string;
  project: string;
  front: string;
  back: string;
  tags: string[];
  created_at: string;
  next_review: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
}

export interface Project {
  name: string;
  description: string;
  memory: string;
  created_at: string;
}

export interface Store {
  projects: Project[];
  flashcards: Flashcard[];
}

export interface StoreBackend {
  load(): Promise<Store>;
  save(store: Store): Promise<void>;
}

export class FileStore implements StoreBackend {
  constructor(private path: string) {}

  async load(): Promise<Store> {
    if (!existsSync(this.path)) return { projects: [], flashcards: [] };
    const data = JSON.parse(readFileSync(this.path, "utf-8"));
    if (!data.projects) data.projects = [];
    for (const p of data.projects) {
      if (p.memory === undefined) p.memory = "";
    }
    return data;
  }

  async save(store: Store): Promise<void> {
    writeFileSync(this.path, JSON.stringify(store, null, 2));
  }
}
