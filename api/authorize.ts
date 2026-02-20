import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getClient, saveAuthCode, generateId } from "../src/oauth.js";

function loginPage(params: Record<string, string>, error?: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Flashcard MCP - Login</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 80px auto; padding: 0 20px; }
    h1 { font-size: 1.4em; }
    form { display: flex; flex-direction: column; gap: 12px; }
    input[type="password"] { padding: 8px; font-size: 1em; border: 1px solid #ccc; border-radius: 4px; }
    button { padding: 10px; font-size: 1em; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #555; }
    .error { color: #c00; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Flashcard MCP</h1>
  <p>Enter the password to authorize access.</p>
  ${error ? `<p class="error">${error}</p>` : ""}
  <form method="POST" action="/api/authorize">
    <input type="password" name="password" placeholder="Password" required autofocus>
    ${Object.entries(params)
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}">`)
      .join("\n    ")}
    <button type="submit">Authorize</button>
  </form>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    // Render login form, carry OAuth params through as hidden fields
    const params: Record<string, string> = {};
    for (const key of ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "response_type"]) {
      const val = req.query[key];
      if (typeof val === "string") params[key] = val;
    }

    res.setHeader("Content-Type", "text/html");
    res.send(loginPage(params));
    return;
  }

  if (req.method === "POST") {
    const {
      password,
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method,
      scope,
      response_type,
    } = req.body || {};

    // Carry params through for re-rendering form on error
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries({ client_id, redirect_uri, state, code_challenge, code_challenge_method, scope, response_type })) {
      if (typeof v === "string") params[k] = v;
    }

    // Validate password
    const apiKey = process.env.FLASHCARD_API_KEY;
    if (!apiKey || password !== apiKey) {
      res.setHeader("Content-Type", "text/html");
      res.status(200).send(loginPage(params, "Incorrect password."));
      return;
    }

    // Validate client
    if (!client_id) {
      res.status(400).send("Missing client_id");
      return;
    }
    const client = await getClient(client_id);
    if (!client) {
      res.status(400).send("Unknown client_id");
      return;
    }

    // Validate redirect_uri
    if (!redirect_uri || !client.redirect_uris.includes(redirect_uri)) {
      res.status(400).send("Invalid redirect_uri");
      return;
    }

    // Require PKCE
    if (!code_challenge || code_challenge_method !== "S256") {
      res.status(400).send("PKCE with S256 is required");
      return;
    }

    // Generate auth code
    const code = generateId();
    await saveAuthCode(code, {
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
    });

    // Redirect back to client
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (state) redirectUrl.searchParams.set("state", state);

    res.redirect(302, redirectUrl.toString());
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
