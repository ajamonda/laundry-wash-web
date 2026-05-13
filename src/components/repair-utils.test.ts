import { describe, expect, it } from 'vitest';
import type { CatalogPrice } from '../types';
import { calcPrice } from './repair-utils';

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

describe('calcPrice — FIXED', () => {
  it('returns amount for both min and max', () => {
    expect(calcPrice(price({ priceType: 'FIXED', amount: 5000 }))).toEqual({ min: 5000, max: 5000 });
  });
  it('null amount → 0', () => {
    expect(calcPrice(price({ priceType: 'FIXED', amount: null }))).toEqual({ min: 0, max: 0 });
  });
});

describe('calcPrice — MATRIX', () => {
  it('treated like FIXED (uses amount)', () => {
    expect(calcPrice(price({ priceType: 'MATRIX', amount: 12000 }))).toEqual({ min: 12000, max: 12000 });
  });
});

describe('calcPrice — RANGE', () => {
  it('min and max distinct', () => {
    expect(calcPrice(price({ priceType: 'RANGE', minAmount: 3000, maxAmount: 7000 }))).toEqual({
      min: 3000,
      max: 7000,
    });
  });
  it('maxAmount null → falls back to minAmount', () => {
    expect(calcPrice(price({ priceType: 'RANGE', minAmount: 3000, maxAmount: null }))).toEqual({
      min: 3000,
      max: 3000,
    });
  });
  it('both null → 0/0', () => {
    expect(calcPrice(price({ priceType: 'RANGE' }))).toEqual({ min: 0, max: 0 });
  });
});

describe('calcPrice — UNIT', () => {
  // base 2000원 / 첫 1단위 + 추가 1단위마다 500원
  const unit = price({
    priceType: 'UNIT',
    baseAmount: 2000,
    baseQuantity: '1',
    extraUnitQuantity: '1',
    extraUnitAmount: 500,
  });

  it('inputValue undefined → defaults to baseQuantity (no extra)', () => {
    expect(calcPrice(unit, undefined)).toEqual({ min: 2000, max: 2000 });
  });

  it('inputValue equal to baseQuantity → no extra', () => {
    expect(calcPrice(unit, '1')).toEqual({ min: 2000, max: 2000 });
  });

  it('partial extra unit rounds up via ceil', () => {
    // qty=1.5 → extra = ceil((1.5-1)/1) = 1 → 2000 + 500 = 2500
    expect(calcPrice(unit, '1.5')).toEqual({ min: 2500, max: 2500 });
  });

  it('multiple extra units', () => {
    // qty=4 → extra = ceil((4-1)/1) = 3 → 2000 + 1500 = 3500
    expect(calcPrice(unit, '4')).toEqual({ min: 3500, max: 3500 });
  });

  it('qty below baseQuantity does not go negative', () => {
    expect(calcPrice(unit, '0.5')).toEqual({ min: 2000, max: 2000 });
  });

  it('extraUnitQuantity = 0 disables extra accumulation', () => {
    const noExtra = price({
      priceType: 'UNIT',
      baseAmount: 2000,
      baseQuantity: '1',
      extraUnitQuantity: '0',
      extraUnitAmount: 500,
    });
    expect(calcPrice(noExtra, '10')).toEqual({ min: 2000, max: 2000 });
  });

  it('empty string inputValue falls back to baseQuantity', () => {
    expect(calcPrice(unit, '')).toEqual({ min: 2000, max: 2000 });
  });
});

describe('calcPrice — NONE / unknown', () => {
  it('returns 0/0', () => {
    expect(calcPrice(price({ priceType: 'NONE' }))).toEqual({ min: 0, max: 0 });
  });
});
