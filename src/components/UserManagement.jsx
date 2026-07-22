import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptSearchQuery, setDeptSearchQuery] = useState('');

  const currentUserRole = currentUser?.user_metadata?.role;
  const isSysAdmin = currentUser?.user_metadata?.is_sysadmin === true;
  const currentUserDeptId = currentUser?.user_metadata?.department_id;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 부서 목록 가져오기 (매핑용)
      const { data: deptData } = await supabase.from('departments').select('*');
      const deptMap = {};
      if (deptData) {
        deptData.forEach(d => {
          deptMap[d.id] = d.name;
        });
      }
      setDepartments(deptMap);

      // 사용자 목록 가져오기
      const { data: userData, error } = await supabase.from('users').select('*');
      if (error) throw error;
      if (userData) {
        setUsers(userData);
      }
    } catch (err) {
      console.error('사용자 목록 로드 중 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (email, newRole) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('email', email);
      
      if (error) throw error;
      
      alert('사용자 권한이 성공적으로 변경되었습니다.\n(현재 로그인된 사용자의 권한을 변경한 경우, 다시 로그인하거나 새로고침해야 적용될 수 있습니다.)');
      await fetchData(); // 최신 데이터로 리프레시
    } catch (err) {
      alert(`권한 변경 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSysAdminToggle = async (email, currentVal) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_sysadmin: !currentVal })
        .eq('email', email);
      
      if (error) throw error;
      alert('시스템 관리자 권한이 변경되었습니다.');
      await fetchData();
    } catch (err) {
      alert(`권한 변경 중 오류: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (email, assignedRole) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'approved', role: assignedRole })
        .eq('email', email);
      
      if (error) throw error;
      alert('사용권한이 승인되었습니다.');
      await fetchData();
    } catch (err) {
      alert(`승인 처리 중 오류: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (email) => {
    if (!window.confirm('정말 이 사용자의 권한 신청을 거절하시겠습니까?')) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'rejected' })
        .eq('email', email);
      
      if (error) throw error;
      alert('신청이 반려/거절되었습니다.');
      await fetchData();
    } catch (err) {
      alert(`반려 처리 중 오류: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 역할을 한글로 변환해주는 헬퍼
  const getRoleLabel = (role) => {
    const roles = {
      applicant: '일반 신청자',
      team_manager: '팀 관리자',
      admin: '원무팀',
      manager: '원무팀 관리자',
      superadmin: '모든 권한자'
    };
    return roles[role] || role;
  };

  // 승인 대기 목록 필터링 (팀 관리자는 본인 부서만, 원무팀 관리자/시스템관리자는 전체 조회)
  const pendingUsers = users.filter(u => u.status === 'pending').filter(u => {
    if (isSysAdmin || currentUserRole === 'manager') return true;
    if (currentUserRole === 'team_manager' && u.department_id === currentUserDeptId) return true;
    return false;
  });

  // 일반 사용자 목록 필터링 (승인 완료 또는 거절된 사용자)
  const filteredUsers = users.filter(u => u.status !== 'pending').filter(user => {
    const matchName = user.name.toLowerCase().includes(searchQuery.toLowerCase());
    const deptName = departments[user.department_id] || '부서 미지정';
    const matchDept = deptName.toLowerCase().includes(deptSearchQuery.toLowerCase());
    return matchName && matchDept;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 권한 승인 대기 목록 */}
      <div className="glass-card">
        <h2 className="log-section-title" style={{ fontSize: '18px', margin: '0 0 16px 0', color: '#b91c1c' }}>
          권한 승인 대기 목록 ({pendingUsers.length}건)
        </h2>
        {loading ? (
          <div className="empty-state">로딩 중...</div>
        ) : pendingUsers.length === 0 ? (
          <div className="empty-state">현재 승인 대기 중인 사용자가 없습니다.</div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>요청일시</th>
                  <th>이메일 (ID)</th>
                  <th>이름</th>
                  <th>신청 소속 부서</th>
                  <th>권한 부여 (승인 시)</th>
                  <th>승인 처리</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map(user => (
                  <PendingUserRow 
                    key={user.email} 
                    user={user} 
                    departmentName={departments[user.department_id]}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    actionLoading={actionLoading}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 시스템 가입 사용자 관리 (기존) */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <h2 className="log-section-title" style={{ fontSize: '18px', margin: 0 }}>
            가입된 사용자 관리
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', color: '#4b5563', fontWeight: '500' }}>부서명</span>
              <input 
                type="text" 
                placeholder="소속 부서 검색..."
                value={deptSearchQuery}
                onChange={(e) => setDeptSearchQuery(e.target.value)}
                className="form-input"
                style={{ width: '160px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', color: '#4b5563', fontWeight: '500' }}>이름</span>
              <input 
                type="text" 
                placeholder="이름으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ width: '160px' }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">사용자 목록을 불러오는 중입니다...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">조건에 맞는 사용자가 없습니다.</div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>이메일 (ID)</th>
                  <th>이름</th>
                  <th>소속 부서</th>
                  <th>기본 권한 (Role)</th>
                  <th>시스템 관리자 여부</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.email}>
                    <td>{user.email}</td>
                    <td>{user.name}</td>
                    <td>{departments[user.department_id] || '부서 미지정'}</td>
                    <td>
                      <select 
                        className="form-select"
                        value={user.role} 
                        onChange={(e) => handleRoleChange(user.email, e.target.value)}
                        disabled={actionLoading || !isSysAdmin} // Only sysadmin can change role after approval usually, or maybe managers. We restrict to sysadmin for safety unless manager. Let's just disable if action loading for now.
                        style={{ width: '150px', padding: '6px 12px', fontSize: '13px' }}
                      >
                        <option value="applicant">일반 신청자</option>
                        <option value="team_manager">팀 관리자</option>
                        <option value="admin">원무팀</option>
                        <option value="manager">원무팀 관리자</option>
                        <option value="superadmin">모든 권한자</option>
                      </select>
                    </td>
                    <td>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isSysAdmin ? 'pointer' : 'default' }}>
                        <input 
                          type="checkbox" 
                          checked={user.is_sysadmin} 
                          onChange={() => handleSysAdminToggle(user.email, user.is_sysadmin)}
                          disabled={actionLoading || !isSysAdmin}
                        />
                        <span style={{ fontSize: '13px', color: user.is_sysadmin ? '#b91c1c' : '#64748b', fontWeight: user.is_sysadmin ? 'bold' : 'normal' }}>
                          관리자 권한
                        </span>
                      </label>
                    </td>
                    <td>
                      <span className={`status-badge ${user.status === 'approved' ? 'status-approved' : 'status-rejected'}`}>
                        {user.status === 'approved' ? '정상 승인' : '거절됨'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// 개별 대기자 Row 컴포넌트
function PendingUserRow({ user, departmentName, onApprove, onReject, actionLoading }) {
  const [selectedRole, setSelectedRole] = useState('applicant');

  return (
    <tr>
      <td>{new Date(user.created_at).toLocaleDateString()}</td>
      <td>{user.email}</td>
      <td style={{ fontWeight: 'bold' }}>{user.name}</td>
      <td>{departmentName || '부서 미지정'}</td>
      <td>
        <select 
          className="form-select"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          disabled={actionLoading}
          style={{ padding: '6px', fontSize: '13px' }}
        >
          <option value="applicant">일반 신청자</option>
          <option value="team_manager">팀 관리자</option>
          <option value="admin">원무팀</option>
          <option value="manager">원무팀 관리자</option>
          <option value="superadmin">모든 권한자</option>
        </select>
      </td>
      <td>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => onApprove(user.email, selectedRole)}
            disabled={actionLoading}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            승인
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => onReject(user.email)}
            disabled={actionLoading}
            style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}
          >
            반려
          </button>
        </div>
      </td>
    </tr>
  );
}
