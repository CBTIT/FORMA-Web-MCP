import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getValidToken } from "../auth/tokens.js";

const CANDIDATE_ENDPOINTS = [
  "https://developer.api.autodesk.com/mfgdataapi/v2/graphql",
  "https://developer.api.autodesk.com/manufacturing/v2/graphql",
  "https://developer.api.autodesk.com/graphql/v2/mfg",
  "https://developer.api.autodesk.com/graphql/v1/mfg",
  "https://developer.api.autodesk.com/mfgdataapi/v1/graphql",
];

const INTROSPECT_QUERY = JSON.stringify({
  query: `{ __schema { types { name kind } } }`,
});

// Probes each candidate URL with a simple introspection query to find which one responds.
export async function handleFindEndpoint(): Promise<CallToolResult> {
  const token = await getValidToken();
  const results: Record<string, string> = {};

  for (const url of CANDIDATE_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: INTROSPECT_QUERY,
      });

      const body = await res.text();
      results[url] = `HTTP ${res.status} — ${body.slice(0, 300)}`;
    } catch (err) {
      results[url] = `FETCH ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return {
    content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
  };
}

// Runs a GraphQL introspection query against the configured FORMA_GRAPHQL_URL
// and returns the available root types so queries can be verified.
export async function handleIntrospectSchema(): Promise<CallToolResult> {
  const token = await getValidToken();
  const endpoint = process.env.FORMA_GRAPHQL_URL;

  if (!endpoint) {
    throw new Error("FORMA_GRAPHQL_URL is not set in .env");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `{
        __schema {
          queryType { name }
          types {
            name
            kind
            fields { name }
          }
        }
      }`,
    }),
  });

  const raw = await res.text();

  if (!res.ok) {
    return {
      content: [
        {
          type: "text",
          text: `HTTP ${res.status} from ${endpoint}\n\n${raw}`,
        },
      ],
      isError: true,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      content: [{ type: "text", text: `Non-JSON response:\n${raw}` }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }],
  };
}
