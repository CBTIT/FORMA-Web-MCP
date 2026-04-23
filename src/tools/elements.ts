import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getFormaClient } from "../graphql/client.js";
import {
  GET_PROJECT_ELEMENTS_QUERY,
  GET_ELEMENT_PROPERTIES_QUERY,
  GET_AREA_BREAKDOWN_QUERY,
} from "../graphql/queries/elements.js";
import type { Element, AreaBreakdownItem } from "../types/forma.js";

interface ElementsResponse {
  elements: Element[];
}

interface ElementResponse {
  element: Element;
}

interface AreaBreakdownResponse {
  areaBreakdown: AreaBreakdownItem[];
}

export async function handleGetProjectElements(args: {
  project_id: string;
  type?: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  const data = await client.request<ElementsResponse>(GET_PROJECT_ELEMENTS_QUERY, {
    projectId: args.project_id,
    category: args.type,
  });
  return {
    content: [{ type: "text", text: JSON.stringify(data.elements, null, 2) }],
  };
}

export async function handleGetElementsByCategory(args: {
  project_id: string;
  category: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  const data = await client.request<ElementsResponse>(GET_PROJECT_ELEMENTS_QUERY, {
    projectId: args.project_id,
    category: args.category,
  });
  const elements = data.elements;
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            category: args.category,
            count: elements.length,
            element_ids: elements.map((e) => e.id),
            elements,
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function handleGetElementProperties(args: {
  project_id: string;
  element_id: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  const data = await client.request<ElementResponse>(GET_ELEMENT_PROPERTIES_QUERY, {
    projectId: args.project_id,
    elementId: args.element_id,
  });
  return {
    content: [{ type: "text", text: JSON.stringify(data.element, null, 2) }],
  };
}

export async function handleSearchElements(args: {
  project_id: string;
  category?: string;
  property_name?: string;
  property_value?: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  const data = await client.request<ElementsResponse>(GET_PROJECT_ELEMENTS_QUERY, {
    projectId: args.project_id,
    category: args.category,
  });

  let results = data.elements;

  if (args.property_name) {
    results = results.filter((el) => {
      const prop = el.properties.find((p) => p.name === args.property_name);
      if (!prop) return false;
      if (args.property_value === undefined) return true;
      return String(prop.value) === args.property_value;
    });
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ count: results.length, elements: results }, null, 2),
      },
    ],
  };
}

export async function handleGetAreaBreakdown(args: {
  project_id: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  const data = await client.request<AreaBreakdownResponse>(GET_AREA_BREAKDOWN_QUERY, {
    projectId: args.project_id,
  });
  return {
    content: [{ type: "text", text: JSON.stringify(data.areaBreakdown, null, 2) }],
  };
}
