// NOTE: Field names are based on FORMA GraphQL schema conventions.
// Introspect the live endpoint to confirm field names before first run.

export const GET_PROJECT_ELEMENTS_QUERY = `
  query GetProjectElements($projectId: String!, $category: String) {
    elements(projectId: $projectId, category: $category) {
      id
      category
      properties {
        name
        value
        unit
      }
    }
  }
`;

export const GET_ELEMENT_PROPERTIES_QUERY = `
  query GetElementProperties($projectId: String!, $elementId: String!) {
    element(projectId: $projectId, id: $elementId) {
      id
      category
      properties {
        name
        value
        unit
      }
    }
  }
`;

export const GET_AREA_BREAKDOWN_QUERY = `
  query GetAreaBreakdown($projectId: String!) {
    areaBreakdown(projectId: $projectId) {
      category
      count
      totalArea
      unit
    }
  }
`;
