import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import type { ProcessingRoute, WashItemView } from '../types';
import { itemStatusLabel, routeLabel, stepLabel } from '../utils';
import { ErrorNotice } from './ErrorNotice';
import { ExceptionForm } from './ExceptionForm';
import { ItemDetailsSection } from './ItemDetailsSection';
import { RouteChangeForm } from './RouteChangeForm';

const INSPECTION_STEP_TYPES = ['INSPECTING', 'RE_INSPECTION', 'PREMIUM_INSPECTING'];

export function WashItemCard({
  item,
  routes,
  token,
  onRefresh,
}: {
  item: WashItemView;
  routes: ProcessingRoute[];
  token: string;
  onRefresh: () => void;
}) {
  const [showTagForm, setShowTagForm] = useState(item.status === 'PICK_UP');
  const [showRouteForm, setShowRouteForm] = useState(item.status === 'TAGGED');
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [showRouteChangeForm, setShowRouteChangeForm] = useState(false);
  const [tagBarcodeForRoute, setTagBarcodeForRoute] = useState<string | null>(item.tagBarcode);

  const tagMutation = useMutation({
    mutationFn: (tagBarcode: string) => api.tagItem(token, item.itemId, tagBarcode),
    onSuccess: (result) => {
      setTagBarcodeForRoute(result.tagBarcode);
      setShowTagForm(false);
      setShowRouteForm(true);
      onRefresh();
    },
  });

  const routeMutation = useMutation({
    mutationFn: (routeCode: string) => api.assignRoute(token, tagBarcodeForRoute ?? '', routeCode),
    onSuccess: () => {
      setShowRouteForm(false);
      onRefresh();
    },
  });

  const state = item.processingState;
  const isOverride = state?.currentStepSource === 'OVERRIDE';
  const canRaiseException =
    (item.status === 'SORTED' || item.status === 'PROCESSING') &&
    !!state?.currentStep &&
    INSPECTION_STEP_TYPES.includes(state.currentStep.stepType);
  const canRequestRouteChange =
    (item.status === 'SORTED' || item.status === 'PROCESSING') &&
    !!state?.routeCode &&
    !isOverride;

  return (
    <div className="wash-item-card">
      <div className="item-row-header">
        <span className="item-name">{item.displayNameSnapshot}</span>
        <ItemStatusBadge status={item.status} isOverride={isOverride} />
      </div>

      {item.tagBarcode ? (
        <div style={{ color: 'var(--steel)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          태그: {item.tagBarcode}
        </div>
      ) : null}

      {state ? (
        <div className="wash-step-info">
          {state.currentStep ? (
            <div className="wash-step-row">
              <span className="wash-step-label">현재 스텝</span>
              <span className={`badge ${isOverride ? 'badge-critical' : 'badge-attention'}`}>
                {isOverride ? '⚡ ' : ''}{state.currentStep.displayName ?? stepLabel(state.currentStep.stepType)}
              </span>
              <span className={`badge ${state.currentStep.status === 'IN_PROGRESS' ? 'badge-info' : 'badge-neutral'}`}>
                {state.currentStep.status === 'IN_PROGRESS' ? '진행 중' : '완료'}
              </span>
            </div>
          ) : null}
          {state.nextStep ? (
            <div className="wash-step-row">
              <span className="wash-step-label">다음 스텝</span>
              <span style={{ color: 'var(--stone)', fontSize: 13 }}>
                {state.nextStep.displayName ?? stepLabel(state.nextStep.stepType)}
              </span>
            </div>
          ) : null}
          <div style={{ color: 'var(--steel)', fontSize: 12 }}>
            {routeLabel(state.routeCode)}
          </div>
        </div>
      ) : null}

      <ItemDetailsSection options={item.selectedOptions} inputs={item.inputs} />

      {item.status === 'PICK_UP' && showTagForm ? (
        <TagForm
          isPending={tagMutation.isPending}
          error={tagMutation.error}
          onSubmit={(tag) => tagMutation.mutate(tag)}
        />
      ) : item.status === 'PICK_UP' ? (
        <button className="ghost-button" style={{ alignSelf: 'flex-start' }} type="button" onClick={() => setShowTagForm(true)}>
          태그 등록
        </button>
      ) : null}

      {item.status === 'TAGGED' && showRouteForm ? (
        <RouteForm
          routes={routes}
          isPending={routeMutation.isPending}
          error={routeMutation.error}
          onSubmit={(routeCode) => routeMutation.mutate(routeCode)}
        />
      ) : item.status === 'TAGGED' ? (
        <button className="ghost-button" style={{ alignSelf: 'flex-start' }} type="button" onClick={() => setShowRouteForm(true)}>
          경로 배정
        </button>
      ) : null}

      {!showExceptionForm && !showRouteChangeForm ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canRaiseException ? (
            <button
              className="danger-button"
              style={{ fontSize: 13, minHeight: 36, padding: '8px 14px' }}
              type="button"
              onClick={() => setShowExceptionForm(true)}
            >
              예외 처리
            </button>
          ) : null}
          {canRequestRouteChange ? (
            <button
              className="ghost-button"
              style={{ fontSize: 13, minHeight: 36, padding: '8px 14px' }}
              type="button"
              onClick={() => setShowRouteChangeForm(true)}
            >
              경로 변경
            </button>
          ) : null}
        </div>
      ) : null}

      {showExceptionForm ? (
        <ExceptionForm
          catalogItemCode={item.catalogItemCode}
          itemId={item.itemId}
          token={token}
          onDone={() => { setShowExceptionForm(false); onRefresh(); }}
          onCancel={() => setShowExceptionForm(false)}
        />
      ) : null}

      {showRouteChangeForm ? (
        <RouteChangeForm
          catalogItemCode={item.catalogItemCode}
          currentRouteCode={state!.routeCode}
          currentSelectedOptions={item.selectedOptions}
          estimatedMinAmount={item.estimatedMinAmount}
          itemId={item.itemId}
          token={token}
          onDone={() => { setShowRouteChangeForm(false); onRefresh(); }}
          onCancel={() => setShowRouteChangeForm(false)}
        />
      ) : null}
    </div>
  );
}

