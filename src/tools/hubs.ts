import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getFormaClient } from "../graphql/client.js";
import { LIST_HUBS_QUERY, LIST_PROJECTS_QUERY } from "../graphql/queries/projects.js";
import type { Hub, Project } from "../types/forma.js";

interface HubsResponse {
  hubs: Hub[];
}

interface ProjectsResponse {
  projects: Project[];
}

export async function handleListHubs(): Promise<CallToolResult> {
  const client = await getFormaClient();
  const data = await client.request<HubsResponse>(LIST_HUBS_QUERY);
  return {
    content: [{ type: "text", text: JSON.stringify(data.hubs, null, 2) }],
  };
}

export async function handleListProjects(args: {
  hub_id: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  const data = await client.request<ProjectsResponse>(LIST_PROJECTS_QUERY, {
    hubId: args.hub_id,
  });
  return {
    content: [{ type: "text", text: JSON.stringify(data.projects, null, 2) }],
  };
}

export async function handleGetProjectModelUrn(args: {
  project_id: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  const data = await client.request<ProjectsResponse>(LIST_PROJECTS_QUERY, {
    hubId: "",
  });
  const project = data.projects.find((p) => p.id === args.project_id);
  if (!project) {
    return {
      content: [{ type: "text", text: `Project not found: ${args.project_id}` }],
      isError: true,
    };
  }
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { project_id: project.id, name: project.name, model_urn: project.modelUrn },
          null,
          2
        ),
      },
    ],
  };
}
