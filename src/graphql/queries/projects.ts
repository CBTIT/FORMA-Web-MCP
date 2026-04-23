// NOTE: Field names are based on FORMA GraphQL schema conventions.
// Introspect the live endpoint to confirm: POST FORMA_GRAPHQL_URL with {"query":"{__schema{types{name}}}"}

export const LIST_HUBS_QUERY = `
  query ListHubs {
    hubs {
      results {
        id
        name
        region
      }
    }
  }
`;

export const LIST_PROJECTS_QUERY = `
  query ListProjects($hubId: String!) {
    projects(hubId: $hubId) {
      results {
        id
        name
        status
        modelUrn
        createdAt
        updatedAt
      }
    }
  }
`;
