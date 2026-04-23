import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// Load .env from project root regardless of what CWD the host process uses
config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });

const requiredEnvVars = ["APS_CLIENT_ID", "APS_CLIENT_SECRET", "FORMA_GRAPHQL_URL"];
const missing = requiredEnvVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  console.error("Please create a .env file in the project root.");
  process.exit(1);
}
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { runOAuthFlow } from "./auth/oauth.js";
import { handleListHubs, handleListProjects, handleGetProjectModelUrn } from "./tools/hubs.js";
import {
  handleGetProjectElements,
  handleGetElementsByCategory,
  handleGetElementProperties,
  handleSearchElements,
  handleGetAreaBreakdown,
} from "./tools/elements.js";
import { handleCompareProjects } from "./tools/compare.js";
import { handleOpenViewer, handleHighlightElements } from "./tools/viewer.js";

const server = new Server(
  { name: "forma-web-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const TOOLS: Tool[] = [
  {
    name: "authenticate",
    description:
      "Launches APS 3-legged OAuth in the browser and stores tokens locally. Must be called before any other tool.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_hubs",
    description: "Returns all accessible FORMA hubs for the authenticated user.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_projects",
    description: "Lists all projects within a hub.",
    inputSchema: {
      type: "object",
      properties: {
        hub_id: { type: "string", description: "Hub ID to list projects from" },
      },
      required: ["hub_id"],
    },
  },
  {
    name: "get_area_breakdown",
    description:
      "Returns area totals grouped by element category/department for a project.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "get_project_elements",
    description:
      "Fetches all elements in a project with their properties. Optionally filter by type.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID" },
        type: {
          type: "string",
          description: "Optional element type filter (e.g. room, space)",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "get_elements_by_category",
    description:
      "Returns all items of a specific category — e.g. doors, windows, walls, columns, stairs. Returns count, IDs, and key properties.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID" },
        category: {
          type: "string",
          description: "Element category (e.g. doors, windows, walls, rooms, stairs)",
        },
      },
      required: ["project_id", "category"],
    },
  },
  {
    name: "get_element_properties",
    description: "Returns all properties for a single element by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID" },
        element_id: { type: "string", description: "Element ID" },
      },
      required: ["project_id", "element_id"],
    },
  },
  {
    name: "search_elements",
    description:
      "Filtered element search — combine category, property name, and value (e.g. all doors with fireRating = '60min').",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID" },
        category: { type: "string", description: "Optional category filter" },
        property_name: {
          type: "string",
          description: "Optional property name to filter on",
        },
        property_value: {
          type: "string",
          description: "Optional property value to match (string comparison)",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "compare_projects",
    description:
      "Side-by-side comparison of area properties across two projects, with a per-category breakdown and totals.",
    inputSchema: {
      type: "object",
      properties: {
        project_a_id: { type: "string", description: "First project ID" },
        project_b_id: { type: "string", description: "Second project ID" },
        property: {
          type: "string",
          description: "Property label for context (e.g. area, circulation_area)",
        },
      },
      required: ["project_a_id", "project_b_id", "property"],
    },
  },
  {
    name: "open_viewer",
    description:
      "Starts a local Autodesk Viewer in the browser for a given model URN.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID" },
        model_urn: {
          type: "string",
          description: "Model URN to load in the viewer",
        },
      },
      required: ["project_id", "model_urn"],
    },
  },
  {
    name: "get_project_model_urn",
    description:
      "Returns the model URN for a specific project, required for opening the viewer.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "highlight_elements_in_viewer",
    description:
      "Highlights a set of element IDs in the currently open Viewer session and zooms to them.",
    inputSchema: {
      type: "object",
      properties: {
        element_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of element IDs to highlight",
        },
      },
      required: ["element_ids"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: CallToolResult;

    switch (name) {
      case "authenticate":
        await runOAuthFlow();
        result = {
          content: [{ type: "text", text: "Authentication successful. Tokens stored." }],
        };
        break;

      case "list_hubs":
        result = await handleListHubs();
        break;

      case "list_projects":
        result = await handleListProjects(args as { hub_id: string });
        break;

      case "get_area_breakdown":
        result = await handleGetAreaBreakdown(args as { project_id: string });
        break;

      case "get_project_elements":
        result = await handleGetProjectElements(
          args as { project_id: string; type?: string }
        );
        break;

      case "get_elements_by_category":
        result = await handleGetElementsByCategory(
          args as { project_id: string; category: string }
        );
        break;

      case "get_element_properties":
        result = await handleGetElementProperties(
          args as { project_id: string; element_id: string }
        );
        break;

      case "search_elements":
        result = await handleSearchElements(
          args as {
            project_id: string;
            category?: string;
            property_name?: string;
            property_value?: string;
          }
        );
        break;

      case "compare_projects":
        result = await handleCompareProjects(
          args as { project_a_id: string; project_b_id: string; property: string }
        );
        break;

      case "open_viewer":
        result = await handleOpenViewer(
          args as { project_id: string; model_urn: string }
        );
        break;

      case "get_project_model_urn":
        result = await handleGetProjectModelUrn(args as { project_id: string });
        break;

      case "highlight_elements_in_viewer":
        result = await handleHighlightElements(
          args as { element_ids: string[] }
        );
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return result;
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
