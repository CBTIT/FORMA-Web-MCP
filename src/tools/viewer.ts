import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import open from "open";
import { getValidToken } from "../auth/tokens.js";
import { startViewerServer, highlightInViewer } from "../viewer/server.js";

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
