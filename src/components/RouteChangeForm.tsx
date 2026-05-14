import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { buildRepairSelection, computeRouteChangeCost } from '../domain/route-change';
import type { RouteChangeRequestView, WashItemSelectedOption } from '../types';
import { ErrorNotice } from './ErrorNotice';
import { formatMoney, RepairOptionPicker, SelectedRepairOption } from './repair-utils';

// ── 세탁물 종류 → 허용 경로 매핑 ──────────────────────────────────────
const LAUNDRY_ITEMS = [
  { code: 'shirt',          label: '셔츠',      routes: ['GENERAL_CLOTHES_CLEANING', 'REPAIR_AND_CLEANING', 'PREMIUM_CLEANING', 'REPAIR_AND_PREMIUM_CLEANING'] },
  { code: 'pants',          label: '바지',      routes: ['GENERAL_CLOTHES_CLEANING', 'REPAIR_AND_CLEANING', 'PREMIUM_CLEANING', 'REPAIR_AND_PREMIUM_CLEANING'] },
  { code: 'sneakers',       label: '운동화',    routes: ['STANDARD_SHOES_CLEANING', 'PREMIUM_SHOES_CLEANING', 'REPAIR_AND_SHOES_CLEANING', 'REPAIR_AND_PREMIUM_SHOES_CLEANING'] },
  { code: 'ugg_boots',      label: '어그 부츠', routes: ['STANDARD_SHOES_CLEANING', 'PREMIUM_SHOES_CLEANING', 'OUTSOURCED_CLEANING', 'OUTSOURCED_PREMIUM_SHOES_CLEANING'] },
  { code: 'accessory_shirt',label: '장식 셔츠', routes: ['GENERAL_CLOTHES_CLEANING', 'REPAIR_AND_CLEANING', 'PREMIUM_CLEANING', 'REPAIR_AND_PREMIUM_CLEANING'] },
  { code: 'tent',           label: '텐트',      routes: ['OUTSOURCED_ONLY_CLEANING'] },
  { code: 'quick_laundry',  label: '생활 빨래', routes: ['QUICK_LAUNDRY'] },
] as const;

const ROUTE_LABELS: Record<string, string> = {
  GENERAL_CLOTHES_CLEANING:          '일반 의류 세탁',
  REPAIR_AND_CLEANING:               '수선 + 일반 세탁',
  PREMIUM_CLEANING:                  '프리미엄 세탁',
  REPAIR_AND_PREMIUM_CLEANING:       '수선 + 프리미엄 세탁',
  STANDARD_SHOES_CLEANING:           '신발 세탁',
  OUTSOURCED_ONLY_CLEANING:          '외주 세탁',
  PREMIUM_SHOES_CLEANING:            '프리미엄 신발 세탁',
  OUTSOURCED_CLEANING:               '외주 수선 + 신발 세탁',
  REPAIR_AND_SHOES_CLEANING:         '수선 + 신발 세탁',
  OUTSOURCED_PREMIUM_SHOES_CLEANING: '외주 수선 + 프리미엄 신발 세탁',
  REPAIR_AND_PREMIUM_SHOES_CLEANING: '수선 + 프리미엄 신발 세탁',
  QUICK_LAUNDRY:                     '생활 빨래',
};

// Route code → cleaning_method option code (null = 해당 없음)
const ROUTE_CLEANING_METHOD: Record<string, string | null> = {
  GENERAL_CLOTHES_CLEANING:          'regular_wash',
  REPAIR_AND_CLEANING:               'regular_wash',
  PREMIUM_CLEANING:                  'premium_wash',
  REPAIR_AND_PREMIUM_CLEANING:       'premium_wash',
  STANDARD_SHOES_CLEANING:           'regular_wash',
  PREMIUM_SHOES_CLEANING:            'premium_wash',
  REPAIR_AND_SHOES_CLEANING:         'regular_wash',
  REPAIR_AND_PREMIUM_SHOES_CLEANING: 'premium_wash',
  OUTSOURCED_CLEANING:               'regular_wash',
  OUTSOURCED_PREMIUM_SHOES_CLEANING: 'premium_wash',
  QUICK_LAUNDRY:                     'water_wash_high_temperature_dry',
  OUTSOURCED_ONLY_CLEANING:          null,
};

