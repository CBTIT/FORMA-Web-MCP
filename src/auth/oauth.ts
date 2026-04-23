import express from "express";
import open from "open";
import type { TokenData } from "../types/forma.js";
import { saveTokens } from "./tokens.js";

const APS_AUTH_URL =
  "https://developer.api.autodesk.com/authentication/v2/authorize";
const APS_TOKEN_URL =
  "https://developer.api.autodesk.com/authentication/v2/token";
const SCOPES = "data:read data:write viewables:read";

export async function runOAuthFlow(): Promise<void> {
  const clientId = process.env.APS_CLIENT_ID;
  const clientSecret = process.env.APS_CLIENT_SECRET;
  const callbackUrl =
    process.env.APS_CALLBACK_URL ?? "http://localhost:3000/auth/callback";
  const port = Number(new URL(callbackUrl).port) || 3000;

  if (!clientId || !clientSecret) {
    throw new Error("APS_CLIENT_ID and APS_CLIENT_SECRET must be set in .env");
  }

  return new Promise((resolve, reject) => {
    const app = express();
    const server = app.listen(port);

    app.get("/auth/callback", async (req, res) => {
      const code = req.query.code as string | undefined;

      if (!code) {
        res.send("<h1>Authentication failed — no code received.</h1>");
        server.close();
        reject(new Error("No auth code in callback"));
        return;
      }

      try {
        const tokens = await exchangeCode(code, clientId, clientSecret, callbackUrl);
        saveTokens(tokens);
        res.send(
          "<h1>Authenticated successfully.</h1><p>You can close this tab and return to Claude.</p>"
        );
        server.close();
        resolve();
      } catch (err) {
        res.send("<h1>Token exchange failed.</h1>");
        server.close();
        reject(err);
      }
    });

    const authUrl = new URL(APS_AUTH_URL);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("scope", SCOPES);

    open(authUrl.toString()).catch(reject);
  });
}

async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<TokenData> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const res = await fetch(APS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}
