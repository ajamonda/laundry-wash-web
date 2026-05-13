import type { CatalogOption, CatalogOptionGroup, CatalogPrice } from '../types';

export type SelectedRepairOption = {
  optionCode: string;
  parentCode: string | null;
  displayLabel: string;
  price: CatalogPrice;
  requiresInput: boolean;
  inputType: string | null;
  inputUnit: string | null;
  inputValue: string;
};

export function calcPrice(price: CatalogPrice, inputValue?: string): { min: number; max: number } {
  if (price.priceType === 'FIXED' || price.priceType === 'MATRIX') {
    const v = price.amount ?? 0;
    return { min: v, max: v };
  }
  if (price.priceType === 'RANGE') {
    return { min: price.minAmount ?? 0, max: price.maxAmount ?? price.minAmount ?? 0 };
  }
  if (price.priceType === 'UNIT') {
    const base = price.baseAmount ?? 0;
    const baseQty = price.baseQuantity ? Number(price.baseQuantity) : 0;
    const extraUnitQty = price.extraUnitQuantity ? Number(price.extraUnitQuantity) : 0;
    const extraUnitAmt = price.extraUnitAmount ?? 0;
    const qty = inputValue ? Number(inputValue) : baseQty;
    const extra = extraUnitQty > 0 ? Math.ceil(Math.max(qty - baseQty, 0) / extraUnitQty) : 0;
    const v = base + extra * extraUnitAmt;
    return { min: v, max: v };
  }
  return { min: 0, max: 0 };
}

export function formatMoney(v: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(v);
}

export function priceLabel(price: CatalogPrice): string {
  if (price.priceType === 'FIXED' || price.priceType === 'MATRIX') return formatMoney(price.amount ?? 0);
  if (price.priceType === 'RANGE') return `${formatMoney(price.minAmount ?? 0)} ~ ${formatMoney(price.maxAmount ?? 0)}`;
  if (price.priceType === 'UNIT') {
    const base = formatMoney(price.baseAmount ?? 0);
    const bq = [price.baseQuantity, price.baseUnit].filter(Boolean).join('');
    const eq = [price.extraUnitQuantity, price.baseUnit].filter(Boolean).join('');
    return `${base}/${bq} + ${formatMoney(price.extraUnitAmount ?? 0)}/${eq}`;
  }
  return '';
}

export function RepairOptionPicker({
  group,
  selections,
  onChange,
}: {
  group: CatalogOptionGroup;
  selections: SelectedRepairOption[];
  onChange: (next: SelectedRepairOption[]) => void;
}) {
  function isSelected(optionCode: string) {
    return selections.some((s) => s.optionCode === optionCode);
  }

  function toggle(option: CatalogOption, parent?: CatalogOption) {
    const price = option.prices[0];
    if (!price) return;
    const label = parent ? `${parent.displayName} - ${option.displayName}` : option.displayName;
    if (isSelected(option.code)) {
      onChange(selections.filter((s) => s.optionCode !== option.code));
    } else {
      onChange([
        ...selections,
        {
          optionCode: option.code,
          parentCode: parent?.code ?? null,
          displayLabel: label,
          price,
          requiresInput: option.requiresInput,
          inputType: option.inputType,
          inputUnit: option.inputUnit,
          inputValue: option.requiresInput && option.inputType === 'NUMBER' ? '1' : '',
        },
      ]);
    }
  }

  function updateInput(optionCode: string, value: string) {
    onChange(selections.map((s) => s.optionCode === optionCode ? { ...s, inputValue: value } : s));
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>수선 항목 선택</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {group.options.map((option) => (
          <RepairOptionBlock
            key={option.code}
            option={option}
            selections={selections}
            isSelected={isSelected}
            onToggle={toggle}
            onInput={updateInput}
          />
        ))}
      </div>
    </div>
  );
}

function RepairOptionBlock({
  option,
  parent,
  selections,
  isSelected,
  onToggle,
  onInput,
}: {
  option: CatalogOption;
  parent?: CatalogOption;
  selections: SelectedRepairOption[];
  isSelected: (code: string) => boolean;
  onToggle: (option: CatalogOption, parent?: CatalogOption) => void;
  onInput: (code: string, value: string) => void;
}) {
  if (option.children.length > 0) {
    return (
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ fontSize: 12, color: 'var(--steel)', fontWeight: 600 }}>{option.displayName}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 8 }}>
          {option.children.map((child) => (
            <RepairOptionBlock
              key={child.code}
              option={child}
              parent={option}
              selections={selections}
              isSelected={isSelected}
              onToggle={onToggle}
              onInput={onInput}
            />
          ))}
        </div>
      </div>
    );
  }

  const selected = isSelected(option.code);
  const sel = selections.find((s) => s.optionCode === option.code);
  const price = option.prices[0];

  return (
    <div>
      <button
        className={selected ? 'action-button' : 'ghost-button'}
        style={{ fontSize: 12, minHeight: 32, padding: '6px 12px', textAlign: 'left', width: 'auto' }}
        type="button"
        onClick={() => onToggle(option, parent)}
      >
        {option.displayName}
        {price ? <span style={{ marginLeft: 6, opacity: 0.7 }}>({priceLabel(price)})</span> : null}
      </button>
      {selected && option.requiresInput ? (
        <input
          min={option.inputType === 'NUMBER' ? 0 : undefined}
          placeholder={option.inputUnit ?? '값 입력'}
          step={option.inputType === 'NUMBER' ? 0.5 : undefined}
          style={{ marginTop: 4, width: '100%' }}
          type={option.inputType === 'NUMBER' ? 'number' : 'text'}
          value={sel?.inputValue ?? ''}
          onChange={(e) => onInput(option.code, e.target.value)}
        />
      ) : null}
    </div>
  );
}
