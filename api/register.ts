import type { VercelRequest, VercelResponse } from "@vercel/node";
import { saveClient, generateId } from "../src/oauth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { redirect_uris, client_name } = req.body || {};

  if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    res.status(400).json({ error: "redirect_uris is required" });
    return;
  }

  const client_id = generateId();

  await saveClient({
    client_id,
    redirect_uris,
    client_name,
    created_at: new Date().toISOString(),
  });

  res.status(201).json({
    client_id,
    redirect_uris,
    client_name,
  });
}