function TagForm({
  isPending,
  error,
  onSubmit,
}: {
  isPending: boolean;
  error: unknown;
  onSubmit: (tag: string) => void;
}) {
  const [tag, setTag] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = tag.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <form className="bag-input-row" onSubmit={handleSubmit}>
        <input
          autoComplete="off"
          autoFocus
          placeholder="TAG-0001"
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
        <button
          className="ghost-button"
          disabled={isPending || !tag.trim()}
          type="submit"
        >
          {isPending ? '등록 중…' : '등록'}
        </button>
      </form>
      {error ? <ErrorNotice error={error} /> : null}
    </div>
  );
}

function RouteForm({
  routes,
  isPending,
  error,
  onSubmit,
}: {
  routes: ProcessingRoute[];
  isPending: boolean;
  error: unknown;
  onSubmit: (routeCode: string) => void;
}) {
  const activeRoutes = routes.filter((r) => r.active);
  const [routeCode, setRouteCode] = useState(activeRoutes[0]?.code ?? '');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (routeCode) onSubmit(routeCode);
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <form style={{ display: 'grid', gap: 8 }} onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="route-select">처리 경로</label>
          <select
            id="route-select"
            value={routeCode}
            onChange={(e) => setRouteCode(e.target.value)}
          >
            {activeRoutes.map((r) => (
              <option key={r.code} value={r.code}>
                {routeLabel(r.code)} — {r.steps.map((s) => s.displayName).join(' → ')}
              </option>
            ))}
          </select>
        </div>
        <button
          className="action-button"
          disabled={isPending || !routeCode}
          type="submit"
        >
          {isPending ? '배정 중…' : '경로 배정'}
        </button>
      </form>
      {error ? <ErrorNotice error={error} /> : null}
    </div>
  );
}

function ItemStatusBadge({ status, isOverride }: { status: string; isOverride?: boolean }) {
  if (isOverride) return <span className="badge badge-critical">⚡ 예외 처리</span>;
  if (status === 'PICK_UP') return <span className="badge badge-neutral">{itemStatusLabel(status)}</span>;
  if (status === 'TAGGED') return <span className="badge badge-info">{itemStatusLabel(status)}</span>;
  if (status === 'SORTED') return <span className="badge badge-attention">{itemStatusLabel(status)}</span>;
  if (status === 'PROCESSING') return <span className="badge badge-info">{itemStatusLabel(status)}</span>;
  if (status === 'READY_TO_PACKAGE') return <span className="badge badge-success">{itemStatusLabel(status)}</span>;
  return <span className="badge badge-neutral">{itemStatusLabel(status)}</span>;
}
