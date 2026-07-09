import React from 'react';
import { supabase, isMock } from '../supabaseClient';

export default function RoleSimulator({ currentUser, onSessionRefresh }) {
  // Mock DB 모드가 아닌 실제 상용 서버에서는 보이지 않음
  if (!isMock) return null;

  const roles = [
    { name: '신청자', email: 'applicant@hospital.com', roleKey: 'applicant' },
    { name: '원무팀', email: 'staff@hospital.com', roleKey: 'admin' }
  ];

  const handleRoleSwitch = async (email) => {
    try {
      const { data, error } = await supabase.auth.mockLogin(email);
      if (error) {
        alert(error.message);
      } else {
        onSessionRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const currentEmail = currentUser?.email || '';

  return (
    <div className="role-simulator-panel">
      <span className="simulator-label">역할 시뮬레이터</span>
      {roles.map((r) => {
        const isActive = currentEmail === r.email;
        return (
          <button
            key={r.email}
            onClick={() => handleRoleSwitch(r.email)}
            className={`simulator-btn ${isActive ? 'active' : ''}`}
            title={`${r.email} 계정으로 전환`}
          >
            {r.name}
          </button>
        );
      })}
    </div>
  );
}
