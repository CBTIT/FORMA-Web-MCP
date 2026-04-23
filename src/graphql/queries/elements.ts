// AEC Data Model API v1 - https://aps.autodesk.com/en/docs/aecdatamodel/v1/reference/

export const GET_PROJECT_ELEMENTS_QUERY = `
  query GetProjectElements($projectId: ID!, $category: String) {
    elements(projectId: $projectId, filter: { query: $category }) {
      results {
        id
        name
        category
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
      category
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
    elements(projectId: $projectId, filter: { query: "property.name.category" }) {
      results {
        id
        name
        category
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