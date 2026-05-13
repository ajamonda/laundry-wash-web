import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { StaffSession } from '../types';
import { ErrorNotice } from './ErrorNotice';
import { WashItemCard } from './WashItemCard';

export function BagItemsScreen({
  bagBarcode,
  session,
  onBack,
}: {
  bagBarcode: string;
  session: StaffSession;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();

  const bagQuery = useQuery({
    queryKey: ['bag', bagBarcode, session.accessToken],
    queryFn: () => api.getBag(session.accessToken, bagBarcode),
  });

  const routesQuery = useQuery({
    queryKey: ['routes', session.accessToken],
    queryFn: () => api.getRoutes(session.accessToken),
  });

  function refetchBag() {
    void queryClient.invalidateQueries({ queryKey: ['bag', bagBarcode] });
    void queryClient.invalidateQueries({ queryKey: ['processing-queue'] });
  }

  if (bagQuery.isLoading) {
    return (
      <>
        <button className="back-button" style={{ marginBottom: 16 }} type="button" onClick={onBack}>
          ← 백 스캔
        </button>
        <div className="skeleton" style={{ height: 120 }} />
      </>
    );
  }

  if (bagQuery.error) {
    return (
      <>
        <button className="back-button" style={{ marginBottom: 16 }} type="button" onClick={onBack}>
          ← 백 스캔
        </button>
        <ErrorNotice error={bagQuery.error} />
      </>
    );
  }

  const bag = bagQuery.data;

  return (
    <>
      <button className="back-button" style={{ marginBottom: 16 }} type="button" onClick={onBack}>
        ← 백 스캔
      </button>

      <div className="page-header-row">
        <h1>{bag?.bagBarcode ?? bagBarcode}</h1>
        <span className="badge badge-info">{bag?.items.length ?? 0}개</span>
      </div>

      {bag?.items.length === 0 ? (
        <p style={{ color: 'var(--stone)', fontSize: 14 }}>이 백에 담긴 아이템이 없습니다.</p>
      ) : (
        <div className="item-list">
          {bag?.items.map((item) => (
            <WashItemCard
              key={item.itemId}
              item={item}
              routes={routesQuery.data ?? []}
              token={session.accessToken}
              onRefresh={refetchBag}
            />
          ))}
        </div>
      )}
    </>
  );
}
