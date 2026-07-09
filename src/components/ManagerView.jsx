import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function ManagerView({ currentUser }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // 대시보드 통계 상태
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalCount: 0,
    approvedCount: 0,
    approvedAmount: 0,
    pendingCount: 0,
    typeStats: {},
    reasonStats: {},
    deptStats: {}
  });

  // 조회 이력 및 결재 히스토리
  const [statusLogs, setStatusLogs] = useState([]);
  const [editLogs, setEditLogs] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);

  // 고급 상세 필터 상태
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPatientNo, setFilterPatientNo] = useState('');
  const [filterPatientName, setFilterPatientName] = useState('');
  const [filterRelationship, setFilterRelationship] = useState('');
  const [filterClinicDept, setFilterClinicDept] = useState('');
  const [filterClinicDate, setFilterClinicDate] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [filterApplicantDept, setFilterApplicantDept] = useState('');
  const [filterApplicant, setFilterApplicant] = useState('');

  // 마스터 데이터
  const [departments, setDepartments] = useState([]);
  const [reasons, setReasons] = useState([]);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    fetchMasterData();
    fetchAllData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const { data } = await supabase.from('clinic_departments').select('name').order('name');
      if (data) {
        const sortedDepts = [...data].sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
        setDepartments(sortedDepts);
      }
      const { data: codeData } = await supabase.from('code_options').select('value').eq('category', 'discount_reason').order('sort_order');
      if (codeData) setReasons(codeData);
    } catch (err) {
      console.error(err);
    }
  };

  // 전체 데이터 로드 및 통계 연산
  const fetchAllData = async () => {
    setLoading(true);
    setCurrentPage(1); // 조회 시 항상 1페이지로
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
      calculateStats(data || []);
    } catch (err) {
      alert(`내역 조회 중 오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 대시보드 통계 계산
  const calculateStats = (dataList) => {
    let totalAmt = 0;
    let totalCnt = dataList.length;
    let approvedCnt = 0;
    let approvedAmt = 0;
    let pendingCnt = 0;

    const types = {};
    const reasons = {};
    const depts = {};

    dataList.forEach(item => {
      const amount = Number(item.discount_amount || 0);
      totalAmt += amount;

      if (item.status === '최종승인') {
        approvedCnt++;
        approvedAmt += amount;
      } else if (item.status === '신청완료' || item.status === '원무확인중' || item.status === '담당자 승인') {
        pendingCnt++;
      }

      // 구분별 통계
      const typeKey = item.discount_type;
      if (!types[typeKey]) types[typeKey] = { count: 0, amount: 0 };
      types[typeKey].count++;
      types[typeKey].amount += amount;

      // 사유별 통계
      const reasonKey = item.reason_category;
      if (!reasons[reasonKey]) reasons[reasonKey] = { count: 0, amount: 0 };
      reasons[reasonKey].count++;
      reasons[reasonKey].amount += amount;

      // 부서별 통계
      const deptKey = item.applicant_dept;
      if (!depts[deptKey]) depts[deptKey] = { count: 0, amount: 0 };
      depts[deptKey].count++;
      depts[deptKey].amount += amount;
    });

    setStats({
      totalAmount: totalAmt,
      totalCount: totalCnt,
      approvedCount: approvedCnt,
      approvedAmount: approvedAmt,
      pendingCount: pendingCnt,
      typeStats: types,
      reasonStats: reasons,
      deptStats: depts
    });
  };

  // 상세 창 오픈 및 조회 감사 로그 등록
  const handleOpenDetail = async (req) => {
    setSelectedReq(req);
    setModalOpen(true);
    setModalLoading(true);

    try {
      // 1. 조회 이력 access_logs 적재
      await supabase.from('access_logs').insert({
        request_id: req.id,
        accessed_by_email: currentUser.email,
        accessed_by_name: currentUser.user_metadata.full_name,
        action: '상세조회'
      });

      // 2. 이력 로드
      await fetchHistoryLogs(req.id);
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const fetchHistoryLogs = async (requestId) => {
    try {
      const { data: sLogs } = await supabase.from('request_status_logs').select('*').eq('request_id', requestId).order('changed_at', { ascending: false });
      const { data: eLogs } = await supabase.from('request_edit_logs').select('*').eq('request_id', requestId).order('edited_at', { ascending: false });
      const { data: aLogs } = await supabase.from('access_logs').select('*').eq('request_id', requestId).order('accessed_at', { ascending: false });

      setStatusLogs(sLogs || []);
      setEditLogs(eLogs || []);
      setAccessLogs(aLogs || []);
    } catch (err) {
      console.error(err);
    }
  };

  // 최종 결재 처리 (최종승인 / 반려 / 취소 / 승인취소)
  const handleUpdateStatus = async (targetStatus) => {
    if (!selectedReq) return;

    let actionReason = '';
    if (targetStatus === '반려' || targetStatus === '원무확인중') {
      const promptMsg = targetStatus === '반려' 
        ? '반려 사유를 입력해주세요. (입력된 사유는 원무팀 메모에 추가됩니다)' 
        : '취소/재확인 요청 사유를 입력해주세요. (입력된 사유는 원무팀 메모에 추가됩니다)';
      
      const reason = window.prompt(promptMsg);
      if (reason === null) return; // 취소 클릭 시 중단
      if (reason.trim()) {
        actionReason = reason.trim();
      }
    }

    setModalLoading(true);
    try {
      const email = currentUser.email;
      const userName = currentUser.user_metadata.full_name;

      // 1. 상태 변경 로그 등록
      const { error: logErr } = await supabase.from('request_status_logs').insert({
        request_id: selectedReq.id,
        from_status: selectedReq.status,
        to_status: targetStatus,
        changed_by_email: email,
        changed_by_name: userName
      });
      if (logErr) throw logErr;

      // 2. 신청서 상태 및 원무 메모 갱신
      let updatedNotes = selectedReq.admin_notes || '';
      if (actionReason) {
        const timestamp = new Date().toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const prefix = targetStatus === '반려' ? '[반려 사유]' : '[결재취소 사유]';
        updatedNotes = updatedNotes ? `${updatedNotes}\n\n${prefix} ${timestamp} - ${userName}:\n${actionReason}` : `${prefix} ${timestamp} - ${userName}:\n${actionReason}`;
      }

      const { data: updatedReq, error: reqErr } = await supabase
        .from('discount_requests')
        .update({ status: targetStatus, admin_notes: updatedNotes })
        .eq('id', selectedReq.id)
        .select()
        .single();

      if (reqErr) throw reqErr;

      alert(`결재 상태가 [${targetStatus}](으)로 처리되었습니다.`);
      setSelectedReq(updatedReq);
      setModalOpen(false);
      fetchAllData(); // 목록 및 통계 리프레시
    } catch (err) {
      alert(`처리 중 에러 발생: ${err.message}`);
    } finally {
      setModalLoading(false);
    }
  };

  // 엑셀 내보내기 (한글 깨짐을 방지하기 위해 UTF-8 BOM 처리된 CSV)
  const handleExportCSV = () => {
    if (requests.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const headers = [
      '신청일자', '신청자 성명', '신청 부서', '병록번호', '대상자 성명', 
      '관계', '진료일자', '진료과', '감면구분', '감면사유', '감면금액', '처리상태', 'IP 주소', '원무 메모'
    ];

    const rows = requests.map(req => [
      formatDate(req.created_at),
      req.applicant_name,
      req.applicant_dept,
      `'${req.patient_no}`, // 병록번호 앞자리 0이 엑셀에서 사라지는 현상 방지
      req.patient_name,
      req.relationship,
      req.clinic_date || '',
      req.clinic_dept,
      req.discount_type,
      req.reason_category,
      req.discount_amount,
      req.status,
      req.ip_address || '',
      (req.admin_notes || '').replace(/\r?\n/g, ' ') // 줄바꿈을 띄어쓰기로 대체
    ]);

    // CSV 파일 조합
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      // 콤마나 따옴표 처리
      const escapedRow = row.map(val => {
        let stringVal = String(val);
        if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
          stringVal = `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      });
      csvContent += escapedRow.join(',') + '\n';
    });

    // 한글 인코딩 깨짐을 막는 UTF-8 BOM 문자 (\uFEFF) 삽입
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `병원감면신청내역_${formatDate(new Date().toISOString())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // 가장 비율이 큰 값을 기준으로 통계 그래프 너비 계산
  const getMaxStats = (statsObj) => {
    let max = 0;
    Object.values(statsObj).forEach(val => {
      if (val.amount > max) max = val.amount;
    });
    return max || 1;
  };

  const maxTypeAmount = getMaxStats(stats.typeStats);
  const maxReasonAmount = getMaxStats(stats.reasonStats);
  const maxDeptAmount = getMaxStats(stats.deptStats);

  // 한글 필드명 맵핑
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

  const totalPages = Math.max(1, Math.ceil(requests.length / ITEMS_PER_PAGE));
  const paginatedRequests = requests.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const activeFilterCount = [
    filterStartDate, filterEndDate, filterStatus, filterType, filterPatientNo, filterPatientName, filterRelationship, filterClinicDept, filterClinicDate, filterReason, filterApplicantDept, filterApplicant
  ].filter(Boolean).length;

  return (
    <div>
      {/* 1. 통계 요약 카드 영역 */}
      <div className="responsive-stats stats-grid">
        <div className="stat-card">
          <div className="stat-label">전체 감면 신청 건수</div>
          <div className="stat-value">{stats.totalCount}건</div>
          <div className="stat-sub">현재 조건 필터 기준 건수</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">최종 승인 완료 건수</div>
          <div className="stat-value">{stats.approvedCount}건</div>
          <div className="stat-sub">승인 완료 비율: {stats.totalCount ? Math.round((stats.approvedCount / stats.totalCount) * 100) : 0}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">누적 감면 적용 금액</div>
          <div className="stat-value">{stats.approvedAmount.toLocaleString()}원</div>
          <div className="stat-sub">최종 승인 완료 금액의 합계</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(217, 119, 6, 0.3)' }}>
          <div className="stat-label">결재 처리 대기 건수</div>
          <div className="stat-value" style={{ color: '#d97706' }}>{stats.pendingCount}건</div>
          <div className="stat-sub">승인/반려 결정 보류 중인 신청 건</div>
        </div>
      </div>

      {/* 2. 시각화 통계 섹션 (Vanilla CSS Bar Charts) */}
      <div className="analytics-section" style={{ marginBottom: '24px' }}>
        {/* 감면구분별 통계 */}
        <div className="glass-card">
          <h3 className="form-label" style={{ fontSize: '15px', color: '#1e293b', marginBottom: '20px' }}>감면구분별 통계 (누적 금액 기준)</h3>
          <div className="bar-chart-container">
            {Object.keys(stats.typeStats).length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>데이터가 존재하지 않습니다.</div>
            ) : (
              Object.entries(stats.typeStats).map(([key, value]) => {
                const widthPercent = Math.max(5, Math.round((value.amount / maxTypeAmount) * 100));
                return (
                  <div key={key} className="bar-chart-row">
                    <div className="bar-chart-info">
                      <span className="bar-chart-label">{key} ({value.count}건)</span>
                      <span className="bar-chart-value">{value.amount.toLocaleString()}원</span>
                    </div>
                    <div className="bar-chart-track">
                      <div className="bar-chart-fill" style={{ width: `${widthPercent}%`, background: 'linear-gradient(to right, #6366f1, #06b6d4)' }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 감면사유별 통계 */}
        <div className="glass-card">
          <h3 className="form-label" style={{ fontSize: '15px', color: '#1e293b', marginBottom: '20px' }}>감면사유별 통계 (누적 금액 기준)</h3>
          <div className="bar-chart-container">
            {Object.keys(stats.reasonStats).length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>데이터가 존재하지 않습니다.</div>
            ) : (
              Object.entries(stats.reasonStats).map(([key, value]) => {
                const widthPercent = Math.max(5, Math.round((value.amount / maxReasonAmount) * 100));
                return (
                  <div key={key} className="bar-chart-row">
                    <div className="bar-chart-info">
                      <span className="bar-chart-label">{key} ({value.count}건)</span>
                      <span className="bar-chart-value">{value.amount.toLocaleString()}원</span>
                    </div>
                    <div className="bar-chart-track">
                      <div className="bar-chart-fill" style={{ width: `${widthPercent}%`, background: 'linear-gradient(to right, #ec4899, #8b5cf6)' }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 부서별 통계 */}
        <div className="glass-card" style={{ gridColumn: 'span 2' }}>
          <h3 className="form-label" style={{ fontSize: '15px', color: '#1e293b', marginBottom: '20px' }}>부서별 누적 감면 금액 현황</h3>
          <div className="bar-chart-container">
            {Object.keys(stats.deptStats).length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>데이터가 존재하지 않습니다.</div>
            ) : (
              Object.entries(stats.deptStats).map(([key, value]) => {
                const widthPercent = Math.max(5, Math.round((value.amount / maxDeptAmount) * 100));
                return (
                  <div key={key} className="bar-chart-row">
                    <div className="bar-chart-info">
                      <span className="bar-chart-label">{key} ({value.count}건)</span>
                      <span className="bar-chart-value">{value.amount.toLocaleString()}원</span>
                    </div>
                    <div className="bar-chart-track">
                      <div className="bar-chart-fill" style={{ width: `${widthPercent}%`, background: 'linear-gradient(to right, #06b6d4, #10b981)' }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. 결재 대기 목록 & 엑셀 전체 목록 필터링 */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 className="log-section-title" style={{ fontSize: '18px', borderBottom: 'none', paddingBottom: 0, margin: 0 }}>전체 감면 결재 및 관리 대시보드</h2>
          <button onClick={handleExportCSV} className="btn btn-accent hide-on-mobile" style={{ padding: '8px 12px', fontSize: '13px', whiteSpace: 'nowrap' }}>
            엑셀 다운로드
          </button>
        </div>

        {/* 상세 검색/필터 영역 */}
        <div className="search-filter-container">
          <div className="search-filter-row">
            <div className="quick-search-field">
              <span className="quick-search-icon">🔍</span>
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

            <button onClick={fetchAllData} className="btn btn-primary search-btn">조회</button>

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

          {filterPanelOpen && (
            <div className="filter-dropdown-body">
              <div className="filter-groups-container">
                
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
                      </select>
                    </div>
                  </div>
                </div>

                <div className="filter-group">
                  <div className="filter-group-label">⏳ 처리 상태 및 기간</div>
                  <div className="filter-grid">
                    <div className="form-group">
                      <label className="form-label">결재 상태</label>
                      <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-select">
                        <option value="">전체 상태</option>
                        <option value="신청완료">신청완료</option>
                        <option value="원무확인중">원무확인중</option>
                        <option value="보완요청">보완요청</option>
                        <option value="담당자 승인">담당자 승인 (결재 대기)</option>
                        <option value="최종승인">최종승인</option>
                        <option value="반려">반려</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">조회 기간 (시작)</label>
                      <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">조회 기간 (종료)</label>
                      <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="form-input" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="filter-actions">
                <button 
                  onClick={() => {
                    setFilterStartDate(''); setFilterEndDate(''); setFilterStatus(''); setFilterType('');
                    setFilterPatientNo(''); setFilterPatientName(''); setFilterRelationship('');
                    setFilterClinicDept(''); setFilterClinicDate(''); setFilterReason('');
                    setFilterApplicantDept(''); setFilterApplicant('');
                  }} 
                  className="btn btn-secondary"
                >
                  초기화
                </button>
                <button onClick={fetchAllData} className="btn btn-primary">상세 조건 적용</button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="empty-state">신청 정보를 조회 중입니다...</div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">조건에 부합하는 결재 건이 존재하지 않습니다.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table compact">
              <thead>
                <tr>
                  <th>신청일</th>
                  <th className="hide-on-mobile">신청부서</th>
                  <th className="hide-on-mobile">신청자</th>
                  <th>대상자(병록번호)</th>
                  <th className="hide-on-mobile">구분</th>
                  <th className="hide-on-mobile">사유</th>
                  <th className="hide-on-mobile">감면금액</th>
                  <th>상태</th>
                  <th className="hide-on-mobile">결재</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map((req) => (
                  <tr key={req.id} onClick={() => handleOpenDetail(req)}>
                    <td>{formatDate(req.created_at)}</td>
                    <td className="hide-on-mobile">{req.applicant_dept}</td>
                    <td className="hide-on-mobile">{req.applicant_name}</td>
                    <td>{req.patient_name} ({req.patient_no})</td>
                    <td className="hide-on-mobile">{req.discount_type}</td>
                    <td className="hide-on-mobile">{req.reason_category}</td>
                    <td className="hide-on-mobile" style={{ fontWeight: '600' }}>{Number(req.discount_amount).toLocaleString()}원</td>
                    <td>
                      <span className={`status-badge status-${req.status.replace(/\s+/g, '-')}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="hide-on-mobile">
                      {req.status === '담당자 승인' ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(req);
                          }} 
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          결재심사
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(req);
                          }} 
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          상세보기
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', padding: '16px 0', borderTop: '1px solid #e5e7eb', marginTop: '16px' }}>
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >이전</button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '14px', fontWeight: '500', color: '#475569' }}>
                {currentPage} / {totalPages} 페이지
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >다음</button>
            </div>
          </div>
        )}
      </div>

      {/* 4. 결재 처리 모달 팝업 */}
      {modalOpen && selectedReq && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">감면 결재 최종 승인 심사</h3>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)}>&times;</button>
            </div>

            <div className="modal-body">
              {modalLoading ? (
                <div className="empty-state">결재 내역을 갱신 중입니다...</div>
              ) : (
                <>
                  {/* 상세 정보 */}
                  <div className="log-section-title">감면 상세 기재 사항</div>
                  <div className="detail-grid" style={{ marginBottom: '20px' }}>
                    <div className="detail-item">
                      <div className="detail-label">신청자 이메일</div>
                      <div className="detail-value">{selectedReq.applicant_email}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">신청자 성명 / 부서</div>
                      <div className="detail-value">{selectedReq.applicant_name} ({selectedReq.applicant_dept})</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">환자 병록번호</div>
                      <div className="detail-value" style={{ color: '#fbbf24', fontWeight: 'bold' }}>{selectedReq.patient_no}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">환자 성명 (관계)</div>
                      <div className="detail-value">{selectedReq.patient_name} ({selectedReq.relationship})</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">진료과 분류</div>
                      <div className="detail-value">{selectedReq.clinic_dept}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">진료일자</div>
                      <div className="detail-value">{selectedReq.clinic_date || '미기입'}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">감면 구분</div>
                      <div className="detail-value">{selectedReq.discount_type} / {selectedReq.reason_category}</div>
                    </div>
                    <div className="detail-item-full">
                      <div className="detail-label">신청 사유 상세내용</div>
                      <div className="detail-value" style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '4px' }}>
                        {selectedReq.details || '상세내용 없음'}
                      </div>
                    </div>
                  </div>

                  <div className="log-section-title">원무팀 검토 및 조치 사항</div>
                  <div className="detail-grid" style={{ marginBottom: '24px' }}>
                    <div className="detail-item">
                      <div className="detail-label">원무팀 산정 감면 금액</div>
                      <div className="detail-value" style={{ fontSize: '18px', color: '#22d3ee', fontWeight: '700' }}>
                        {Number(selectedReq.discount_amount).toLocaleString()}원
                      </div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">원무 검토 처리상태</div>
                      <div className="detail-value">
                        <span className={`status-badge status-${selectedReq.status.replace(/\s+/g, '-')}`}>
                          {selectedReq.status}
                        </span>
                      </div>
                    </div>
                    <div className="detail-item-full">
                      <div className="detail-label">원무팀 확인 메모</div>
                      <div className="detail-value" style={{ fontStyle: 'italic', color: '#cbd5e1' }}>
                        {selectedReq.admin_notes || '작성된 원무 메모가 없습니다.'}
                      </div>
                    </div>
                  </div>

                  {/* 로그 타임라인 */}
                  <div className="responsive-grid" style={{ gap: '20px' }}>
                    <div>
                      <div className="log-section-title">상태 변경 & 정보 수정 이력</div>
                      <div className="log-timeline">
                        {statusLogs.map(l => (
                          <div key={l.id} className="log-entry">
                            <div className="log-meta">{formatDateTime(l.changed_at)} | {l.changed_by_name}</div>
                            <div className="log-msg">
                              상태 변경: <span className="highlight">'{l.from_status || '최초신청'}'</span> ➔ <span className="highlight">'{l.to_status}'</span>
                            </div>
                          </div>
                        ))}
                        {editLogs.map(l => (
                          <div key={l.id} className="log-entry">
                            <div className="log-meta">{formatDateTime(l.edited_at)} | {l.edited_by_name}</div>
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
                      </div>
                    </div>

                    <div>
                      <div className="log-section-title">상세조회 감사로그 (접근 로그)</div>
                      <div className="log-timeline">
                        {accessLogs.map(l => (
                          <div key={l.id} className="log-entry">
                            <div className="log-meta">{formatDateTime(l.accessed_at)}</div>
                            <div className="log-msg">
                              <span className="highlight">{l.accessed_by_name}</span> ({l.accessed_by_email}) 가 조회함
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setModalOpen(false)} className="btn btn-secondary">닫기</button>
              
              {/* 결재 대기 중(담당자 승인) 상태일 때만 승인/반려 노출 */}
              {selectedReq.status === '담당자 승인' && (
                <>
                  <button onClick={() => handleUpdateStatus('반려')} className="btn btn-danger">반려 처리</button>
                  <button onClick={() => handleUpdateStatus('최종승인')} className="btn btn-primary">최종 승인</button>
                </>
              )}

              {/* 이미 결재 완료된 상태면 승인 취소(원무확인중으로 복구) 기능 지원 */}
              {(selectedReq.status === '최종승인' || selectedReq.status === '반려') && (
                <button 
                  onClick={() => handleUpdateStatus('원무확인중')} 
                  className="btn btn-accent" 
                  title="승인을 취소하고 원무팀이 세부 내역을 재조정할 수 있도록 상태를 원무확인중으로 되돌립니다."
                >
                  최종결재 취소 (내용 정정용)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
