export type AppStep =
  | 'login'
  | 'bag-scan'
  | 'bag-items'
  | 'order-search'
  | 'queue'
  | 'step-scan'
  | 'packaging';

export type StaffSession = {
  accessToken: string;
  staff: {
    staffId: string;
    role: string;
    displayName: string | null;
    phoneNumber: string | null;
  };
};

export type CurrentStateView = {
  orderItemId: string;
  planId: string;
  routeCode: string;
  currentStepSource: 'ROUTE' | 'OVERRIDE';
  currentStep: {
    stepId: string;
    stepType: string;
    displayName: string;
    sortOrder: number;
    status: 'IN_PROGRESS' | 'COMPLETED';
  } | null;
  nextStep: {
    stepId: string;
    stepType: string;
    displayName: string;
    sortOrder: number;
  } | null;
  isPlanCompleted: boolean;
};

export type WashItemSelectedOption = {
  groupCode: string;
  optionCode: string;
  displayName: string;
  inputValue: string | null;
  quantity: number | null;
};

export type WashItemView = {
  itemId: string;
  orderId: string;
  catalogItemCode: string;
  displayNameSnapshot: string;
  status: string;
  location: string;
  tagBarcode: string | null;
  estimatedMinAmount: number;
  processingState: CurrentStateView | null;
  selectedOptions: WashItemSelectedOption[];
  inputs: { inputCode: string; inputValue: string }[];
};

export type BagView = {
  bagBarcode: string;
  items: WashItemView[];
};

export type OrderItemsView = {
  orderId: string;
  items: WashItemView[];
};

export type AssignRouteResult = {
  item: WashItemView;
  processingState: CurrentStateView;
};

export type ScanStepResult = {
  item: WashItemView;
  processingState: CurrentStateView;
};

export type ProcessingRoute = {
  id: string;
  code: string;
  displayName: string;
  active: boolean;
  steps: {
    id: string;
    stepType: string;
    displayName: string;
    sortOrder: number;
  }[];
};

export type ProcessingQueueItem = {
  itemId: string;
  orderId: string;
  tagBarcode: string | null;
  displayNameSnapshot: string;
  status: string;
  routeCode: string;
  currentStep: {
    stepType: string;
    displayName: string;
    sortOrder: number;
    status: string;
  } | null;
  nextStep: {
    stepType: string;
    displayName: string;
    sortOrder: number;
  } | null;
  isPlanCompleted: boolean;
};

export type ProcessingQueueResponse = {
  items: ProcessingQueueItem[];
};

export type IssueResult = {
  id: string;
  orderItemId: string;
  issueType: string;
  note: string | null;
  raisedBy: string;
  createdAt: string;
};

export type CreatePackagesResult = {
  packages: {
    packageId: string;
    orderId: string;
    items: { itemId: string; tagBarcode: string | null }[];
    createdAt: string;
  }[];
};

export type RouteChangeRequestView = {
  id: string;
  orderItemId: string;
  fromRouteCode: string;
  toRouteCode: string;
  additionalCost: number | null;
  reason: string;
  status: string;
  requestedBy: string;
  createdAt: string;
};

export type CatalogPrice = {
  id: string;
  priceType: 'FIXED' | 'RANGE' | 'UNIT' | 'MATRIX' | 'NONE';
  currency: string;
  amount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  baseAmount: number | null;
  baseQuantity: string | null;
  baseUnit: string | null;
  extraUnitQuantity: string | null;
  extraUnitAmount: number | null;
};

export type CatalogOption = {
  id: string;
  code: string;
  displayName: string;
  parentOptionId: string | null;
  requiresInput: boolean;
  inputType: string | null;
  inputUnit: string | null;
  sortOrder: number;
  prices: CatalogPrice[];
  children: CatalogOption[];
};

export type CatalogOptionGroup = {
  id: string;
  code: string;
  displayName: string;
  selectionType: 'SINGLE' | 'MULTI';
  required: boolean;
  sortOrder: number;
  options: CatalogOption[];
};

export type CatalogItemDetail = {
  id: string;
  code: string;
  displayName: string;
  optionGroups: CatalogOptionGroup[];
};
