# flashcard-mcp

An MCP server that gives Claude (or any MCP client) the ability to create, review, and manage flashcards with spaced repetition (SM-2 algorithm).

Organize cards into projects, tag them by topic, and let the scheduling algorithm figure out when you need to see each card again.

100% vibecoded.

## Tools

- `create_project` / `list_projects` — organize cards into projects
- `create_flashcard` / `list_flashcards` / `delete_flashcard` — manage cards
- `get_due_flashcards` — get cards that are due for review
- `review_flashcard` — record how well you remembered (1-4), updates the schedule
- `get_flashcard_answer` — reveal the answer after quizzing yourself

## Running locally (stdio)

```bash
npm install
npm run build
npm start
```

Add to your MCP config:

```json
{
  "mcpServers": {
    "flashcards": {
      "command": "node",
      "args": ["/path/to/flashcard-mcp/dist/index.js"]
    }
  }
}
```

Cards are stored in a local `flashcards.json` file.

## Deploying to Vercel (remote HTTP)

The `api/mcp.ts` endpoint runs as a Vercel serverless function, backed by Upstash Redis instead of a local file.

Connect an Upstash Redis database via Vercel's Storage integration — it'll set up `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.

Optionally set `FLASHCARD_API_KEY` to require Bearer token auth.
