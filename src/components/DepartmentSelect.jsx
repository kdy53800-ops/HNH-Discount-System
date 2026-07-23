import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, X, Shield } from 'lucide-react';

const DepartmentSelect = ({ departments, value, onChange, disabled, placeholder = '부서 선택', maxLevel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState([]);
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef]);

  // 부서 데이터 로드 시 모든 부서 트리를 기본적으로 모두 열림(expanded) 상태로 설정
  useEffect(() => {
    if (departments && departments.length > 0) {
      setExpandedIds(departments.map(d => d.id));
    }
  }, [departments]);

  // 오픈 시 검색창 포커스
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const toggleExpand = (e, id) => {
    e.stopPropagation();
    setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // 계층화 정렬된 리스트 생성 (들여쓰기용 접두사 'ㄴ' 포함)
  const getTreeOrderedDepts = (depts) => {
    const result = [];
    const buildTree = (parentId, depth) => {
      const children = depts
        .filter(d => (d.parent_id == null ? null : d.parent_id) === parentId && (maxLevel ? d.level <= maxLevel : true))
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        
      children.forEach(child => {
        const prefix = depth > 0 ? '\u00A0\u00A0'.repeat(depth) + 'ㄴ ' : '';
        result.push({ ...child, displayName: prefix + child.name });
        buildTree(child.id, depth + 1);
      });
    };
    buildTree(null, 0);
    return result;
  };

  const flattenedDepts = getTreeOrderedDepts(departments);
  const filteredDepts = flattenedDepts.filter(dept => 
    dept.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedDept = departments.find(d => d.id === value);
  const selectedDisplayName = selectedDept ? selectedDept.name : '';

  // 계층형 트리 렌더링
  const renderTree = (parentId = null) => {
    const children = departments
      .filter(d => (d.parent_id == null ? null : d.parent_id) === parentId && (maxLevel ? d.level <= maxLevel : true))
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      
    if (children.length === 0) return null;

    return (
      <div style={{ paddingLeft: parentId ? '1.25rem' : '0' }}>
        {children.map(dept => {
          const hasChildren = departments.some(d => d.parent_id === dept.id && (maxLevel ? d.level <= maxLevel : true));
          const isExpanded = expandedIds.includes(dept.id);
          const isSelected = value === dept.id;

          return (
            <div key={dept.id}>
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '6px 8px', 
                  cursor: 'pointer',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? 'rgba(0, 70, 128, 0.1)' : 'transparent',
                  color: isSelected ? '#004680' : 'var(--text-main)',
                  fontWeight: isSelected ? 600 : 400,
                  margin: '1px 0',
                  fontSize: '13px',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isSelected ? 'rgba(0, 70, 128, 0.1)' : '#f1f5f9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? 'rgba(0, 70, 128, 0.1)' : 'transparent'; }}
                onClick={() => {
                  onChange(dept.id); 
                  setIsOpen(false);
                }}
              >
                <div 
                  onClick={(e) => { 
                    if (hasChildren) {
                      e.stopPropagation(); 
                      toggleExpand(e, dept.id); 
                    } 
                  }}
                  style={{ 
                    width: '20px', 
                    height: '20px',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    cursor: hasChildren ? 'pointer' : 'default',
                    opacity: hasChildren ? 0.7 : 0,
                    marginRight: '4px',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => { if (hasChildren) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'; }}
                  onMouseLeave={(e) => { if (hasChildren) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {hasChildren && (
                    isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                  )}
                </div>
                
                <span>{dept.name}</span>
              </div>
              
              {hasChildren && isExpanded && (
                renderTree(dept.id)
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: disabled ? 'rgba(255,255,255,0.05)' : '#ffffff',
          opacity: disabled ? 0.6 : 1,
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '14px',
          color: value ? '#1f2937' : '#9ca3af',
          transition: 'all 0.15s ease'
        }}
      >
        <span>
          {value ? selectedDisplayName : placeholder}
        </span>
        <ChevronDown 
          size={16} 
          style={{ 
            color: '#9ca3af', 
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'none'
          }} 
        />
      </div>

      {isOpen && (
        <div 
          className="glass-card"
          style={{ 
            position: 'absolute', 
            zIndex: 9999, 
            width: '100%', 
            marginTop: '4px', 
            padding: 0,
            display: 'flex', 
            flexDirection: 'column',
            maxHeight: '300px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid rgba(0,0,0,0.1)',
            backgroundColor: '#ffffff'
          }}
        >
          {/* 검색 기능 */}
          <div style={{ 
            padding: '8px 12px', 
            borderBottom: '1px solid #e5e7eb', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            backgroundColor: '#f9fafb'
          }}>
            <Search size={14} style={{ color: '#9ca3af' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="부서명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', 
                border: 'none', 
                outline: 'none', 
                background: 'transparent',
                fontSize: '13px',
                color: '#374151'
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {searchTerm && (
              <X 
                size={14} 
                style={{ color: '#9ca3af', cursor: 'pointer' }} 
                onClick={(e) => { e.stopPropagation(); setSearchTerm(''); }} 
              />
            )}
          </div>
          
          {/* 부서 트리 및 리스트 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {value && (
              <div 
                style={{ 
                  padding: '6px 12px', 
                  fontSize: '12px', 
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontWeight: 600,
                  borderRadius: '4px',
                  marginBottom: '4px'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#fee2e2'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                onClick={() => { onChange(''); setIsOpen(false); }}
              >
                선택 취소 (할당 없음)
              </div>
            )}
            
            {searchTerm ? (
              filteredDepts.length === 0 ? (
                <div style={{ padding: '16px', fontSize: '13px', textAlign: 'center', color: '#9ca3af' }}>
                  검색 결과가 없습니다.
                </div>
              ) : (
                filteredDepts.map(dept => {
                  const isSelected = value === dept.id;
                  return (
                    <div 
                      key={dept.id}
                      onClick={() => {
                        onChange(dept.id);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      style={{
                        padding: '6px 12px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        backgroundColor: isSelected ? 'rgba(0, 70, 128, 0.1)' : 'transparent',
                        color: isSelected ? '#004680' : '#374151',
                        fontWeight: isSelected ? 600 : 400,
                        fontSize: '13px'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isSelected ? 'rgba(0, 70, 128, 0.1)' : '#f3f4f6'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? 'rgba(0, 70, 128, 0.1)' : 'transparent'; }}
                    >
                      {dept.displayName}
                    </div>
                  );
                })
              )
            ) : (
              renderTree(null)
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentSelect;
