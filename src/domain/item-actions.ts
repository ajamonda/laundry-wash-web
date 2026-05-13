import type { CurrentStateView, WashItemView } from '../types';

export const INSPECTION_STEP_TYPES = ['INSPECTING', 'RE_INSPECTION', 'PREMIUM_INSPECTING'] as const;

const ACTIONABLE_STATUSES = ['SORTED', 'PROCESSING'] as const;

export function isOverride(state: CurrentStateView | null | undefined): boolean {
  return state?.currentStepSource === 'OVERRIDE';
}

export function isAwaitingDecision(state: CurrentStateView | null | undefined): boolean {
  return state?.currentStep?.stepType === 'WAIT_CUSTOMER_DECISION';
}

export function canRaiseException(
  item: Pick<WashItemView, 'status'>,
  state: CurrentStateView | null | undefined,
): boolean {
  if (!ACTIONABLE_STATUSES.includes(item.status as typeof ACTIONABLE_STATUSES[number])) return false;
  const stepType = state?.currentStep?.stepType;
  if (!stepType) return false;
  return INSPECTION_STEP_TYPES.includes(stepType as typeof INSPECTION_STEP_TYPES[number]);
}

export function canRequestRouteChange(
  item: Pick<WashItemView, 'status'>,
  state: CurrentStateView | null | undefined,
): boolean {
  if (!ACTIONABLE_STATUSES.includes(item.status as typeof ACTIONABLE_STATUSES[number])) return false;
  if (!state?.routeCode) return false;
  return !isOverride(state);
}

export function canScanStep(
  item: Pick<WashItemView, 'tagBarcode'>,
  state: CurrentStateView | null | undefined,
): boolean {
  if (!item.tagBarcode) return false;
  if (state?.isPlanCompleted) return false;
  return !isAwaitingDecision(state);
}
