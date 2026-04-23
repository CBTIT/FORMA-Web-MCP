// AEC Data Model API v1 - https://aps.autodesk.com/en/docs/aecdatamodel/v1/reference/

export const GET_PROJECT_ELEMENTS_QUERY = `
  query GetProjectElements($projectId: ID!, $filter: String) {
    elements(projectId: $projectId, filter: { query: $filter }) {
      results {
        id
        name
        properties {
          results {
            name
            value
          }
        }
      }
    }
  }
`;

export const GET_ELEMENT_PROPERTIES_QUERY = `
  query GetElementProperties($projectId: ID!, $elementId: ID!) {
    element(projectId: $projectId, elementId: $elementId) {
      id
      name
      properties {
        results {
          name
          value
        }
      }
    }
  }
`;

export const GET_AREA_BREAKDOWN_QUERY = `
  query GetAreaBreakdown($projectId: ID!) {
    elements(projectId: $projectId) {
      results {
        id
        name
        properties {
          results {
            name
            value
          }
        }
      }
    }
  }
`;