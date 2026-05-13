import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import type { StaffSession } from '../types';
import { ErrorNotice } from './ErrorNotice';

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (session: StaffSession) => void }) {
  const [staffId, setStaffId] = useState('wash-staff-1');

  const loginMutation = useMutation({
    mutationFn: (id: string) => api.staffDevLogin(id),
    onSuccess: onLoggedIn,
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = staffId.trim();
    if (trimmed) loginMutation.mutate(trimmed);
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <span className="eyebrow">세탁 스태프</span>
        <h1>세탁 운영 로그인</h1>
        <p>스태프 ID를 입력해 세탁 공장 작업을 시작합니다.</p>

        <div className="field">
          <label htmlFor="staff-id">Staff ID</label>
          <input
            autoFocus
            id="staff-id"
            placeholder="wash-staff-1"
            type="text"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          />
        </div>

        {loginMutation.error ? <ErrorNotice error={loginMutation.error} /> : null}

        <button
          className="primary-button"
          disabled={loginMutation.isPending}
          type="submit"
        >
          {loginMutation.isPending ? '로그인 중…' : '시작하기'}
        </button>
      </form>
    </div>
  );
}
