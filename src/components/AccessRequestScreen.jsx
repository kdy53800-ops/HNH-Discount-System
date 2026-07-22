import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import DepartmentSelect from './DepartmentSelect';

export default function AccessRequestScreen({ currentUser, onSessionRefresh }) {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const { data } = await supabase.from('departments').select('*').order('level').order('order_index');
        if (data) {
          setDepartments(data);
        }
      } catch (err) {
        console.error('부서 목록 로드 오류:', err);
      }
    };
    fetchDepts();
  }, []);

  const handleSubmit = async () => {
    if (!selectedDept) {
      alert('소속 부서를 선택해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ department_id: selectedDept, status: 'pending' })
        .eq('email', currentUser.email);
      
      if (error) throw error;
      
      alert('신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.');
      if (onSessionRefresh) {
        onSessionRefresh();
      }
    } catch (err) {
      console.error('권한 신청 실패:', err);
      alert('신청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onSessionRefresh) {
      onSessionRefresh();
    }
  };

  const userStatus = currentUser.user_metadata?.status || 'pending';
  const hasApplied = currentUser.user_metadata?.department_id != null;

  return (
    <div className="login-wrapper">
      <div className="glass-card login-card" style={{ maxWidth: '500px' }}>
        <h1 className="login-title">사용 권한 신청</h1>
        
        {hasApplied ? (
          <div style={{ textAlign: 'center', margin: '30px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <h3 style={{ marginBottom: '8px', color: '#1e293b' }}>승인 대기 중</h3>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>
              사용 권한을 신청하셨습니다.<br/>
              소속 부서 팀 관리자 또는 시스템 관리자의 승인 완료 후 시스템을 이용하실 수 있습니다.
            </p>
          </div>
        ) : (
          <>
            <p className="login-desc" style={{ marginBottom: '24px', textAlign: 'left' }}>
              환영합니다! 시스템을 이용하려면 먼저 소속 부서를 선택하고 권한을 신청해 주세요.
            </p>
            
            <div style={{ marginBottom: '24px', textAlign: 'left' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                소속 부서 선택 <span style={{ color: 'red' }}>*</span>
              </label>
              <DepartmentSelect 
                departments={departments}
                value={selectedDept}
                onChange={setSelectedDept}
                placeholder="본인의 소속 부서를 선택해 주세요"
              />
            </div>
            
            <button 
              onClick={handleSubmit} 
              disabled={loading || !selectedDept} 
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '15px' }}
            >
              {loading ? '신청 중...' : '권한 신청하기'}
            </button>
          </>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button 
            onClick={handleLogout}
            style={{ 
              background: 'none', border: 'none', color: '#64748b', 
              textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' 
            }}
          >
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    </div>
  );
}
