import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminView({ currentUser }) {
  // 목록 및 마스터 정보
  const [requests, setRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  // 검색 필터 상태 (감면 등록서와 동일 필드 구성)
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('')            // 감면구분
  const [filterPatientNo, setFilterPatientNo] = useState('');  // 병록번호
  const [filterPatientName, setFilterPatientName] = useState(''); // 대상 이름
  const [filterRelationship, setFilterRelationship] = useState(''); // 신청자와의 관계
  const [filterClinicDept, setFilterClinicDept] = useState('');    // 진료과
  const [filterClinicDate, setFilterClinicDate] = useState('');    // 진료일자
  const [filterReason, setFilterReason] = useState('');       // 감면 사유 (select)
  const [filterApplicantDept, setFilterApplicantDept] = useState(''); // 신청자 소속
  const [filterApplicant, setFilterApplicant] = useState('');  // 신청자 이름
  const [reasons, setReasons] = useState([]);                  // 감면 사유 목록 (DB)

  // 필터 패널 열림 상태
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // 상세/수정 모달 상태
  const [selectedReq, setSelectedReq] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [basicInfoOpen, setBasicInfoOpen] = useState(false);

  // 모달 안 수정용 필드 상태
  const [editPatientNo, setEditPatientNo] = useState('');
  const [editPatientName, setEditPatientName] = useState('');
  const [editClinicDept, setEditClinicDept] = useState('');
  const [editClinicDate, setEditClinicDate] = useState('');
  const [editDiscountAmount, setEditDiscountAmount] = useState(0);
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [editStatus, setEditStatus] = useState('');

  // 이력 로그 상태
  const [statusLogs, setStatusLogs] = useState([]);
  const [editLogs, setEditLogs] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);

  useEffect(() => {
    fetchMasterData();
    fetchRequests();
  }, []);

  // 진료과 + 감면사유 마스터 데이터 가져오기
  const fetchMasterData = async () => {
    try {
      const { data } = await supabase.from('clinic_departments').select('name').order('name');
      if (data) {
        const sortedDepts = [...data].sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
        setDepartments(sortedDepts);
      }
      // 감면 사유 목록 (ApplicantView와 동일)
      const { data: codeData } = await supabase
        .from('code_options')
        .select('value')
        .eq('category', 'discount_reason')
        .order('sort_order');
      if (codeData) setReasons(codeData);
    } catch (err) {
      console.error(err);
    }
  };

  // 조건부 신청 내역 필터링 쿼리
  const fetchRequests = async () => {
    setLoading(true);
    try {
      let query = supabase.from('discount_requests').select('*');

      if (filterStartDate) query = query.gte('created_at', `${filterStartDate}T00:00:00.000Z`);
      if (filterEndDate)   query = query.lte('created_at', `${filterEndDate}T23:59:59.999Z`);
      if (filterStatus)    query = query.eq('status', filterStatus);
      if (filterType)      query = query.eq('discount_type', filterType);
      if (filterPatientNo) query = query.like('patient_no', `%${filterPatientNo}%`);
      if (filterPatientName) query = query.like('patient_name', `%${filterPatientName}%`);
      if (filterRelationship) query = query.eq('relationship', filterRelationship);
      if (filterClinicDept)   query = query.eq('clinic_dept', filterClinicDept);
      if (filterClinicDate)   query = query.eq('clinic_date', filterClinicDate);
      if (filterReason)       query = query.eq('reason_category', filterReason);
      if (filterApplicantDept) query = query.like('applicant_dept', `%${filterApplicantDept}%`);
      if (filterApplicant)    query = query.like('applicant_name', `%${filterApplicant}%`);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      alert(`데이터 조회 중 오류 발생: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterStatus('');
    setFilterType('');
    setFilterPatientNo('');
    setFilterPatientName('');
    setFilterRelationship('');
    setFilterClinicDept('');
    setFilterClinicDate('');
    setFilterReason('');
    setFilterApplicantDept('');
    setFilterApplicant('');
    setTimeout(() => fetchRequests(), 50);
  };

  // 특정 요청 건 상세 보기 및 조회 로그 기록
  const handleOpenDetail = async (req) => {
    setSelectedReq(req);
    
    // 모달 수정 필드 초기화
    setEditPatientNo(req.patient_no);
    setEditPatientName(req.patient_name);
    setEditClinicDept(req.clinic_dept);
    setEditClinicDate(req.clinic_date || '');
    setEditDiscountAmount(Number(req.discount_amount || 0));
    setEditAdminNotes(req.admin_notes || '');
    setEditStatus(req.status);

    setModalOpen(true);
    setModalLoading(true);

    try {
      // 1. 조회 감사 로그 (access_logs) 삽입
      await supabase.from('access_logs').insert({
        request_id: req.id,
        accessed_by_email: currentUser.email,
        accessed_by_name: currentUser.user_metadata.full_name,
        action: '상세조회'
      });

      // 2. 이력 및 로그 로드
      await fetchHistoryLogs(req.id);
    } catch (err) {
      console.error('로그 적재 및 내역 조회 중 오류:', err);
    } finally {
      setModalLoading(false);
    }
  };

  // 상세 이력 로그 데이터 수집
  const fetchHistoryLogs = async (requestId) => {
    try {
      // 상태 변경 이력
      const { data: sLogs } = await supabase
        .from('request_status_logs')
        .select('*')
        .eq('request_id', requestId)
        .order('changed_at', { ascending: false });
      
      // 수정 이력
      const { data: eLogs } = await supabase
        .from('request_edit_logs')
        .select('*')
        .eq('request_id', requestId)
        .order('edited_at', { ascending: false });

      // 조회 이력
      const { data: aLogs } = await supabase
        .from('access_logs')
        .select('*')
        .eq('request_id', requestId)
        .order('accessed_at', { ascending: false });

      setStatusLogs(sLogs || []);
      setEditLogs(eLogs || []);
      setAccessLogs(aLogs || []);
    } catch (err) {
      console.error(err);
    }
  };

  // 정보 수정 및 금액 입력 저장
  const handleSaveEdit = async () => {
    if (!editPatientNo || !editPatientName || !editClinicDept || !editClinicDate) {
      alert('병록번호, 이름, 진료과, 진료일자는 빈 칸으로 둘 수 없습니다.');
      return;
    }

    if (isNaN(editDiscountAmount) || editDiscountAmount < 0) {
      alert('올바른 감면금액을 입력해 주세요.');
      return;
    }

    setModalLoading(true);
    try {
      const email = currentUser.email;
      const userName = currentUser.user_metadata.full_name;

      // 1. 수정 이력 변경 사항 파악하여 로깅 준비
      const editRecords = [];
      const original = selectedReq;

      const checkFieldChange = (fieldName, beforeVal, afterVal) => {
        if (String(beforeVal) !== String(afterVal)) {
          editRecords.push({
            request_id: original.id,
            field_name: fieldName,
            before_value: String(beforeVal || ''),
            after_value: String(afterVal || ''),
            edited_by_email: email,
            edited_by_name: userName
          });
        }
      };

      checkFieldChange('patient_no', original.patient_no, editPatientNo.padStart(10, '0'));
      checkFieldChange('patient_name', original.patient_name, editPatientName);
      checkFieldChange('clinic_dept', original.clinic_dept, editClinicDept);
      checkFieldChange('clinic_date', original.clinic_date, editClinicDate);
      checkFieldChange('discount_amount', original.discount_amount, editDiscountAmount);
      checkFieldChange('admin_notes', original.admin_notes, editAdminNotes);

      // 2. 상태 변경 파악
      const statusChanged = original.status !== editStatus;

      // 3. 수정 로그 삽입
      if (editRecords.length > 0) {
        const { error: editErr } = await supabase.from('request_edit_logs').insert(editRecords);
        if (editErr) throw editErr;
      }

      // 4. 상태 로그 삽입
      if (statusChanged) {
        const { error: statErr } = await supabase.from('request_status_logs').insert({
          request_id: original.id,
          from_status: original.status,
          to_status: editStatus,
          changed_by_email: email,
          changed_by_name: userName
        });
        if (statErr) throw statErr;
      }

      // 5. discount_requests 갱신
      const updatedFields = {
        patient_no: editPatientNo.padStart(10, '0'),
        patient_name: editPatientName,
        clinic_dept: editClinicDept,
        clinic_date: editClinicDate,
        discount_amount: editDiscountAmount,
        admin_notes: editAdminNotes,
        status: editStatus
      };

      const { data: updatedReq, error: updateErr } = await supabase
        .from('discount_requests')
        .update(updatedFields)
        .eq('id', original.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      alert('신청 건 정보가 수정 저장되었습니다.');
      
      // 모달 데이터 리프레시 및 창 닫기
      setSelectedReq(updatedReq);
      setModalOpen(false);
      
      // 신청 목록 리프레시
      fetchRequests();

    } catch (err) {
      alert(`수정 사항 저장 중 에러가 발생했습니다: ${err.message}`);
    } finally {
      setModalLoading(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    return isoString.split('T')[0];
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 한글 필드명 맵핑 딕셔너리
  const getFieldKoreanName = (fieldName) => {
    const mapping = {
      patient_no: '병록번호',
      patient_name: '대상 이름',
      clinic_dept: '진료과',
      clinic_date: '진료일자',
      discount_amount: '감면금액',
      admin_notes: '원무메모'
    };
    return mapping[fieldName] || fieldName;
  };

  // 최종 결재완료(최종승인 / 반려) 상태인지 체크
  const isFinalApproved = selectedReq?.status === '최종승인' || selectedReq?.status === '반려';

  // 활성 상세 필터 개수 계산 (대상 이름·병록번호 제외)
  const activeFilterCount = [filterType, filterRelationship,
    filterClinicDept, filterClinicDate, filterReason, filterStatus,
    filterApplicantDept, filterApplicant, filterStartDate, filterEndDate
  ].filter(Boolean).length;

  return (
    <div>
      {/* 통합 검색 + 필터 컨테이너 */}
      <div className="search-filter-container">

        {/* 윗줄: 신청상태 / 이름 / 차트번호 / 조회 / 상세필터 */}
        <div className="search-filter-row">
          <div className="quick-search-field">
            <span className="quick-search-icon">👤</span>
            <input
              type="text"
              value={filterPatientName}
              onChange={(e) => setFilterPatientName(e.target.value)}
              placeholder="대상자 이름"
              className="quick-search-input"
            />
            {filterPatientName && (
              <button className="quick-search-clear" onClick={() => setFilterPatientName('')}>✕</button>
            )}
          </div>

          <div className="quick-search-field">
            <span className="quick-search-icon">🔢</span>
            <input
              type="text"
              inputMode="numeric"
              value={filterPatientNo}
              onChange={(e) => setFilterPatientNo(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="차트번호"
              className="quick-search-input"
            />
            {filterPatientNo && (
              <button className="quick-search-clear" onClick={() => setFilterPatientNo('')}>✕</button>
            )}
          </div>

          <button onClick={fetchRequests} className="btn btn-primary search-btn">조회</button>

          <button
            className={`btn search-filter-toggle ${filterPanelOpen ? 'active' : ''}`}
            onClick={() => setFilterPanelOpen(prev => !prev)}
          >
            ⚙️ 상세필터
            {activeFilterCount > 0 && (
              <span className="filter-badge">{activeFilterCount}</span>
            )}
            <span className={`filter-dropdown-arrow ${filterPanelOpen ? 'open' : ''}`}>▾</span>
          </button>
        </div>

        {/* 아랫줄: 상세필터 패널 */}
        {filterPanelOpen && (
          <div className="filter-dropdown-body">
            <div className="filter-groups-container">
              
              {/* 그룹 1: 진료 정보 */}
              <div className="filter-group">
                <div className="filter-group-label">🏥 진료 정보</div>
                <div className="filter-grid">
                  <div className="form-group">
                    <label className="form-label">진료과</label>
                    <select value={filterClinicDept} onChange={(e) => setFilterClinicDept(e.target.value)} className="form-select">
                      <option value="">전체</option>
                      {departments.map(d => (
                        <option key={d.name} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">진료일자</label>
                    <input type="date" value={filterClinicDate} onChange={(e) => setFilterClinicDate(e.target.value)} className="form-input" />
                  </div>
                </div>
              </div>

              {/* 그룹 2: 감면 정보 */}
              <div className="filter-group">
                <div className="filter-group-label">📋 감면 정보</div>
                <div className="filter-grid">
                  <div className="form-group">
                    <label className="form-label">감면구분</label>
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="form-select">
                      <option value="">전체</option>
                      <option value="외래">외래</option>
                      <option value="입원">입원</option>
                      <option value="검진">검진</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">감면 사유</label>
                    <select value={filterReason} onChange={(e) => setFilterReason(e.target.value)} className="form-select">
                      <option value="">전체</option>
                      {reasons.map(r => (
                        <option key={r.value} value={r.value}>{r.value}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 그룹 3: 신청자 정보 */}
              <div className="filter-group">
                <div className="filter-group-label">👤 신청자 정보</div>
                <div className="filter-grid">
                  <div className="form-group">
                    <label className="form-label">신청자 소속</label>
                    <input type="text" value={filterApplicantDept} onChange={(e) => setFilterApplicantDept(e.target.value)} placeholder="부서명 키워드" className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">신청자 이름</label>
                    <input type="text" value={filterApplicant} onChange={(e) => setFilterApplicant(e.target.value)} placeholder="신청 직원 성명" className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">신청자와의 관계</label>
                    <select value={filterRelationship} onChange={(e) => setFilterRelationship(e.target.value)} className="form-select">
                      <option value="">전체</option>
                      <option value="기타 (관계없음-감면등록용)">기타 (관계없음-감면등록용)</option>
                      <option value="본인/배우자">본인/배우자</option>
                      <option value="직계 (자녀,부모(본인 또는 배우자의))">직계 (자녀,부모(본인 또는 배우자의))</option>
                      <option value="방계 (본인 또는 배우자의)">방계 (본인 또는 배우자의)</option>
                      <option value="친인척/지인">친인척/지인</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 그룹 4: 처리 상태 및 기간 */}
              <div className="filter-group">
                <div className="filter-group-label">⏳ 처리 상태 및 기간</div>
                <div className="filter-grid">
                  <div className="form-group">
                    <label className="form-label">결재 상태</label>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-select">
                      <option value="">전체 상태</option>
                      <option value="신청완료">신청완료</option>
                      <option value="원무확인중">원무확인중</option>
                      <option value="재확인 필요">재확인 필요</option>
                      <option value="보완요청">보완요청</option>
                      <option value="담당자 승인">담당자 승인 (결재 대기)</option>
                      <option value="최종승인">최종승인</option>
                      <option value="반려">반려</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">조회 시작일</label>
                    <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">조회 종료일</label>
                    <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="form-input" />
                  </div>
                </div>
              </div>

            </div>

            <div className="filter-actions">
              <button onClick={handleResetFilters} className="btn btn-secondary">필터 초기화</button>
              <button onClick={() => { fetchRequests(); setFilterPanelOpen(false); }} className="btn btn-primary">조회하기</button>
            </div>
          </div>
        )}
      </div>

      {/* 2. 테이블 목록 섹션 */}
      <div className="glass-card">
        <div className="flex justify-between items-center" style={{ marginBottom: '20px' }}>
          <h2 className="log-section-title" style={{ fontSize: '18px', borderBottom: 'none', paddingBottom: 0 }}>업무 처리용 목록</h2>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>총 {requests.length} 건</span>
        </div>

        {loading ? (
          <div className="empty-state">신청 정보를 조회하는 중입니다...</div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <div className="empty-state-text">검색 조건에 맞는 감면 신청 내역이 없습니다.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table compact">
              <thead>
                <tr>
                  <th>신청일</th>
                  <th className="hide-on-mobile">신청자</th>
                  <th>대상자</th>
                  <th className="hide-on-mobile">감면구분</th>
                  <th className="hide-on-mobile">감면사유</th>
                  <th>상태</th>
                  <th className="hide-on-mobile">기능</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} onClick={() => handleOpenDetail(req)}>
                    <td>{formatDate(req.created_at)}</td>
                    <td className="hide-on-mobile">{req.applicant_name} ({req.applicant_dept})</td>
                    <td>{req.patient_name}</td>
                    <td className="hide-on-mobile">{req.discount_type}</td>
                    <td className="hide-on-mobile">{req.reason_category}</td>
                    <td>
                      <span className={`status-badge status-${req.status.replace(/\s+/g, '-')}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="hide-on-mobile">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(req);
                        }} 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        상세/수정
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. 상세조회 및 정보 수정 모달 */}
      {modalOpen && selectedReq && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">감면 신청 상세 정보 및 업무 수정</h3>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)}>&times;</button>
            </div>

            <div className="modal-body">
              {modalLoading ? (
                <div className="empty-state">데이터를 업데이트 및 기록하는 중입니다...</div>
              ) : (
                <>
                  {/* 신청자 인적정보 영역 */}
                  {/* 신청자 인적정보 영역 (토글) */}
                  <div 
                    className="log-section-title" 
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    onClick={() => setBasicInfoOpen(!basicInfoOpen)}
                  >
                    <span>신청 기본 정보 {basicInfoOpen ? '▲' : '▼'}</span>
                  </div>
                  
                  {basicInfoOpen && (
                    <div className="detail-grid" style={{ marginBottom: '24px' }}>
                      <div className="detail-item">
                        <div className="detail-label">신청자 이메일</div>
                        <div className="detail-value">{selectedReq.applicant_email}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">신청자 성명 / 부서</div>
                        <div className="detail-value">{selectedReq.applicant_name} ({selectedReq.applicant_dept})</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">신청 일시</div>
                        <div className="detail-value">{formatDateTime(selectedReq.created_at)}</div>
                      </div>
                      <div className="detail-item">
                        <div className="detail-label">접속 IP</div>
                        <div className="detail-value">{selectedReq.ip_address || '기록 안됨'}</div>
                      </div>
                      <div className="detail-item-full">
                        <div className="detail-label">신청 사유 상세 설명</div>
                        <div className="detail-value" style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '4px' }}>
                          {selectedReq.details || '입력된 상세 내역이 없습니다.'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 원무팀 입력 수정 영역 */}
                  <div className="log-section-title">원무 업무 처리 내용 {isFinalApproved && <span style={{ color: 'var(--status-rejected)', fontSize: '12px', marginLeft: '10px' }}>(최종 결재 완료 건 - 수정 불가)</span>}</div>
                  
                  {isFinalApproved && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '13px', fontWeight: '500' }}>
                      ⚠️ 최종 결재가 완료된 건(최종승인/반려)은 직접 수정이 차단되어 있습니다. 정정이 필요할 경우, 원무팀장 권한으로 승인을 취소한 후에만 수정이 가능합니다.
                    </div>
                  )}

                  <div className="form-grid" style={{ marginBottom: '24px', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div className="form-group">
                      <label className="form-label required">병록번호 수정</label>
                      <input 
                        type="text" 
                        value={editPatientNo} 
                        onChange={(e) => setEditPatientNo(e.target.value)} 
                        disabled={isFinalApproved}
                        className="form-input" 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label required">대상 이름 수정</label>
                      <input 
                        type="text" 
                        value={editPatientName} 
                        onChange={(e) => setEditPatientName(e.target.value)} 
                        disabled={isFinalApproved}
                        className="form-input" 
                      />
                    </div>
                    {/* 대상 이름 옆에 신청자와의 관계 표시 (수정 불가/참고용) */}
                    <div className="form-group">
                      <label className="form-label">신청자와의 관계 (참고)</label>
                      <input 
                        type="text" 
                        value={selectedReq.relationship || ''} 
                        disabled 
                        className="form-input" 
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label required">진료과 수정</label>
                      <select 
                        value={editClinicDept} 
                        onChange={(e) => setEditClinicDept(e.target.value)} 
                        disabled={isFinalApproved}
                        className="form-select"
                      >
                        {departments.map(d => (
                          <option key={d.name} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label required">진료일자 수정</label>
                      <input 
                        type="date" 
                        value={editClinicDate} 
                        onChange={(e) => setEditClinicDate(e.target.value)} 
                        disabled={isFinalApproved}
                        className="form-input" 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label required">감면금액 입력 (원화)</label>
                      <input 
                        type="number" 
                        value={editDiscountAmount} 
                        onChange={(e) => setEditDiscountAmount(Number(e.target.value))} 
                        disabled={isFinalApproved}
                        placeholder="숫자만 입력"
                        className="form-input" 
                      />
                    </div>
                    <div className="form-group-full form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">원무팀 확인 메모 (반려 시 요청사항 포함)</label>
                      <textarea 
                        value={editAdminNotes} 
                        onChange={(e) => setEditAdminNotes(e.target.value)} 
                        disabled={isFinalApproved}
                        placeholder="팀 내부에서 공유할 조치 사항 또는 확인 메모 입력"
                        className="form-textarea"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label required">처리상태 변경</label>
                      <select 
                        value={editStatus} 
                        onChange={(e) => setEditStatus(e.target.value)} 
                        disabled={isFinalApproved}
                        className="form-select"
                      >
                        {/* 원무팀 처리상태 변경 옵션 간소화: 보완요청, 담당자 승인, 반려 노출 */}
                        {editStatus !== '보완요청' && editStatus !== '담당자 승인' && editStatus !== '반려' && (
                          <option value={editStatus} disabled>{editStatus}</option>
                        )}
                        <option value="보완요청">보완요청</option>
                        <option value="담당자 승인">담당자 승인</option>
                        <option value="반려">반려</option>
                      </select>
                    </div>
                  </div>

                  {/* 로그 히스토리 뷰어 */}
                  <div className="responsive-grid" style={{ gap: '20px' }}>
                    <div>
                      <div className="log-section-title">상태 변경 & 정보 수정 이력</div>
                      <div className="log-timeline">
                        {statusLogs.map(l => (
                          <div key={l.id} className="log-entry">
                            <div className="log-meta">{formatDateTime(l.changed_at)} | {l.changed_by_name} ({l.changed_by_email})</div>
                            <div className="log-msg">
                              상태를 <span className="highlight">'{l.from_status || '최초신청'}'</span>에서 <span className="highlight">'{l.to_status}'</span>(으)로 변경
                            </div>
                          </div>
                        ))}
                        {editLogs.map(l => (
                          <div key={l.id} className="log-entry">
                            <div className="log-meta">{formatDateTime(l.edited_at)} | {l.edited_by_name} ({l.edited_by_email})</div>
                            <div className="log-msg">
                              항목 <span className="highlight">[{getFieldKoreanName(l.field_name)}]</span> 수정: 
                              {l.field_name === 'discount_amount' ? (
                                ` ${Number(l.before_value).toLocaleString()}원 ➔ ${Number(l.after_value).toLocaleString()}원`
                              ) : (
                                ` '${l.before_value}' ➔ '${l.after_value}'`
                              )}
                            </div>
                          </div>
                        ))}
                        {statusLogs.length === 0 && editLogs.length === 0 && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>변경 기록이 존재하지 않습니다.</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="log-section-title">원무팀/팀장 상세조회 감사로그 (조회이력)</div>
                      <div className="log-timeline">
                        {accessLogs.map(l => (
                          <div key={l.id} className="log-entry">
                            <div className="log-meta">{formatDateTime(l.accessed_at)}</div>
                            <div className="log-msg">
                              <span className="highlight">{l.accessed_by_name}</span> ({l.accessed_by_email}) 가 신청서 정보를 상세 조회함
                            </div>
                          </div>
                        ))}
                        {accessLogs.length === 0 && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>조회 기록이 아직 기록되지 않았습니다.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setModalOpen(false)} className="btn btn-secondary">닫기</button>
              <button 
                onClick={handleSaveEdit} 
                disabled={modalLoading || isFinalApproved} 
                className="btn btn-primary"
              >
                변경 및 금액 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
