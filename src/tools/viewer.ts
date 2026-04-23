import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import open from "open";
import { getValidToken } from "../auth/tokens.js";
import { getFormaClient } from "../graphql/client.js";
import { LIST_PROJECTS_QUERY } from "../graphql/queries/projects.js";
import { startViewerServer, highlightInViewer } from "../viewer/server.js";

interface ProjectsResponse {
  projects: { id: string; name: string; modelUrn?: string }[];
}

async function fetchModelUrn(projectId: string): Promise<string> {
  const client = await getFormaClient();
  const data = await client.request<ProjectsResponse>(LIST_PROJECTS_QUERY, {
    hubId: "",
  });
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.modelUrn) throw new Error(`No model available for project: ${projectId}`);
  return project.modelUrn;
}

export async function handleOpenViewer(args: {
  project_id: string;
  model_urn?: string;
}): Promise<CallToolResult> {
  const token = await getValidToken();
  const modelUrn = args.model_urn || await fetchModelUrn(args.project_id);
  const port = startViewerServer(token, {
    projectId: args.project_id,
    modelUrn,
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
