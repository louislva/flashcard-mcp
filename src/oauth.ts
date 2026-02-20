import { Redis } from "@upstash/redis";
import { createHash, randomBytes } from "node:crypto";

const redis = Redis.fromEnv();

// --- Client Registration ---

interface OAuthClient {
  client_id: string;
  redirect_uris: string[];
  client_name?: string;
  created_at: string;
}

export async function saveClient(client: OAuthClient): Promise<void> {
  await redis.set(`oauth:client:${client.client_id}`, JSON.stringify(client));
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const data = await redis.get<string>(`oauth:client:${clientId}`);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

// --- Authorization Codes ---

interface AuthCode {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
}

export async function saveAuthCode(code: string, data: AuthCode): Promise<void> {
  // 10 minute TTL
  await redis.set(`oauth:code:${code}`, JSON.stringify(data), { ex: 600 });
}

export async function getAuthCode(code: string): Promise<AuthCode | null> {
  const data = await redis.get<string>(`oauth:code:${code}`);
  if (!data) return null;
  // Delete after use (single-use codes)
  await redis.del(`oauth:code:${code}`);
  return typeof data === "string" ? JSON.parse(data) : data;
}

// --- Access Tokens ---

export async function saveAccessToken(token: string): Promise<void> {
  // 30 day TTL
  await redis.set(`oauth:token:${token}`, "valid", { ex: 60 * 60 * 24 * 30 });
}

export async function validateAccessToken(token: string): Promise<boolean> {
  const data = await redis.get(`oauth:token:${token}`);
  return data === "valid";
}

// --- PKCE ---

export function verifyPKCE(codeVerifier: string, codeChallenge: string): boolean {
  const hash = createHash("sha256").update(codeVerifier).digest("base64url");
  return hash === codeChallenge;
}

// --- Helpers ---

export function generateId(): string {
  return randomBytes(32).toString("hex");
}
