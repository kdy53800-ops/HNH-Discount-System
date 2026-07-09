import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptSearchQuery, setDeptSearchQuery] = useState('');

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

  // 역할을 한글로 변환해주는 헬퍼
  const getRoleLabel = (role) => {
    const roles = {
      applicant: '일반 신청자',
      admin: '원무팀',
      manager: '원무팀장',
      sysadmin: '시스템 관리자'
    };
    return roles[role] || role;
  };

  const filteredUsers = users.filter(user => {
    const matchName = user.name.toLowerCase().includes(searchQuery.toLowerCase());
    const deptName = departments[user.department_id] || '부서 미지정';
    const matchDept = deptName.toLowerCase().includes(deptSearchQuery.toLowerCase());
    return matchName && matchDept;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <h2 className="log-section-title" style={{ fontSize: '18px', margin: 0 }}>
            시스템 가입 사용자 및 권한 관리
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
                  <th>권한 (Role)</th>
                  <th>권한 설정</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.email}>
                    <td>{user.email}</td>
                    <td>{user.name}</td>
                    <td>{departments[user.department_id] || '부서 미지정'}</td>
                    <td>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: user.role === 'sysadmin' ? '#fee2e2' : user.role === 'manager' ? '#fef3c7' : user.role === 'admin' ? '#e0e7ff' : '#f1f5f9',
                        color: user.role === 'sysadmin' ? '#991b1b' : user.role === 'manager' ? '#92400e' : user.role === 'admin' ? '#3730a3' : '#475569'
                      }}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td>
                      <select 
                        className="form-select"
                        value={user.role} 
                        onChange={(e) => handleRoleChange(user.email, e.target.value)}
                        disabled={actionLoading}
                        style={{ width: '150px', padding: '6px 12px', fontSize: '13px' }}
                      >
                        <option value="applicant">일반 신청자</option>
                        <option value="admin">원무팀</option>
                        <option value="manager">원무팀장</option>
                        <option value="sysadmin">시스템 관리자</option>
                      </select>
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
