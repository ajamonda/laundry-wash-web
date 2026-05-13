import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { StaffSession } from '../types';

export function BagScanScreen({
  session,
  onScanBag,
  onGoToOrderSearch,
  onGoToQueue,
  onGoToStepScan,
  onGoToPackaging,
}: {
  session: StaffSession;
  onScanBag: (barcode: string) => void;
  onGoToOrderSearch: () => void;
  onGoToQueue: () => void;
  onGoToStepScan: () => void;
  onGoToPackaging: () => void;
}) {
  const [barcode, setBarcode] = useState('');

  const queueQuery = useQuery({
    queryKey: ['processing-queue', session.accessToken],
    queryFn: () => api.getProcessingQueue(session.accessToken),
  });

  const queueItems = queueQuery.data?.items ?? [];
  const processingCount = queueItems.filter((i) => i.status === 'SORTED' || i.status === 'PROCESSING').length;
  const packagingCount = queueItems.filter((i) => i.status === 'READY_TO_PACKAGE').length;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = barcode.trim();
    if (trimmed) {
      onScanBag(trimmed);
      setBarcode('');
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>세탁 공장</h1>
        <p>백 바코드를 스캔하거나 메뉴를 선택하세요.</p>
      </div>

      <div className="wash-card" style={{ marginBottom: 16 }}>
        <h2 className="wash-card-title">백 스캔</h2>
        <p style={{ color: 'var(--steel)', fontSize: 14, margin: '0 0 12px' }}>
          수거 백 바코드를 스캔해 담긴 아이템을 확인합니다.
        </p>
        <form className="bag-input-row" onSubmit={handleSubmit}>
          <input
            autoComplete="off"
            autoFocus
            placeholder="BAG-001"
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
          <button
            className="ghost-button"
            disabled={!barcode.trim()}
            type="submit"
          >
            스캔
          </button>
        </form>
      </div>

      <div className="wash-nav-grid">
        <button className="wash-nav-card" type="button" onClick={onGoToOrderSearch}>
          <span className="wash-nav-icon">🔍</span>
          <span className="wash-nav-label">주문 검색</span>
        </button>

        <button className="wash-nav-card" type="button" onClick={onGoToQueue}>
          <span className="wash-nav-icon">📋</span>
          <span className="wash-nav-label">처리 대기열</span>
          {processingCount > 0 ? (
            <span className="badge badge-info">{processingCount}개</span>
          ) : null}
        </button>

        <button className="wash-nav-card" type="button" onClick={onGoToStepScan}>
          <span className="wash-nav-icon">🔖</span>
          <span className="wash-nav-label">스텝 스캔</span>
        </button>

        <button className="wash-nav-card" type="button" onClick={onGoToPackaging}>
          <span className="wash-nav-icon">📦</span>
          <span className="wash-nav-label">패키징</span>
          {packagingCount > 0 ? (
            <span className="badge badge-attention">{packagingCount}개</span>
          ) : null}
        </button>
      </div>
    </>
  );
}
