import type { WashItemSelectedOption } from '../types';
import { optionGroupLabel } from '../utils';

export function ItemDetailsSection({
  options,
  inputs,
}: {
  options: WashItemSelectedOption[];
  inputs: { inputCode: string; inputValue: string }[];
}) {
  if (options.length === 0 && inputs.length === 0) return null;

  const grouped = new Map<string, WashItemSelectedOption[]>();
  for (const opt of options) {
    const list = grouped.get(opt.groupCode) ?? [];
    list.push(opt);
    grouped.set(opt.groupCode, list);
  }

  return (
    <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 10, marginTop: 4, display: 'grid', gap: 6 }}>
      {Array.from(grouped.entries()).map(([groupCode, opts]) => (
        <div key={groupCode} style={{ display: 'grid', gap: 2 }}>
          <span style={{ color: 'var(--stone)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {optionGroupLabel(groupCode)}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
            {opts.map((opt) => (
              <span key={opt.optionCode} style={{ color: 'var(--ink-deep)', fontSize: 13 }}>
                {opt.displayName}
                {opt.quantity != null ? ` × ${opt.quantity}` : ''}
                {opt.inputValue ? ` (${opt.inputValue})` : ''}
              </span>
            ))}
          </div>
        </div>
      ))}
      {inputs.map((inp) => (
        <div key={inp.inputCode} style={{ display: 'grid', gap: 2 }}>
          <span style={{ color: 'var(--stone)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {optionGroupLabel(inp.inputCode)}
          </span>
          <span style={{ color: 'var(--ink-deep)', fontSize: 13 }}>{inp.inputValue}</span>
        </div>
      ))}
    </div>
  );
}
