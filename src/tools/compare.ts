import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getFormaClient } from "../graphql/client.js";
import { GET_AREA_BREAKDOWN_QUERY } from "../graphql/queries/elements.js";
import type { AreaBreakdownItem } from "../types/forma.js";

interface AreaBreakdownResponse {
  areaBreakdown: AreaBreakdownItem[];
}

export async function handleCompareProjects(args: {
  project_a_id: string;
  project_b_id: string;
  property: string;
}): Promise<CallToolResult> {
  const client = await getFormaClient();

  const [dataA, dataB] = await Promise.all([
    client.request<AreaBreakdownResponse>(GET_AREA_BREAKDOWN_QUERY, {
      projectId: args.project_a_id,
    }),
    client.request<AreaBreakdownResponse>(GET_AREA_BREAKDOWN_QUERY, {
      projectId: args.project_b_id,
    }),
  ]);

  const toMap = (items: AreaBreakdownItem[]) =>
    Object.fromEntries(items.map((i) => [i.category, i.totalArea]));

  const aMap = toMap(dataA.areaBreakdown);
  const bMap = toMap(dataB.areaBreakdown);

  const allCategories = [
    ...new Set([...Object.keys(aMap), ...Object.keys(bMap)]),
  ].sort();

  const breakdown = allCategories.map((cat) => {
    const aVal = aMap[cat] ?? 0;
    const bVal = bMap[cat] ?? 0;
    return {
      category: cat,
      project_a: aVal,
      project_b: bVal,
      difference: bVal - aVal,
      larger: aVal > bVal ? "project_a" : bVal > aVal ? "project_b" : "equal",
    };
  });

  const totalA = Object.values(aMap).reduce((s, v) => s + v, 0);
  const totalB = Object.values(bMap).reduce((s, v) => s + v, 0);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            property: args.property,
            project_a_id: args.project_a_id,
            project_b_id: args.project_b_id,
            total_project_a: totalA,
            total_project_b: totalB,
            overall_larger: totalA > totalB ? "project_a" : totalB > totalA ? "project_b" : "equal",
            breakdown,
          },
          null,
          2
        ),
      },
    ],
  };
}
