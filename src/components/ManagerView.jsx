import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';
import * as XLSX from 'xlsx';

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
    deptStats: {},
    clinicDeptStats: {},
    relationshipStats: {},
    statusStats: {},
    monthlyStats: []
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
  const [relationships, setRelationships] = useState([]);
  const [discountTypes, setDiscountTypes] = useState([]);
  const [userNamesMap, setUserNamesMap] = useState({});

  // 페이지네이션 및 정렬 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const ITEMS_PER_PAGE = 20;

  // 차트 색상 팔레트 (지정된 브랜드 컬러 및 파생 색상)
  const COLORS = ['#004680', '#39a845', '#ffca4b', '#2a6b9c', '#5ab764', '#ffd36c', '#558fb8', '#7bc584', '#ffdc8c'];

  // 엑셀/구글시트 가져오기 모달 상태
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [parsedImportData, setParsedImportData] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [defaultImportStatus, setDefaultImportStatus] = useState('최종승인');

  useEffect(() => {
    fetchMasterData();
  }, []);

  // 필터 상태 변경 시 대시보드 및 목록 즉시 갱신
  useEffect(() => {
    fetchAllData();
  }, [
    filterStartDate, filterEndDate, filterStatus, filterType, 
    filterPatientNo, filterPatientName, filterRelationship, 
    filterClinicDept, filterClinicDate, filterReason, 
    filterApplicantDept, filterApplicant
  ]);

  // 대시보드 차트/항목 클릭 시 필터 토글
  const handleFilterToggle = (category, value) => {
    switch (category) {
      case 'status':
        setFilterStatus(prev => prev === value ? '' : value);
        break;
      case 'type':
        setFilterType(prev => prev === value ? '' : value);
        break;
      case 'reason':
        setFilterReason(prev => prev === value ? '' : value);
        break;
      case 'relationship':
        setFilterRelationship(prev => prev === value ? '' : value);
        break;
      case 'applicantDept':
        setFilterApplicantDept(prev => prev === value ? '' : value);
        break;
      case 'clinicDept':
        setFilterClinicDept(prev => prev === value ? '' : value);
        break;
      default:
        break;
    }
  };

  // 꺾은선 차트 연월(YYYY-MM) 클릭 시 해당 월 시작일~종료일 필터링
  const handleMonthFilterToggle = (monthStr) => {
    if (!monthStr || typeof monthStr !== 'string') return;
    const parts = monthStr.split('-');
    if (parts.length !== 2) return;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return;

    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    if (filterStartDate === startDateStr && filterEndDate === endDateStr) {
      setFilterStartDate('');
      setFilterEndDate('');
    } else {
      setFilterStartDate(startDateStr);
      setFilterEndDate(endDateStr);
    }
  };

  const getActiveMonthString = () => {
    if (!filterStartDate || !filterEndDate) return '';
    const startPart = filterStartDate.slice(0, 7);
    const endPart = filterEndDate.slice(0, 7);
    if (startPart === endPart) return startPart;
    return `${filterStartDate} ~ ${filterEndDate}`;
  };

  const fetchMasterData = async () => {
    try {
      // 최신 사용자 이름 맵 구성
      const { data: userData } = await supabase.from('users').select('email, name');
      if (userData) {
        const uMap = {};
        userData.forEach(u => {
          if (u.email && u.name) uMap[u.email] = u.name;
        });
        setUserNamesMap(uMap);
      }

      const { data } = await supabase.from('clinic_departments').select('name').order('name');
      if (data) {
        const sortedDepts = [...data].sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
        setDepartments(sortedDepts);
      }
      const { data: codeData } = await supabase.from('code_options').select('category, value').order('sort_order');
      if (codeData) {
        setReasons(codeData.filter(c => c.category === 'discount_reason'));
        setRelationships(codeData.filter(c => c.category === 'relationship'));
        setDiscountTypes(codeData.filter(c => c.category === 'discount_type'));
      }
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
    const clinicDepts = {};
    const relations = {};
    const statuses = {};
    const monthly = {};

    dataList.forEach(item => {
      const amount = Number(item.discount_amount || 0);
      totalAmt += amount;

      if (item.status === '최종승인') {
        approvedCnt++;
        approvedAmt += amount;
      } else if (item.status === '신청완료' || item.status === '원무확인중' || item.status === '담당자 승인') {
        pendingCnt++;
      }

      // 결재상태별 통계 (전체 데이터 기준)
      const statusKey = item.status || '미분류';
      if (!statuses[statusKey]) statuses[statusKey] = { count: 0, amount: 0 };
      statuses[statusKey].count++;
      statuses[statusKey].amount += amount;

      // 나머지 통계는 모두 '최종승인'된 데이터만 기준
      if (item.status === '최종승인') {
        // 구분별 통계
        const typeKey = item.discount_type || '미분류';
        if (!types[typeKey]) types[typeKey] = { count: 0, amount: 0 };
        types[typeKey].count++;
        types[typeKey].amount += amount;

        // 사유별 통계
        const reasonKey = item.reason_category || '미분류';
        if (!reasons[reasonKey]) reasons[reasonKey] = { count: 0, amount: 0 };
        reasons[reasonKey].count++;
        reasons[reasonKey].amount += amount;

        // 부서별 통계
        const deptKey = item.applicant_dept || '미분류';
        if (!depts[deptKey]) depts[deptKey] = { count: 0, amount: 0 };
        depts[deptKey].count++;
        depts[deptKey].amount += amount;

        // 진료과별 통계
        const cDeptKey = item.clinic_dept || '미분류';
        if (!clinicDepts[cDeptKey]) clinicDepts[cDeptKey] = { count: 0, amount: 0 };
        clinicDepts[cDeptKey].count++;
        clinicDepts[cDeptKey].amount += amount;

        // 관계별 통계
        const relKey = item.relationship || '미분류';
        if (!relations[relKey]) relations[relKey] = { count: 0, amount: 0 };
        relations[relKey].count++;
        relations[relKey].amount += amount;

        // 월별 통계
        const date = new Date(item.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthly[monthKey]) monthly[monthKey] = { name: monthKey, count: 0, amount: 0 };
        monthly[monthKey].count++;
        monthly[monthKey].amount += amount;
      }
    });

    const sortedMonthly = Object.values(monthly).sort((a, b) => a.name.localeCompare(b.name));

    setStats({
      totalAmount: totalAmt,
      totalCount: totalCnt,
      approvedCount: approvedCnt,
      approvedAmount: approvedAmt,
      pendingCount: pendingCnt,
      typeStats: types,
      reasonStats: reasons,
      deptStats: depts,
      clinicDeptStats: clinicDepts,
      relationshipStats: relations,
      statusStats: statuses,
      monthlyStats: sortedMonthly
    });
  };

  // 특별 감면 대상 자동 매칭 상태
  const [specialMatchInfo, setSpecialMatchInfo] = useState(null);

  // 상세 창 오픈 및 조회 감사 로그 등록
  const handleOpenDetail = async (req) => {
    setSelectedReq(req);
    setModalOpen(true);
    setModalLoading(true);
    setSpecialMatchInfo(null);

    try {
      // 1. 기존 이력 정보 우선 로드
      await fetchHistoryLogs(req.id);

      // 2. 특별 감면 대상 자동 조회 (병록번호 / 성명 / 소속 기준 매칭)
      try {
        const { data: sMatch } = await supabase
          .from('special_discounts')
          .select('*')
          .eq('status', '활성');

        if (sMatch && sMatch.length > 0) {
          const pNo = req.patient_no;
          const pName = req.patient_name;
          const aDept = req.applicant_dept;

          const matched = sMatch.find(item => {
            if (item.chart_no && pNo && item.chart_no !== '미생성' && item.chart_no === pNo) return true;
            if (item.name && (item.name === pName || (aDept && item.name === aDept))) return true;
            if (item.reason && aDept && item.reason.includes(aDept)) return true;
            return false;
          });
          if (matched) setSpecialMatchInfo(matched);
        }
      } catch (matchErr) {
        console.warn('특별 감면 매칭 실패:', matchErr);
      }

      // 3. 조회 이력 access_logs 별도 안전 적재
      try {
        const currentUserName = (userNamesMap && userNamesMap[currentUser.email]) || currentUser?.user_metadata?.full_name || '사용자';
        await supabase.from('access_logs').insert({
          request_id: req.id,
          accessed_by_email: currentUser.email,
          accessed_by_name: currentUserName,
          action: '상세조회'
        });
        
        // 최신 조회로그 재갱신
        const { data: aLogs } = await supabase.from('access_logs').select('*').eq('request_id', req.id).order('accessed_at', { ascending: false });
        if (aLogs) setAccessLogs(aLogs);
      } catch (logErr) {
        console.warn('감사 로그 적재 실패 (무시):', logErr);
      }
    } catch (err) {
      console.error('이력 로드 오류:', err);
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
      const userName = userNamesMap[email] || currentUser.user_metadata.full_name;

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
      (req.treatment_end_date && req.treatment_end_date !== req.clinic_date ? `${req.clinic_date} ~ ${req.treatment_end_date}` : req.clinic_date) || '',
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

  // 엑셀/CSV 파일 파싱 (UTF-8/CP949 인코딩 복원 및 위치 기반 폴백 포함)
  const handleImportFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportLoading(true);

    const isCsv = file.name.toLowerCase().endsWith('.csv');

    const processWorkbook = (workbook) => {
      try {
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

        if (!rawJson || rawJson.length === 0) {
          alert('파일에 데이터가 존재하지 않습니다.');
          setImportLoading(false);
          return;
        }

        // 헤더 행 위치 탐색 (키워드 매칭)
        let headerRowIndex = -1;
        const keywords = ['신청', '날짜', '병록', '성명', '환자', '진료', '할인', '비고', '소속', '이름', '사유', '관계', '부문', '구분'];

        for (let i = 0; i < Math.min(rawJson.length, 10); i++) {
          const rowStr = rawJson[i].map(c => String(c)).join(' ');
          const matchCount = keywords.filter(k => rowStr.includes(k)).length;
          if (matchCount >= 2) {
            headerRowIndex = i;
            break;
          }
        }

        // 키워드 탐색 실패 시 헤더 행 폴백 (1행 또는 0행 중 채워진 컬럼이 더 많은 행)
        if (headerRowIndex === -1) {
          headerRowIndex = 0;
          if (rawJson.length > 1) {
            const count0 = rawJson[0].filter(c => String(c).trim()).length;
            const count1 = rawJson[1].filter(c => String(c).trim()).length;
            if (count1 > count0) headerRowIndex = 1;
          }
        }

        const headers = rawJson[headerRowIndex].map(h => String(h).trim());
        const dataRows = rawJson.slice(headerRowIndex + 1);

        const findColIndex = (kwList, defaultIdx) => {
          const foundIdx = headers.findIndex(h => kwList.some(k => h.toLowerCase().includes(k.toLowerCase())));
          return foundIdx !== -1 ? foundIdx : defaultIdx;
        };

        // 상세내용 컬럼 존재 여부 확인
        const hasDetailHeader = headers.some(h => ['상세내용', '상세', '세부내용', '비고내용'].some(k => h.toLowerCase().includes(k)));

        // 컬럼 위치 탐색 (헤더명 매핑 or 구글 시트 양식 유연한 기본 순서)
        const idxDate = findColIndex(['신청날짜', '신청일자', '신청일'], 0);
        const idxType = findColIndex(['감면부문', '감면구분', '구분'], 1);
        const idxClinicDate = findColIndex(['진료일자', '진료일'], 2);
        const idxPatientNo = findColIndex(['병록번호', '등록번호'], 3);
        const idxPatientName = findColIndex(['성명', '대상자', '환자명'], 4);
        const idxClinicDept = findColIndex(['진료과'], 5);
        const idxAmount = findColIndex(['비고(할인금액)', '할인금액', '감면금액', '비고'], 6);
        const idxReason = findColIndex(['신청사유', '사유'], 7);
        const idxDetail = findColIndex(['상세내용', '상세', '세부내용', '비고내용'], hasDetailHeader ? 8 : -1);

        // 상세내용 컬럼 유무에 따른 후속 컬럼 기본 인덱스 보정 (8 또는 9)
        const baseOffset = (hasDetailHeader || idxDetail !== -1) ? 1 : 0;
        const idxApplicantDept = findColIndex(['신청인 소속', '신청인소속', '신청부서', '소속'], 8 + baseOffset);
        const idxApplicantName = findColIndex(['신청인 이름', '신청인이름', '신청자'], 9 + baseOffset);
        const idxRelation = findColIndex(['관계'], 10 + baseOffset);

        const formatted = [];

        dataRows.forEach((row) => {
          if (!row || row.length === 0) return;

          // 모든 셀이 비어있으면 스킵
          const hasContent = row.some(cell => String(cell).trim() !== '');
          if (!hasContent) return;

          const getCellVal = (idx) => (idx !== -1 && idx < row.length ? String(row[idx] || '').trim() : '');

          const patientName = getCellVal(idxPatientName);
          const patientNo = getCellVal(idxPatientNo);
          const rawDate = getCellVal(idxDate);
          const rawAmount = getCellVal(idxAmount);
          const reasonVal = getCellVal(idxReason);
          const detailVal = getCellVal(idxDetail);

          // 헤더 행 재등장 시 스킵
          if (patientName === '성명' || patientNo === '병록번호' || rawDate === '신청날짜') return;

          const parseDateStr = (val) => {
            if (!val) return new Date().toISOString().split('T')[0];
            const str = String(val).replace(/\./g, '-').replace(/\s+/g, '').replace(/-$/g, '');
            const parts = str.split('-');
            if (parts.length === 3) {
              return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
            return new Date().toISOString().split('T')[0];
          };

          const parseAmount = (val) => {
            if (!val) return 0;
            const numStr = String(val).replace(/[^0-9]/g, '');
            return parseInt(numStr, 10) || 0;
          };

          // 사유 카테고리 및 상세 내용 자동 정리
          const finalReasonCategory = reasonVal || '의료진 요청';
          const finalDetails = detailVal || (reasonVal && reasonVal !== finalReasonCategory ? reasonVal : '구글 스프레드시트 과거 내역 일괄 이관');

          formatted.push({
            created_at: rawDate ? new Date(parseDateStr(rawDate)).toISOString() : new Date().toISOString(),
            discount_type: getCellVal(idxType) || '외래',
            clinic_date: parseDateStr(getCellVal(idxClinicDate)),
            patient_no: patientNo || '미기재',
            patient_name: patientName || '미상',
            clinic_dept: getCellVal(idxClinicDept) || '미지정',
            discount_amount: parseAmount(rawAmount),
            reason_category: finalReasonCategory,
            details: finalDetails,
            applicant_dept: getCellVal(idxApplicantDept) || '미지정',
            applicant_name: getCellVal(idxApplicantName) || '과거이관자',
            applicant_email: 'imported@hnh.local',
            relationship: getCellVal(idxRelation) || '기타',
            status: defaultImportStatus,
            admin_notes: `[일괄이관] ${finalDetails}`
          });
        });

        if (formatted.length === 0) {
          alert('파싱 가능한 행이 발견되지 않았습니다. 파일 형식을 확인해주세요.');
        }

        setParsedImportData(formatted);
      } catch (err) {
        alert(`파일 읽기 오류: ${err.message}`);
      } finally {
        setImportLoading(false);
      }
    };

    if (isCsv) {
      // CSV 파일의 경우 FileReader.readAsText로 인코딩 지원
      const readerText = new FileReader();
      readerText.onload = (evt) => {
        try {
          const text = evt.target.result;
          const workbook = XLSX.read(text, { type: 'string', raw: true });
          processWorkbook(workbook);
        } catch (err) {
          // UTF-8 실패 시 Binary ArrayBuffer로 2차 시도
          const readerBin = new FileReader();
          readerBin.onload = (evtBin) => {
            const data = new Uint8Array(evtBin.target.result);
            const workbook = XLSX.read(data, { type: 'array', codepage: 949 });
            processWorkbook(workbook);
          };
          readerBin.readAsArrayBuffer(file);
        }
      };
      readerText.readAsText(file, 'utf-8');
    } else {
      // XLSX/XLS 파일의 경우 ArrayBuffer 처리
      const readerBin = new FileReader();
      readerBin.onload = (evtBin) => {
        try {
          const data = new Uint8Array(evtBin.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          processWorkbook(workbook);
        } catch (err) {
          alert(`엑셀 파일 구조 읽기 실패: ${err.message}`);
          setImportLoading(false);
        }
      };
      readerBin.readAsArrayBuffer(file);
    }
  };

  // DB에 파싱된 데이터 저장
  const handleSaveImportData = async () => {
    if (parsedImportData.length === 0) return;
    setImportLoading(true);
    try {
      const payload = parsedImportData.map(item => ({ ...item, status: defaultImportStatus }));
      const { error } = await supabase.from('discount_requests').insert(payload);
      if (error) throw error;

      alert(`총 ${parsedImportData.length}건의 감면 정보가 성공적으로 등록되었습니다.`);
      setImportModalOpen(false);
      setParsedImportData([]);
      setImportFileName('');
      fetchAllData();
    } catch (err) {
      alert(`DB 저장 중 오류 발생: ${err.message}`);
    } finally {
      setImportLoading(false);
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

  // Recharts 툴팁 포맷터
  const customTooltipFormatter = (value, name, props) => {
    return [`${Number(value).toLocaleString()}원 (${props.payload.count}건)`, name];
  };
  const countTooltipFormatter = (value, name, props) => {
    return [`${value}건`, name];
  };

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

  // 컬럼 헤더 클릭 시 정렬 핑퐁
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 정렬 헤더 Cell 렌더링 헬퍼
  const renderSortHeader = (field, label, isHideMobile = false) => {
    const isActive = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)} 
        className={isHideMobile ? 'hide-on-mobile' : ''}
        style={{ cursor: 'pointer', userSelect: 'none', transition: 'background-color 0.15s' }}
        title={`${label} 기준 ${isActive && sortOrder === 'asc' ? '내림차순' : '오름차순'} 정렬`}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span>{label}</span>
          <span style={{ fontSize: '11px', color: isActive ? '#004680' : '#9ca3af', fontWeight: 'bold' }}>
            {isActive ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </div>
      </th>
    );
  };

  // 목록 정렬 처리
  const sortedRequests = [...requests].sort((a, b) => {
    let aVal = '';
    let bVal = '';

    switch (sortField) {
      case 'created_at':
        aVal = a.created_at || '';
        bVal = b.created_at || '';
        break;
      case 'applicant_dept':
        aVal = a.applicant_dept || '';
        bVal = b.applicant_dept || '';
        break;
      case 'applicant_name':
        aVal = a.applicant_name || '';
        bVal = b.applicant_name || '';
        break;
      case 'patient_name':
        aVal = a.patient_name || '';
        bVal = b.patient_name || '';
        break;
      case 'discount_type':
        aVal = a.discount_type || '';
        bVal = b.discount_type || '';
        break;
      case 'reason_category':
        aVal = a.reason_category || '';
        bVal = b.reason_category || '';
        break;
      case 'discount_amount':
        const numA = Number(a.discount_amount) || 0;
        const numB = Number(b.discount_amount) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      case 'status':
        aVal = a.status || '';
        bVal = b.status || '';
        break;
      default:
        aVal = a.created_at || '';
        bVal = b.created_at || '';
    }

    const comparison = String(aVal).localeCompare(String(bVal), 'ko', { numeric: true, sensitivity: 'base' });
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.max(1, Math.ceil(requests.length / ITEMS_PER_PAGE));
  const paginatedRequests = sortedRequests.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const activeFilterCount = [
    filterStartDate, filterEndDate, filterStatus, filterType, filterPatientNo, filterPatientName, filterRelationship, filterClinicDept, filterClinicDate, filterReason, filterApplicantDept, filterApplicant
  ].filter(Boolean).length;

  // PieChart용 데이터 변환
  const generatePieData = (statsObj, useCount = false) => {
    return Object.entries(statsObj)
      .map(([name, data]) => ({
        name,
        value: useCount ? data.count : data.amount,
        count: data.count,
        amount: data.amount
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value); // 크기순 정렬
  };

  const statusPieData = generatePieData(stats.statusStats, true);
  const typePieData = generatePieData(stats.typeStats, false);
  const reasonPieData = generatePieData(stats.reasonStats, false);
  const relationPieData = generatePieData(stats.relationshipStats, false);
  const deptPieData = generatePieData(stats.deptStats, false).slice(0, 8); // 너무 많은 부서는 상위 8개만 표시
  const clinicDeptPieData = generatePieData(stats.clinicDeptStats, false).slice(0, 8);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
    if (percent < 0.05) return null; // 5% 미만은 라벨 표시 생략
    return (
      <text 
        x={x} y={y} 
        fill="#ffffff" 
        textAnchor="middle" 
        dominantBaseline="central" 
        fontSize="12" 
        fontWeight="bold"
        style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8)' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const renderPieChartCard = (title, data, colorPaletteOffset = 0, isCountOnly = false, filterCategory = '', activeValue = '') => {
    if (!data || data.length === 0) {
      return (
        <div className="glass-card" style={{ height: '235px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <h3 className="form-label" style={{ fontSize: '15px', color: '#1e293b', marginBottom: '10px' }}>{title}</h3>
          <div className="empty-state" style={{ padding: '24px 0', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>데이터가 존재하지 않습니다.</div>
        </div>
      );
    }

    const totalValue = data.reduce((acc, item) => acc + (Number(item.value) || 0), 0);

    return (
      <div className="glass-card" style={{ height: '235px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 className="form-label" style={{ fontSize: '15px', color: '#1e293b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={title}>
            {title}
          </h3>
          {activeValue && (
            <span 
              onClick={() => handleFilterToggle(filterCategory, activeValue)}
              style={{ fontSize: '11px', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#fef2f2', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fecaca', whiteSpace: 'nowrap' }}
              title="클릭하여 필터 해제"
            >
              ✕ {activeValue}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
          {/* 그래프 (슬라이스 클릭 시 필터 적용) */}
          <div style={{ width: '130px', height: '150px', flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%" cy="50%"
                  innerRadius={25} outerRadius={52}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  onClick={(entry) => entry && entry.name && handleFilterToggle(filterCategory, entry.name)}
                >
                  {data.map((entry, index) => {
                    const isSelected = activeValue === entry.name;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[(index + colorPaletteOffset) % COLORS.length]} 
                        stroke={isSelected ? '#0284c7' : 'none'}
                        strokeWidth={isSelected ? 3 : 0}
                        style={{ cursor: 'pointer', filter: isSelected ? 'drop-shadow(0 0 4px rgba(0,0,0,0.4))' : 'none' }}
                      />
                    );
                  })}
                </Pie>
                <Tooltip formatter={isCountOnly ? countTooltipFormatter : customTooltipFormatter} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 우측 세부 수치 리스트 (클릭 시 필터 적용) */}
          <div style={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px', paddingTop: '2px', paddingBottom: '2px' }}>
            {data.map((entry, index) => {
              const color = COLORS[(index + colorPaletteOffset) % COLORS.length];
              const pct = totalValue > 0 ? ((Number(entry.value) / totalValue) * 100).toFixed(1) : '0';
              const isSelected = activeValue === entry.name;
              
              return (
                <div 
                  key={entry.name} 
                  onClick={() => handleFilterToggle(filterCategory, entry.name)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    fontSize: '11px', 
                    padding: '5px 7px', 
                    borderRadius: '5px', 
                    backgroundColor: isSelected ? '#dbeafe' : '#f8fafc',
                    border: isSelected ? '1px solid #0284c7' : '1px solid #f1f5f9',
                    gap: '4px',
                    flexShrink: 0,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#e0f2fe'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                  title={`클릭하여 '${entry.name}' (으)로 필터링`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflow: 'hidden', flex: 1 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                    <span style={{ color: isSelected ? '#0369a1' : '#334155', fontWeight: isSelected ? 700 : 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {isSelected ? `✓ ${entry.name}` : entry.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <span style={{ fontWeight: 'bold', color: isSelected ? '#0369a1' : '#004680', fontSize: '11px' }}>
                      {isCountOnly ? `${entry.count || entry.value}건` : `${entry.count}건`}
                    </span>
                    {!isCountOnly && entry.amount != null && entry.amount > 0 && (
                      <span style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold' }}>
                        {Number(entry.amount).toLocaleString()}원
                      </span>
                    )}
                    <span style={{ fontSize: '10px', color: isSelected ? '#0369a1' : '#64748b', backgroundColor: isSelected ? '#bae6fd' : '#e2e8f0', padding: '1px 4px', borderRadius: '3px', fontWeight: 'bold' }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    );
  };

  return (
    <div>
      {/* 0. 상세 검색/필터 영역을 최상단으로 이동 */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h2 className="log-section-title" style={{ fontSize: '18px', borderBottom: 'none', paddingBottom: '16px', margin: 0 }}>
          감면 관리 대시보드 - 데이터 필터
        </h2>
        
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
                        {discountTypes.map(t => (
                          <option key={t.value} value={t.value}>{t.value}</option>
                        ))}
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
                        {relationships.map(r => (
                          <option key={r.value} value={r.value}>{r.value}</option>
                        ))}
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
      </div>

      {/* 1. 통계 요약 카드 영역 */}
      <div className="responsive-stats stats-grid">
        <div className="stat-card">
          <div className="stat-label">전체 필터된 신청 건수</div>
          <div className="stat-value">{stats.totalCount}건</div>
          <div className="stat-sub">현재 조건 필터 기준 총 누적 신청</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">필터된 누적 감면 신청 금액</div>
          <div className="stat-value">{stats.totalAmount.toLocaleString()}원</div>
          <div className="stat-sub">모든 처리 상태 포함</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">최종 승인 완료 건수</div>
          <div className="stat-value">{stats.approvedCount}건</div>
          <div className="stat-sub">승인 완료 비율: {stats.totalCount ? Math.round((stats.approvedCount / stats.totalCount) * 100) : 0}%</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(5, 150, 105, 0.3)' }}>
          <div className="stat-label">승인된 감면 적용 금액</div>
          <div className="stat-value" style={{ color: '#059669' }}>{stats.approvedAmount.toLocaleString()}원</div>
          <div className="stat-sub">최종 승인 완료 금액의 합계</div>
        </div>
      </div>

      {/* 2. 시각화 통계 섹션 (Recharts 기반) */}
      <div className="analytics-section" style={{ marginBottom: '24px' }}>
        
        {/* 월별 감면 신청 추이 (꺾은선) */}
        <div className="glass-card" style={{ gridColumn: 'span 3' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="form-label" style={{ fontSize: '15px', color: '#1e293b', margin: 0 }}>
              기간별(월별) 최종승인 감면 추이
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal', marginLeft: '8px' }}>
                (그래프 포인트 또는 X축 연월 클릭 시 해당 월로 필터링)
              </span>
            </h3>
            {getActiveMonthString() && (
              <span 
                onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
                style={{ fontSize: '11px', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#fef2f2', padding: '3px 8px', borderRadius: '4px', border: '1px solid #fecaca', whiteSpace: 'nowrap' }}
                title="클릭하여 기간 필터 해제"
              >
                ✕ {getActiveMonthString()} 필터 해제
              </span>
            )}
          </div>

          {stats.monthlyStats.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>데이터가 존재하지 않습니다.</div>
          ) : (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart 
                  data={stats.monthlyStats} 
                  margin={{ top: 15, right: 20, bottom: 5, left: 20 }}
                  onClick={(e) => {
                    if (e && e.activeLabel) {
                      handleMonthFilterToggle(e.activeLabel);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: '#004680', fontWeight: 'bold' }} 
                  />
                  <YAxis yAxisId="left" tickFormatter={(v) => (v / 10000) + '만'} tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'amount') return [`${Number(value).toLocaleString()}원`, '감면 금액'];
                      if (name === 'count') return [`${value}건`, '신청 건수'];
                      return [value, name];
                    }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  <Line 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="amount" 
                    name="감면 금액" 
                    stroke="#004680" 
                    strokeWidth={3} 
                    activeDot={{ r: 8, cursor: 'pointer' }}
                  >
                    <LabelList dataKey="amount" position="top" formatter={(val) => Math.round(val / 10000) + '만'} fontSize={11} fill="#004680" fontWeight="bold" />
                  </Line>
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="count" 
                    name="신청 건수" 
                    stroke="#39a845" 
                    strokeWidth={3}
                    activeDot={{ r: 8, cursor: 'pointer' }}
                  >
                    <LabelList dataKey="count" position="bottom" formatter={(val) => val + '건'} fontSize={11} fill="#39a845" fontWeight="bold" />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 결재 처리상태별 통계 (건수 기준) */}
        {renderPieChartCard("결재 처리상태별 분포 (건수 기준)", statusPieData, 0, true, 'status', filterStatus)}

        {/* 감면구분별 통계 */}
        {renderPieChartCard("감면구분별 지분 (최종승인 금액 기준)", typePieData, 2, false, 'type', filterType)}

        {/* 감면사유별 통계 */}
        {renderPieChartCard("감면사유별 지분 (최종승인 금액 기준)", reasonPieData, 4, false, 'reason', filterReason)}

        {/* 신청자와의 관계별 통계 */}
        {renderPieChartCard("대상자 관계별 지분 (최종승인 금액 기준)", relationPieData, 1, false, 'relationship', filterRelationship)}

        {/* 신청 부서별 통계 (상위 8개) */}
        {renderPieChartCard("신청 부서별 지분 (최종승인 금액 기준, 상위 8)", deptPieData, 0, false, 'applicantDept', filterApplicantDept)}

        {/* 진료과별 통계 (상위 8개) */}
        {renderPieChartCard("진료과별 지분 (최종승인 금액 기준, 상위 8)", clinicDeptPieData, 3, false, 'clinicDept', filterClinicDept)}

      </div>

      {/* 3. 결재 대기 목록 & 엑셀 전체 목록 */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 className="log-section-title" style={{ fontSize: '18px', borderBottom: 'none', paddingBottom: 0, margin: 0 }}>전체 감면 신청서 목록</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setImportModalOpen(true)} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '13px', whiteSpace: 'nowrap' }}>
              📥 구글 시트/엑셀 가져오기
            </button>
            <button onClick={handleExportCSV} className="btn btn-accent hide-on-mobile" style={{ padding: '8px 12px', fontSize: '13px', whiteSpace: 'nowrap' }}>
              엑셀 다운로드
            </button>
          </div>
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
                  {renderSortHeader('created_at', '신청일')}
                  {renderSortHeader('applicant_dept', '신청부서', true)}
                  {renderSortHeader('applicant_name', '신청자', true)}
                  {renderSortHeader('patient_name', '대상자(병록번호)')}
                  {renderSortHeader('discount_type', '구분', true)}
                  {renderSortHeader('reason_category', '사유', true)}
                  {renderSortHeader('discount_amount', '감면금액', true)}
                  {renderSortHeader('status', '상태')}
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
                  {/* 특별 감면 대상 자동 매칭 알림 뱃지 */}
                  {specialMatchInfo && (() => {
                    const formatRateVal = (rateVal) => {
                      if (!rateVal) return '';
                      let str = String(rateVal).trim();
                      const numMatch = str.match(/([0-9]+(\.[0-9]+)?)/);
                      if (numMatch) {
                        const num = parseFloat(numMatch[1]);
                        if (!isNaN(num)) {
                          const intNum = num <= 1 && num > 0 ? Math.round(num * 100) : Math.round(num);
                          return `${intNum}%`;
                        }
                      }
                      return str.endsWith('%') ? str : `${str}%`;
                    };

                    const reqType = selectedReq?.discount_type || '';
                    let matchedRate = specialMatchInfo.discount_rate;
                    let typeLabel = '';
                    if (reqType.includes('외래') && specialMatchInfo.discount_outpatient) {
                      matchedRate = specialMatchInfo.discount_outpatient;
                      typeLabel = '(외래 세부 적용)';
                    } else if (reqType.includes('입원') && specialMatchInfo.discount_inpatient) {
                      matchedRate = specialMatchInfo.discount_inpatient;
                      typeLabel = '(입원 세부 적용)';
                    } else if (reqType.includes('검진') && specialMatchInfo.discount_checkup) {
                      matchedRate = specialMatchInfo.discount_checkup;
                      typeLabel = '(검진 세부 적용)';
                    }

                    return (
                      <div style={{ backgroundColor: '#fffbe8', border: '1px solid #fde68a', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>⭐</span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#92400e' }}>
                            [특별 감면 대상 매칭] {specialMatchInfo.target_type}: {specialMatchInfo.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
                            현재 신청인({reqType}) 적용 할인율: <strong style={{ color: '#059669', fontSize: '13.5px' }}>{formatRateVal(matchedRate)}</strong> {typeLabel} 
                            {(currentUser?.role === 'admin' || currentUser?.is_sysadmin || currentUser?.isSysAdmin) && (
                              <> | 사유: {specialMatchInfo.reason || '미기재'}</>
                            )}
                            | 승인요청자: {specialMatchInfo.requester || '미기재'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

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
                      <div className="detail-label">진료 기간</div>
                      <div className="detail-value">
                        {selectedReq.treatment_end_date && selectedReq.treatment_end_date !== selectedReq.clinic_date
                          ? `${selectedReq.clinic_date} ~ ${selectedReq.treatment_end_date}`
                          : (selectedReq.clinic_date || '미기입')}
                      </div>
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
                            <div className="log-meta">{formatDateTime(l.changed_at)} | {(userNamesMap && userNamesMap[l.changed_by_email]) || l.changed_by_name || '미상'}</div>
                            <div className="log-msg">
                              상태 변경: <span className="highlight">'{l.from_status || '최초신청'}'</span> ➔ <span className="highlight">'{l.to_status}'</span>
                            </div>
                          </div>
                        ))}
                        {editLogs.map(l => (
                          <div key={l.id} className="log-entry">
                            <div className="log-meta">{formatDateTime(l.edited_at)} | {(userNamesMap && userNamesMap[l.edited_by_email]) || l.edited_by_name || '미상'}</div>
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
                          <div style={{ fontSize: '12px', color: '#94a3b8', padding: '8px 0' }}>변경 기록이 존재하지 않습니다.</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="log-section-title">상세조회 감사로그 (접근 로그)</div>
                      <div className="log-timeline">
                        {accessLogs.map(l => (
                          <div key={l.id} className="log-entry">
                            <div className="log-meta">{formatDateTime(l.accessed_at)}</div>
                            <div className="log-msg">
                              <span className="highlight">{(userNamesMap && userNamesMap[l.accessed_by_email]) || l.accessed_by_name || '미상'}</span> ({l.accessed_by_email}) 가 조회함
                            </div>
                          </div>
                        ))}
                        {accessLogs.length === 0 && (
                          <div style={{ fontSize: '12px', color: '#94a3b8', padding: '8px 0' }}>조회 기록이 아직 존재하지 않습니다.</div>
                        )}
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
                  <button onClick={() => handleUpdateStatus('원무확인중')} className="btn btn-danger">반려 (원무팀 반송)</button>
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

      {/* 구글 시트 / 엑셀 일괄 이관 모달 */}
      {importModalOpen && (
        <div 
          className="modal-overlay" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
          onClick={(e) => e.target.className === 'modal-overlay' && !importLoading && setImportModalOpen(false)}
        >
          <div className="glass-card animate-in" style={{ width: '750px', maxWidth: '95%', padding: '24px', backgroundColor: '#ffffff', overflowY: 'auto', maxHeight: '90vh', border: '1px solid rgba(0,0,0,0.1)', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#004680', margin: 0 }}>
                📥 구글 스프레드시트 / 엑셀 데이터 일괄 가져오기
              </h3>
              <button onClick={() => !importLoading && setImportModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.6', marginBottom: '16px', backgroundColor: '#f0f9ff', padding: '12px 16px', borderRadius: '6px', border: '1px solid #bae6fd' }}>
              💡 <strong>구글 스프레드시트 가져오기 방법:</strong><br />
              1. 구글 스프레드시트 상단 메뉴 <strong>[파일] ➔ [다운로드] ➔ [쉼표로 구분된 값(.csv)]</strong> 또는 <strong>[Microsoft Excel(.xlsx)]</strong> 선택하여 파일 다운로드<br />
              2. 아래 파일 선택 버튼으로 다운로드받은 파일 선택 후 <strong>[DB에 일괄 등록]</strong> 클릭!
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: '600' }}>파일 선택 (.csv, .xlsx, .xls)</label>
              <input 
                type="file" 
                accept=".csv, .xlsx, .xls"
                onChange={handleImportFileUpload}
                disabled={importLoading}
                className="form-input" 
                style={{ padding: '8px' }}
              />
            </div>

            {parsedImportData.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#059669' }}>
                    ✅ 총 {parsedImportData.length}건의 감면 정보가 정상 파싱되었습니다.
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: '500' }}>등록 처리 상태:</span>
                    <select 
                      value={defaultImportStatus} 
                      onChange={(e) => setDefaultImportStatus(e.target.value)}
                      className="form-select"
                      style={{ padding: '4px 8px', fontSize: '12px', width: '110px' }}
                    >
                      <option value="최종승인">최종승인</option>
                      <option value="담당자 승인">담당자 승인</option>
                      <option value="신청완료">신청완료</option>
                    </select>
                  </div>
                </div>

                {/* 데이터 미리보기 테이블 */}
                <div className="table-responsive" style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '20px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                  <table className="custom-table compact" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                    <thead>
                      <tr>
                        <th>신청일자</th>
                        <th>신청부서</th>
                        <th>신청자</th>
                        <th>성명</th>
                        <th>병록번호</th>
                        <th>진료과</th>
                        <th>구분</th>
                        <th>할인금액</th>
                        <th>신청사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedImportData.slice(0, 10).map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.created_at.split('T')[0]}</td>
                          <td>{row.applicant_dept}</td>
                          <td>{row.applicant_name}</td>
                          <td>{row.patient_name}</td>
                          <td>{row.patient_no}</td>
                          <td>{row.clinic_dept}</td>
                          <td>{row.discount_type}</td>
                          <td>{Number(row.discount_amount).toLocaleString()}원</td>
                          <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.reason_category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedImportData.length > 10 && (
                    <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', padding: '6px', backgroundColor: '#f8fafc' }}>
                      ... 외 {parsedImportData.length - 10}건의 데이터가 더 포함되어 있습니다.
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                onClick={() => setImportModalOpen(false)}
                disabled={importLoading}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                취소
              </button>
              <button 
                onClick={handleSaveImportData}
                disabled={importLoading || parsedImportData.length === 0}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                {importLoading ? '이관 등록 중...' : `DB에 일괄 등록 (${parsedImportData.length}건)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
