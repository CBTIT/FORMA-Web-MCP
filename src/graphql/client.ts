import { GraphQLClient } from "graphql-request";
import { getValidToken } from "../auth/tokens.js";

export async function getFormaClient(): Promise<GraphQLClient> {
  const token = await getValidToken();
  const endpoint = process.env.FORMA_GRAPHQL_URL;

  if (!endpoint) {
    throw new Error("FORMA_GRAPHQL_URL must be set in .env");
  }

  return new GraphQLClient(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}
