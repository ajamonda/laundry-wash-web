import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { ScanStepResult, StaffSession, WashItemView } from '../types';
import { itemStatusLabel, stepLabel } from '../utils';
import { ErrorNotice } from './ErrorNotice';
import { ExceptionForm } from './ExceptionForm';
import { ItemDetailsSection } from './ItemDetailsSection';

export function StepScanScreen({
  session,
  onBack,
}: {
  session: StaffSession;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [tagBarcode, setTagBarcode] = useState('');
  const [foundItem, setFoundItem] = useState<WashItemView | null>(null);
  const [scanResult, setScanResult] = useState<ScanStepResult | null>(null);
  const [showException, setShowException] = useState(false);

  const searchMutation = useMutation({
    mutationFn: (tag: string) => api.getItemByTag(session.accessToken, tag),
    onSuccess: (item) => {
      setFoundItem(item);
      setScanResult(null);
      setShowException(false);
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => api.scanStep(session.accessToken, foundItem!.tagBarcode!),
    onSuccess: (result) => {
      setScanResult(result);
      setFoundItem(result.item);
      void queryClient.invalidateQueries({ queryKey: ['processing-queue'] });
    },
  });

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = tagBarcode.trim();
    if (trimmed) searchMutation.mutate(trimmed);
  }

  const state = scanResult ? scanResult.processingState : foundItem?.processingState;
  const isOverride = state?.currentStepSource === 'OVERRIDE';
  const isAwaitingDecision = state?.currentStep?.stepType === 'WAIT_CUSTOMER_DECISION';
  const canScan = !!foundItem?.tagBarcode && !state?.isPlanCompleted && !isAwaitingDecision;
  const INSPECTION_STEP_TYPES = ['INSPECTING', 'RE_INSPECTION', 'PREMIUM_INSPECTING'];
  const canRaiseException =
    foundItem &&
    (foundItem.status === 'SORTED' || foundItem.status === 'PROCESSING') &&
    !!state?.currentStep &&
    INSPECTION_STEP_TYPES.includes(state.currentStep.stepType);

  return (
    <>
      <button className="back-button" style={{ marginBottom: 16 }} type="button" onClick={onBack}>
        ← 백 스캔
      </button>

      <div className="page-header">
        <h1>스텝 스캔</h1>
        <p>태그 바코드로 아이템을 검색합니다.</p>
      </div>

      <div className="wash-card" style={{ marginBottom: 16 }}>
        <form className="bag-input-row" onSubmit={handleSearch}>
          <input
            autoComplete="off"
            autoFocus
            placeholder="TAG-0001"
            type="text"
            value={tagBarcode}
            onChange={(e) => setTagBarcode(e.target.value)}
          />
          <button
            className="action-button"
            disabled={searchMutation.isPending || !tagBarcode.trim()}
            style={{ flex: '0 0 auto', width: 'auto', minHeight: 44, padding: '0 20px' }}
            type="submit"
          >
            {searchMutation.isPending ? '검색 중…' : '검색'}
          </button>
        </form>

        {searchMutation.error ? (
          <div style={{ marginTop: 10 }}>
            <ErrorNotice error={searchMutation.error} />
          </div>
        ) : null}
      </div>

      {foundItem ? (
        <div className={`wash-card ${scanResult?.processingState?.isPlanCompleted ? 'wash-card-success' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span className="item-name">{foundItem.displayNameSnapshot}</span>
            <ItemStatusBadge status={foundItem.status} isOverride={isOverride} />
          </div>

          {foundItem.tagBarcode ? (
            <div style={{ color: 'var(--steel)', fontSize: 13, marginBottom: 6 }}>
              태그: {foundItem.tagBarcode}
            </div>
          ) : null}

          {state ? (
            <div className="wash-step-info" style={{ marginBottom: 6 }}>
              {state.isPlanCompleted ? (
                <div className="photo-registered">
                  <span>✓ 처리 완료 — 포장 대기 상태로 이동됨</span>
                </div>
              ) : state.currentStep?.stepType === 'WAIT_CUSTOMER_DECISION' ? (
                <div className="waiting-notice">
                  <div className="waiting-icon">⏳</div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 4 }}>고객 응답 대기 중</div>
                    <div style={{ color: 'var(--steel)', fontSize: 13 }}>
                      고객이 예외 처리 승인 또는 거절할 때까지 대기합니다.
                    </div>
                  </div>
                </div>
              ) : state.currentStep ? (
                <>
                  <div className="wash-step-row">
                    <span className="wash-step-label">현재 스텝</span>
                    <span className={`badge ${isOverride ? 'badge-critical' : 'badge-attention'}`}>
                      {isOverride ? '⚡ ' : ''}{state.currentStep.displayName ?? stepLabel(state.currentStep.stepType)}
                    </span>
                    <span className="badge badge-info">진행 중</span>
                  </div>
                  {state.nextStep ? (
                    <div className="wash-step-row">
                      <span className="wash-step-label">다음 스텝</span>
                      <span style={{ color: 'var(--stone)', fontSize: 13 }}>
                        {state.nextStep.displayName ?? stepLabel(state.nextStep.stepType)}
                      </span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          <ItemDetailsSection options={foundItem.selectedOptions} inputs={foundItem.inputs} />

          {scanMutation.error ? (
            <div style={{ marginTop: 10 }}>
              <ErrorNotice error={scanMutation.error} />
            </div>
          ) : null}

          {!showException ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {canScan ? (
                <button
                  className="action-button"
                  disabled={scanMutation.isPending}
                  style={{ flex: 1, minHeight: 40, padding: '10px 16px' }}
                  type="button"
                  onClick={() => scanMutation.mutate()}
                >
                  {scanMutation.isPending ? '처리 중…' : '스캔'}
                </button>
              ) : null}
              {canRaiseException ? (
                <button
                  className="danger-button"
                  style={{ flex: 1, minHeight: 40, padding: '10px 16px', fontSize: 13 }}
                  type="button"
                  onClick={() => setShowException(true)}
                >
                  예외 처리
                </button>
              ) : null}
              <button
                className="ghost-button"
                style={{ minHeight: 40, padding: '10px 16px' }}
                type="button"
                onClick={() => { setFoundItem(null); setScanResult(null); setTagBarcode(''); }}
              >
                닫기
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <ExceptionForm
                catalogItemCode={foundItem.catalogItemCode}
                itemId={foundItem.itemId}
                token={session.accessToken}
                onDone={() => {
                  setShowException(false);
                  searchMutation.mutate(foundItem.tagBarcode!);
                  void queryClient.invalidateQueries({ queryKey: ['processing-queue'] });
                }}
                onCancel={() => setShowException(false)}
              />
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

function ItemStatusBadge({ status, isOverride }: { status: string; isOverride?: boolean }) {
  if (isOverride) return <span className="badge badge-critical">⚡ 예외 처리</span>;
  if (status === 'READY_TO_PACKAGE') return <span className="badge badge-success">{itemStatusLabel(status)}</span>;
  if (status === 'PROCESSING') return <span className="badge badge-info">{itemStatusLabel(status)}</span>;
  if (status === 'SORTED') return <span className="badge badge-attention">{itemStatusLabel(status)}</span>;
  return <span className="badge badge-neutral">{itemStatusLabel(status)}</span>;
}
