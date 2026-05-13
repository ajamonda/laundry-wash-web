import { FormEvent, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAppStore } from '../store';
import type { StaffSession } from '../types';
import { useWashStaffExceptionSocket } from '../useWashStaffExceptionSocket';
import { ErrorNotice } from './ErrorNotice';
import { WashItemCard } from './WashItemCard';

export function OrderSearchScreen({
  session,
  onBack,
}: {
  session: StaffSession;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const lastSearchedOrderId = useAppStore((s) => s.lastSearchedOrderId);
  const setLastSearchedOrderId = useAppStore((s) => s.setLastSearchedOrderId);
  const [orderIdInput, setOrderIdInput] = useState(lastSearchedOrderId ?? '');
  const [searchedOrderId, setSearchedOrderId] = useState<string | null>(lastSearchedOrderId);

  const orderQuery = useQuery({
    queryKey: ['order-items', searchedOrderId, session.accessToken],
    queryFn: () => api.getOrderItems(session.accessToken, searchedOrderId!),
    enabled: !!searchedOrderId,
  });

  const routesQuery = useQuery({
    queryKey: ['routes', session.accessToken],
    queryFn: () => api.getRoutes(session.accessToken),
  });

  const refetchOrder = useCallback(() => {
    if (!searchedOrderId) return;
    void queryClient.invalidateQueries({ queryKey: ['order-items', searchedOrderId] });
    void queryClient.invalidateQueries({ queryKey: ['processing-queue'] });
  }, [queryClient, searchedOrderId]);

  // 고객이 승인/거절했을 때 현재 화면을 새로고침
  const handleResolved = useCallback(
    (event: { orderItemId: string }) => {
      const items = orderQuery.data?.items;
      if (!items) return;
      if (items.some((item) => item.itemId === event.orderItemId)) {
        refetchOrder();
      }
    },
    [orderQuery.data, refetchOrder],
  );

  useWashStaffExceptionSocket(session.accessToken, {
    onApprovalResolved: handleResolved,
    onRouteChangeResolved: handleResolved,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = orderIdInput.trim();
    if (trimmed) {
      setSearchedOrderId(trimmed);
      setLastSearchedOrderId(trimmed);
    }
  }

  const items = orderQuery.data?.items ?? [];

  return (
    <>
      <button className="back-button" style={{ marginBottom: 16 }} type="button" onClick={onBack}>
        ← 백 스캔
      </button>

      <div className="page-header">
        <h1>주문 검색</h1>
        <p>주문 ID로 아이템 상태를 확인합니다.</p>
      </div>

      <div className="wash-card" style={{ marginBottom: 16 }}>
        <form className="bag-input-row" onSubmit={handleSubmit}>
          <input
            autoComplete="off"
            autoFocus
            placeholder="주문 ID"
            type="text"
            value={orderIdInput}
            onChange={(e) => setOrderIdInput(e.target.value)}
          />
          <button
            className="action-button"
            disabled={!orderIdInput.trim()}
            style={{ flex: '0 0 auto', width: 'auto', minHeight: 44, padding: '0 20px' }}
            type="submit"
          >
            검색
          </button>
        </form>
      </div>

      {!searchedOrderId ? null : orderQuery.isLoading ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : orderQuery.error ? (
        <ErrorNotice error={orderQuery.error} />
      ) : (
        <>
          <div className="page-header-row">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              주문 {orderQuery.data?.orderId}
            </h2>
            <span className="badge badge-info">{items.length}개</span>
          </div>

          {items.length === 0 ? (
            <p style={{ color: 'var(--stone)', fontSize: 14 }}>주문에 아이템이 없습니다.</p>
          ) : (
            <div className="item-list">
              {items.map((item) => (
                <WashItemCard
                  key={item.itemId}
                  item={item}
                  routes={routesQuery.data ?? []}
                  token={session.accessToken}
                  onRefresh={refetchOrder}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
