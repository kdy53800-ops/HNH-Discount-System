import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ClinicSettings() {
  const [clinics, setClinics] = useState([]);
  const [code, setCode] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchClinics();
  }, []);

  const fetchClinics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clinic_departments')
        .select('*')
        .order('code');

      if (error) throw error;
      
      const sorted = (data || []).sort((a, b) => 
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );
      setClinics(sorted);
    } catch (err) {
      console.error('진료과 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClinic = async (e) => {
    e.preventDefault();
    if (!code.trim() || !doctorName.trim()) {
      alert('진료과 코드와 의료인 성명을 입력해 주세요.');
      return;
    }

    const cleanCode = code.trim();
    const cleanDoctor = doctorName.trim();
    const fullName = `${cleanCode} (${cleanDoctor})`;

    // 이미 존재하는 항목인지 체크
    if (clinics.some(c => c.name === fullName)) {
      alert('이미 동일한 이름으로 등록된 진료과 정보가 있습니다.');
      return;
    }

    setSubmitLoading(true);
    try {
      const { error } = await supabase
        .from('clinic_departments')
        .insert({
          name: fullName,
          code: cleanCode,
          doctor_name: cleanDoctor
        });

      if (error) throw error;

      alert(`새 진료과 [${fullName}]가 성공적으로 등록되었습니다.`);
      setCode('');
      setDoctorName('');
      fetchClinics();
    } catch (err) {
      alert(`진료과 등록 중 오류: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteClinic = async (name) => {
    if (!window.confirm(`[${name}] 진료과 항목을 정말로 삭제하시겠습니까?\n기존에 신청된 내역이 있을 경우 영향이 갈 수 있습니다.`)) {
      return;
    }

    try {
      // Supabase or Mock에서 delete 처리
      // Mock의 경우 eq 필터링으로 delete 동작 처리
      const { error } = await supabase
        .from('clinic_departments')
        .update({ is_deleted: true }) // 실제 운영환경에선 soft delete나 cascade 검토 필요
        .eq('name', name);
        
      // Mock DB 모드 대응을 위해 delete를 직접 구현하거나 
      // 이식성 높은 localStorage 동기화를 위해 supabaseClient Mock 객체는 update / insert / select 위주로 구성되어 있으므로
      // delete를 지원하기 위해 supabaseClient.js의 Mock 객체에서 데이터를 필터 아웃하거나 DB API의 삭제 흐름 처리.
      // 여기서는 DB API 지원에 맞추어 delete API 모사 또는 갱신 수행
      const { error: delError } = await supabase
        .from('clinic_departments')
        .update({ name: null }) // Mock DB의 경우 update를 통해 제거하거나 직접 raw db 갱신을 수행할 수 있습니다.
        .eq('name', name);
      
      // 실제로는 Mock DB 파일 구조상 filter 처리가 더 매끄럽습니다.
      // supabaseClient의 delete를 지원하기 위해 mock.js에서 갱신이 구현되어 있지 않은 경우,
      // clinic_departments를 update로 지우는 쿼리를 흉내 내거나 client에서 쿼리를 보내 필터 삭제합니다.
      // supabaseClient.js Mock에 delete 쿼리가 안 들어있으므로, 직접 localStorage를 열어 조작하는 안전장치를 사용합니다.
      const stored = localStorage.getItem('discount_app_clinic_departments');
      if (stored) {
        const parsed = JSON.parse(stored);
        const filtered = parsed.filter(c => c.name !== name);
        localStorage.setItem('discount_app_clinic_departments', JSON.stringify(filtered));
      }
      
      alert('진료과 항목이 삭제되었습니다.');
      fetchClinics();
    } catch (err) {
      alert(`삭제 중 에러: ${err.message}`);
    }
  };

  return (
    <div className="clinic-settings-grid">
      {/* 등록 카드 */}
      <div className="glass-card" style={{ height: 'fit-content' }}>
        <h2 className="log-section-title" style={{ fontSize: '17px', marginBottom: '20px' }}>신규 진료과 & 의료인 추가</h2>
        <form onSubmit={handleAddClinic} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="form-group">
            <label className="form-label required">진료과 코드</label>
            <input 
              type="text" 
              value={code} 
              onChange={(e) => setCode(e.target.value)} 
              placeholder="예: IM_1, EI, 한방, FM" 
              className="form-input"
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label required">의료인 성명</label>
            <input 
              type="text" 
              value={doctorName} 
              onChange={(e) => setDoctorName(e.target.value)} 
              placeholder="예: 고인영, 서휘, 박미경" 
              className="form-input"
              required 
            />
          </div>

          <div className="form-group" style={{ marginTop: '8px' }}>
            <button type="submit" disabled={submitLoading} className="btn btn-primary w-full">
              {submitLoading ? '등록 중...' : '새 진료과 등록'}
            </button>
          </div>
        </form>
      </div>

      {/* 목록 카드 */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 className="log-section-title" style={{ fontSize: '17px', marginBottom: '20px' }}>
          등록된 진료과 목록 설정 ({clinics.length}개)
        </h2>

        {loading ? (
          <div className="empty-state">조회 중...</div>
        ) : clinics.length === 0 ? (
          <div className="empty-state">등록된 진료과 및 의료인 정보가 없습니다.</div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: '550px' }}>
            <table className="custom-table compact">
              <thead>
                <tr>
                  <th>진료과 코드</th>
                  <th>의료인 성명</th>
                  <th className="hide-on-mobile">신청용 표기명</th>
                  <th style={{ textAlign: 'center' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {clinics.map((c) => (
                  <tr key={c.name} style={{ cursor: 'default' }}>
                    <td style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>{c.code}</td>
                    <td>{c.doctor_name}</td>
                    <td className="hide-on-mobile" style={{ fontFamily: 'var(--font-title)' }}>{c.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => handleDeleteClinic(c.name)} 
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
  );
}
