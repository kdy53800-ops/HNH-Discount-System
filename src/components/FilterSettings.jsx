import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function FilterSettings() {
  const [activeCategory, setActiveCategory] = useState('discount_type');
  const [options, setOptions] = useState([]);
  const [newValue, setNewValue] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newSortOrder, setNewSortOrder] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const categories = [
    { id: 'discount_type', name: '감면 구분 (외래/입원 등)' },
    { id: 'relationship', name: '신청자와의 관계' },
    { id: 'discount_reason', name: '감면 사유' }
  ];

  useEffect(() => {
    fetchOptions();
  }, [activeCategory]);

  const fetchOptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('code_options')
        .select('*')
        .eq('category', activeCategory)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });

      if (error) throw error;
      setOptions(data || []);
    } catch (err) {
      console.error('옵션 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOption = async (e) => {
    e.preventDefault();
    if (!newValue.trim()) {
      alert('항목 이름을 입력해 주세요.');
      return;
    }

    // 중복 체크
    if (options.some(o => o.value === newValue.trim())) {
      alert('이미 동일한 이름의 항목이 존재합니다.');
      return;
    }

    setSubmitLoading(true);
    try {
      const maxSortOrder = options.reduce((max, obj) => (obj.sort_order > max ? obj.sort_order : max), 0);
      const computedSortOrder = newSortOrder.trim() ? parseInt(newSortOrder.trim(), 10) : maxSortOrder + 1;
      
      const newOptionData = {
        category: activeCategory,
        value: newValue.trim(),
        code: newCode.trim() || `custom_${Date.now()}`,
        sort_order: computedSortOrder
      };

      const { data, error } = await supabase
        .from('code_options')
        .insert([newOptionData])
        .select();

      if (error) throw error;
      
      // Mock DB의 경우 insert 결과를 반영하기 위해 추가 처리 (Supabase Mock은 insert를 지원하지만 id 자동증가가 완벽하지 않을 수 있음)
      const stored = localStorage.getItem('discount_app_code_options');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.some(o => o.value === newValue.trim() && o.category === activeCategory)) {
            newOptionData.id = Date.now();
            parsed.push(newOptionData);
            localStorage.setItem('discount_app_code_options', JSON.stringify(parsed));
        }
      }

      alert('새 항목이 성공적으로 추가되었습니다.');
      setNewValue('');
      setNewCode('');
      setNewSortOrder('');
      fetchOptions();
    } catch (err) {
      alert(`항목 등록 중 오류: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteOption = async (id, value) => {
    if (!window.confirm(`[${value}] 항목을 정말로 삭제하시겠습니까?\n기존에 신청된 내역 검색 시 영향이 있을 수 있습니다.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('code_options')
        .delete()
        .eq('id', id);
        
      if (error) throw error;

      // Mock DB 모드 대응 (localStorage 동기화 - code_options delete 처리가 mock에 완벽하지 않을 수 있으므로 수동 보완)
      const stored = localStorage.getItem('discount_app_code_options');
      if (stored) {
        const parsed = JSON.parse(stored);
        const filtered = parsed.filter(o => o.id !== id);
        localStorage.setItem('discount_app_code_options', JSON.stringify(filtered));
      }

      alert('항목이 삭제되었습니다.');
      fetchOptions();
    } catch (err) {
      alert(`삭제 중 에러: ${err.message}`);
    }
  };

  const handleSortOrderChange = async (id, currentVal, newVal) => {
    const parsed = parseInt(newVal, 10);
    if (isNaN(parsed) || parsed === currentVal) return;

    try {
      const { error } = await supabase
        .from('code_options')
        .update({ sort_order: parsed })
        .eq('id', id);
      if (error) throw error;
      
      // Mock DB sync
      const stored = localStorage.getItem('discount_app_code_options');
      if (stored) {
        const parsedData = JSON.parse(stored);
        const idx = parsedData.findIndex(o => o.id === id);
        if (idx !== -1) {
          parsedData[idx].sort_order = parsed;
          localStorage.setItem('discount_app_code_options', JSON.stringify(parsedData));
        }
      }
      fetchOptions();
    } catch (err) {
      alert(`순서 변경 오류: ${err.message}`);
    }
  };

  const currentCategoryName = categories.find(c => c.id === activeCategory)?.name;

  return (
    <div className="filter-settings-grid">
      
      {/* 좌측 카테고리 메뉴 */}
      <div className="glass-card" style={{ height: 'fit-content', padding: '20px' }}>
        <h2 className="log-section-title" style={{ fontSize: '16px', marginBottom: '16px' }}>필터 항목 선택</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`nav-item ${activeCategory === cat.id ? 'active' : ''}`}
              style={{
                textAlign: 'left',
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeCategory === cat.id ? 'var(--accent-light)' : 'transparent',
                color: activeCategory === cat.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                fontWeight: activeCategory === cat.id ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* 우측 설정 영역 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* 등록 폼 */}
        <div className="glass-card" style={{ height: 'fit-content' }}>
          <h2 className="log-section-title" style={{ fontSize: '16px', marginBottom: '16px' }}>
            [{currentCategoryName}] 항목 추가
          </h2>
          <form onSubmit={handleAddOption} className="filter-form-row">
            <div className="form-group">
              <label className="form-label required">항목 표시 이름</label>
              <input 
                type="text" 
                value={newValue} 
                onChange={(e) => setNewValue(e.target.value)} 
                placeholder="예: 특수 관계, 응급실" 
                className="form-input"
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">고유 코드 (선택)</label>
              <input 
                type="text" 
                value={newCode} 
                onChange={(e) => setNewCode(e.target.value)} 
                placeholder="영문/숫자 코드 (비워두면 자동생성)" 
                className="form-input"
              />
            </div>
            <div className="form-group" style={{ flex: '0 0 100px' }}>
              <label className="form-label">정렬 순서</label>
              <input 
                type="number" 
                value={newSortOrder} 
                onChange={(e) => setNewSortOrder(e.target.value)} 
                placeholder="마지막" 
                className="form-input"
              />
            </div>
            <div className="form-group" style={{ marginBottom: '4px', flex: '0 0 auto' }}>
              <button type="submit" disabled={submitLoading} className="btn btn-primary" style={{ width: '100%' }}>
                {submitLoading ? '추가 중...' : '추가하기'}
              </button>
            </div>
          </form>
        </div>

        {/* 목록 테이블 */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <h2 className="log-section-title" style={{ fontSize: '16px', marginBottom: '16px' }}>
            [{currentCategoryName}] 등록된 옵션 ({options.length}개)
          </h2>

          {loading ? (
            <div className="empty-state">목록을 불러오는 중입니다...</div>
          ) : options.length === 0 ? (
            <div className="empty-state">등록된 항목이 없습니다.</div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: '400px' }}>
              <table className="custom-table compact">
                <thead>
                  <tr>
                    <th>항목 표시 이름 (Value)</th>
                    <th>코드 (Code)</th>
                    <th>정렬 순서</th>
                    <th style={{ textAlign: 'center' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {options.map((opt) => (
                    <tr key={opt.id}>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{opt.value}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{opt.code}</td>
                      <td>
                        <input
                          type="number"
                          defaultValue={opt.sort_order}
                          onBlur={(e) => handleSortOrderChange(opt.id, opt.sort_order, e.target.value)}
                          className="form-input"
                          style={{ width: '70px', padding: '4px', textAlign: 'center' }}
                          title="숫자를 입력하고 다른 곳을 클릭하면 저장됩니다."
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => handleDeleteOption(opt.id, opt.value)} 
                          className="btn btn-danger" 
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
