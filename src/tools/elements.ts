import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getFormaClient } from "../graphql/client.js";
import {
  LIST_ELEMENT_GROUPS_QUERY,
  GET_PROJECT_ELEMENTS_QUERY,
  GET_ELEMENT_PROPERTIES_QUERY,
  GET_AREA_BREAKDOWN_QUERY,
} from "../graphql/queries/elements.js";

type ElementProperty = { name: string; value: unknown };
type Element = { id: string; name: string; properties: { results: ElementProperty[] } };
type ElementGroup = { id: string; name: string };

interface ElementGroupsResponse {
  elementGroupsByProject: {
    pagination: { cursor: string };
    results: ElementGroup[];
  };
}

interface ElementsResponse {
  elementsByElementGroup: { results: Element[] };
}

interface SingleElementResponse {
  elementByElementGroup: Element;
}

const MAX_ELEMENTS = 500;

export async function handleGetAreaBreakdown(args: {
  element_group_id: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  let allElements: Element[] = [];
  let cursor: string | null = null;

  do {
    const data = await client.request<ElementsResponse>(GET_AREA_BREAKDOWN_QUERY, {
      elementGroupId: args.element_group_id,
    });
    const results = data.elementsByElementGroup?.results || [];
    allElements.push(...results);
    cursor = results.length >= MAX_ELEMENTS ? "more" : null;
  } while (cursor && allElements.length < MAX_ELEMENTS * 3);

  const breakdown: Record<string, { count: number; totalArea: number }> = {};
  for (const el of allElements) {
    const props = el.properties?.results || [];
    const categoryProp = props.find((p) => p.name === "category");
    const cat = (categoryProp?.value as string) || "Uncategorized";
    if (!breakdown[cat]) breakdown[cat] = { count: 0, totalArea: 0 };
    breakdown[cat].count++;
    const areaProp = props.find((p) => p.name === "Area" || p.name === "GrossArea");
    if (areaProp && typeof areaProp.value === "number") {
      breakdown[cat].totalArea += areaProp.value;
    }
  }
  return {
    content: [{ type: "text", text: JSON.stringify(breakdown, null, 2) }],
  };
}

export async function handleListElementGroups(args: {
  project_id: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  const data = await client.request<ElementGroupsResponse>(LIST_ELEMENT_GROUPS_QUERY, {
    projectId: args.project_id,
    cursor: null,
  });
  const groups = data.elementGroupsByProject?.results || [];
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            count: groups.length,
            element_groups: groups,
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function handleGetProjectElements(args: {
  element_group_id: string;
  type?: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  const filter = args.type ? `property.name.category=='${args.type}'` : undefined;
  const data = await client.request<ElementsResponse>(GET_PROJECT_ELEMENTS_QUERY, {
    elementGroupId: args.element_group_id,
    filter,
  });
  const elements = data.elementsByElementGroup?.results || [];
  return {
    content: [{ type: "text", text: JSON.stringify(elements, null, 2) }],
  };
}

export async function handleGetElementsByCategory(args: {
  element_group_id: string;
  category: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  const filter = `property.name.category=='${args.category}'`;
  const data = await client.request<ElementsResponse>(GET_PROJECT_ELEMENTS_QUERY, {
    elementGroupId: args.element_group_id,
    filter,
  });
  const elements = data.elementsByElementGroup?.results || [];
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            category: args.category,
            count: elements.length,
            element_ids: elements.map((e) => e.id),
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function handleGetElementProperties(args: {
  element_group_id: string;
  element_id: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  const data = await client.request<SingleElementResponse>(GET_ELEMENT_PROPERTIES_QUERY, {
    elementGroupId: args.element_group_id,
    elementId: args.element_id,
  });
  return {
    content: [{ type: "text", text: JSON.stringify(data.elementByElementGroup, null, 2) }],
  };
}

export async function handleSearchElements(args: {
  element_group_id: string;
  category?: string;
  property_name?: string;
  property_value?: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();
  let filter: string | undefined;
  if (args.category) {
    filter = `property.name.category=='${args.category}'`;
  }
  const data = await client.request<ElementsResponse>(GET_PROJECT_ELEMENTS_QUERY, {
    elementGroupId: args.element_group_id,
    filter,
  });

  let results = data.elementsByElementGroup?.results || [];
  if (args.property_name && args.property_value) {
    results = results.filter((el) => {
      const prop = el.properties?.results?.find((p) => p.name === args.property_name);
      return prop && String(prop.value) === args.property_value;
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