import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ApplicantView({ currentUser }) {
  // 폼 입력 상태
  const [discountType, setDiscountType] = useState('외래');
  const [patientNo, setPatientNo] = useState('');
  const [patientNoUnassigned, setPatientNoUnassigned] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [relationship, setRelationship] = useState('기타 (관계없음-감면등록용)');
  const [clinicDept, setClinicDept] = useState('');
  const [clinicDate, setClinicDate] = useState(new Date().toISOString().split('T')[0]);
  const [reasonCategory, setReasonCategory] = useState('감면규정등록');
  const [details, setDetails] = useState('');
  
  // 마스터 데이터 상태
  const [departments, setDepartments] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [discountTypes, setDiscountTypes] = useState([]);
  const [requestList, setRequestList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // 상세 조회 및 보완 수정용 상태
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editPatientNo, setEditPatientNo] = useState('');
  const [editPatientNoUnassigned, setEditPatientNoUnassigned] = useState(false);
  const [editPatientName, setEditPatientName] = useState('');
  const [editRelationship, setEditRelationship] = useState('');
  const [editClinicDept, setEditClinicDept] = useState('');
  const [editClinicDate, setEditClinicDate] = useState('');
  const [editReasonCategory, setEditReasonCategory] = useState('');
  const [editDetails, setEditDetails] = useState('');

  const applicantEmail = currentUser?.email || '';
  const applicantName = currentUser?.name || '홍신청';

  useEffect(() => {
    fetchMasterData();
    fetchMyRequests();
  }, [currentUser]);

  // 부서 및 사유 코드 정보 가져오기
  const fetchMasterData = async () => {
    try {
      // 진료과 목록 (clinic_departments 테이블에서 조회 후 자연어 정렬 적용)
      const { data: deptData } = await supabase.from('clinic_departments').select('name').order('name');
      if (deptData) {
        const sortedDepts = [...deptData].sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
        setDepartments(sortedDepts);
        if (sortedDepts.length > 0) setClinicDept(sortedDepts[0].name);
      }

      // 코드 옵션 목록 전체 조회 후 필터링
      const { data: codeData } = await supabase
        .from('code_options')
        .select('category, value')
        .order('sort_order');
      if (codeData) {
        const reasonOptions = codeData.filter(c => c.category === 'discount_reason');
        setReasons(reasonOptions);
        if (reasonOptions.length > 0 && reasonCategory === '감면규정등록') setReasonCategory(reasonOptions[0].value);

        const relationOptions = codeData.filter(c => c.category === 'relationship');
        setRelationships(relationOptions);
        if (relationOptions.length > 0 && relationship === '기타 (관계없음-감면등록용)') setRelationship(relationOptions[0].value);

        const typeOptions = codeData.filter(c => c.category === 'discount_type');
        setDiscountTypes(typeOptions);
        if (typeOptions.length > 0 && discountType === '외래') setDiscountType(typeOptions[0].value);
      }
    } catch (err) {
      console.error('마스터 데이터 로드 중 오류:', err);
    }
  };

  // 본인 신청 내역 조회 (이메일 기준)
  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('discount_requests')
        .select('id, created_at, discount_type, patient_name, status')
        .eq('applicant_email', applicantEmail)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequestList(data || []);
    } catch (err) {
      console.error('신청 내역 조회 중 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  // 신청 행 클릭 시 상세 모달 열기 및 수정 폼 값 로딩
  const handleRowClick = async (id) => {
    try {
      const { data, error } = await supabase
        .from('discount_requests')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setSelectedRequest(data);
      setIsEditing(false); // 수정 모드 초기화
      
      const isUnassigned = data.patient_no === '미생성';
      setEditPatientNoUnassigned(isUnassigned);
      setEditPatientNo(isUnassigned ? '' : data.patient_no.replace(/^0+/, ''));
      setEditPatientName(data.patient_name);
      setEditRelationship(data.relationship);
      setEditClinicDept(data.clinic_dept);
      setEditClinicDate(data.clinic_date);
      setEditReasonCategory(data.reason_category);
      setEditDetails(data.details || '');
    } catch (err) {
      console.error('신청 상세 정보 조회 실패:', err);
    }
  };

  // 보완 완료 후 재등록(재제출) 처리
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if ((!editPatientNo && !editPatientNoUnassigned) || !editPatientName || !editRelationship || !editClinicDept || !editReasonCategory || !editClinicDate) {
      alert('필수 입력 사항을 누락 없이 작성해 주세요.');
      return;
    }

    try {
      setSubmitLoading(true);
      
      // 상태를 '신청완료'로 돌려서 원무팀에게 재접수 통보
      const { error } = await supabase
        .from('discount_requests')
        .update({
          patient_no: editPatientNoUnassigned ? '미생성' : editPatientNo.padStart(10, '0'),
          patient_name: editPatientName,
          relationship: editRelationship,
          clinic_dept: editClinicDept,
          clinic_date: editClinicDate,
          reason_category: editReasonCategory,
          details: editDetails,
          status: '신청완료'
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      alert('보완 사항이 정상 반영되어 재접수되었습니다.');
      setSelectedRequest(null);
      setIsEditing(false);
      fetchMyRequests(); // 리스트 갱신
    } catch (err) {
      alert(`보완 재등록 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };


  // 신청서 제출 처리
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientNo || !patientName || !relationship || !clinicDept || !reasonCategory || !clinicDate) {
      alert('필수 기입 사항을 입력해 주세요.');
      return;
    }

    setSubmitLoading(true);
    try {
      // 1. IP 획득 시도 (간이 클라이언트 측 획득)
      let ip = '127.0.0.1';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipJson = await ipRes.json();
        ip = ipJson.ip;
      } catch (e) {
        // 백업용 모의 IP 생성
        ip = '192.168.' + Math.floor(Math.random() * 254 + 1) + '.' + Math.floor(Math.random() * 254 + 1);
      }



      const paddedPatientNo = patientNoUnassigned ? '미생성' : patientNo.padStart(10, '0');

      const newRequest = {
        discount_type: discountType,
        patient_no: paddedPatientNo,
        patient_name: patientName,
        relationship: relationship,
        clinic_dept: clinicDept,
        clinic_date: clinicDate,
        reason_category: reasonCategory,
        details: details,
        applicant_dept: currentUser.user_metadata?.department || '미지정',
        applicant_email: applicantEmail,
        applicant_name: applicantName,
        ip_address: ip,
        discount_amount: 0,
        admin_notes: '',
        status: '신청완료'
      };

      // 2. 신청서 생성
      const { data: createdReq, error: reqError } = await supabase
        .from('discount_requests')
        .insert(newRequest)
        .select()
        .single();

      if (reqError) throw reqError;

      // 3. 상태 변경 로그 등록
      const newStatusLog = {
        request_id: createdReq.id,
        from_status: null,
        to_status: '신청완료',
        changed_by_email: applicantEmail,
        changed_by_name: applicantName
      };

      await supabase.from('request_status_logs').insert(newStatusLog);

      alert('감면 신청이 성공적으로 완료되었습니다.');
      
      // 폼 초기화
      setDiscountType('외래');
      setPatientNo('');
      setPatientNoUnassigned(false);
      setPatientName('');
      setRelationship('기타 (관계없음-감면등록용)');
      setDetails('');
      setClinicDate(new Date().toISOString().split('T')[0]);
      if (departments.length > 0) setClinicDept(departments[0].name);
      if (reasons.length > 0) setReasonCategory(reasons[0].value);

      // 내역 갱신
      fetchMyRequests();
    } catch (err) {
      alert(`신청 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  // 이름 마스킹 유틸리티 (가운데만 동그라미 처리. 예: 홍길동 -> 홍○동, 김철 -> 김○, 남궁선우 -> 남○○우)
  const maskName = (name) => {
    if (!name) return '';
    const cleanName = name.trim();
    if (cleanName.length <= 1) return cleanName;
    if (cleanName.length === 2) return cleanName[0] + '○';
    return cleanName[0] + '○'.repeat(cleanName.length - 2) + cleanName[cleanName.length - 1];
  };

  // 날짜 포맷팅 (YYYY-MM-DD)
  const formatDate = (isoString) => {
    if (!isoString) return '';
    return isoString.split('T')[0];
  };

  return (
    <div className="responsive-grid">
      {/* 신청서 입력 영역 */}
      <div className="glass-card">
        <h2 className="log-section-title" style={{ fontSize: '18px', marginBottom: '20px' }}>감면 등록서</h2>
        
        <form onSubmit={handleSubmit} className="form-grid">
          
          <div className="form-group">
            <label className="form-label required">감면구분</label>
            <select 
              value={discountType} 
              onChange={(e) => setDiscountType(e.target.value)}
              className="form-select"
            >
              {discountTypes.map(type => (
                <option key={type.value} value={type.value}>{type.value}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label required">병록번호</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="text"
                inputMode="numeric"
                value={patientNoUnassigned ? '' : patientNo}
                onChange={(e) => setPatientNo(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="숫자만 입력 (10자리 이내)"
                className="form-input"
                maxLength={10}
                disabled={patientNoUnassigned}
                required={!patientNoUnassigned}
                style={patientNoUnassigned ? { backgroundColor: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' } : {}}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={patientNoUnassigned}
                  onChange={(e) => {
                    setPatientNoUnassigned(e.target.checked);
                    if (e.target.checked) setPatientNo('');
                  }}
                  style={{ accentColor: '#004680', width: '14px', height: '14px' }}
                />
                미생성 (병록번호 미발급 대상)
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">대상 이름</label>
            <input 
              type="text" 
              value={patientName} 
              onChange={(e) => setPatientName(e.target.value)} 
              placeholder="감면 대상자 성명"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label required">신청자와의 관계</label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="form-select"
            >
              {relationships.map(r => (
                <option key={r.value} value={r.value}>{r.value}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label required">진료과</label>
            <select
              value={clinicDept}
              onChange={(e) => setClinicDept(e.target.value)}
              className="form-select"
            >
              {departments.map(d => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label required">진료일자</label>
            <input 
              type="date" 
              value={clinicDate} 
              onChange={(e) => setClinicDate(e.target.value)} 
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label required">감면 사유</label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="form-select"
            >
              {reasons.map(r => (
                <option key={r.value} value={r.value}>{r.value}</option>
              ))}
            </select>
          </div>

          <div className="form-group-full form-group">
            <label className="form-label">상세내용</label>
            <textarea 
              value={details} 
              onChange={(e) => setDetails(e.target.value)}
              placeholder="감면이 필요한 이유에 대해 간략히 설명해 주세요."
              className="form-textarea"
            />
          </div>

          <div className="form-group">
            <label className="form-label">신청자 소속</label>
            <input 
              type="text" 
              value={currentUser?.user_metadata?.department || '일반부서'} 
              disabled 
              className="form-input" 
              style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed', color: '#6b7280' }}
            />
            <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
              * 소속 변경은 상단 프로필 영역의 [소속 변경] 버튼을 통해 가능합니다.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">신청자 이름</label>
            <input type="text" value={applicantName} disabled className="form-input" />
          </div>

          <div className="form-group-full" style={{ marginTop: '12px' }}>
            <button type="submit" disabled={submitLoading} className="btn btn-primary w-full">
              {submitLoading ? '등록 중...' : '등록하기'}
            </button>
          </div>

        </form>
      </div>

      {/* 신청 상태 요약 목록 */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 className="log-section-title" style={{ fontSize: '18px', marginBottom: '20px' }}>나의 감면 등록 현황</h2>
        
        {loading ? (
          <div className="empty-state">내역을 조회하는 중입니다...</div>
        ) : requestList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <div className="empty-state-text">등록된 감면 정보가 없습니다.</div>
          </div>
        ) : (
          <div className="table-responsive" style={{ flex: 1 }}>
            <table className="custom-table compact" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px' }}>신청일</th>
                  <th className="hide-on-mobile" style={{ padding: '8px' }}>진료과</th>
                  <th className="hide-on-mobile" style={{ padding: '8px' }}>관계</th>
                  <th style={{ padding: '8px' }}>대상자</th>
                  <th className="hide-on-mobile" style={{ padding: '8px' }}>사유</th>
                  <th style={{ padding: '8px' }}>처리상태</th>
                </tr>
              </thead>
              <tbody>
                {requestList.map((req) => (
                  <tr 
                    key={req.id} 
                    onClick={() => handleRowClick(req.id)}
                    style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ padding: '8px' }}>{formatDate(req.created_at)}</td>
                    <td className="hide-on-mobile" style={{ padding: '8px' }}>{req.clinic_dept}</td>
                    <td className="hide-on-mobile" style={{ padding: '8px' }}>{req.relationship}</td>
                    <td style={{ padding: '8px' }}>{maskName(req.patient_name)}</td>
                    <td className="hide-on-mobile" style={{ padding: '8px' }}>{req.reason_category}</td>
                    <td style={{ padding: '8px' }}>
                      <span className={`status-badge status-${req.status.replace(/\s+/g, '-')}`}>
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 상세 정보 및 보완 수정 모달 */}
      {selectedRequest && (
        <div 
          className="modal-overlay" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={(e) => e.target.className === 'modal-overlay' && !submitLoading && setSelectedRequest(null)}
        >
          <div className="glass-card animate-in" style={{ width: '600px', maxWidth: '90%', padding: '24px', backgroundColor: '#ffffff', overflowY: 'auto', maxHeight: '90vh', border: '1px solid rgba(0,0,0,0.1)', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#004680' }}>
                {isEditing ? '감면 신청 정보 보완 수정' : '감면 등록 상세 정보'}
              </h3>
              <button 
                onClick={() => !submitLoading && setSelectedRequest(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}
                disabled={submitLoading}
              >
                &times;
              </button>
            </div>

            {/* 원무팀 보완요청 및 반려 피드백 메시지 박스 */}
            {(selectedRequest.status === '보완요청' || selectedRequest.status === '반려') && (
              <div style={{
                backgroundColor: '#fff5f5',
                border: '1px solid #fed7d7',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
                color: '#c53030'
              }}>
                <h4 style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ {selectedRequest.status === '반려' ? '최종 반려 사유 및 피드백' : '원무팀 보완요청 사유'}
                </h4>
                <p style={{ fontSize: '12.5px', lineHeight: '1.5', color: '#9b2c2c', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {selectedRequest.admin_notes || (selectedRequest.status === '반려' ? '별도의 반려 사유 코멘트가 작성되지 않았습니다.' : '보완요청 피드백 코멘트가 작성되지 않았습니다.')}
                </p>
              </div>
            )}

            {isEditing ? (
              <form onSubmit={handleEditSubmit} className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label required">대상자 병록번호</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editPatientNoUnassigned ? '' : editPatientNo}
                      onChange={(e) => setEditPatientNo(e.target.value.replace(/[^0-9]/g, ''))}
                      className="form-input"
                      maxLength={10}
                      disabled={editPatientNoUnassigned}
                      required={!editPatientNoUnassigned}
                      style={editPatientNoUnassigned ? { backgroundColor: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' } : {}}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={editPatientNoUnassigned}
                        onChange={(e) => {
                          setEditPatientNoUnassigned(e.target.checked);
                          if (e.target.checked) setEditPatientNo('');
                        }}
                        style={{ accentColor: '#004680', width: '14px', height: '14px' }}
                      />
                      미생성 (병록번호 미발급 대상)
                    </label>
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label required">대상자 이름</label>
                  <input
                    type="text"
                    value={editPatientName}
                    onChange={(e) => setEditPatientName(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">신청자와의 관계</label>
                  <select
                    value={editRelationship}
                    onChange={(e) => setEditRelationship(e.target.value)}
                    className="form-select"
                    required
                  >
                    {relationships.map(r => (
                      <option key={r.value} value={r.value}>{r.value}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label required">진료일자</label>
                  <input
                    type="date"
                    value={editClinicDate}
                    onChange={(e) => setEditClinicDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">진료과 (의료진)</label>
                  <select
                    value={editClinicDept}
                    onChange={(e) => setEditClinicDept(e.target.value)}
                    className="form-select"
                    required
                  >
                    {departments.map(d => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label required">감면사유 분류</label>
                  <select
                    value={editReasonCategory}
                    onChange={(e) => setEditReasonCategory(e.target.value)}
                    className="form-select"
                    required
                  >
                    {reasons.map(r => (
                      <option key={r.value} value={r.value}>{r.value}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group-full form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">상세내용 (필수 기재 대상 시 기입)</label>
                  <textarea
                    value={editDetails}
                    onChange={(e) => setEditDetails(e.target.value)}
                    className="form-textarea"
                    placeholder="보완 요청받은 내용을 참고하여 상세히 기입해 주십시오."
                  />
                </div>

                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setIsEditing(false)}
                    disabled={submitLoading}
                  >
                    취소
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={submitLoading}
                  >
                    {submitLoading ? '재등록 중...' : '보완 완료 및 재등록'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '13px', color: '#4b5563' }}><strong>신청일:</strong> {formatDate(selectedRequest.created_at)}</div>
                  <div style={{ fontSize: '13px', color: '#4b5563' }}>
                    <strong>처리상태:</strong> 
                    <span className={`status-badge status-${selectedRequest.status.replace(/\s+/g, '-')}`} style={{ marginLeft: '6px' }}>
                      {selectedRequest.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#4b5563' }}><strong>대상자 병록번호:</strong> {selectedRequest.patient_no}</div>
                  <div style={{ fontSize: '13px', color: '#4b5563' }}><strong>대상자 이름:</strong> {selectedRequest.patient_name}</div>
                  <div style={{ fontSize: '13px', color: '#4b5563' }}><strong>관계:</strong> {selectedRequest.relationship}</div>
                  <div style={{ fontSize: '13px', color: '#4b5563' }}><strong>진료일자:</strong> {selectedRequest.clinic_date}</div>
                  <div style={{ fontSize: '13px', color: '#4b5563' }}><strong>진료과:</strong> {selectedRequest.clinic_dept}</div>
                  <div style={{ fontSize: '13px', color: '#4b5563' }}><strong>감면사유:</strong> {selectedRequest.reason_category}</div>
                  
                  <div style={{ gridColumn: 'span 2', fontSize: '13px', color: '#4b5563' }}>
                    <strong>신청자 소속:</strong> {selectedRequest.applicant_dept}
                  </div>
                  
                  <div style={{ gridColumn: 'span 2', fontSize: '13px', color: '#4b5563' }}>
                    <strong>상세내용:</strong>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb', marginTop: '6px', whiteSpace: 'pre-wrap', color: '#1f2937', minHeight: '60px' }}>
                      {selectedRequest.details || '(상세 기재 내용 없음)'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                  {(selectedRequest.status === '보완요청' || selectedRequest.status === '반려') && (
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => setIsEditing(true)}
                      style={{ backgroundColor: '#d97706', borderColor: '#d97706', color: '#ffffff' }}
                    >
                      {selectedRequest.status === '반려' ? '수정 후 재신청하기' : '보완 수정하기'}
                    </button>
                  )}
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setSelectedRequest(null)}
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
