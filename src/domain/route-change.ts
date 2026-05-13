import type { CatalogOption, CatalogOptionGroup } from '../types';
import { calcPrice, SelectedRepairOption } from '../components/repair-utils';

export function findOptionByCode(options: CatalogOption[], code: string): CatalogOption | null {
  for (const opt of options) {
    if (opt.code === code) return opt;
    const found = findOptionByCode(opt.children, code);
    if (found) return found;
  }
  return null;
}

export function buildRepairSelection(
  group: CatalogOptionGroup,
  optionCode: string,
  inputValue: string | null,
): SelectedRepairOption | null {
  for (const parent of group.options) {
    const child = parent.children.find((c) => c.code === optionCode);
    const target = parent.code === optionCode ? parent : child ?? null;
    if (!target) continue;
    const price = target.prices[0];
    if (!price) return null;
    const label = child ? `${parent.displayName} - ${target.displayName}` : target.displayName;
    return {
      optionCode: target.code,
      parentCode: child ? parent.code : null,
      displayLabel: label,
      price,
      requiresInput: target.requiresInput,
      inputType: target.inputType,
      inputUnit: target.inputUnit,
      inputValue: inputValue ?? (target.requiresInput && target.inputType === 'NUMBER' ? '1' : ''),
    };
  }
  return null;
}

export type RouteChangeCost = {
  /** New route's implied cleaning_method option price; {0,0} if cleaning_method is null (e.g. OUTSOURCED_ONLY_CLEANING) */
  newCleaningPrice: { min: number; max: number };
  repairCost: { min: number; max: number };
  totalNew: { min: number; max: number };
  /** total - estimatedMinAmount. May be negative (savings). This is the value sent as `additionalCost` to the server. */
  additionalCost: { min: number; max: number };
  /** True only when the caller should display the cost panel. False when cleaning_method is null or catalog unavailable. */
  hasPriceInfo: boolean;
};

export function computeRouteChangeCost(input: {
  cleaningGroup: CatalogOptionGroup | null | undefined;
  newCleaningMethodCode: string | null | undefined;
  repairSelections: SelectedRepairOption[];
  estimatedMinAmount: number;
}): RouteChangeCost {
  const { cleaningGroup, newCleaningMethodCode, repairSelections, estimatedMinAmount } = input;

  const repairMin = repairSelections.reduce((sum, o) => sum + calcPrice(o.price, o.inputValue).min, 0);
  const repairMax = repairSelections.reduce((sum, o) => sum + calcPrice(o.price, o.inputValue).max, 0);

  const newCleaningOption =
    newCleaningMethodCode && cleaningGroup
      ? cleaningGroup.options.find((o) => o.code === newCleaningMethodCode) ?? null
      : null;

  const newCleaningPrice = newCleaningOption
    ? calcPrice(newCleaningOption.prices[0], undefined)
    : { min: 0, max: 0 };

  const totalMin = newCleaningPrice.min + repairMin;
  const totalMax = newCleaningPrice.max + repairMax;

  return {
    newCleaningPrice,
    repairCost: { min: repairMin, max: repairMax },
    totalNew: { min: totalMin, max: totalMax },
    additionalCost: { min: totalMin - estimatedMinAmount, max: totalMax - estimatedMinAmount },
    hasPriceInfo: newCleaningOption != null,
  };
}
