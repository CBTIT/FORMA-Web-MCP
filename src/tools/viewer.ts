import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import open from "open";
import { getValidToken } from "../auth/tokens.js";
import { startViewerServer, highlightInViewer } from "../viewer/server.js";

export async function handleGetModelUrn(_args: {
  project_id: string;
}): Promise<CallToolResult> {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            note: "Model URN must be obtained from ACC/FORMA manually",
            instructions: [
              "1. Open your project in Autodesk Construction Cloud (ACC)",
              "2. Navigate to the model/drawing",
              "3. Copy the URN from the URL or model details",
              "4. Use open_viewer with the model_urn parameter"
            ],
            example_urn: "urn:adsk.dwg:xxxxxxxxxxxxx"
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function handleOpenViewer(args: {
  project_id: string;
  model_urn: string;
}): Promise<CallToolResult> {
  const token = await getValidToken();
  const port = startViewerServer(token, {
    projectId: args.project_id,
    modelUrn: args.model_urn,
  });

  const url = `http://localhost:${port}/viewer`;
  await open(url);

  return {
    content: [
      {
        type: "text",
        text: `Viewer opened at ${url}\nProject: ${args.project_id}\nModel URN: ${args.model_urn}`,
      },
    ],
  };
}

export async function handleHighlightElements(args: {
  element_ids: string[];
}): Promise<CallToolResult> {
  highlightInViewer(args.element_ids);
  return {
    content: [
      {
        type: "text",
        text: `Sent highlight request for ${args.element_ids.length} element(s) to the viewer.`,
      },
    ],
  };
}