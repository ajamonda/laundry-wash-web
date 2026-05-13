import { describe, expect, it } from 'vitest';
import type { CatalogOption, CatalogOptionGroup, CatalogPrice } from '../types';
import type { SelectedRepairOption } from '../components/repair-utils';
import { buildRepairSelection, computeRouteChangeCost, findOptionByCode } from './route-change';

// ── fixtures ────────────────────────────────────────────────────────
function price(p: Partial<CatalogPrice> & Pick<CatalogPrice, 'priceType'>): CatalogPrice {
  return {
    id: 'p1',
    currency: 'KRW',
    amount: null,
    minAmount: null,
    maxAmount: null,
    baseAmount: null,
    baseQuantity: null,
    baseUnit: null,
    extraUnitQuantity: null,
    extraUnitAmount: null,
    ...p,
  };
}

function option(o: Partial<CatalogOption> & Pick<CatalogOption, 'code' | 'displayName'>): CatalogOption {
  return {
    id: o.code,
    parentOptionId: null,
    requiresInput: false,
    inputType: null,
    inputUnit: null,
    sortOrder: 0,
    prices: [],
    children: [],
    ...o,
  };
}

const repairGroup: CatalogOptionGroup = {
  id: 'g1',
  code: 'repair',
  displayName: '수선',
  selectionType: 'MULTI',
  required: false,
  sortOrder: 0,
  options: [
    option({
      code: 'hem',
      displayName: '단 수선',
      prices: [price({ priceType: 'FIXED', amount: 3000 })],
    }),
    option({
      code: 'patch',
      displayName: '패치',
      children: [
        option({
          code: 'patch_small',
          displayName: '소형',
          requiresInput: true,
          inputType: 'NUMBER',
          inputUnit: 'cm',
          prices: [price({ priceType: 'FIXED', amount: 5000 })],
        }),
        option({
          code: 'patch_large',
          displayName: '대형',
          prices: [], // no price
        }),
      ],
    }),
  ],
};

const cleaningGroup: CatalogOptionGroup = {
  id: 'g2',
  code: 'cleaning_method',
  displayName: '세탁 방법',
  selectionType: 'SINGLE',
  required: true,
  sortOrder: 0,
  options: [
    option({
      code: 'regular_wash',
      displayName: '일반 세탁',
      prices: [price({ priceType: 'FIXED', amount: 10000 })],
    }),
    option({
      code: 'premium_wash',
      displayName: '프리미엄 세탁',
      prices: [price({ priceType: 'FIXED', amount: 25000 })],
    }),
  ],
};

// ── findOptionByCode ────────────────────────────────────────────────
describe('findOptionByCode', () => {
  it('finds top-level option', () => {
    expect(findOptionByCode(repairGroup.options, 'hem')?.displayName).toBe('단 수선');
  });
  it('finds nested option', () => {
    expect(findOptionByCode(repairGroup.options, 'patch_small')?.displayName).toBe('소형');
  });
  it('returns null when not found', () => {
    expect(findOptionByCode(repairGroup.options, 'nonexistent')).toBeNull();
  });
});

// ── buildRepairSelection ────────────────────────────────────────────
describe('buildRepairSelection', () => {
  it('builds selection for top-level option (no parent)', () => {
    const result = buildRepairSelection(repairGroup, 'hem', null);
    expect(result).toMatchObject({
      optionCode: 'hem',
      parentCode: null,
      displayLabel: '단 수선',
    });
  });

  it('builds selection for child option with parent label prefix', () => {
    const result = buildRepairSelection(repairGroup, 'patch_small', '5');
    expect(result).toMatchObject({
      optionCode: 'patch_small',
      parentCode: 'patch',
      displayLabel: '패치 - 소형',
      inputValue: '5',
    });
  });

  it('defaults inputValue to "1" for NUMBER inputs when not provided', () => {
    const result = buildRepairSelection(repairGroup, 'patch_small', null);
    expect(result?.inputValue).toBe('1');
  });

  it('returns null when option has no price', () => {
    expect(buildRepairSelection(repairGroup, 'patch_large', null)).toBeNull();
  });

  it('returns null when option code not found', () => {
    expect(buildRepairSelection(repairGroup, 'unknown', null)).toBeNull();
  });
});

