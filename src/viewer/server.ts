import express from "express";
import { createServer, type Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ViewerSession {
  projectId: string;
  modelUrn: string;
}

let httpServer: HttpServer | null = null;
let wss: WebSocketServer | null = null;
let activePort: number | null = null;

export function startViewerServer(
  token: string,
  session: ViewerSession
): number {
  const port = Number(process.env.PORT) || 3000;

  // If already running, push a load command to the open tab and return
  if (httpServer?.listening && activePort !== null) {
    broadcastToViewer({ type: "load", ...session, token });
    return activePort;
  }

  const app = express();

  app.get("/viewer", (_req, res) => {
    const template = readFileSync(join(__dirname, "template.html"), "utf-8");
    const page = template
      .replace("__TOKEN__", token)
      .replace("__URN__", session.modelUrn)
      .replace("__PROJECT_ID__", session.projectId)
      .replace("__WS_PORT__", String(port));
    res.setHeader("Content-Type", "text/html");
    res.send(page);
  });

  httpServer = createServer(app);
  wss = new WebSocketServer({ server: httpServer });

  httpServer.listen(port);
  activePort = port;
  return port;
}

export function highlightInViewer(elementIds: string[]): void {
  broadcastToViewer({ type: "highlight", elementIds });
}

export function stopViewerServer(): void {
  wss?.close();
  httpServer?.close();
  httpServer = null;
  wss = null;
  activePort = null;
}

function broadcastToViewer(message: object): void {
  if (!wss) return;
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}
