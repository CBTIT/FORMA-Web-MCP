import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { TokenData } from "../types/forma.js";

const TOKEN_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.tokens.json"
);

export function loadTokens(): TokenData | null {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8")) as TokenData;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: TokenData): void {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

export function clearTokens(): void {
  try {
    fs.unlinkSync(TOKEN_FILE);
  } catch {
    // already gone
  }
}

export async function getValidToken(): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) {
    throw new Error("Not authenticated. Call the authenticate tool first.");
  }

  // Refresh 60 s before expiry
  if (Date.now() >= tokens.expires_at - 60_000) {
    tokens = await refreshTokens(tokens.refresh_token);
  }

  return tokens.access_token;
}

async function refreshTokens(refreshToken: string): Promise<TokenData> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.APS_CLIENT_ID!,
    client_secret: process.env.APS_CLIENT_SECRET!,
  });

  const res = await fetch(
    "https://developer.api.autodesk.com/authentication/v2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    }
  );

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const tokens: TokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  saveTokens(tokens);
  return tokens;
}
