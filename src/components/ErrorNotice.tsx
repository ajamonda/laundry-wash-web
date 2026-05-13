import { ApiError } from '../api';

export function ErrorNotice({ error }: { error: unknown }) {
  return <div className="error-notice">{readableError(error)}</div>;
}

function readableError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '요청 처리 중 오류가 발생했어요.';
}
