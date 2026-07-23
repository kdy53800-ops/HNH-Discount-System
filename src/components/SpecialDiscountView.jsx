import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export const formatRate = (rateVal) => {
  if (rateVal === null || rateVal === undefined) return '';
  let str = String(rateVal).trim();
  if (!str) return '';

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

export default function SpecialDiscountView({ currentUser }) {
  // 최고 관리자(admin / sysadmin) 전용 사유(reason) 필드 노출 권한 체크
  const isAdmin = currentUser?.role === 'admin' || currentUser?.is_sysadmin || currentUser?.isSysAdmin;

  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(true);

  // 검색 및 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('전체'); // '전체', '개인', '기관/단체'
  const [statusFilter, setStatusFilter] = useState('전체'); // '전체', '활성', '만료', '중단'

  // 정렬 상태
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // 등록/수정 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    target_type: '개인',
    name: '',
    chart_no: '',
    category: '급여포함',
    discount_rate: '100%',
    discount_outpatient: '',
    discount_inpatient: '',
    discount_checkup: '',
    reason: '',
    requester: '',
    request_date: new Date().toISOString().split('T')[0],
    start_date: '',
    end_date: '',
    status: '활성',
    contact: '',
    notes: ''
  });

  // 엑셀 Import 모달 상태
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [parsedImportData, setParsedImportData] = useState([]);
  const [importFileName, setImportFileName] = useState('');

  // 이력 로그 모달 상태
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [itemHistoryLogs, setItemHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchSpecialDiscounts();
  }, []);

  const handleOpenHistoryModal = async (item) => {
    setSelectedHistoryItem(item);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('special_discount_logs')
        .select('*')
        .eq('special_discount_id', item.id)
        .order('edited_at', { ascending: false });
      if (error) throw error;
      setItemHistoryLogs(data || []);
    } catch (err) {
      console.error('이력 로드 실패:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchSpecialDiscounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('special_discounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        throw error;
      }
      console.log('Fetched special discounts count:', data ? data.length : 0);
      setDataList(data || []);
    } catch (err) {
      console.error('특별 감면 대상 로드 실패:', err);
      alert(`특별 감면 대상 조회 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      target_type: '개인',
      name: '',
      chart_no: '',
      category: '급여포함',
      discount_rate: '100%',
      discount_outpatient: '',
      discount_inpatient: '',
      discount_checkup: '',
      reason: '',
      requester: '',
      request_date: new Date().toISOString().split('T')[0],
      start_date: '',
      end_date: '',
      status: '활성',
      contact: '',
      notes: ''
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      target_type: item.target_type || '개인',
      name: item.name || '',
      chart_no: item.chart_no || '',
      category: item.category || '급여포함',
      discount_rate: item.discount_rate || '',
      discount_outpatient: item.discount_outpatient || '',
      discount_inpatient: item.discount_inpatient || '',
      discount_checkup: item.discount_checkup || '',
      reason: item.reason || '',
      requester: item.requester || '',
      request_date: item.request_date || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      status: item.status || '활성',
      contact: item.contact || '',
      notes: item.notes || ''
    });
    setModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.discount_rate) {
      alert('성명/기관명 및 할인율은 필수 입력 사항입니다.');
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        ...formData,
        discount_rate: formatRate(formData.discount_rate),
        discount_outpatient: formData.discount_outpatient ? formatRate(formData.discount_outpatient) : null,
        discount_inpatient: formData.discount_inpatient ? formatRate(formData.discount_inpatient) : null,
        discount_checkup: formData.discount_checkup ? formatRate(formData.discount_checkup) : null,
        request_date: formData.request_date || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        updated_at: new Date().toISOString()
      };

      if (editingItem) {
        // 변경 항목 자동 감지 및 로깅
        const editorEmail = currentUser?.email || 'manager@hnh.local';
        const editorName = currentUser?.user_metadata?.full_name || currentUser?.name || '원무팀 담당자';

        const fieldsToTrack = [
          { key: 'name', label: '성명/기관명' },
          { key: 'chart_no', label: '차트번호/범위' },
          { key: 'category', label: '적용 구분' },
          { key: 'discount_rate', label: '대표 할인율' },
          { key: 'discount_outpatient', label: '외래 할인율' },
          { key: 'discount_inpatient', label: '입원 할인율' },
          { key: 'discount_checkup', label: '검진 할인율' },
          { key: 'reason', label: '사유/배경' },
          { key: 'requester', label: '요청자' },
          { key: 'request_date', label: '요청일자' },
          { key: 'status', label: '적용 상태' },
          { key: 'notes', label: '비공개 메모' }
        ];

        const logInserts = [];
        fieldsToTrack.forEach(({ key, label }) => {
          const beforeVal = String(editingItem[key] || '').trim();
          const afterVal = String(payload[key] || '').trim();
          if (beforeVal !== afterVal) {
            logInserts.push({
              special_discount_id: editingItem.id,
              field_name: label,
              before_value: beforeVal || '(미지정)',
              after_value: afterVal || '(미지정)',
              edited_by_email: editorEmail,
              edited_by_name: editorName,
              edited_at: new Date().toISOString()
            });
          }
        });

        if (logInserts.length > 0) {
          try {
            await supabase.from('special_discount_logs').insert(logInserts);
          } catch (logErr) {
            console.warn('이력 로그 저장 실패:', logErr);
          }
        }

        const { error } = await supabase
          .from('special_discounts')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        alert('특별 감면 대상 정보가 성공적으로 수정되었습니다.');
      } else {
        const { data: newInserted, error } = await supabase
          .from('special_discounts')
          .insert(payload)
          .select();
        if (error) throw error;

        if (newInserted && newInserted[0]) {
          try {
            const editorEmail = currentUser?.email || 'manager@hnh.local';
            const editorName = currentUser?.user_metadata?.full_name || currentUser?.name || '원무팀 담당자';
            await supabase.from('special_discount_logs').insert({
              special_discount_id: newInserted[0].id,
              field_name: '신규 등록',
              before_value: null,
              after_value: `'${newInserted[0].name}' 특별 감면 생성`,
              edited_by_email: editorEmail,
              edited_by_name: editorName,
              edited_at: new Date().toISOString()
            });
          } catch (e) {
            console.warn('신규 등록 로그 저장 실패:', e);
          }
        }
        alert('특별 감면 대상이 정상적으로 등록되었습니다.');
      }

      setModalOpen(false);
      fetchSpecialDiscounts();
    } catch (err) {
      alert(`저장 중 오류 발생: ${err.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`'${name}' 특별 감면 대상을 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase
        .from('special_discounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      alert('삭제되었습니다.');
      fetchSpecialDiscounts();
    } catch (err) {
      alert(`삭제 처리 오류: ${err.message}`);
    }
  };

  // 엑셀 다운로드
  const handleExportCSV = () => {
    if (dataList.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const headers = isAdmin
      ? ['구분(유형)', '이름/기관명', '차트번호/대상', '할인구분', '할인율', '사유', '요청자', '시작일', '종료일', '상태', '연락처/담당자', '비고']
      : ['구분(유형)', '이름/기관명', '차트번호/대상', '할인구분', '할인율', '요청자', '시작일', '종료일', '상태', '연락처/담당자', '비고'];

    const rows = dataList.map(item => {
      const r = [
        item.target_type,
        item.name,
        `'${item.chart_no || ''}`,
        item.category,
        item.discount_rate
      ];
      if (isAdmin) {
        r.push((item.reason || '').replace(/\r?\n/g, ' '));
      }
      r.push(
        item.requester,
        item.start_date || '',
        item.end_date || '',
        item.status,
        item.contact || '',
        (item.notes || '').replace(/\r?\n/g, ' ')
      );
      return r;
    });

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      const escapedRow = row.map(val => {
        let stringVal = String(val);
        if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
          stringVal = `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      });
      csvContent += escapedRow.join(',') + '\n';
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `특별감면대상목록_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 엑셀/CSV 일괄 업로드 파싱
  const handleImportFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportLoading(true);

    const isCsv = file.name.toLowerCase().endsWith('.csv');

    const processWorkbook = (workbook) => {
      try {
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', raw: false });

        if (!rawJson || rawJson.length === 0) {
          alert('파일에 데이터가 존재하지 않습니다.');
          setImportLoading(false);
          return;
        }

        // 헤더 행 탐색
        let headerRowIndex = -1;
        const keywords = ['이름', '성명', '차트', '병록', '구분', '할인율', '사유', '요청자', '요청일자'];

        for (let i = 0; i < Math.min(rawJson.length, 10); i++) {
          const rowStr = rawJson[i].map(c => String(c)).join(' ');
          const matchCount = keywords.filter(k => rowStr.includes(k)).length;
          if (matchCount >= 2) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) headerRowIndex = 0;

        const headers = rawJson[headerRowIndex].map(h => String(h).trim());
        const dataRows = rawJson.slice(headerRowIndex + 1);

        const findColIndex = (kwList, defaultIdx) => {
          const foundIdx = headers.findIndex(h => kwList.some(k => h.toLowerCase().includes(k.toLowerCase())));
          return foundIdx !== -1 ? foundIdx : defaultIdx;
        };

        const idxName = findColIndex(['이름', '성명', '기관명', '대상자'], 0);
        const idxChartNo = findColIndex(['차트번호', '병록번호', '대상범위', '차트'], 1);
        const idxCategory = findColIndex(['구분', '할인구분'], 2);
        const idxDiscountRate = findColIndex(['할인율', '할인'], 3);
        const idxReason = findColIndex(['사유', '신청사유', '비고내용'], 4);
        const idxRequester = findColIndex(['요청자', '신청자'], 5);
        const idxRequestDate = findColIndex(['요청일자', '등록일자', '요청일'], 6);

        const formatted = [];

        dataRows.forEach((row) => {
          if (!row || row.length === 0) return;
          const hasContent = row.some(cell => String(cell).trim() !== '');
          if (!hasContent) return;

          const getCellVal = (idx) => (idx !== -1 && idx < row.length ? String(row[idx] || '').trim() : '');

          const nameVal = getCellVal(idxName);
          const chartNoVal = getCellVal(idxChartNo);

          if (!nameVal || nameVal === '이름' || nameVal === '성명') return;

          const parseDateStr = (val) => {
            if (!val) return null;
            const str = String(val).replace(/\./g, '-').replace(/\s+/g, '').replace(/-$/g, '');
            const parts = str.split('-');
            if (parts.length === 3) {
              return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
            return null;
          };

          const rawRate = getCellVal(idxDiscountRate);
          let rateFormatted = rawRate;
          if (rawRate && !rawRate.includes('%')) {
            const num = parseFloat(rawRate);
            if (!isNaN(num)) {
              rateFormatted = num <= 1 ? `${Math.round(num * 100)}%` : `${num}%`;
            }
          }

          const targetType = (chartNoVal.includes('임직원') || chartNoVal.includes('학생') || nameVal.includes('대학') || nameVal.includes('기업') || nameVal.includes('주식회사')) ? '기관/단체' : '개인';

          formatted.push({
            target_type: targetType,
            name: nameVal,
            chart_no: chartNoVal,
            category: getCellVal(idxCategory) || '급여포함',
            discount_rate: rateFormatted || '100%',
            reason: getCellVal(idxReason),
            requester: getCellVal(idxRequester) || '원장님 VIP',
            request_date: parseDateStr(getCellVal(idxRequestDate)) || new Date().toISOString().split('T')[0],
            status: '활성',
            notes: '엑셀 데이터 일괄 가져오기'
          });
        });

        if (formatted.length === 0) {
          alert('파싱 가능한 행이 발견되지 않았습니다.');
        }

        setParsedImportData(formatted);
      } catch (err) {
        alert(`파일 파싱 오류: ${err.message}`);
      } finally {
        setImportLoading(false);
      }
    };

    if (isCsv) {
      const readerText = new FileReader();
      readerText.onload = (evt) => {
        try {
          const workbook = XLSX.read(evt.target.result, { type: 'string', raw: true });
          processWorkbook(workbook);
        } catch (err) {
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

  const handleSaveImportData = async () => {
    if (parsedImportData.length === 0) return;
    setImportLoading(true);
    try {
      const { error } = await supabase.from('special_discounts').insert(parsedImportData);
      if (error) throw error;

      alert(`총 ${parsedImportData.length}건의 특별 감면 대상 정보가 성공적으로 등록되었습니다.`);
      setImportModalOpen(false);
      setParsedImportData([]);
      setImportFileName('');
      fetchSpecialDiscounts();
    } catch (err) {
      alert(`DB 저장 중 오류 발생: ${err.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  // 필터링된 리스트
  const filteredData = dataList.filter(item => {
    if (targetTypeFilter !== '전체' && item.target_type !== targetTypeFilter) return false;
    if (statusFilter !== '전체' && item.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (item.name || '').toLowerCase().includes(q);
      const chartMatch = (item.chart_no || '').toLowerCase().includes(q);
      const reasonMatch = (item.reason || '').toLowerCase().includes(q);
      const requesterMatch = (item.requester || '').toLowerCase().includes(q);
      return nameMatch || chartMatch || reasonMatch || requesterMatch;
    }

    return true;
  });

  // 정렬 처리
  const sortedData = [...filteredData].sort((a, b) => {
    let aVal = a[sortField] || '';
    let bVal = b[sortField] || '';
    const comp = String(aVal).localeCompare(String(bVal), 'ko', { numeric: true });
    return sortOrder === 'asc' ? comp : -comp;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 통계 연산
  const totalCount = dataList.length;
  const personalCount = dataList.filter(i => i.target_type === '개인').length;
  const orgCount = dataList.filter(i => i.target_type === '기관/단체').length;
  const activeCount = dataList.filter(i => i.status === '활성').length;

  return (
    <div>
      {/* 1. 상단 타이틀 & 컨트롤 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '22px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⭐</span> 특별 감면 대상 관리
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal', backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
              🔒 원무팀/관리자 전용 비공개 탭
            </span>
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            개인 VIP 대상자 및 할인 협약 기관/단체의 특수 감면 혜택을 등록하고 관리합니다.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setImportModalOpen(true)} 
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            📥 엑셀/CSV 가져오기
          </button>
          <button 
            onClick={handleExportCSV} 
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            📤 엑셀 내려받기
          </button>
          <button 
            onClick={handleOpenAddModal} 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ➕ 특별 대상 신규 등록
          </button>
        </div>
      </div>

      {/* 2. 요약 통계 카드 */}
      <div className="responsive-stats stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-label">총 등록 대상</div>
          <div className="stat-value">{totalCount}건</div>
          <div className="stat-sub">전체 특별 감면 내역</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">개인 VIP 대상</div>
          <div className="stat-value" style={{ color: '#004680' }}>{personalCount}명</div>
          <div className="stat-sub">개인 지정 특수 대상자</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">협약 기관 / 단체</div>
          <div className="stat-value" style={{ color: '#0284c7' }}>{orgCount}곳</div>
          <div className="stat-sub">학교, 기업, 조합 등</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'rgba(5, 150, 105, 0.3)' }}>
          <div className="stat-label">현재 정상 적용중</div>
          <div className="stat-value" style={{ color: '#059669' }}>{activeCount}건</div>
          <div className="stat-sub">활성 유효 대상</div>
        </div>
      </div>

      {/* 3. 검색 및 서브 탭 필터 영역 */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* 분류 탭 버튼 */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['전체', '개인', '기관/단체'].map((type) => (
              <button
                key={type}
                onClick={() => setTargetTypeFilter(type)}
                className={`btn ${targetTypeFilter === type ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 14px', fontSize: '13px', borderRadius: '6px' }}
              >
                {type === '전체' ? '전체 보기' : type === '개인' ? '👤 개인 VIP' : '🏢 협약 기관/단체'}
              </button>
            ))}
          </div>

          {/* 상태 필터 및 키워드 검색 */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
              style={{ width: '130px', fontSize: '13px' }}
            >
              <option value="전체">상태: 전체</option>
              <option value="활성">상태: 활성 (적용중)</option>
              <option value="만료">상태: 만료</option>
              <option value="중단">상태: 중단</option>
            </select>

            <div className="quick-search-field" style={{ width: '260px' }}>
              <span className="quick-search-icon">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="이름, 차트번호, 사유, 요청자 검색..."
                className="quick-search-input"
              />
              {searchQuery && (
                <button className="quick-search-clear" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 4. 특별 감면 대상 리스트 테이블 */}
      <div className="glass-card">
        {loading ? (
          <div className="empty-state">특별 감면 대상 정보를 불러오는 중입니다...</div>
        ) : sortedData.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            등록된 특별 감면 대상 데이터가 존재하지 않습니다.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table compact">
              <thead>
                <tr>
                  <th style={{ width: '80px', whiteSpace: 'nowrap' }}>유형</th>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '120px' }}>
                    이름 / 기관명 {sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                  <th onClick={() => handleSort('chart_no')} style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '130px' }}>
                    차트번호 / 대상범위 {sortField === 'chart_no' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                  <th style={{ whiteSpace: 'nowrap', minWidth: '90px' }}>구분</th>
                  <th onClick={() => handleSort('discount_rate')} style={{ cursor: 'pointer', whiteSpace: 'nowrap', minWidth: '90px' }}>
                    할인율 {sortField === 'discount_rate' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                  </th>
                  {isAdmin && <th style={{ minWidth: '150px' }}>사유</th>}
                  <th style={{ whiteSpace: 'nowrap', minWidth: '100px' }}>요청자</th>
                  <th style={{ whiteSpace: 'nowrap', minWidth: '70px' }}>상태</th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap', minWidth: '160px' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((item) => (
                  <tr key={item.id} style={{ opacity: item.status !== '활성' ? 0.6 : 1 }}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '3px 7px', 
                        borderRadius: '4px', 
                        fontWeight: 'bold',
                        display: 'inline-block',
                        whiteSpace: 'nowrap',
                        backgroundColor: item.target_type === '개인' ? '#e0f2fe' : '#fef3c7',
                        color: item.target_type === '개인' ? '#0369a1' : '#b45309'
                      }}>
                        {item.target_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 'bold', color: '#0f172a', whiteSpace: 'nowrap' }}>{item.name}</td>
                    <td style={{ color: '#0284c7', fontWeight: '600', whiteSpace: 'nowrap' }}>{item.chart_no || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '3px 8px', 
                        borderRadius: '6px', 
                        fontWeight: 'bold',
                        display: 'inline-block',
                        whiteSpace: 'nowrap',
                        backgroundColor: item.category === '비급여만' ? '#ffedd5' : (item.category === '급여포함' ? '#dcfce7' : '#f1f5f9'),
                        color: item.category === '비급여만' ? '#c2410c' : (item.category === '급여포함' ? '#15803d' : '#475569'),
                        border: item.category === '비급여만' ? '1px solid #fed7aa' : (item.category === '급여포함' ? '1px solid #bbf7d0' : '1px solid #e2e8f0')
                      }}>
                        {item.category || '급여포함'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {(item.discount_outpatient || item.discount_inpatient || item.discount_checkup) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px' }}>
                          {item.discount_outpatient && (
                            <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                              외래: <strong>{formatRate(item.discount_outpatient)}</strong>
                            </span>
                          )}
                          {item.discount_inpatient && (
                            <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                              입원: <strong>{formatRate(item.discount_inpatient)}</strong>
                            </span>
                          )}
                          {item.discount_checkup && (
                            <span style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', padding: '1px 5px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                              검진: <strong>{formatRate(item.discount_checkup)}</strong>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#059669', whiteSpace: 'nowrap' }}>
                          {formatRate(item.discount_rate)}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.reason}>
                        {item.reason || '-'}
                      </td>
                    )}
                    <td style={{ color: '#475569', fontWeight: '500', whiteSpace: 'nowrap' }}>{item.requester || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className={`status-badge ${item.status === '활성' ? 'status-최종승인' : 'status-반려'}`} style={{ padding: '3px 8px', fontSize: '11px', whiteSpace: 'nowrap', display: 'inline-block' }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button 
                          onClick={() => handleOpenHistoryModal(item)} 
                          className="btn btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '12px', color: '#0369a1', borderColor: '#bae6fd', backgroundColor: '#f0f9ff', whiteSpace: 'nowrap' }}
                          title="변경 이력 타임라인 보기"
                        >
                          📋 이력
                        </button>
                        <button 
                          onClick={() => handleOpenEditModal(item)} 
                          className="btn btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '12px', whiteSpace: 'nowrap' }}
                        >
                          수정
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(item.id, item.name)} 
                          className="btn btn-danger"
                          style={{ padding: '3px 8px', fontSize: '12px', whiteSpace: 'nowrap' }}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. 등록 / 수정 모달 */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '640px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingItem ? '⭐ 특별 감면 대상 정보 수정' : '⭐ 특별 감면 대상 신규 등록'}
              </h3>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)}>&times;</button>
            </div>

            <form onSubmit={handleSubmitForm}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label required">대상 분류</label>
                  <select
                    value={formData.target_type}
                    onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
                    className="form-select"
                  >
                    <option value="개인">개인 (VIP / 특수대상자)</option>
                    <option value="기관/단체">기관/단체 (학교, 기업, 조합)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label required">
                    {formData.target_type === '개인' ? '성명 (이름)' : '기관 / 단체명'}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder=""
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {formData.target_type === '개인' ? '차트번호 (병록번호)' : '적용 대상 범위'}
                  </label>
                  <input
                    type="text"
                    value={formData.chart_no}
                    onChange={(e) => setFormData({ ...formData, chart_no: e.target.value })}
                    placeholder=""
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">대표 / 통합 할인율 (%)</label>
                  <input
                    type="text"
                    value={formData.discount_rate}
                    onChange={(e) => setFormData({ ...formData, discount_rate: e.target.value })}
                    placeholder=""
                    required
                    className="form-input"
                  />
                </div>

                {/* 진료구분별 세부 할인율 입력 섹션 */}
                <div className="form-group" style={{ gridColumn: 'span 2', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box', width: '100%' }}>
                  <label className="form-label" style={{ fontWeight: 'bold', color: '#004680', marginBottom: '8px', display: 'block', fontSize: '13px' }}>
                    🩺 진료 구분별 세부 할인율 설정 (외래 / 입원 / 검진 개별 지정 시 입력)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px', whiteSpace: 'nowrap' }}>외래 할인율</span>
                      <input
                        type="text"
                        value={formData.discount_outpatient}
                        onChange={(e) => setFormData({ ...formData, discount_outpatient: e.target.value })}
                        placeholder=""
                        className="form-input"
                        style={{ fontSize: '12px', width: '100%', boxSizing: 'border-box', minWidth: 0 }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px', whiteSpace: 'nowrap' }}>입원 할인율</span>
                      <input
                        type="text"
                        value={formData.discount_inpatient}
                        onChange={(e) => setFormData({ ...formData, discount_inpatient: e.target.value })}
                        placeholder=""
                        className="form-input"
                        style={{ fontSize: '12px', width: '100%', boxSizing: 'border-box', minWidth: 0 }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px', whiteSpace: 'nowrap' }}>검진 할인율</span>
                      <input
                        type="text"
                        value={formData.discount_checkup}
                        onChange={(e) => setFormData({ ...formData, discount_checkup: e.target.value })}
                        placeholder=""
                        className="form-input"
                        style={{ fontSize: '12px', width: '100%', boxSizing: 'border-box', minWidth: 0 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">적용 구분</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="form-select"
                  >
                    <option value="급여포함">급여포함 (급여 + 비급여 항목 전체 적용)</option>
                    <option value="비급여만">비급여만 (비급여 항목만 할인 적용)</option>
                    {formData.category && formData.category !== '급여포함' && formData.category !== '비급여만' && (
                      <option value={formData.category}>{formData.category}</option>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">요청자 (승인자)</label>
                  <input
                    type="text"
                    value={formData.requester}
                    onChange={(e) => setFormData({ ...formData, requester: e.target.value })}
                    placeholder=""
                    className="form-input"
                  />
                </div>

                {isAdmin && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">사유 / 배경</label>
                    <input
                      type="text"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder=""
                      className="form-input"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">요청일자 / 등록일</label>
                  <input
                    type="date"
                    value={formData.request_date}
                    onChange={(e) => setFormData({ ...formData, request_date: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">적용 상태</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="form-select"
                  >
                    <option value="활성">활성 (적용중)</option>
                    <option value="만료">만료</option>
                    <option value="중단">중단</option>
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">원무팀 비공개 메모 및 유의사항</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="원무팀 수납/접수 시 확인할 특이사항을 적어주세요."
                    className="form-textarea"
                    rows={2}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">취소</button>
                <button type="submit" disabled={formLoading} className="btn btn-primary">
                  {formLoading ? '저장 중...' : (editingItem ? '수정 내용 저장' : '신규 등록')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. 엑셀 Import 모달 */}
      {importModalOpen && (
        <div className="modal-overlay" onClick={() => setImportModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📥 특별 감면 대상 엑셀/CSV 데이터 일괄 가져오기</h3>
              <button className="modal-close-btn" onClick={() => setImportModalOpen(false)}>&times;</button>
            </div>

            <div className="modal-body">
              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', padding: '12px', borderRadius: '6px', fontSize: '13px', color: '#0369a1', marginBottom: '16px' }}>
                💡 기존에 관리하시던 엑셀 파일(이름, 차트번호, 구분, 할인율, 사유, 요청자, 요청일자)을 선택하시면 자동으로 파싱되어 등록됩니다.
              </div>

              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleImportFileUpload}
                style={{ marginBottom: '16px', fontSize: '14px' }}
              />

              {importLoading && <div className="empty-state">파일을 읽고 데이터 파싱 중입니다...</div>}

              {parsedImportData.length > 0 && (
                <div>
                  <div style={{ fontWeight: 'bold', color: '#059669', marginBottom: '8px', fontSize: '14px' }}>
                    ✅ 총 {parsedImportData.length}건의 특별 감면 대상 데이터가 파싱되었습니다.
                  </div>
                  <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                    <table className="custom-table compact" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>유형</th>
                          <th>이름/기관명</th>
                          <th>차트번호/범위</th>
                          <th>구분</th>
                          <th>할인율</th>
                          <th>사유</th>
                          <th>요청자</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedImportData.map((d, idx) => (
                          <tr key={idx}>
                            <td>{d.target_type}</td>
                            <td>{d.name}</td>
                            <td>{d.chart_no}</td>
                            <td>{d.category}</td>
                            <td style={{ color: '#059669', fontWeight: 'bold' }}>{d.discount_rate}</td>
                            <td>{d.reason}</td>
                            <td>{d.requester}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setImportModalOpen(false)} className="btn btn-secondary">취소</button>
              <button 
                onClick={handleSaveImportData} 
                disabled={importLoading || parsedImportData.length === 0}
                className="btn btn-primary"
              >
                DB에 일괄 등록 ({parsedImportData.length}건)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. 변경 이력 타임라인 모달 */}
      {historyModalOpen && (
        <div className="modal-overlay" onClick={() => setHistoryModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '640px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                📋 변경 이력 타임라인 ({selectedHistoryItem?.name || ''})
              </h3>
              <button className="modal-close-btn" onClick={() => setHistoryModalOpen(false)}>&times;</button>
            </div>

            <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  이력을 불러오는 중입니다...
                </div>
              ) : itemHistoryLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                  등록된 변경 이력이 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {itemHistoryLogs.filter(log => isAdmin || log.field_name !== '사유/배경').map((log) => (
                    <div 
                      key={log.id} 
                      style={{ 
                        backgroundColor: '#f8fafc', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '8px', 
                        padding: '12px 14px' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: '#64748b' }}>
                        <span>
                          👤 <strong>{log.edited_by_name}</strong> ({log.edited_by_email})
                        </span>
                        <span>
                          🕒 {new Date(log.edited_at).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 'bold', marginBottom: '4px' }}>
                        🔹 [{log.field_name}] {log.field_name === '신규 등록' ? '생성' : '수정'}
                      </div>
                      {log.field_name !== '신규 등록' ? (
                        <div style={{ fontSize: '12px', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px' }}>
                            기존: {log.before_value}
                          </span>
                          <span>➔</span>
                          <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            변경: {log.after_value}
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#166534', backgroundColor: '#dcfce7', padding: '4px 8px', borderRadius: '4px' }}>
                          {log.after_value}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setHistoryModalOpen(false)} className="btn btn-secondary">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
