import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import type { ProcessingQueueItem, StaffSession } from '../types';
import { itemStatusLabel, routeLabel, stepLabel } from '../utils';
import { ErrorNotice } from './ErrorNotice';

export function ProcessingQueueScreen({
  session,
  onBack,
  onGoToStepScan,
}: {
  session: StaffSession;
  onBack: () => void;
  onGoToStepScan: () => void;
}) {
  const [filterStep, setFilterStep] = useState<string>('ALL');

  const queueQuery = useQuery({
    queryKey: ['processing-queue', session.accessToken],
    queryFn: () => api.getProcessingQueue(session.accessToken),
    refetchInterval: 30_000,
  });

  const allItems = (queueQuery.data?.items ?? []).filter(
    (i) => i.status === 'SORTED' || i.status === 'PROCESSING',
  );

  const stepTypes = Array.from(
    new Set(allItems.map((i) => i.currentStep?.stepType).filter(Boolean) as string[]),
  );

  const filtered =
    filterStep === 'ALL'
      ? allItems
      : allItems.filter((i) => i.currentStep?.stepType === filterStep);

  return (
    <>
      <button className="back-button" style={{ marginBottom: 16 }} type="button" onClick={onBack}>
        ← 백 스캔
      </button>

      <div className="page-header-row">
        <h1>처리 대기열</h1>
        <button className="ghost-button" style={{ fontSize: 13, minHeight: 36, padding: '8px 16px' }} type="button" onClick={onGoToStepScan}>
          스텝 스캔 →
        </button>
      </div>

      {queueQuery.isLoading ? (
        <>
          <div className="skeleton" style={{ height: 60, marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 80 }} />
        </>
      ) : queueQuery.error ? (
        <ErrorNotice error={queueQuery.error} />
      ) : (
        <>
          {stepTypes.length > 0 ? (
            <div className="filter-tabs">
              <button
                className={`filter-tab ${filterStep === 'ALL' ? 'active' : ''}`}
                type="button"
                onClick={() => setFilterStep('ALL')}
              >
                전체 ({allItems.length})
              </button>
              {stepTypes.map((type) => {
                const count = allItems.filter((i) => i.currentStep?.stepType === type).length;
                return (
                  <button
                    key={type}
                    className={`filter-tab ${filterStep === type ? 'active' : ''}`}
                    type="button"
                    onClick={() => setFilterStep(type)}
                  >
                    {stepLabel(type)} ({count})
                  </button>
                );
              })}
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="handoff-empty">
              <p>처리 중인 아이템이 없습니다.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {filtered.map((item) => (
                <QueueItemCard key={item.itemId} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function QueueItemCard({ item }: { item: ProcessingQueueItem }) {
  return (
    <div className="wash-item-card">
      <div className="item-row-header">
        <div>
          <div className="item-name">{item.displayNameSnapshot}</div>
          {item.tagBarcode ? (
            <div style={{ color: 'var(--stone)', fontSize: 12, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
              {item.tagBarcode}
            </div>
          ) : null}
        </div>
        <span className={`badge ${item.status === 'PROCESSING' ? 'badge-info' : 'badge-attention'}`}>
          {itemStatusLabel(item.status)}
        </span>
      </div>

      <div style={{ color: 'var(--steel)', fontSize: 12 }}>{routeLabel(item.routeCode)}</div>

      {item.currentStep ? (
        <div className="wash-step-info">
          <div className="wash-step-row">
            <span className="wash-step-label">현재 스텝</span>
            <span className="badge badge-attention">
              {item.currentStep.displayName ?? stepLabel(item.currentStep.stepType)}
            </span>
            <span className={`badge ${item.currentStep.status === 'IN_PROGRESS' ? 'badge-info' : 'badge-neutral'}`}>
              {item.currentStep.status === 'IN_PROGRESS' ? '진행 중' : '완료'}
            </span>
          </div>
          {item.nextStep ? (
            <div className="wash-step-row">
              <span className="wash-step-label">다음</span>
              <span style={{ color: 'var(--stone)', fontSize: 13 }}>
                {item.nextStep.displayName ?? stepLabel(item.nextStep.stepType)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
