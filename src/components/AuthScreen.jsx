import React, { useState } from 'react';
import { supabase, isMock } from '../supabaseClient';

export default function AuthScreen({ onSessionRefresh }) {
  const [loading, setLoading] = useState(false);

  // 실제 구글 OAuth 로그인 (Supabase 연동 시)
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      
      // Mock 모드인 경우 시뮬레이터 흐름을 위해 신청자로 기본 로그인 유도
      if (isMock) {
        await supabase.auth.mockLogin('applicant@hospital.com');
        onSessionRefresh();
      }
    } catch (err) {
      alert(`구글 로그인 시도 중 에러가 발생했습니다: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 모의 가상 계정 로그인 처리
  const handleMockLogin = async (email) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.mockLogin(email);
      if (error) {
        alert(error.message);
      } else {
        onSessionRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="glass-card login-card">
        <div className="login-icon" style={{ background: 'transparent', boxShadow: 'none' }}>
          <img src="/favicon.svg" alt="Logo" style={{ width: '64px', height: '64px' }} />
        </div>
        <h1 className="login-title">진료비 감면 관리</h1>
        <p className="login-desc">종이 감면 신청서를 쉽고 간편하게 온라인으로 접수하고 결재 현황을 확인하세요.</p>

        <button 
          onClick={handleGoogleLogin} 
          disabled={loading} 
          className="google-login-btn"
        >
          {/* Google 로고 아이콘 */}
          <svg className="google-icon" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Google 계정으로 로그인
        </button>

        {isMock && (
          <>
            <div className="separator">테스트용 가상 계정 선택</div>
            <div className="mock-accounts-list">
              <button 
                onClick={() => handleMockLogin('applicant@hospital.com')} 
                disabled={loading}
                className="mock-account-btn"
              >
                <div className="mock-account-info">
                  <span className="mock-account-name">일반 직원 (홍신청 - 간호부)</span>
                  <span className="mock-account-email">applicant@hospital.com</span>
                </div>
                <span className="user-role-badge applicant">신청자</span>
              </button>

              <button 
                onClick={() => handleMockLogin('staff@hospital.com')} 
                disabled={loading}
                className="mock-account-btn"
              >
                <div className="mock-account-info">
                  <span className="mock-account-name">원무팀 직원 (김원무 - 원무팀)</span>
                  <span className="mock-account-email">staff@hospital.com</span>
                </div>
                <span className="user-role-badge admin">원무팀</span>
              </button>


              <button 
                onClick={() => handleMockLogin('manager@hospital.com')} 
                disabled={loading}
                className="mock-account-btn"
              >
                <div className="mock-account-info">
                  <span className="mock-account-name">원무팀장 (박팀장 - 원무팀)</span>
                  <span className="mock-account-email">manager@hospital.com</span>
                </div>
                <span className="user-role-badge manager">원무팀장</span>
              </button>

              <button 
                onClick={() => handleMockLogin('sysadmin@hospital.com')} 
                disabled={loading}
                className="mock-account-btn"
              >
                <div className="mock-account-info">
                  <span className="mock-account-name">시스템 관리자 (이관리 - 전산팀)</span>
                  <span className="mock-account-email">sysadmin@hospital.com</span>
                </div>
                <span className="user-role-badge sysadmin">관리자</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
