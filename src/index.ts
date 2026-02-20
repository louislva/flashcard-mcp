import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { join, dirname } from "path";
import { FileStore } from "./store.js";
import { registerTools } from "./tools.js";

const STORE_PATH = join(dirname(new URL(import.meta.url).pathname), "..", "flashcards.json");

const server = new McpServer({ name: "flashcard-mcp", version: "0.3.0" });
registerTools(server, new FileStore(STORE_PATH));

const transport = new StdioServerTransport();
await server.connect(transport);
