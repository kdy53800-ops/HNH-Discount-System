import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, ChevronRight, ChevronDown, Folder, Briefcase, Users, User, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import DepartmentSelect from './DepartmentSelect';

export default function DepartmentSettings() {
  const [departments, setDepartments] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showMembersDeptId, setShowMembersDeptId] = useState(null);
  const [newDept, setNewDept] = useState({ name: '', parent_id: null, level: 1 });
  const [draggedDept, setDraggedDept] = useState(null);
  const [dragOverDeptId, setDragOverDeptId] = useState(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // 부서 목록 조회
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('level')
        .order('order_index')
        .order('created_at');

      if (deptError) throw deptError;
      setDepartments(deptData || []);

      // 사용자 목록 조회 (부서 매핑용)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email, name, role, department_id');

      if (userError) throw userError;
      setProfiles(userData || []);
    } catch (err) {
      console.error('부서 정보 로드 실패:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddDept = async (e) => {
    e.preventDefault();
    if (!newDept.name.trim()) return;

    try {
      const cleanName = newDept.name.trim();
      const parentId = newDept.parent_id;
      const level = newDept.level;

      // 1단계 parent_id 중복 검출 등
      if (departments.some(d => d.name === cleanName && d.parent_id === parentId)) {
        alert('동일 레벨에 이미 같은 이름의 부서가 존재합니다.');
        return;
      }

      // order_index 결정 (형제들 중 최하위)
      const siblings = departments.filter(d => d.parent_id === parentId);
      const nextOrder = siblings.length > 0 ? Math.max(...siblings.map(d => d.order_index || 0)) + 1 : 0;

      const { error } = await supabase
        .from('departments')
        .insert({
          name: cleanName,
          level: level,
          parent_id: parentId,
          order_index: nextOrder
        });

      if (error) throw error;

      alert(`[${cleanName}] 부서가 성공적으로 추가되었습니다.`);
      setShowModal(false);
      fetchDepartments(false);
    } catch (err) {
      alert(`부서 추가 중 오류: ${err.message}`);
    }
  };

  const handleDeleteDept = async (id, name, e) => {
    e.stopPropagation();

    // 1. 하위 부서가 있는지 체크
    const hasChildren = departments.some(d => d.parent_id === id);
    if (hasChildren) {
      alert('하위 부서가 존재합니다. 하위 부서를 먼저 삭제해 주세요.');
      return;
    }

    // 2. 소속된 인원이 있는지 체크
    const hasMembers = profiles.some(p => p.department_id === id);
    if (hasMembers) {
      alert('이 부서에 소속된 직원이 존재합니다. 직원의 소속을 먼저 변경한 후 삭제해 주세요.');
      return;
    }

    if (!window.confirm(`[${name}] 부서를 정말로 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) {
        // Mock DB에서는 delete를 직접 sync하지 않는 경우 대응
        const stored = localStorage.getItem('discount_app_departments');
        if (stored) {
          const parsed = JSON.parse(stored);
          const filtered = parsed.filter(d => d.id !== id);
          localStorage.setItem('discount_app_departments', JSON.stringify(filtered));
        }
      }

      alert('부서가 성공적으로 삭제되었습니다.');
      fetchDepartments(false);
    } catch (err) {
      alert(`삭제 오류: ${err.message}`);
    }
  };

  const handleChangeMemberDept = async (member, newDeptId) => {
    if (member.department_id === newDeptId) return;

    const targetDept = departments.find(d => d.id === newDeptId);
    const confirmMessage = `'${member.name}' 직원의 소속을 '${targetDept?.name}'(으)로 변경하시겠습니까?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const { error } = await supabase.from('users').update({ department_id: newDeptId }).eq('email', member.email);
      if (error) {
        // Fallback
        const storedUsers = localStorage.getItem('discount_app_users');
        if (storedUsers) {
          const parsed = JSON.parse(storedUsers);
          const updated = parsed.map(p => p.email === member.email ? { ...p, department_id: newDeptId } : p);
          localStorage.setItem('discount_app_users', JSON.stringify(updated));
        }
      }
      setProfiles(prev => prev.map(p => p.email === member.email ? { ...p, department_id: newDeptId } : p));
    } catch (err) {
      console.error('부서 이동 실패:', err);
      alert('직원 부서 이동 중 오류가 발생했습니다.');
    }
  };

  const handleDragStart = (e, dept) => {
    e.stopPropagation();
    setDraggedDept(dept);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dept.id);
    }
  };

  const handleDragOver = (e, dept) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedDept && draggedDept.id !== dept.id && draggedDept.parent_id === dept.parent_id) {
      setDragOverDeptId(dept.id);
    }
  };

  const handleDragLeave = (e) => {
    e.stopPropagation();
    setDragOverDeptId(null);
  };

  const handleDrop = async (e, targetDept) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDeptId(null);

    // 부서 이동 처리
    if (!draggedDept) return;
    if (draggedDept.id === targetDept.id) return;
    if (draggedDept.parent_id !== targetDept.parent_id) {
      return; // Only allow reordering within same parent
    }

    const currentOrder = draggedDept.order_index ?? 0;
    const targetOrder = targetDept.order_index ?? 0;

    // Swap order_index locally
    setDepartments(prev => prev.map(d => {
      if (d.id === draggedDept.id) return { ...d, order_index: targetOrder };
      if (d.id === targetDept.id) return { ...d, order_index: currentOrder };
      return d;
    }));

    // Update DB
    try {
      await supabase.from('departments').update({ order_index: targetOrder }).eq('id', draggedDept.id);
      await supabase.from('departments').update({ order_index: currentOrder }).eq('id', targetDept.id);
    } catch (err) {
      console.error('순서 변경 실패:', err);
      fetchDepartments(false);
    }
    setDraggedDept(null);
  };

  const handleDragEnd = () => {
    setDraggedDept(null);
    setDragOverDeptId(null);
  };

  const renderTree = (parentId = null) => {
    const children = departments
      .filter(d => (d.parent_id == null ? null : d.parent_id) === parentId)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

    if (children.length === 0) return null;

    return (
      <div style={{ marginLeft: parentId ? '20px' : '0', borderLeft: parentId ? '1px dashed #cbd5e1' : 'none', paddingLeft: parentId ? '16px' : '0' }}>
        {children.map((dept, index) => {
          const hasSubDepts = departments.some(d => d.parent_id === dept.id);
          const isExpanded = expanded[dept.id];
          const deptMembers = profiles.filter(p => p.department_id === dept.id);

          return (
            <div key={dept.id} style={{ marginBottom: '8px' }}>
              <div 
                className="glass-card" 
                draggable
                onDragStart={(e) => handleDragStart(e, dept)}
                onDragOver={(e) => handleDragOver(e, dept)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dept)}
                onDragEnd={handleDragEnd}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '10px 16px', 
                  cursor: 'move',
                  border: dragOverDeptId === dept.id ? '2px dashed #004680' : '1px solid rgba(0,0,0,0.06)',
                  backgroundColor: dragOverDeptId === dept.id ? '#f0f9ff' : '#ffffff',
                  opacity: draggedDept?.id === dept.id ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
                onClick={(e) => hasSubDepts && toggleExpand(dept.id, e)}
              >
                {/* 확장 토글 아이콘 */}
                {hasSubDepts ? (
                  isExpanded ? <ChevronDown size={16} style={{ marginRight: '8px' }} /> : <ChevronRight size={16} style={{ marginRight: '8px' }} />
                ) : (
                  <div style={{ width: '24px' }} />
                )}

                {/* 계층별 아이콘 매핑 */}
                {dept.level === 1 && <Folder size={18} style={{ color: '#004680', marginRight: '8px' }} />}
                {dept.level === 2 && <Briefcase size={18} style={{ color: '#10b981', marginRight: '8px' }} />}
                {dept.level === 3 && <Users size={18} style={{ color: '#f59e0b', marginRight: '8px' }} />}
                {dept.level >= 4 && <User size={18} style={{ color: '#6b7280', marginRight: '8px' }} />}

                {/* 부서 이름 */}
                <span style={{ fontWeight: '600', color: '#1f2937', fontSize: '14px' }}>{dept.name}</span>

                {/* 소속 인원수 뱃지 (클릭 시 팝업) */}
                <button 
                  className="badge badge-secondary" 
                  style={{ 
                    marginLeft: '12px', 
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMembersDeptId(dept.id);
                  }}
                >
                  {deptMembers.length}명
                </button>

                {/* 컨트롤 액션 버튼 그룹 */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  {dept.level < 5 && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewDept({ 
                          name: '', 
                          parent_id: dept.id, 
                          level: dept.level + 1 
                        });
                        setShowModal(true);
                      }}
                    >
                      + 하위 추가
                    </button>
                  )}
                  
                  <button 
                    className="btn btn-danger" 
                    style={{ padding: '4px 6px' }}
                    onClick={(e) => handleDeleteDept(dept.id, dept.name, e)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* 하위 노드 재귀적 출력 */}
              {isExpanded && hasSubDepts && renderTree(dept.id)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#004680' }}>병원 조직도 (소속 부서 관리)</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            임직원의 소속 부서를 계층화 구조(레벨 1~5)로 통합 구성 및 실시간 관리합니다.
          </p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setNewDept({ name: '', parent_id: null, level: 1 });
            setShowModal(true);
          }}
        >
          + 최상위 그룹 추가
        </button>
      </div>

      <div className="glass-card" style={{ padding: '24px', minHeight: '400px' }}>
        {loading ? (
          <div className="empty-state">조직도를 조회하는 중입니다...</div>
        ) : departments.length === 0 ? (
          <div className="empty-state">설정된 소속 부서가 없습니다. 최상위 그룹을 먼저 생성해 주세요.</div>
        ) : (
          renderTree(null)
        )}
      </div>

      {/* 부서 추가 모달 */}
      {showModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '400px', padding: '24px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>신규 부서 추가</h3>
              <button 
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddDept}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label required">부서명</label>
                <input 
                  type="text" 
                  value={newDept.name} 
                  onChange={e => setNewDept({...newDept, name: e.target.value})}
                  className="form-input" 
                  placeholder="예: 영양팀, 심사1파트 등"
                  required
                />
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
                추가 경로 단계: **Level {newDept.level}**
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>취소</button>
                <button type="submit" className="btn btn-primary">추가하기</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 소속 인원 확인 팝업 모달 */}
      {showMembersDeptId && (
        <div 
          className="modal-overlay" 
          style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'center', 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            zIndex: 1000,
            overflowY: 'auto',
            padding: '40px 0'
          }}
          onClick={(e) => e.target.className === 'modal-overlay' && setShowMembersDeptId(null)}
        >
          <div className="glass-card" style={{ width: '450px', padding: '24px', backgroundColor: '#ffffff', margin: 'auto', overflow: 'visible' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>
                [{departments.find(d => d.id === showMembersDeptId)?.name}] 소속 직원 명단
              </h3>
              <button 
                onClick={() => setShowMembersDeptId(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <div style={{ overflow: 'visible' }}>
              {profiles.filter(p => p.department_id === showMembersDeptId).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', color: '#6b7280', fontSize: '13px' }}>
                  소속된 직원이 없습니다.
                </div>
              ) : (
                profiles.filter(p => p.department_id === showMembersDeptId).map(member => (
                  <div 
                    key={member.email} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      padding: '10px 12px', 
                      marginBottom: '8px', 
                      background: '#f9fafb', 
                      borderRadius: '6px', 
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#004680', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px', flexShrink: 0 }}>
                      {member.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#1f2937' }}>{member.name}</div>
                      <div style={{ color: '#6b7280', fontSize: '11px' }}>계정: {member.email}</div>
                    </div>
                    <div style={{ width: '180px' }}>
                      <DepartmentSelect 
                        departments={departments}
                        value={member.department_id}
                        onChange={(newDeptId) => handleChangeMemberDept(member, newDeptId)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
