import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Flashcard, StoreBackend } from "./store.js";
import { nextReview } from "./sr.js";

export function registerTools(server: McpServer, store: StoreBackend) {
  // --- Project tools ---

  server.tool(
    "list_projects",
    "List all flashcard projects. Call this first to see what projects exist before creating flashcards or querying them. Each project has a name and description so you can pick the right one.",
    {},
    async () => {
      const data = await store.load();
      if (data.projects.length === 0) {
        return { content: [{ type: "text" as const, text: "No projects yet. Create one with create_project." }] };
      }
      const now = new Date().toISOString();
      const text = data.projects
        .map((p) => {
          const count = data.flashcards.filter((c) => c.project === p.name).length;
          const dueCount = data.flashcards.filter(
            (c) => c.project === p.name && c.next_review <= now
          ).length;
          return `- ${p.name}: ${p.description} (${count} cards, ${dueCount} due)`;
        })
        .join("\n");
      return { content: [{ type: "text" as const, text }] };
    }
  );

  server.tool(
    "create_project",
    "Create a new flashcard project. Use a short, lowercase name (e.g. 'math', 'spanish', 'medicine'). The description helps identify the project later.",
    {
      name: z.string().describe("Short project name, e.g. 'math', 'spanish', 'medicine'"),
      description: z.string().describe("What this project is for, e.g. 'Self-taught math from algebra through abstract algebra'"),
    },
    async ({ name, description }) => {
      const data = await store.load();
      if (data.projects.find((p) => p.name === name)) {
        return { content: [{ type: "text" as const, text: `Project "${name}" already exists.` }] };
      }
      data.projects.push({ name, description, created_at: new Date().toISOString() });
      await store.save(data);
      return { content: [{ type: "text" as const, text: `Created project "${name}": ${description}` }] };
    }
  );

  // --- Flashcard tools ---

  server.tool(
    "create_flashcard",
    "Create a new flashcard in a project. Front is the prompt/question, back is the answer. Tags help organize by topic within the project. You must specify a project — call list_projects first if you're not sure which one to use.",
    {
      project: z.string().describe("The project name to add this card to (e.g. 'math')"),
      front: z.string().describe("The question or prompt side of the flashcard"),
      back: z.string().describe("The answer side of the flashcard"),
      tags: z.array(z.string()).optional().describe("Tags for organizing, e.g. ['linear-algebra', 'eigenvalues']"),
    },
    async ({ project, front, back, tags }) => {
      const data = await store.load();
      if (!data.projects.find((p) => p.name === project)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Project "${project}" not found. Available projects: ${data.projects.map((p) => p.name).join(", ") || "none"}. Create one first with create_project.`,
            },
          ],
        };
      }
      const card: Flashcard = {
        id: crypto.randomUUID(),
        project,
        front,
        back,
        tags: tags ?? [],
        created_at: new Date().toISOString(),
        next_review: new Date().toISOString(),
        interval_days: 0,
        ease_factor: 2.5,
        repetitions: 0,
      };
      data.flashcards.push(card);
      await store.save(data);
      return {
        content: [
          {
            type: "text" as const,
            text: `Created flashcard in "${project}" (${card.id}):\nFront: ${card.front}\nBack: ${card.back}\nTags: ${card.tags.join(", ") || "none"}`,
          },
        ],
      };
    }
  );

  server.tool(
    "edit_flashcard",
    "Edit an existing flashcard. You can update the front, back, and/or tags. Only provided fields are changed.",
    {
      id: z.string().describe("The flashcard ID to edit"),
      front: z.string().optional().describe("New question or prompt side of the flashcard"),
      back: z.string().optional().describe("New answer side of the flashcard"),
      tags: z.array(z.string()).optional().describe("New tags (replaces existing tags)"),
    },
    async ({ id, front, back, tags }) => {
      const data = await store.load();
      const idx = data.flashcards.findIndex((c) => c.id === id);
      if (idx === -1) {
        return { content: [{ type: "text" as const, text: `Flashcard ${id} not found.` }] };
      }
      if (front === undefined && back === undefined && tags === undefined) {
        return { content: [{ type: "text" as const, text: "Nothing to update — provide at least one of front, back, or tags." }] };
      }
      const card = data.flashcards[idx];
      if (front !== undefined) card.front = front;
      if (back !== undefined) card.back = back;
      if (tags !== undefined) card.tags = tags;
      await store.save(data);
      return {
        content: [
          {
            type: "text" as const,
            text: `Updated flashcard (${card.id}):\nFront: ${card.front}\nBack: ${card.back}\nTags: ${card.tags.join(", ") || "none"}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_due_flashcards",
    "Get flashcards that are due for review right now. Returns cards whose next_review date is in the past. Specify a project to filter, or omit to see due cards across all projects.",
    {
      project: z.string().optional().describe("Filter by project name"),
      limit: z.number().optional().describe("Max number of cards to return (default 10)"),
      tag: z.string().optional().describe("Filter by tag"),
    },
    async ({ project, limit, tag }) => {
      const data = await store.load();
      const now = new Date().toISOString();
      let due = data.flashcards.filter((c) => c.next_review <= now);
      if (project) due = due.filter((c) => c.project === project);
      if (tag) due = due.filter((c) => c.tags.includes(tag));
      due.sort((a, b) => a.next_review.localeCompare(b.next_review));
      due = due.slice(0, limit ?? 10);

      if (due.length === 0) {
        return { content: [{ type: "text" as const, text: "No flashcards due for review right now." }] };
      }

      const text = due
        .map(
          (c, i) =>
            `${i + 1}. [${c.id}] (${c.project})\n   Front: ${c.front}\n   Tags: ${c.tags.join(", ") || "none"}`
        )
        .join("\n\n");
      return { content: [{ type: "text" as const, text: `${due.length} flashcard(s) due:\n\n${text}` }] };
    }
  );

  server.tool(
    "review_flashcard",
    "Record a review result for a flashcard. This updates the spaced repetition schedule.",
    {
      id: z.string().describe("The flashcard ID"),
      quality: z
        .number()
        .min(1)
        .max(4)
        .describe("How well you remembered: 1 = forgot, 2 = hard, 3 = good, 4 = easy"),
    },
    async ({ id, quality }) => {
      const data = await store.load();
      const idx = data.flashcards.findIndex((c) => c.id === id);
      if (idx === -1) {
        return { content: [{ type: "text" as const, text: `Flashcard ${id} not found.` }] };
      }
      data.flashcards[idx] = nextReview(data.flashcards[idx], quality);
      await store.save(data);
      const card = data.flashcards[idx];
      return {
        content: [
          {
            type: "text" as const,
            text: `Reviewed! Next review in ${card.interval_days} day(s) (${card.next_review.split("T")[0]}).`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_flashcard_answer",
    "Get the answer (back) of a specific flashcard by ID. Use this after quizzing yourself.",
    {
      id: z.string().describe("The flashcard ID"),
    },
    async ({ id }) => {
      const data = await store.load();
      const card = data.flashcards.find((c) => c.id === id);
      if (!card) {
        return { content: [{ type: "text" as const, text: `Flashcard ${id} not found.` }] };
      }
      return { content: [{ type: "text" as const, text: `Front: ${card.front}\nBack: ${card.back}` }] };
    }
  );

  server.tool(
    "list_flashcards",
    "List all flashcards, optionally filtered by project and/or tag. Shows front, tags, and review status. Supports pagination and ordering.",
    {
      project: z.string().optional().describe("Filter by project name"),
      tag: z.string().optional().describe("Filter by tag"),
      order_by: z.enum(["created_at", "next_review"]).optional().describe("Field to order by (default: created_at)"),
      order: z.enum(["asc", "desc"]).optional().describe("Sort direction (default: asc)"),
      offset: z.number().optional().describe("Number of cards to skip for pagination (default: 0)"),
      limit: z.number().optional().describe("Max number of cards to return for pagination (default: all)"),
    },
    async ({ project, tag, order_by, order, offset, limit }) => {
      const data = await store.load();
      let cards = data.flashcards;
      if (project) cards = cards.filter((c) => c.project === project);
      if (tag) cards = cards.filter((c) => c.tags.includes(tag));

      if (cards.length === 0) {
        const filters = [project && `project "${project}"`, tag && `tag "${tag}"`].filter(Boolean).join(" and ");
        return {
          content: [{ type: "text" as const, text: filters ? `No flashcards matching ${filters}.` : "No flashcards yet." }],
        };
      }

      const field = order_by ?? "created_at";
      const dir = order === "desc" ? -1 : 1;
      cards.sort((a, b) => dir * a[field].localeCompare(b[field]));

      const totalCount = cards.length;
      const start = offset ?? 0;
      if (limit !== undefined) {
        cards = cards.slice(start, start + limit);
      } else if (start > 0) {
        cards = cards.slice(start);
      }

      const now = new Date().toISOString();
      const text = cards
        .map((c, i) => {
          const due = c.next_review <= now ? "DUE" : `next: ${c.next_review.split("T")[0]}`;
          return `${start + i + 1}. [${c.id}] (${c.project})\n   Front: ${c.front}\n   Tags: ${c.tags.join(", ") || "none"}\n   Status: ${due}`;
        })
        .join("\n\n");

      const allTags = [...new Set(cards.flatMap((c) => c.tags))];
      const paginationInfo = limit !== undefined ? `\n\nShowing ${start + 1}-${start + cards.length} of ${totalCount}` : "";
      return {
        content: [
          {
            type: "text" as const,
            text: `${totalCount} flashcard(s):${paginationInfo}\n\n${text}\n\nAll tags: ${allTags.join(", ") || "none"}`,
          },
        ],
      };
    }
  );

  server.tool(
    "delete_flashcard",
    "Delete a flashcard by ID.",
    {
      id: z.string().describe("The flashcard ID to delete"),
    },
    async ({ id }) => {
      const data = await store.load();
      const idx = data.flashcards.findIndex((c) => c.id === id);
      if (idx === -1) {
        return { content: [{ type: "text" as const, text: `Flashcard ${id} not found.` }] };
      }
      const removed = data.flashcards.splice(idx, 1)[0];
      await store.save(data);
      return { content: [{ type: "text" as const, text: `Deleted flashcard: ${removed.front}` }] };
    }
  );
}
