import { describe, expect, it } from 'vitest';
import type { CurrentStateView, WashItemView } from '../types';
import {
  canRaiseException,
  canRequestRouteChange,
  canScanStep,
  isAwaitingDecision,
  isOverride,
} from './item-actions';

function state(overrides: Partial<CurrentStateView> = {}): CurrentStateView {
  return {
    orderItemId: 'item-1',
    planId: 'plan-1',
    routeCode: 'GENERAL_CLOTHES_CLEANING',
    currentStepSource: 'ROUTE',
    currentStep: { stepId: 's1', stepType: 'WASHING', displayName: '세탁', sortOrder: 1, status: 'IN_PROGRESS' },
    nextStep: null,
    isPlanCompleted: false,
    ...overrides,
  };
}

function item(overrides: Partial<WashItemView> = {}): WashItemView {
  return {
    itemId: 'item-1',
    orderId: 'order-1',
    catalogItemCode: 'shirt',
    displayNameSnapshot: '셔츠',
    status: 'PROCESSING',
    location: 'WASH',
    tagBarcode: 'TAG-0001',
    estimatedMinAmount: 0,
    processingState: null,
    selectedOptions: [],
    inputs: [],
    ...overrides,
  };
}

describe('isOverride', () => {
  it('OVERRIDE source → true', () => {
    expect(isOverride(state({ currentStepSource: 'OVERRIDE' }))).toBe(true);
  });
  it('ROUTE source → false', () => {
    expect(isOverride(state())).toBe(false);
  });
  it('null/undefined state → false', () => {
    expect(isOverride(null)).toBe(false);
    expect(isOverride(undefined)).toBe(false);
  });
});

describe('isAwaitingDecision', () => {
  it('WAIT_CUSTOMER_DECISION step → true', () => {
    expect(
      isAwaitingDecision(
        state({ currentStep: { ...state().currentStep!, stepType: 'WAIT_CUSTOMER_DECISION' } }),
      ),
    ).toBe(true);
  });
  it('other step → false', () => {
    expect(isAwaitingDecision(state())).toBe(false);
  });
  it('null state → false', () => {
    expect(isAwaitingDecision(null)).toBe(false);
  });
});

describe('canRaiseException', () => {
  it.each(['INSPECTING', 'RE_INSPECTION', 'PREMIUM_INSPECTING'])(
    'allowed when status=PROCESSING and step=%s',
    (stepType) => {
      expect(
        canRaiseException(item(), state({ currentStep: { ...state().currentStep!, stepType } })),
      ).toBe(true);
    },
  );

  it('allowed when status=SORTED at inspection step', () => {
    expect(
      canRaiseException(
        item({ status: 'SORTED' }),
        state({ currentStep: { ...state().currentStep!, stepType: 'INSPECTING' } }),
      ),
    ).toBe(true);
  });

  it('rejected at non-inspection step (WASHING)', () => {
    expect(canRaiseException(item(), state())).toBe(false);
  });

  it.each(['PICK_UP', 'TAGGED', 'READY_TO_PACKAGE', 'FINISHED'])(
    'rejected when status=%s even at inspection step',
    (status) => {
      expect(
        canRaiseException(
          item({ status }),
          state({ currentStep: { ...state().currentStep!, stepType: 'INSPECTING' } }),
        ),
      ).toBe(false);
    },
  );

  it('rejected when state is null', () => {
    expect(canRaiseException(item(), null)).toBe(false);
  });

  it('rejected when currentStep is null', () => {
    expect(canRaiseException(item(), state({ currentStep: null }))).toBe(false);
  });
});

describe('canRequestRouteChange', () => {
  it('allowed when status=PROCESSING and source=ROUTE', () => {
    expect(canRequestRouteChange(item(), state())).toBe(true);
  });

  it('rejected when source=OVERRIDE (invariant 5)', () => {
    expect(canRequestRouteChange(item(), state({ currentStepSource: 'OVERRIDE' }))).toBe(false);
  });

  it.each(['PICK_UP', 'TAGGED', 'READY_TO_PACKAGE'])('rejected when status=%s', (status) => {
    expect(canRequestRouteChange(item({ status }), state())).toBe(false);
  });

  it('rejected when state is null', () => {
    expect(canRequestRouteChange(item(), null)).toBe(false);
  });

  it('rejected when routeCode is empty', () => {
    expect(canRequestRouteChange(item(), state({ routeCode: '' }))).toBe(false);
  });
});

describe('canScanStep', () => {
  it('allowed with tag + active plan + non-decision step', () => {
    expect(canScanStep(item(), state())).toBe(true);
  });

  it('rejected when tagBarcode is null', () => {
    expect(canScanStep(item({ tagBarcode: null }), state())).toBe(false);
  });

  it('rejected when plan is completed', () => {
    expect(canScanStep(item(), state({ isPlanCompleted: true }))).toBe(false);
  });

  it('rejected when awaiting customer decision (invariant 4)', () => {
    expect(
      canScanStep(
        item(),
        state({ currentStep: { ...state().currentStep!, stepType: 'WAIT_CUSTOMER_DECISION' } }),
      ),
    ).toBe(false);
  });

  it('allowed when state is null but tag exists (pre-state edge case)', () => {
    expect(canScanStep(item(), null)).toBe(true);
  });
});
