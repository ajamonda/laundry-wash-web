import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { CatalogOptionGroup, IssueResult } from '../types';
import { ErrorNotice } from './ErrorNotice';
import { calcPrice, formatMoney, RepairOptionPicker, SelectedRepairOption } from './repair-utils';

// ── 아이템 종류별 허용 이슈 유형 ──────────────────────────────────────
const ITEM_ISSUE_MAP: Record<string, ReadonlyArray<string>> = {
  shirt:           ['REWASH_REQUIRED', 'ADDITIONAL_REPAIR_REQUIRED'],
  pants:           ['REWASH_REQUIRED', 'ADDITIONAL_REPAIR_REQUIRED'],
  sneakers:        ['REWASH_REQUIRED', 'ADDITIONAL_REPAIR_REQUIRED'],
  ugg_boots:       ['ADDITIONAL_VENDOR_REQUIRED'],
  accessory_shirt: ['REWASH_REQUIRED', 'ADDITIONAL_REPAIR_REQUIRED'],
  tent:            ['ADDITIONAL_VENDOR_REQUIRED'],
  quick_laundry:   ['REWASH_REQUIRED'],
};

const ISSUE_OPTIONS = [
  { value: 'REWASH_REQUIRED',          label: '재세탁',    flowCode: 'REWASH_FLOW' },
  { value: 'ADDITIONAL_REPAIR_REQUIRED', label: '추가 수선', flowCode: 'ADDITIONAL_REPAIR_FLOW' },
  { value: 'ADDITIONAL_VENDOR_REQUIRED', label: '추가 외주', flowCode: 'ADDITIONAL_VENDOR_FLOW' },
] as const;

type IssueValue = typeof ISSUE_OPTIONS[number]['value'];

