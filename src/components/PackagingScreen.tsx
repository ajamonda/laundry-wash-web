import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { CreatePackagesResult, StaffSession } from '../types';
import { ErrorNotice } from './ErrorNotice';

export function PackagingScreen({
  session,
  onBack,
}: {
  session: StaffSession;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();

  const queueQuery = useQuery({
    queryKey: ['processing-queue', session.accessToken],
    queryFn: () => api.getProcessingQueue(session.accessToken),
  });

  const packageMutation = useMutation({
    mutationFn: () => api.createPackages(session.accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['processing-queue'] });
    },
  });

  const readyItems = (queueQuery.data?.items ?? []).filter(
    (i) => i.status === 'READY_TO_PACKAGE',
  );

  const groupedByOrder = new Map<string, typeof readyItems>();
  for (const item of readyItems) {
    const group = groupedByOrder.get(item.orderId) ?? [];
    group.push(item);
    groupedByOrder.set(item.orderId, group);
  }

  const packages = packageMutation.data?.packages ?? [];

  return (
    <>
      <button className="back-button" style={{ marginBottom: 16 }} type="button" onClick={onBack}>
        ← 백 스캔
      </button>

      <div className="page-header">
        <h1>패키징</h1>
        <p>포장 준비가 완료된 아이템을 주문별로 묶어 배송 준비 상태로 전환합니다.</p>
      </div>

      {packages.length > 0 ? (
        <div className="success-notice" style={{ marginBottom: 20 }}>
          <h2>패키징 완료!</h2>
          <p>{packages.length}개 주문이 배송 준비 상태로 전환됐습니다.</p>
          <div style={{ display: 'grid', gap: 8, width: '100%' }}>
            {packages.map((pkg) => (
              <PackageSummaryCard key={pkg.packageId} pkg={pkg} />
            ))}
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              packageMutation.reset();
              void queryClient.invalidateQueries({ queryKey: ['processing-queue'] });
            }}
          >
            확인
          </button>
        </div>
      ) : null}

      {packageMutation.error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorNotice error={packageMutation.error} />
        </div>
      ) : null}

      {queueQuery.isLoading ? (
        <div className="skeleton" style={{ height: 100 }} />
      ) : readyItems.length === 0 ? (
        <div className="handoff-empty">
          <p>포장 준비된 아이템이 없습니다.</p>
          <p style={{ marginTop: 8 }}>스텝 스캔 후 아이템이 여기에 나타납니다.</p>
        </div>
      ) : (
        <>
          <div style={{ color: 'var(--ink-deep)', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            포장 대기 ({readyItems.length}개 아이템 / {groupedByOrder.size}개 주문)
          </div>

          <div style={{ display: 'grid', gap: 12, marginBottom: 80 }}>
            {Array.from(groupedByOrder.entries()).map(([orderId, items]) => (
              <div key={orderId} className="wash-card">
                <div style={{ color: 'var(--stone)', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                  주문 {orderId.slice(-8)}
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {items.map((item) => (
                    <div key={item.itemId} className="handoff-item-row">
                      <span>·</span>
                      <span>{item.displayNameSnapshot}</span>
                      {item.tagBarcode ? (
                        <span style={{ color: 'var(--stone)', fontSize: 12 }}>({item.tagBarcode})</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {readyItems.length > 0 && packages.length === 0 ? (
        <div className="bottom-bar">
          <button
            className="primary-button"
            disabled={packageMutation.isPending}
            style={{ flex: 1 }}
            type="button"
            onClick={() => packageMutation.mutate()}
          >
            {packageMutation.isPending
              ? '패키징 중…'
              : `패키징 실행 (${groupedByOrder.size}개 주문)`}
          </button>
        </div>
      ) : null}
    </>
  );
}

function PackageSummaryCard({
  pkg,
}: {
  pkg: CreatePackagesResult['packages'][number];
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.7)',
      border: '1px solid rgba(49,162,76,0.28)',
      borderRadius: 12,
      padding: '10px 14px',
      textAlign: 'left',
    }}>
      <div style={{ color: '#207338', fontSize: 13, fontWeight: 700 }}>
        주문 {pkg.orderId.slice(-8)}
      </div>
      <div style={{ color: 'var(--charcoal)', fontSize: 12, marginTop: 4 }}>
        {pkg.items.length}개 아이템
        {pkg.items.map((i) => i.tagBarcode).filter(Boolean).join(', ')
          ? ` — ${pkg.items.map((i) => i.tagBarcode).filter(Boolean).join(', ')}`
          : null}
      </div>
    </div>
  );
}
