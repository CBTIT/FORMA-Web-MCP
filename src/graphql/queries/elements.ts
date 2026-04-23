// AEC Data Model API v1 - https://aps.autodesk.com/en/docs/aecdatamodel/v1/reference/

export const LIST_ELEMENT_GROUPS_QUERY = `
  query ListElementGroups($projectId: ID!, $cursor: String) {
    elementGroupsByProject(projectId: $projectId, pagination: { cursor: $cursor, limit: 50 }) {
      pagination {
        cursor
      }
      results {
        id
        name
      }
    }
  }
`;

export const GET_PROJECT_ELEMENTS_QUERY = `
  query GetProjectElements($elementGroupId: ID!, $filter: String) {
    elementsByElementGroup(elementGroupId: $elementGroupId, filter: { query: $filter }) {
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
  query GetElementProperties($elementGroupId: ID!, $elementId: ID!) {
    elementByElementGroup(elementGroupId: $elementGroupId, elementId: $elementId) {
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
  query GetAreaBreakdown($elementGroupId: ID!) {
    elementsByElementGroup(elementGroupId: $elementGroupId) {
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