// ── computeRouteChangeCost ──────────────────────────────────────────
function repairSel(code: string, amount: number, inputValue = ''): SelectedRepairOption {
  return {
    optionCode: code,
    parentCode: null,
    displayLabel: code,
    price: price({ priceType: 'FIXED', amount }),
    requiresInput: false,
    inputType: null,
    inputUnit: null,
    inputValue,
  };
}

describe('computeRouteChangeCost', () => {
  it('cleaning_method only — no repair (additionalCost = newPrice - estimatedMin)', () => {
    const cost = computeRouteChangeCost({
      cleaningGroup,
      newCleaningMethodCode: 'premium_wash',
      repairSelections: [],
      estimatedMinAmount: 10000,
    });
    expect(cost.newCleaningPrice).toEqual({ min: 25000, max: 25000 });
    expect(cost.repairCost).toEqual({ min: 0, max: 0 });
    expect(cost.totalNew).toEqual({ min: 25000, max: 25000 });
    expect(cost.additionalCost).toEqual({ min: 15000, max: 15000 });
    expect(cost.hasPriceInfo).toBe(true);
  });

  it('cleaning + multiple repair options accumulate', () => {
    const cost = computeRouteChangeCost({
      cleaningGroup,
      newCleaningMethodCode: 'regular_wash',
      repairSelections: [repairSel('hem', 3000), repairSel('patch_small', 5000)],
      estimatedMinAmount: 10000,
    });
    expect(cost.totalNew).toEqual({ min: 18000, max: 18000 }); // 10000 + 3000 + 5000
    expect(cost.additionalCost).toEqual({ min: 8000, max: 8000 });
  });

  it('cleaning_method=null → newCleaningPrice 0, hasPriceInfo false (OUTSOURCED_ONLY_CLEANING case)', () => {
    const cost = computeRouteChangeCost({
      cleaningGroup,
      newCleaningMethodCode: null,
      repairSelections: [repairSel('hem', 3000)],
      estimatedMinAmount: 10000,
    });
    expect(cost.newCleaningPrice).toEqual({ min: 0, max: 0 });
    expect(cost.hasPriceInfo).toBe(false);
    // even though repair still computes, the additionalCost is not displayed by caller
    expect(cost.repairCost).toEqual({ min: 3000, max: 3000 });
  });

  it('cleaningGroup missing → hasPriceInfo false', () => {
    const cost = computeRouteChangeCost({
      cleaningGroup: null,
      newCleaningMethodCode: 'regular_wash',
      repairSelections: [],
      estimatedMinAmount: 0,
    });
    expect(cost.hasPriceInfo).toBe(false);
    expect(cost.newCleaningPrice).toEqual({ min: 0, max: 0 });
  });

  it('cleaning_method code not present in group → hasPriceInfo false', () => {
    const cost = computeRouteChangeCost({
      cleaningGroup,
      newCleaningMethodCode: 'unknown_method',
      repairSelections: [],
      estimatedMinAmount: 5000,
    });
    expect(cost.hasPriceInfo).toBe(false);
    expect(cost.additionalCost).toEqual({ min: -5000, max: -5000 });
  });

  it('negative additionalCost (savings) is preserved — backend accepts negative', () => {
    const cost = computeRouteChangeCost({
      cleaningGroup,
      newCleaningMethodCode: 'regular_wash',
      repairSelections: [],
      estimatedMinAmount: 25000, // was premium, switching down to regular
    });
    expect(cost.additionalCost).toEqual({ min: -15000, max: -15000 });
  });

  it('range repair price propagates min/max to additionalCost', () => {
    const rangeRepair: SelectedRepairOption = {
      optionCode: 'range',
      parentCode: null,
      displayLabel: 'range',
      price: price({ priceType: 'RANGE', minAmount: 2000, maxAmount: 8000 }),
      requiresInput: false,
      inputType: null,
      inputUnit: null,
      inputValue: '',
    };
    const cost = computeRouteChangeCost({
      cleaningGroup,
      newCleaningMethodCode: 'regular_wash',
      repairSelections: [rangeRepair],
      estimatedMinAmount: 10000,
    });
    expect(cost.repairCost).toEqual({ min: 2000, max: 8000 });
    expect(cost.totalNew).toEqual({ min: 12000, max: 18000 });
    expect(cost.additionalCost).toEqual({ min: 2000, max: 8000 });
  });
});