export function ExceptionForm({
  itemId,
  token,
  catalogItemCode,
  onDone,
  onCancel,
}: {
  itemId: string;
  token: string;
  catalogItemCode: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const allowedTypes = ITEM_ISSUE_MAP[catalogItemCode] ?? ISSUE_OPTIONS.map((o) => o.value);
  const filteredOptions = ISSUE_OPTIONS.filter((o) => allowedTypes.includes(o.value));
  const defaultIssue = filteredOptions[0]?.value ?? ISSUE_OPTIONS[0].value;

  const [issueType, setIssueType] = useState<IssueValue>(defaultIssue as IssueValue);
  const [repairSelections, setRepairSelections] = useState<SelectedRepairOption[]>([]);
  const [note, setNote] = useState('');
  const [raisedIssue, setRaisedIssue] = useState<IssueResult | null>(null);

  const selectedOption = ISSUE_OPTIONS.find((o) => o.value === issueType)!;
  const needsRepair = issueType === 'ADDITIONAL_REPAIR_REQUIRED';

  const catalogQuery = useQuery({
    queryKey: ['catalog-item', catalogItemCode],
    queryFn: () => api.getCatalogItem(catalogItemCode),
    enabled: needsRepair,
  });

  const repairGroup: CatalogOptionGroup | undefined = catalogQuery.data?.optionGroups.find(
    (g) => g.code === 'repair',
  );

  const repairCostMin = repairSelections.reduce((sum, o) => sum + calcPrice(o.price, o.inputValue).min, 0);
  const repairCostMax = repairSelections.reduce((sum, o) => sum + calcPrice(o.price, o.inputValue).max, 0);

  const raiseMutation = useMutation({
    mutationFn: () => api.raiseIssue(token, itemId, issueType, note),
    onSuccess: (result) => setRaisedIssue(result),
  });

  const activateMutation = useMutation({
    mutationFn: () =>
      api.activateExceptionFlow(token, itemId, selectedOption.flowCode, needsRepair ? repairCostMin : undefined),
    onSuccess: onDone,
  });

  function handleIssueTypeChange(value: IssueValue) {
    setIssueType(value);
    setRepairSelections([]);
  }

  const canRaiseIssue = !needsRepair || repairSelections.length > 0;

  return (
    <div className="exception-form">
      <div style={{ color: 'var(--critical)', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
        예외 처리
      </div>

      {!raisedIssue ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {/* 이슈 유형 */}
          <div className="field">
            <label>이슈 유형</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {filteredOptions.map((o) => (
                <button
                  key={o.value}
                  className={issueType === o.value ? 'action-button' : 'ghost-button'}
                  style={{ minHeight: 36, padding: '8px 16px', fontSize: 13, width: 'auto' }}
                  type="button"
                  onClick={() => handleIssueTypeChange(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* 수선 항목 선택 (추가 수선만) */}
          {needsRepair ? (
            <div>
              {catalogQuery.isLoading ? (
                <div className="skeleton" style={{ height: 80 }} />
              ) : repairGroup ? (
                <RepairOptionPicker
                  group={repairGroup}
                  selections={repairSelections}
                  onChange={setRepairSelections}
                />
              ) : (
                <div style={{ fontSize: 13, color: 'var(--steel)' }}>수선 옵션을 불러올 수 없습니다.</div>
              )}
            </div>
          ) : null}

          {/* 수선 비용 표시 */}
          {needsRepair && repairSelections.length > 0 ? (
            <div className="wash-step-info" style={{ fontSize: 13 }}>
              <div className="wash-step-row" style={{ fontWeight: 700 }}>
                <span className="wash-step-label">수선 비용 (추가)</span>
                <span style={{ color: 'var(--critical)' }}>
                  {repairCostMin === repairCostMax
                    ? formatMoney(repairCostMin)
                    : `${formatMoney(repairCostMin)} ~ ${formatMoney(repairCostMax)}`}
                </span>
              </div>
            </div>
          ) : null}

          {/* 메모 */}
          <div className="field">
            <label>메모 (선택)</label>
            <input
              placeholder="이슈 내용을 간략히 입력..."
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {raiseMutation.error ? <ErrorNotice error={raiseMutation.error} /> : null}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="danger-button"
              disabled={raiseMutation.isPending || !canRaiseIssue}
              style={{ flex: 1, minHeight: 40, padding: '10px 16px' }}
              type="button"
              onClick={() => raiseMutation.mutate()}
            >
              {raiseMutation.isPending ? '등록 중…' : '이슈 등록'}
            </button>
            <button
              className="ghost-button"
              style={{ minHeight: 40, padding: '10px 16px' }}
              type="button"
              onClick={onCancel}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="photo-registered">
            <span>✓ 이슈 등록 완료 — {selectedOption.label}</span>
          </div>

          {needsRepair && repairSelections.length > 0 ? (
            <div className="wash-step-info" style={{ fontSize: 13 }}>
              <div className="wash-step-row">
                <span className="wash-step-label">수선 항목</span>
                <span>{repairSelections.map((s) => s.displayLabel).join(', ')}</span>
              </div>
              <div className="wash-step-row" style={{ fontWeight: 700 }}>
                <span className="wash-step-label">추가 비용</span>
                <span style={{ color: 'var(--critical)' }}>
                  {repairCostMin === repairCostMax
                    ? formatMoney(repairCostMin)
                    : `${formatMoney(repairCostMin)} ~ ${formatMoney(repairCostMax)}`}
                </span>
              </div>
            </div>
          ) : null}

          <div style={{ color: 'var(--steel)', fontSize: 13 }}>
            예외 플로우를 활성화하면 처리 스텝이 변경됩니다.
          </div>

          {activateMutation.error ? <ErrorNotice error={activateMutation.error} /> : null}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="action-button"
              disabled={activateMutation.isPending}
              style={{ flex: 1, minHeight: 40, padding: '10px 16px' }}
              type="button"
              onClick={() => activateMutation.mutate()}
            >
              {activateMutation.isPending ? '활성화 중…' : '예외 플로우 활성화'}
            </button>
            <button
              className="ghost-button"
              style={{ minHeight: 40, padding: '10px 16px' }}
              type="button"
              onClick={onCancel}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
