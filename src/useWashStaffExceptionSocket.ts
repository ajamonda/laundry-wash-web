import { useEffect } from 'react';
import { io } from 'socket.io-client';

type ApprovalResolvedEvent = {
  approvalRequestId: string;
  decision: string;
  orderItemId: string;
};

type RouteChangeResolvedEvent = {
  routeChangeRequestId: string;
  orderItemId: string;
  status: 'APPROVED' | 'REJECTED';
};

const socketBaseUrl =
  (import.meta.env.VITE_SOCKET_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/api$/, '') ||
  'http://localhost:3000';

/**
 * Staff용 /exception 네임스페이스 연결. 고객이 승인/거절한 시점에 콜백을 호출한다.
 */
export function useWashStaffExceptionSocket(
  accessToken: string | undefined,
  handlers: {
    onApprovalResolved?: (event: ApprovalResolvedEvent) => void;
    onRouteChangeResolved?: (event: RouteChangeResolvedEvent) => void;
  },
) {
  const { onApprovalResolved, onRouteChangeResolved } = handlers;

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(`${socketBaseUrl}/exception`, {
      auth: { token: `Bearer ${accessToken}` },
      transports: ['websocket'],
    });

    if (onApprovalResolved) {
      socket.on('exception:approval-resolved', onApprovalResolved);
    }
    if (onRouteChangeResolved) {
      socket.on('exception:route-change-resolved', onRouteChangeResolved);
    }

    return () => {
      socket.disconnect();
    };
  }, [accessToken, onApprovalResolved, onRouteChangeResolved]);
}