const REPAIR_ROUTES = [
  'REPAIR_AND_CLEANING',
  'REPAIR_AND_PREMIUM_CLEANING',
  'REPAIR_AND_SHOES_CLEANING',
  'REPAIR_AND_PREMIUM_SHOES_CLEANING',
];

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────
export function RouteChangeForm({
  itemId,
  currentRouteCode,
  currentSelectedOptions,
  catalogItemCode,
  estimatedMinAmount,
  token,
  onDone,
  onCancel,
}: {
  itemId: string;
  currentRouteCode: string;
  currentSelectedOptions: WashItemSelectedOption[];
  catalogItemCode: string;
  estimatedMinAmount: number;
  token: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [selectedItemCode, setSelectedItemCode] = useState(
    LAUNDRY_ITEMS.find((i) => i.code === catalogItemCode)?.code ?? LAUNDRY_ITEMS[0].code,
  );
  const [selectedRoute, setSelectedRoute] = useState('');
  const [repairSelections, setRepairSelections] = useState<SelectedRepairOption[]>([]);
  const [repairInitialized, setRepairInitialized] = useState(false);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState<RouteChangeRequestView | null>(null);

  const laundryItem = LAUNDRY_ITEMS.find((i) => i.code === selectedItemCode)!;
  const allowedRoutes = [...laundryItem.routes];
  const needsRepairConfig = REPAIR_ROUTES.includes(selectedRoute);

  // 카탈로그는 항상 로드 (가격 계산에 필요)
  const catalogQuery = useQuery({
    queryKey: ['catalog-item', selectedItemCode],
    queryFn: () => api.getCatalogItem(selectedItemCode),
    enabled: !!selectedItemCode,
  });

  const repairGroup = catalogQuery.data?.optionGroups.find((g) => g.code === 'repair');
  const cleaningGroup = catalogQuery.data?.optionGroups.find((g) => g.code === 'cleaning_method');

  // 수선 경로로 변경 시, 현재 아이템의 수선 옵션을 초기값으로 채움
  useEffect(() => {
    if (!needsRepairConfig || !repairGroup || repairInitialized) return;

    const currentRepairOpts = currentSelectedOptions.filter((o) => o.groupCode === 'repair');
    if (currentRepairOpts.length === 0) {
      setRepairInitialized(true);
      return;
    }

    const initial = currentRepairOpts.flatMap((co): SelectedRepairOption[] => {
      const sel = buildRepairSelection(repairGroup, co.optionCode, co.inputValue);
      return sel ? [sel] : [];
    });

    setRepairSelections(initial);
    setRepairInitialized(true);
  }, [needsRepairConfig, repairGroup, repairInitialized, currentSelectedOptions]);

  // ── 가격 계산 ─────────────────────────────────────────────────────
  const cost = computeRouteChangeCost({
    cleaningGroup,
    newCleaningMethodCode: selectedRoute ? ROUTE_CLEANING_METHOD[selectedRoute] : undefined,
    repairSelections,
    estimatedMinAmount,
  });
  const { repairCost, totalNew, additionalCost } = cost;
  const repairCostMin = repairCost.min;
  const repairCostMax = repairCost.max;
  const totalNewPriceMin = totalNew.min;
  const totalNewPriceMax = totalNew.max;
  const additionalCostMin = additionalCost.min;
  const additionalCostMax = additionalCost.max;
  // hasPriceInfo: cost 함수는 cleaning_method 존재 여부만 본다. 화면 표시는 경로 선택 + 카탈로그 로드도 필요.
  const hasPriceInfo = !!selectedRoute && !!catalogQuery.data && cost.hasPriceInfo;

  // 백엔드는 수선 경로일 때만 repairOptions를 OrderItemOption 행으로 재구축한다.
  // 비수선 경로면 어차피 무시되므로 보내지 않음. ROUTES_WITH_REPAIR(백엔드) ⊃
  // REPAIR_ROUTES(폼)이지만 OUTSOURCED_* 경로는 폼에서 수선 picker가 노출되지
  // 않으므로 여기서 sender 측 `needsRepairConfig`만 보면 됨.
  const repairOptionsPayload = needsRepairConfig && repairSelections.length > 0
    ? repairSelections.map((s) => ({
        optionCode: s.optionCode,
        inputValue: s.inputValue ? s.inputValue : undefined,
      }))
    : undefined;

  const mutation = useMutation({
    mutationFn: () =>
      api.requestRouteChange(token, itemId, {
        toRouteCode: selectedRoute,
        additionalCost: hasPriceInfo ? Math.round(additionalCostMin) : undefined,
        reason,
        repairOptions: repairOptionsPayload,
      }),
    onSuccess: (result) => setSubmitted(result),
  });

  function handleItemCodeChange(code: string) {
    setSelectedItemCode(code as typeof LAUNDRY_ITEMS[number]['code']);
    setSelectedRoute('');
    setRepairSelections([]);
    setRepairInitialized(false);
  }

  function handleRouteChange(route: string) {
    setSelectedRoute(route);
    setRepairSelections([]);
    setRepairInitialized(false);
  }

  if (submitted) {
    const costLabel = submitted.additionalCost != null && submitted.additionalCost !== 0
      ? ` · ${submitted.additionalCost > 0 ? '추가비용' : '절감'} ${formatMoney(Math.abs(submitted.additionalCost))}`
      : '';
    return (
      <div className="exception-form">
        <div className="photo-registered">
          <span>✓ 경로 변경 요청 완료 — 고객 승인 대기 중</span>
        </div>
        <div style={{ color: 'var(--steel)', fontSize: 13, marginTop: 6 }}>
          {ROUTE_LABELS[submitted.fromRouteCode] ?? submitted.fromRouteCode}
          {' → '}
          {ROUTE_LABELS[submitted.toRouteCode] ?? submitted.toRouteCode}
          {costLabel}
        </div>
        <button
          className="ghost-button"
          style={{ marginTop: 10, minHeight: 40, padding: '10px 16px', width: '100%' }}
          type="button"
          onClick={onDone}
        >
          닫기
        </button>
      </div>
    );
  }

  const canSubmit =
    !!selectedRoute &&
    selectedRoute !== currentRouteCode &&
    !!reason.trim() &&
    (!needsRepairConfig || repairSelections.length > 0);

  return (
    <div className="exception-form">
      <div style={{ color: 'var(--critical)', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
        경로 변경 요청
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {/* 세탁물 종류 */}
        <div className="field">
          <label>세탁물 종류</label>
          <select value={selectedItemCode} onChange={(e) => handleItemCodeChange(e.target.value)}>
            {LAUNDRY_ITEMS.map((i) => (
              <option key={i.code} value={i.code}>{i.label}</option>
            ))}
          </select>
        </div>

        {/* 변경할 경로 */}
        <div className="field">
          <label>변경할 경로</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {allowedRoutes.map((route) => {
              const isCurrent = route === currentRouteCode;
              return (
                <button
                  key={route}
                  className={selectedRoute === route ? 'action-button' : 'ghost-button'}
                  disabled={isCurrent}
                  style={{ minHeight: 36, padding: '8px 16px', fontSize: 13, width: 'auto', opacity: isCurrent ? 0.45 : 1 }}
                  type="button"
                  onClick={() => handleRouteChange(route)}
                >
                  {ROUTE_LABELS[route] ?? route}
                  {isCurrent ? <span style={{ marginLeft: 4, fontSize: 11 }}>(현재)</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* 수선 옵션 */}
        {needsRepairConfig ? (
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

        {/* 가격 차이 표시 */}
        {hasPriceInfo ? (
          <div className="wash-step-info" style={{ fontSize: 13 }}>
            {needsRepairConfig && repairSelections.length > 0 ? (
              <div className="wash-step-row">
                <span className="wash-step-label">수선 비용</span>
                <span>
                  {repairCostMin === repairCostMax
                    ? formatMoney(repairCostMin)
                    : `${formatMoney(repairCostMin)} ~ ${formatMoney(repairCostMax)}`}
                </span>
              </div>
            ) : null}
            <div className="wash-step-row">
              <span className="wash-step-label">새 경로 금액</span>
              <span>
                {totalNewPriceMin === totalNewPriceMax
                  ? formatMoney(totalNewPriceMin)
                  : `${formatMoney(totalNewPriceMin)} ~ ${formatMoney(totalNewPriceMax)}`}
              </span>
            </div>
            <div className="wash-step-row">
              <span className="wash-step-label">기존 금액</span>
              <span>{formatMoney(estimatedMinAmount)}</span>
            </div>
            <div className="wash-step-row" style={{ fontWeight: 700 }}>
              <span className="wash-step-label">
                {additionalCostMin >= 0 ? '추가비용' : '절감액'}
              </span>
              <span style={{ color: additionalCostMin > 0 ? 'var(--critical)' : additionalCostMin < 0 ? 'var(--success, #2d9c5a)' : 'var(--ink)' }}>
                {additionalCostMin === additionalCostMax
                  ? formatMoney(Math.abs(additionalCostMin))
                  : `${formatMoney(Math.abs(additionalCostMin))} ~ ${formatMoney(Math.abs(additionalCostMax))}`}
              </span>
            </div>
          </div>
        ) : null}

        {/* 변경 사유 */}
        <div className="field">
          <label>변경 사유</label>
          <input
            placeholder="변경 사유를 입력하세요"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {mutation.error ? <ErrorNotice error={mutation.error} /> : null}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="action-button"
            disabled={mutation.isPending || !canSubmit}
            style={{ flex: 1, minHeight: 40, padding: '10px 16px' }}
            type="button"
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? '요청 중…' : '경로 변경 요청'}
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
    </div>
  );
}
