import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getFormaClient } from "../graphql/client.js";
import { GET_AREA_BREAKDOWN_QUERY } from "../graphql/queries/elements.js";

type ElementProperty = { name: string; value: unknown };
type Element = { id: string; name: string; properties: { results: ElementProperty[] } };

interface ElementsResponse {
  elementsByElementGroup: { results: Element[] };
}

export async function handleCompareProjects(args: {
  element_group_a_id: string;
  element_group_b_id: string;
  property: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();

  const [dataA, dataB] = await Promise.all([
    client.request<ElementsResponse>(GET_AREA_BREAKDOWN_QUERY, {
      elementGroupId: args.element_group_a_id,
    }),
    client.request<ElementsResponse>(GET_AREA_BREAKDOWN_QUERY, {
      elementGroupId: args.element_group_b_id,
    }),
  ]);

  const calcBreakdown = (elements: Element[]) => {
    const breakdown: Record<string, { count: number; totalArea: number }> = {};
    for (const el of elements) {
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
    return breakdown;
  };

  const aMap = calcBreakdown(dataA.elementsByElementGroup?.results || []);
  const bMap = calcBreakdown(dataB.elementsByElementGroup?.results || []);

  const allCategories = [
    ...new Set([...Object.keys(aMap), ...Object.keys(bMap)]),
  ].sort();

  const comparison = allCategories.map((cat) => {
    const aVal = aMap[cat]?.totalArea ?? 0;
    const bVal = bMap[cat]?.totalArea ?? 0;
    return {
      category: cat,
      element_group_a: aVal,
      element_group_b: bVal,
      difference: bVal - aVal,
    };
  });

  const totalA = Object.values(aMap).reduce((s, v) => s + v.totalArea, 0);
  const totalB = Object.values(bMap).reduce((s, v) => s + v.totalArea, 0);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            property: args.property,
            element_group_a_id: args.element_group_a_id,
            element_group_b_id: args.element_group_b_id,
            total_a: totalA,
            total_b: totalB,
            larger: totalA > totalB ? "a" : totalB > totalA ? "b" : "equal",
            comparison,
          },
          null,
          2
        ),
      },
    ],
  };
}