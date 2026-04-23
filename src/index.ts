import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
config({ path: join(projectRoot, ".env") });

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
  handleListElementGroups,
  handleGetProjectElements,
  handleGetElementsByCategory,
  handleGetElementProperties,
  handleSearchElements,
  handleGetAreaBreakdown,
} from "./tools/elements.js";
import { handleCompareProjects } from "./tools/compare.js";
import { handleOpenViewer, handleHighlightElements, handleGetModelUrn } from "./tools/viewer.js";

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
    name: "list_element_groups",
    description: "Returns element groups (designs/models) within a project. Use project_id from list_projects.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID from list_projects" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "get_area_breakdown",
    description:
      "Returns area totals grouped by element category. Use element_group_id from list_element_groups.",
    inputSchema: {
      type: "object",
      properties: {
        element_group_id: { type: "string", description: "Element Group ID from list_element_groups" },
      },
      required: ["element_group_id"],
    },
  },
  {
    name: "get_project_elements",
    description:
      "Fetches all elements in an element group with their properties. Optionally filter by category.",
    inputSchema: {
      type: "object",
      properties: {
        element_group_id: { type: "string", description: "Element Group ID" },
        category: {
          type: "string",
          description: "Optional category filter (e.g. Walls, Doors, Windows)",
        },
      },
      required: ["element_group_id"],
    },
  },
  {
    name: "get_elements_by_category",
    description:
      "Returns all items of a specific category — e.g. doors, windows, walls. Returns count and IDs.",
    inputSchema: {
      type: "object",
      properties: {
        element_group_id: { type: "string", description: "Element Group ID" },
        category: {
          type: "string",
          description: "Element category (e.g. Walls, Doors, Windows)",
        },
      },
      required: ["element_group_id", "category"],
    },
  },
  {
    name: "get_element_properties",
    description: "Returns all properties for a single element by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        element_group_id: { type: "string", description: "Element Group ID" },
        element_id: { type: "string", description: "Element ID" },
      },
      required: ["element_group_id", "element_id"],
    },
  },
  {
    name: "search_elements",
    description:
      "Filtered element search — combine category, property name, and value.",
    inputSchema: {
      type: "object",
      properties: {
        element_group_id: { type: "string", description: "Element Group ID" },
        category: { type: "string", description: "Optional category filter" },
        property_name: {
          type: "string",
          description: "Optional property name to filter on",
        },
        property_value: {
          type: "string",
          description: "Optional property value to match",
        },
      },
      required: ["element_group_id"],
    },
  },
  {
    name: "compare_projects",
    description:
      "Side-by-side comparison of area properties across two element groups.",
    inputSchema: {
      type: "object",
      properties: {
        element_group_a_id: { type: "string", description: "First Element Group ID" },
        element_group_b_id: { type: "string", description: "Second Element Group ID" },
        property: {
          type: "string",
          description: "Property label for context (e.g. area)",
        },
      },
      required: ["element_group_a_id", "element_group_b_id", "property"],
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
      "Returns the model URN for a specific project. Use project_id from list_projects.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID from list_projects" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "highlight_elements_in_viewer",
    description:
      "Highlights a set of element IDs in the currently open Viewer session.",
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

      case "list_element_groups":
        result = await handleListElementGroups(args as { project_id: string });
        break;

      case "get_area_breakdown":
        result = await handleGetAreaBreakdown(args as { element_group_id: string });
        break;

      case "get_project_elements":
        result = await handleGetProjectElements(
          args as { element_group_id: string; category?: string }
        );
        break;

      case "get_elements_by_category":
        result = await handleGetElementsByCategory(
          args as { element_group_id: string; category: string }
        );
        break;

      case "get_element_properties":
        result = await handleGetElementProperties(
          args as { element_group_id: string; element_id: string }
        );
        break;

      case "search_elements":
        result = await handleSearchElements(
          args as {
            element_group_id: string;
            category?: string;
            property_name?: string;
            property_value?: string;
          }
        );
        break;

      case "compare_projects":
        result = await handleCompareProjects(
          args as { element_group_a_id: string; element_group_b_id: string; property: string }
        );
        break;

      case "open_viewer":
        result = await handleOpenViewer(
          args as { project_id: string; model_urn: string }
        );
        break;

      case "get_project_model_urn":
        result = await handleGetModelUrn(args as { project_id: string });
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