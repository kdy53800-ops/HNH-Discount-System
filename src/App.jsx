import React, { useState, useEffect } from 'react';
import { supabase, isMock } from './supabaseClient';
import AuthScreen from './components/AuthScreen';
import RoleSimulator from './components/RoleSimulator';
import ApplicantView from './components/ApplicantView';
import AdminView from './components/AdminView';
import ManagerView from './components/ManagerView';
import ClinicSettings from './components/ClinicSettings';
import DepartmentSettings from './components/DepartmentSettings';
import DepartmentSelect from './components/DepartmentSelect';
import FilterSettings from './components/FilterSettings';
import UserManagement from './components/UserManagement';
import AccessRequestScreen from './components/AccessRequestScreen';

export default function App() {
  const [session, setSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState(''); // 현재 표시중인 탭
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 소속 부서 수정을 위한 상태 변수
  const [allDepartments, setAllDepartments] = useState([]);
  const [showDeptEditModal, setShowDeptEditModal] = useState(false);
  const [userDeptId, setUserDeptId] = useState('');

  // 부서 목록 로드 및 현재 사용자 부서 ID 설정
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const { data } = await supabase.from('departments').select('*').order('level').order('order_index');
        if (data) {
          setAllDepartments(data);
        }
      } catch (err) {
        console.error('부서 목록 로드 오류:', err);
      }
    };
    
    fetchDepts();
    
    if (currentUser) {
      setUserDeptId(currentUser.user_metadata?.department_id || '');
    }
  }, [currentUser]);

  // 인증 상태 실시간 추적
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        
        if (currentSession?.user) {
          // 최신 사용자 정보 및 권한 메타데이터 설정
          setCurrentUser(currentSession.user);
          
          // 권한에 따른 기본 탭 설정
          const role = currentSession.user.user_metadata?.role;
          const isSysAdmin = currentSession.user.user_metadata?.is_sysadmin === true;
          
          if (role === 'manager') {
            setActiveTab('manager');
          } else if (role === 'admin') {
            setActiveTab('admin');
          } else if (role === 'team_manager' || isSysAdmin) {
            setActiveTab('user-management');
          } else {
            setActiveTab('applicant');
          }
        } else {
          setCurrentUser(null);
          setActiveTab('');
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 세션 강제 갱신용 헬퍼
  const handleSessionRefresh = async () => {
    setLoading(true);
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    setSession(currentSession);
    if (currentSession?.user) {
      setCurrentUser(currentSession.user);
      const role = currentSession.user.user_metadata?.role;
      const isSysAdmin = currentSession.user.user_metadata?.is_sysadmin === true;
      if (role === 'manager') {
        setActiveTab('manager');
      } else if (role === 'admin') {
        setActiveTab('admin');
      } else if (role === 'team_manager' || isSysAdmin) {
        setActiveTab('user-management');
      } else {
        setActiveTab('applicant');
      }
    } else {
      setCurrentUser(null);
      setActiveTab('');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSession(null);
  };

  // 소속 부서 실시간 변경 처리
  const handleDeptChange = async (newDeptId) => {
    setUserDeptId(newDeptId);
    if (currentUser?.email) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ department_id: newDeptId })
          .eq('email', currentUser.email);
        
        if (error) throw error;
        
        // 세션 데이터 실시간 갱신 실행
        await handleSessionRefresh();
      } catch (err) {
        console.error('사용자 소속 부서 ID 업데이트 실패:', err);
        alert('소속 부서 변경 중 오류가 발생했습니다.');
      }
    }
  };

  if (loading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="empty-state">
          <div className="empty-state-text" style={{ fontSize: '18px', fontWeight: '600' }}>
            시스템을 로딩하고 있습니다...
          </div>
        </div>
      </div>
    );
  }

  // 로그인되지 않은 경우 로그인 화면 출력
  if (!session || !currentUser) {
    return (
      <div className="app-container">
        <main className="main-content">
          <AuthScreen onSessionRefresh={handleSessionRefresh} />
        </main>
        {/* 로그인 대기 단계에서도 역할 빠른 선택을 위해 플로팅 시뮬레이터 제공 */}
        <RoleSimulator currentUser={null} onSessionRefresh={handleSessionRefresh} />
      </div>
    );
  }

  const role = currentUser.user_metadata?.role || 'applicant';
  const isSysAdmin = currentUser.user_metadata?.is_sysadmin === true;
  const roleName = currentUser.user_metadata?.full_name || '사용자';
  const departmentName = currentUser.user_metadata?.department || '일반부서';
  const userStatus = currentUser.user_metadata?.status || 'pending';

  if (userStatus !== 'approved') {
    return (
      <div className="app-container">
        <main className="main-content">
          <AccessRequestScreen currentUser={currentUser} onSessionRefresh={handleSessionRefresh} />
        </main>
      </div>
    );
  }

  // 한국어 역할 매칭
  const getRoleLabel = (r, isSys) => {
    if (isSys) return '관리자';
    const labels = {
      applicant: '신청자',
      team_manager: '팀 관리자',
      admin: '원무팀',
      manager: '원무팀장'
    };
    return labels[r] || '일반';
  };

  return (
    <div className="app-container">
      {/* GNB 영역 */}
      <header className="app-header">
        <div className="header-top-row">
          <div className="brand" style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/logo.png" alt="Logo" style={{ height: '32px' }} />
            <span className="brand-logo">진료비 감면 관리</span>
            <span className="brand-badge">v1.0 {isMock && 'MOCK-DB'}</span>
          </div>
          <button 
            className="mobile-menu-btn" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            ☰
          </button>
        </div>

        <div className={`header-nav-container ${isMobileMenuOpen ? 'open' : ''}`}>
          {/* 권한별 상단 탭 노출 */}
          <nav className="nav-links">
            {/* 신청자는 단일 화면이므로 상단 메뉴 탭을 아예 노출하지 않음 */}

            {/* 원무팀은 신청 및 원무 처리 탭 선택 가능 */}
            {role === 'admin' && (
              <>
                <button 
                  onClick={() => { setActiveTab('admin'); setIsMobileMenuOpen(false); }} 
                  className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
                >
                  처리현황
                </button>
                <button 
                  onClick={() => { setActiveTab('applicant'); setIsMobileMenuOpen(false); }} 
                  className={`nav-item ${activeTab === 'applicant' ? 'active' : ''}`}
                >
                  감면 등록
                </button>
              </>
            )}

            {/* 원무팀장은 결재 대시보드, 원무 업무 조회, 신청 탭 전체 노출 */}
            {(role === 'manager' || isSysAdmin) && (
              <>
                <button 
                  onClick={() => { setActiveTab('manager'); setIsMobileMenuOpen(false); }} 
                  className={`nav-item ${activeTab === 'manager' ? 'active' : ''}`}
                >
                  감면 관리
                </button>
                <button 
                  onClick={() => { setActiveTab('admin'); setIsMobileMenuOpen(false); }} 
                  className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
                >
                  처리현황
                </button>
                <button 
                  onClick={() => { setActiveTab('applicant'); setIsMobileMenuOpen(false); }} 
                  className={`nav-item ${activeTab === 'applicant' ? 'active' : ''}`}
                >
                  감면 등록
                </button>
                <button 
                  onClick={() => { setActiveTab('clinic-settings'); setIsMobileMenuOpen(false); }} 
                  className={`nav-item ${activeTab === 'clinic-settings' ? 'active' : ''}`}
                >
                  진료과 설정
                </button>
                <button 
                  onClick={() => { setActiveTab('department-settings'); setIsMobileMenuOpen(false); }} 
                  className={`nav-item ${activeTab === 'department-settings' ? 'active' : ''}`}
                >
                  소속 부서 설정
                </button>
                <button 
                  onClick={() => { setActiveTab('filter-settings'); setIsMobileMenuOpen(false); }} 
                  className={`nav-item ${activeTab === 'filter-settings' ? 'active' : ''}`}
                >
                  필터 설정
                </button>
              </>
            )}

            {/* 권한 관리 탭 노출 (시스템 관리자, 원무팀장, 팀 관리자) */}
            {(isSysAdmin || role === 'manager' || role === 'team_manager') && (
              <button 
                onClick={() => { setActiveTab('user-management'); setIsMobileMenuOpen(false); }} 
                className={`nav-item ${activeTab === 'user-management' ? 'active' : ''}`}
              >
                권한 관리
              </button>
            )}
          </nav>

          {/* 사용자 정보 및 로그아웃 버튼 */}
          <div className="user-profile">
            <div className="user-avatar">
              {roleName[0]}
            </div>
            <div className="user-info">
              <span className="user-name" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                {roleName} ({departmentName})
                <button 
                  onClick={() => { setShowDeptEditModal(true); setIsMobileMenuOpen(false); }} 
                  className="btn-edit-dept"
                  title="소속 부서 변경"
                  style={{
                    background: 'none',
                    border: '1px solid #d1d5db',
                    padding: '2px 6px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    color: '#004680',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 70, 128, 0.05)'; e.currentTarget.style.borderColor = '#004680'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                >
                  소속 변경
                </button>
              </span>

            </div>
            <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="btn-logout">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 화면 렌더링 분기 */}
      <main className="main-content">
        <div className="page-title-section">
          <h1 className="page-title">
            {activeTab === 'applicant' && '감면 등록서'}
            {activeTab === 'admin' && '처리현황'}
            {activeTab === 'manager' && '감면 관리'}
            {activeTab === 'clinic-settings' && '진료과 설정'}
            {activeTab === 'department-settings' && '소속 부서 설정'}
            {activeTab === 'filter-settings' && '필터 설정'}
            {activeTab === 'user-management' && '권한 관리'}
          </h1>
          <div className="page-actions">
            {activeTab === 'applicant' && '감면 대상 환자 정보 및 사유를 기입해 주십시오.'}
            {activeTab === 'admin' && '전체 임직원이 등록한 신청서 정보 검토, 금액 산정 및 1차 확인 처리를 담당합니다.'}
            {activeTab === 'manager' && '1차 검토가 완료된 건의 최종 승인 결정 및 부서별/사유별 감면 분석 통계를 확인합니다.'}
            {activeTab === 'clinic-settings' && '감면 대상 진료과 코드와 원내 의료인 성명 매핑 정보를 실시간으로 수정 및 추가합니다.'}
            {activeTab === 'department-settings' && '임직원 소속 부서 조직도를 5단계 계층 구조로 설정하고 추가/수정합니다.'}
            {activeTab === 'filter-settings' && '감면 사유 및 처리 상태에 대한 필터링 옵션을 설정합니다.'}
            {activeTab === 'user-management' && '시스템 가입 승인 및 사용자의 권한을 관리합니다.'}
          </div>
        </div>

        {/* 활성화된 탭에 맞춰 화면 마운트 */}
        {activeTab === 'applicant' && <ApplicantView currentUser={currentUser} />}
        {activeTab === 'admin' && <AdminView currentUser={currentUser} />}
        {activeTab === 'manager' && <ManagerView currentUser={currentUser} />}
        {activeTab === 'clinic-settings' && <ClinicSettings />}
        {activeTab === 'department-settings' && <DepartmentSettings />}
        {activeTab === 'filter-settings' && <FilterSettings />}
        {activeTab === 'user-management' && <UserManagement currentUser={currentUser} />}
      </main>

      {/* 테스트를 원활하게 도와줄 하단 플로팅 역할 체인저 */}
      <RoleSimulator currentUser={currentUser} onSessionRefresh={handleSessionRefresh} />

      {/* 소속 부서 변경 모달 */}
      {showDeptEditModal && (
        <div 
          className="modal-overlay" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={(e) => e.target.className === 'modal-overlay' && setShowDeptEditModal(false)}
        >
          <div className="glass-card" style={{ width: '400px', padding: '24px', backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#004680' }}>소속 부서 변경</h3>
              <button 
                onClick={() => setShowDeptEditModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}
              >
                &times;
              </button>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '600', fontSize: '13px' }}>신규 소속 부서 선택</label>
              <DepartmentSelect
                departments={allDepartments}
                value={userDeptId}
                onChange={handleDeptChange}
                placeholder="소속 부서 선택"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowDeptEditModal(false)}
                style={{ padding: '6px 16px', fontSize: '13px' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
