import type {
  AssignRouteResult,
  BagView,
  CatalogItemDetail,
  CreatePackagesResult,
  CurrentStateView,
  IssueResult,
  OrderItemsView,
  ProcessingQueueResponse,
  ProcessingRoute,
  RouteChangeRequestView,
  ScanStepResult,
  StaffSession,
  WashItemView,
} from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT';
  token?: string;
  body?: unknown;
};

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const api = {
  staffDevLogin(staffId: string) {
    return request<StaffSession>('/auth/staff/wash/dev-login', {
      body: { staffId },
    });
  },

  getBag(token: string, barcode: string) {
    return request<BagView>(`/wash/bags/${encodeURIComponent(barcode)}`, { token });
  },

  getOrderItems(token: string, orderId: string) {
    return request<OrderItemsView>(`/wash/orders/${encodeURIComponent(orderId)}/items`, { token });
  },

  tagItem(token: string, itemId: string, tagBarcode: string) {
    return request<WashItemView>(`/wash/items/${itemId}/tag`, {
      token,
      body: { tagBarcode },
    });
  },

  getRoutes(token: string) {
    return request<ProcessingRoute[]>('/processing-routes', { token });
  },

  assignRoute(token: string, tagBarcode: string, routeCode: string) {
    return request<AssignRouteResult>(`/wash/tags/${encodeURIComponent(tagBarcode)}/assign-route`, {
      token,
      body: { routeCode },
    });
  },

  getProcessingQueue(token: string) {
    return request<ProcessingQueueResponse>('/wash/processing-queue', { token });
  },

  getItemByTag(token: string, tagBarcode: string) {
    return request<WashItemView>(`/wash/tags/${encodeURIComponent(tagBarcode)}`, { token });
  },

  scanStep(token: string, tagBarcode: string) {
    return request<ScanStepResult>(`/wash/tags/${encodeURIComponent(tagBarcode)}/scan-step`, {
      method: 'POST',
      token,
    });
  },

  createPackages(token: string) {
    return request<CreatePackagesResult>('/wash/packages', { method: 'POST', token });
  },

  raiseIssue(token: string, itemId: string, issueType: string, note: string) {
    return request<IssueResult>(`/wash/items/${itemId}/raise-issue`, {
      token,
      body: { issueType, note },
    });
  },

  activateExceptionFlow(token: string, itemId: string, flowCode: string, additionalCost?: number) {
    return request<CurrentStateView>(`/wash/items/${itemId}/activate-exception-flow`, {
      token,
      body: { flowCode, additionalCost },
    });
  },

  getCatalogItem(itemCode: string) {
    return request<CatalogItemDetail>(`/catalog/items/${encodeURIComponent(itemCode)}`);
  },

  requestRouteChange(
    token: string,
    itemId: string,
    input: {
      toRouteCode: string;
      additionalCost?: number;
      reason: string;
      repairOptions?: { optionCode: string; inputValue?: string }[];
    },
  ) {
    return request<RouteChangeRequestView>(`/wash/items/${itemId}/request-route-change`, {
      token,
      body: input,
    });
  },
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const payload = text ? parseJson(text) : null;

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `요청에 실패했어요. (${response.status})`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
