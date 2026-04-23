export interface Hub {
  id: string;
  name: string;
  region: string;
}

export interface Project {
  id: string;
  name: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ElementProperty {
  name: string;
  value: string | number | boolean;
  unit?: string;
}

export interface Element {
  id: string;
  category: string;
  properties: ElementProperty[];
}

export interface AreaBreakdownItem {
  category: string;
  count: number;
  totalArea: number;
  unit?: string;
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}
