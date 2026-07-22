import { createClient } from '@supabase/supabase-js';

// 환경 변수 로드
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 기본 자리표시자이거나 누락되었는지 확인하여 Mock 모드 판정
const isMockMode = 
  !supabaseUrl || 
  !supabaseAnonKey || 
  supabaseUrl === 'your_supabase_project_url' || 
  supabaseAnonKey === 'your_supabase_anon_public_key';

let supabaseInstance = null;

if (!isMockMode) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    console.log('Supabase Real Client Initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize real Supabase client, falling back to Mock DB:', err);
    supabaseInstance = null;
  }
}

// ==========================================
// Mock Database (localStorage + Memory Fallback) 구현부
// ==========================================

const MOCK_STORAGE_KEYS = {
  users: 'discount_app_users',
  departments: 'discount_app_departments',
  clinic_departments: 'discount_app_clinic_departments',
  code_options: 'discount_app_code_options',
  discount_requests: 'discount_app_requests',
  request_status_logs: 'discount_app_status_logs',
  request_edit_logs: 'discount_app_edit_logs',
  access_logs: 'discount_app_access_logs',
  session: 'discount_app_session'
};

// 인메모리 저장소 백업 (localStorage 접근 차단 또는 브라우저 보안 이슈용)
const memoryStore = {};

function safeGetItem(key) {
  try {
    return localStorage.getItem(key) || memoryStore[key] || null;
  } catch (e) {
    return memoryStore[key] || null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // block or private mode fallback
  }
  memoryStore[key] = value;
}

// 초기 시드 데이터 정의 (직원 소속 부서용)
const SEED_DEPARTMENTS = [
  {
    "id": "00000000-0000-0000-0000-000000000001",
    "name": "병원장",
    "level": 1,
    "parent_id": null
  },
  {
    "id": "00000000-0000-0000-0000-000000000002",
    "name": "경영분석실",
    "level": 1,
    "parent_id": null
  },
  {
    "id": "00000000-0000-0000-0000-000000000003",
    "name": "조직문화성장실",
    "level": 1,
    "parent_id": null
  },
  {
    "id": "00000000-0000-0000-0000-000000000004",
    "name": "조직문화팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000003"
  },
  {
    "id": "00000000-0000-0000-0000-000000000005",
    "name": "HR팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000003"
  },
  {
    "id": "00000000-0000-0000-0000-000000000006",
    "name": "브랜딩실",
    "level": 1,
    "parent_id": null
  },
  {
    "id": "00000000-0000-0000-0000-000000000007",
    "name": "홍보팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000006"
  },
  {
    "id": "00000000-0000-0000-0000-000000000008",
    "name": "뉴미디어팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000006"
  },
  {
    "id": "00000000-0000-0000-0000-000000000009",
    "name": "전담부서",
    "level": 1,
    "parent_id": null
  },
  {
    "id": "00000000-0000-0000-0000-00000000000a",
    "name": "감염관리팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000009"
  },
  {
    "id": "00000000-0000-0000-0000-00000000000b",
    "name": "안전보건팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000009"
  },
  {
    "id": "00000000-0000-0000-0000-00000000000c",
    "name": "QPS팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000009"
  },
  {
    "id": "00000000-0000-0000-0000-00000000000d",
    "name": "진료협력전담팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000009"
  },
  {
    "id": "00000000-0000-0000-0000-00000000000e",
    "name": "통합의료",
    "level": 1,
    "parent_id": null
  },
  {
    "id": "00000000-0000-0000-0000-00000000000f",
    "name": "통합진료부",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-00000000000e"
  },
  {
    "id": "00000000-0000-0000-0000-000000000010",
    "name": "영상의학과",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-00000000000f"
  },
  {
    "id": "00000000-0000-0000-0000-000000000011",
    "name": "내과",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-00000000000f"
  },
  {
    "id": "00000000-0000-0000-0000-000000000012",
    "name": "소화기내과",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-000000000011"
  },
  {
    "id": "00000000-0000-0000-0000-000000000013",
    "name": "내분비내과",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-000000000011"
  },
  {
    "id": "00000000-0000-0000-0000-000000000014",
    "name": "순환기내과",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-000000000011"
  },
  {
    "id": "00000000-0000-0000-0000-000000000015",
    "name": "가정의학과",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-00000000000f"
  },
  {
    "id": "00000000-0000-0000-0000-000000000016",
    "name": "통합의료전문센터",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-00000000000e"
  },
  {
    "id": "00000000-0000-0000-0000-000000000017",
    "name": "갑상선센터",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000016"
  },
  {
    "id": "00000000-0000-0000-0000-000000000018",
    "name": "유방센터",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000016"
  },
  {
    "id": "00000000-0000-0000-0000-000000000019",
    "name": "내과내시경센터",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000016"
  },
  {
    "id": "00000000-0000-0000-0000-00000000001a",
    "name": "건강증진센터",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000016"
  },
  {
    "id": "00000000-0000-0000-0000-00000000001b",
    "name": "비타민면역센터",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000016"
  },
  {
    "id": "00000000-0000-0000-0000-00000000001c",
    "name": "통합지원실",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-00000000000e"
  },
  {
    "id": "00000000-0000-0000-0000-00000000001d",
    "name": "갑상선유방팀",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-00000000001c"
  },
  {
    "id": "00000000-0000-0000-0000-00000000001e",
    "name": "내과내시경팀",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-00000000001c"
  },
  {
    "id": "00000000-0000-0000-0000-00000000001f",
    "name": "건강증진팀",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-00000000001c"
  },
  {
    "id": "00000000-0000-0000-0000-000000000020",
    "name": "가정의학팀",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-00000000001c"
  },
  {
    "id": "00000000-0000-0000-0000-000000000021",
    "name": "영상의학팀",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-00000000001c"
  },
  {
    "id": "00000000-0000-0000-0000-000000000022",
    "name": "진단검사팀",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-00000000001c"
  },
  {
    "id": "00000000-0000-0000-0000-000000000023",
    "name": "재활의료",
    "level": 1,
    "parent_id": null
  },
  {
    "id": "00000000-0000-0000-0000-000000000024",
    "name": "재활진료부",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000023"
  },
  {
    "id": "00000000-0000-0000-0000-000000000025",
    "name": "재활의학과",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000024"
  },
  {
    "id": "00000000-0000-0000-0000-000000000026",
    "name": "한방과",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000024"
  },
  {
    "id": "00000000-0000-0000-0000-000000000027",
    "name": "야간전담과",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000024"
  },
  {
    "id": "00000000-0000-0000-0000-000000000028",
    "name": "재활의료전문센터",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000023"
  },
  {
    "id": "00000000-0000-0000-0000-000000000029",
    "name": "뇌신경재활센터",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000028"
  },
  {
    "id": "00000000-0000-0000-0000-00000000002a",
    "name": "척수손상재활센터",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000028"
  },
  {
    "id": "00000000-0000-0000-0000-00000000002b",
    "name": "일상재활센터",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000028"
  },
  {
    "id": "00000000-0000-0000-0000-00000000002c",
    "name": "외래재활센터",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000028"
  },
  {
    "id": "00000000-0000-0000-0000-00000000002d",
    "name": "언어인지재활전문센터",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000028"
  },
  {
    "id": "00000000-0000-0000-0000-00000000002e",
    "name": "재활지원",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000023"
  },
  {
    "id": "00000000-0000-0000-0000-00000000002f",
    "name": "재활간호팀",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-00000000002e"
  },
  {
    "id": "00000000-0000-0000-0000-000000000030",
    "name": "5층 생활재활파트",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-000000000031",
    "name": "6층 생활재활파트",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-000000000032",
    "name": "통합병동 교육전담",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-000000000033",
    "name": "7층 생활재활파트",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-000000000034",
    "name": "8층 생활재활파트",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-000000000035",
    "name": "일상재활파트",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-000000000036",
    "name": "외래재활파트",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-000000000037",
    "name": "한방파트",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-000000000038",
    "name": "CSR(소독실)",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-000000000039",
    "name": "5층 병동지원인력",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-00000000003a",
    "name": "5층 이동간병사",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-00000000003b",
    "name": "5층 재활지원인력",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-00000000003c",
    "name": "6층 병동지원인력",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-00000000003d",
    "name": "6층 재활지원인력",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000002f"
  },
  {
    "id": "00000000-0000-0000-0000-00000000003e",
    "name": "재활치료",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-00000000002e"
  },
  {
    "id": "00000000-0000-0000-0000-00000000003f",
    "name": "재활치료1팀",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000003e"
  },
  {
    "id": "00000000-0000-0000-0000-000000000040",
    "name": "재활치료2팀",
    "level": 4,
    "parent_id": "00000000-0000-0000-0000-00000000003e"
  },
  {
    "id": "00000000-0000-0000-0000-000000000041",
    "name": "재활복지",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000023"
  },
  {
    "id": "00000000-0000-0000-0000-000000000042",
    "name": "사회사업팀",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000041"
  },
  {
    "id": "00000000-0000-0000-0000-000000000043",
    "name": "재활코치팀",
    "level": 3,
    "parent_id": "00000000-0000-0000-0000-000000000041"
  },
  {
    "id": "00000000-0000-0000-0000-000000000044",
    "name": "경영지원",
    "level": 1,
    "parent_id": null
  },
  {
    "id": "00000000-0000-0000-0000-000000000045",
    "name": "경영지원실",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000044"
  },
  {
    "id": "00000000-0000-0000-0000-000000000046",
    "name": "원무팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000044"
  },
  {
    "id": "00000000-0000-0000-0000-000000000047",
    "name": "심사팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000044"
  },
  {
    "id": "00000000-0000-0000-0000-000000000048",
    "name": "전산팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000044"
  },
  {
    "id": "00000000-0000-0000-0000-000000000049",
    "name": "총무팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000044"
  },
  {
    "id": "00000000-0000-0000-0000-00000000004a",
    "name": "시설팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000044"
  },
  {
    "id": "00000000-0000-0000-0000-00000000004b",
    "name": "재무팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000044"
  },
  {
    "id": "00000000-0000-0000-0000-00000000004c",
    "name": "영양팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000044"
  },
  {
    "id": "00000000-0000-0000-0000-00000000004d",
    "name": "약제팀",
    "level": 2,
    "parent_id": "00000000-0000-0000-0000-000000000044"
  },
  {
    "id": "00000000-0000-0000-0000-00000000004e",
    "name": "나눔과행복의료재단",
    "level": 1,
    "parent_id": null
  },
  {
    "id": "00000000-0000-0000-0000-00000000004f",
    "name": "(사)나눔으로 행복한 동행",
    "level": 1,
    "parent_id": null
  }
];

// 진료과 & 의료인 코드 정의 (병원 감면 심사용)
const SEED_CLINIC_DEPARTMENTS = [
  { name: 'RM_1 (서휘)', code: 'RM_1', doctor_name: '서휘' },
  { name: 'RM_2 (박여진)', code: 'RM_2', doctor_name: '박여진' },
  { name: 'RM_3 (차은겸)', code: 'RM_3', doctor_name: '차은겸' },
  { name: 'RM_4 (김인혜)', code: 'RM_4', doctor_name: '김인혜' },
  { name: 'RM_5 (김완호)', code: 'RM_5', doctor_name: '김완호' },
  { name: 'RD_1 (백선미)', code: 'RD_1', doctor_name: '백선미' },
  { name: 'RD_2 (신수영)', code: 'RD_2', doctor_name: '신수영' },
  { name: 'RD_3 (손정민)', code: 'RD_3', doctor_name: '손정민' },
  { name: 'RD_5 (김현수)', code: 'RD_5', doctor_name: '김현수' },
  { name: 'RD_10 (서영화)', code: 'RD_10', doctor_name: '서영화' },
  { name: 'IM_1 (고인영)', code: 'IM_1', doctor_name: '고인영' },
  { name: 'IM_3 (남지현)', code: 'IM_3', doctor_name: '남지현' },
  { name: 'IM_5 (정민정)', code: 'IM_5', doctor_name: '정민정' },
  { name: 'IM_7 (류승훈)', code: 'IM_7', doctor_name: '류승훈' },
  { name: 'EI (박미경)', code: 'EI', doctor_name: '박미경' },
  { name: 'CI (박민아)', code: 'CI', doctor_name: '박민아' },
  { name: 'FM (황은교)', code: 'FM', doctor_name: '황은교' },
  { name: '한방 (김종삼)', code: '한방', doctor_name: '김종삼' }
];

const SEED_CODE_OPTIONS = [
  { id: 1, category: 'discount_type', code: 'outpatient', value: '외래', sort_order: 1 },
  { id: 2, category: 'discount_type', code: 'inpatient', value: '입원', sort_order: 2 },
  { id: 3, category: 'discount_type', code: 'checkup', value: '검진', sort_order: 3 },
  { id: 4, category: 'discount_type', code: 'other', value: '기타', sort_order: 4 },
  { id: 5, category: 'discount_reason', code: 'regulation', value: '감면규정등록', sort_order: 1 },
  { id: 6, category: 'discount_reason', code: 'request', value: '의료진 요청', sort_order: 2 },
  { id: 7, category: 'discount_reason', code: 'complaint', value: '민원', sort_order: 3 },
  { id: 8, category: 'discount_reason', code: 'social', value: '사회사업', sort_order: 4 },
  { id: 9, category: 'discount_reason', code: 'liability', value: '병원 귀책', sort_order: 5 },
  { id: 10, category: 'discount_reason', code: 'other', value: '기타 (상세내용 기재 필수)', sort_order: 6 },
  { id: 11, category: 'relationship', code: 'none', value: '기타 (관계없음-감면등록용)', sort_order: 1 },
  { id: 12, category: 'relationship', code: 'self_spouse', value: '본인/배우자', sort_order: 2 },
  { id: 13, category: 'relationship', code: 'direct', value: '직계 (자녀,부모(본인 또는 배우자의))', sort_order: 3 },
  { id: 14, category: 'relationship', code: 'collateral', value: '방계 (본인 또는 배우자의)', sort_order: 4 },
  { id: 15, category: 'relationship', code: 'acquaintance', value: '친인척/지인', sort_order: 5 }
];

const SEED_USERS = [
  { email: 'applicant@hospital.com', name: '홍신청', role: 'applicant', is_sysadmin: false, status: 'approved', department_id: '00000000-0000-0000-0000-00000000002f' },
  { email: 'team_manager@hospital.com', name: '이팀장', role: 'team_manager', is_sysadmin: false, status: 'approved', department_id: '00000000-0000-0000-0000-00000000002f' },
  { email: 'staff@hospital.com', name: '김원무', role: 'admin', is_sysadmin: false, status: 'approved', department_id: '00000000-0000-0000-0000-000000000046' },
  { email: 'manager@hospital.com', name: '박팀장', role: 'manager', is_sysadmin: false, status: 'approved', department_id: '00000000-0000-0000-0000-000000000046' },
  { email: 'sysadmin@hospital.com', name: '최관리', role: 'manager', is_sysadmin: true, status: 'approved', department_id: '00000000-0000-0000-0000-000000000048' },
  { email: 'director@hospital.com', name: '병원장', role: 'superadmin', is_sysadmin: true, status: 'approved', department_id: '00000000-0000-0000-0000-000000000001' }
];

// 초기 시드 데이터 로드 유틸리티 (배열이 깨졌거나 비어있으면 재생성)
function initMockDB() {
  // 이전 세션의 캐시된 구버전 데이터가 존재할 경우 자동 갱신 조치
  try {
    const storedCodes = safeGetItem(MOCK_STORAGE_KEYS.code_options);
    if (storedCodes) {
      const parsed = JSON.parse(storedCodes);
      if (parsed.some(item => item.value === '본인(직원) 감면' || item.value === '감면규정') || !parsed.some(item => item.category === 'relationship')) {
        safeSetItem(MOCK_STORAGE_KEYS.code_options, JSON.stringify(SEED_CODE_OPTIONS));
      }
    }
  } catch (e) {}

  try {
    const storedDepts = safeGetItem(MOCK_STORAGE_KEYS.departments);
    if (storedDepts && JSON.parse(storedDepts).some(item => !item.id || item.name === '정형외과')) {
      safeSetItem(MOCK_STORAGE_KEYS.departments, JSON.stringify(SEED_DEPARTMENTS));
      // 사용자 소속 컬럼도 바뀌었으므로 users 테이블도 리셋
      localStorage.removeItem(MOCK_STORAGE_KEYS.users);
    }
  } catch (e) {}

  try {
    const storedReqs = safeGetItem(MOCK_STORAGE_KEYS.discount_requests);
    if (storedReqs && JSON.parse(storedReqs).some(item => !item.clinic_date || item.reason_category === '직계가족 감면' || item.reason_category === '감면규정' || item.status === '1차확인완료' || item.status === '취소')) {
      // 진료일자 누락, 구버전 사유 정보 또는 구버전 처리상태 검출 시 신청 및 로그 데이터를 리셋하여 자동 재시딩 유도
      localStorage.removeItem(MOCK_STORAGE_KEYS.discount_requests);
      localStorage.removeItem(MOCK_STORAGE_KEYS.request_status_logs);
      localStorage.removeItem(MOCK_STORAGE_KEYS.request_edit_logs);
      localStorage.removeItem(MOCK_STORAGE_KEYS.access_logs);
    }
  } catch (e) {}

  try {
    const storedUsers = safeGetItem(MOCK_STORAGE_KEYS.users);
    if (storedUsers) {
      const parsedUsers = JSON.parse(storedUsers);
      // 구버전(상태 없는 경우) 또는 병원장 계정 없는 경우 초기화
      if (parsedUsers.length > 0 && (parsedUsers.some(u => u.status === undefined) || !parsedUsers.some(u => u.email === 'director@hospital.com'))) {
        localStorage.removeItem(MOCK_STORAGE_KEYS.users);
      }
    }
  } catch (e) {}

  // 정식 서비스 전환용: 이전 가짜 신청 데이터 완전 초기화
  if (!localStorage.getItem('prod_clear_v1')) {
    localStorage.removeItem(MOCK_STORAGE_KEYS.discount_requests);
    localStorage.removeItem(MOCK_STORAGE_KEYS.request_status_logs);
    localStorage.removeItem(MOCK_STORAGE_KEYS.request_edit_logs);
    localStorage.removeItem(MOCK_STORAGE_KEYS.access_logs);
    localStorage.setItem('prod_clear_v1', 'true');
  }

  const checkAndSeed = (key, defaultData) => {
    const stored = safeGetItem(key);
    let needSeed = false;
    if (!stored) {
      needSeed = true;
    } else {
      try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          needSeed = true;
        }
      } catch (e) {
        needSeed = true;
      }
    }
    if (needSeed) {
      safeSetItem(key, JSON.stringify(defaultData));
    }
  };

  checkAndSeed(MOCK_STORAGE_KEYS.departments, SEED_DEPARTMENTS);
  checkAndSeed(MOCK_STORAGE_KEYS.clinic_departments, SEED_CLINIC_DEPARTMENTS);
  checkAndSeed(MOCK_STORAGE_KEYS.code_options, SEED_CODE_OPTIONS);
  checkAndSeed(MOCK_STORAGE_KEYS.users, SEED_USERS);

  // 모의 신청 데이터 3건 초기 시드 제거 (빈 배열로 처리)
  const mockRequests = [];
  const mockStatusLogs = [];
  const mockEditLogs = [];

  checkAndSeed(MOCK_STORAGE_KEYS.discount_requests, mockRequests);
  checkAndSeed(MOCK_STORAGE_KEYS.request_status_logs, mockStatusLogs);
  checkAndSeed(MOCK_STORAGE_KEYS.request_edit_logs, mockEditLogs);

  const storedAccess = safeGetItem(MOCK_STORAGE_KEYS.access_logs);
  if (!storedAccess) {
    safeSetItem(MOCK_STORAGE_KEYS.access_logs, JSON.stringify([]));
  }
}

// 데이터 읽기 유틸리티
function getMockData(table) {
  initMockDB();
  const key = MOCK_STORAGE_KEYS[table];
  if (!key) return [];
  const stored = safeGetItem(key);
  try {
    return JSON.parse(stored || '[]');
  } catch (e) {
    console.error(`Error parsing mock table ${table}, resetting:`, e);
    return [];
  }
}

// 데이터 저장 유틸리티
function saveMockData(table, data) {
  const key = MOCK_STORAGE_KEYS[table];
  if (key) {
    safeSetItem(key, JSON.stringify(data));
  }
}

// Promise 체이닝 흉내를 내는 Mock 쿼리 빌더
class MockQueryBuilder {
  constructor(table) {
    this.table = table;
    this.data = getMockData(table);
    this.filters = [];
    this.sortField = null;
    this.sortAscending = true;
    this.limitCount = null;
    this.isSingle = false;
    this.isUpdate = false;
    this.updateValues = null;
    this.isDelete = false;
    this.isInsert = false;
    this.insertRows = null;
    this.isUpsert = false;
    this.upsertRows = null;
  }

  select(columns = '*') {
    // 기본 체이닝 구조를 위해 자기 자신 반환
    return this;
  }

  eq(field, value) {
    this.filters.push(item => item[field] === value);
    return this;
  }

  neq(field, value) {
    this.filters.push(item => item[field] !== value);
    return this;
  }

  in(field, values) {
    this.filters.push(item => values.includes(item[field]));
    return this;
  }

  like(field, value) {
    // SQL의 LIKE '%값%' 형태 재현
    const cleanValue = value.replace(/%/g, '').toLowerCase();
    this.filters.push(item => 
      item[field] !== undefined && 
      item[field] !== null && 
      item[field].toString().toLowerCase().includes(cleanValue)
    );
    return this;
  }

  gte(field, value) {
    this.filters.push(item => {
      if (!item[field]) return false;
      return new Date(item[field]) >= new Date(value);
    });
    return this;
  }

  lte(field, value) {
    this.filters.push(item => {
      if (!item[field]) return false;
      return new Date(item[field]) <= new Date(value);
    });
    return this;
  }

  order(field, { ascending = true } = {}) {
    this.sortField = field;
    this.sortAscending = ascending;
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  // INSERT 처리 지연 바인딩 (체이닝 지원)
  insert(rows) {
    this.isInsert = true;
    this.insertRows = rows;
    return this;
  }

  // UPDATE 처리 지연 바인딩 (체이닝 지원)
  update(values) {
    this.isUpdate = true;
    this.updateValues = values;
    return this;
  }

  // DELETE 처리 지연 바인딩 (체이닝 지원)
  delete() {
    this.isDelete = true;
    return this;
  }

  // UPSERT 처리 지연 바인딩 (체이닝 지원)
  upsert(rows) {
    this.isUpsert = true;
    this.upsertRows = rows;
    return this;
  }

  // SELECT / UPDATE / DELETE / INSERT / UPSERT 최종 조건 맞춰 실행
  async execute() {
    // 1. INSERT 지연 실행
    if (this.isInsert) {
      const currentData = getMockData(this.table);
      const newRows = Array.isArray(this.insertRows) ? this.insertRows : [this.insertRows];
      
      const processedRows = newRows.map(row => ({
        id: row.id || `mock-id-${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...row
      }));

      const updatedData = [...currentData, ...processedRows];
      saveMockData(this.table, updatedData);
      
      const resData = Array.isArray(this.insertRows) ? processedRows : processedRows[0];
      if (this.isSingle) {
        return { data: processedRows[0] || null, error: processedRows[0] ? null : { message: 'Item not found' } };
      }
      return { data: resData, error: null };
    }

    // 2. UPSERT 지연 실행
    if (this.isUpsert) {
      const currentData = getMockData(this.table);
      const incoming = Array.isArray(this.upsertRows) ? this.upsertRows : [this.upsertRows];
      
      incoming.forEach(row => {
        // primary key 판정 (email 혹은 id)
        const pkField = this.table === 'users' ? 'email' : 'id';
        const existingIdx = currentData.findIndex(item => item[pkField] === row[pkField]);
        
        const record = {
          created_at: new Date().toISOString(),
          ...row,
          updated_at: new Date().toISOString()
        };

        if (existingIdx >= 0) {
          currentData[existingIdx] = { ...currentData[existingIdx], ...record };
        } else {
          currentData.push(record);
        }
      });

      saveMockData(this.table, currentData);
      
      const resData = Array.isArray(this.upsertRows) ? incoming : incoming[0];
      if (this.isSingle) {
        return { data: incoming[0] || null, error: incoming[0] ? null : { message: 'Item not found' } };
      }
      return { data: resData, error: null };
    }

    // 3. UPDATE 지연 실행
    if (this.isUpdate) {
      const currentData = getMockData(this.table);
      
      // 필터 적용 인덱스 선별
      let filteredIndices = [];
      currentData.forEach((item, index) => {
        let matches = true;
        for (const filter of this.filters) {
          if (!filter(item)) {
            matches = false;
            break;
          }
        }
        if (matches) {
          filteredIndices.push(index);
        }
      });

      const updatedRows = [];
      filteredIndices.forEach(idx => {
        const original = currentData[idx];
        const updated = {
          ...original,
          ...this.updateValues,
          updated_at: new Date().toISOString()
        };
        currentData[idx] = updated;
        updatedRows.push(updated);
      });

      saveMockData(this.table, currentData);

      // 만약 users 테이블을 갱신하는 것이고, 현재 세션 사용자와 이메일이 같다면 세션 동시 갱신
      if (this.table === 'users' && updatedRows.length > 0) {
        try {
          const session = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEYS.session) || 'null');
          if (session && session.user) {
            const updatedUser = updatedRows.find(u => u.email === session.user.email);
            if (updatedUser) {
              const depts = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEYS.departments) || '[]');
              const deptObj = depts.find(d => d.id === updatedUser.department_id);
              const deptName = deptObj ? deptObj.name : '미기입';
              
              session.user.user_metadata = {
                ...session.user.user_metadata,
                full_name: updatedUser.name,
                role: updatedUser.role,
                department_id: updatedUser.department_id,
                department: deptName
              };
              localStorage.setItem(MOCK_STORAGE_KEYS.session, JSON.stringify(session));
              
              // 실시간 GNB 반영을 위해 Auth 변경 통보 실행
              if (authChangeCallback) {
                authChangeCallback('USER_UPDATED', session);
              }
            }
          }
        } catch (e) {
          console.error('세션 동기화 갱신 오류:', e);
        }
      }
      
      if (this.isSingle) {
        return { data: updatedRows[0] || null, error: updatedRows[0] ? null : { message: 'Item not found' } };
      }
      return { data: updatedRows, error: null };
    }

    // 4. DELETE 지연 실행
    if (this.isDelete) {
      const currentData = getMockData(this.table);
      const remainingRows = [];
      const deletedRows = [];

      currentData.forEach(item => {
        let matches = true;
        for (const filter of this.filters) {
          if (!filter(item)) {
            matches = false;
            break;
          }
        }
        if (matches) {
          deletedRows.push(item);
        } else {
          remainingRows.push(item);
        }
      });

      saveMockData(this.table, remainingRows);

      if (this.isSingle) {
        return { data: deletedRows[0] || null, error: deletedRows[0] ? null : { message: 'Item not found' } };
      }
      return { data: deletedRows, error: null };
    }

    // 5. SELECT 실행
    let result = [...this.data];
    
    // 필터링 적용
    for (const filter of this.filters) {
      result = result.filter(filter);
    }
    
    // 정렬 적용 (자연어 정렬 적용)
    if (this.sortField) {
      result.sort((a, b) => {
        const valA = a[this.sortField];
        const valB = b[this.sortField];
        
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        
        const strA = String(valA);
        const strB = String(valB);
        const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
        return this.sortAscending ? cmp : -cmp;
      });
    }

    // Limit 제한
    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    // Single 객체 반환 여부
    if (this.isSingle) {
      return { data: result[0] || null, error: result[0] ? null : { message: 'Item not found' } };
    }

    return { data: result, error: null };
  }

  // await 키워드를 직접 쓸 수 있도록 Promise Thenable 인터페이스 구현
  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// Mock Supabase 클라이언트 구조
const mockSupabase = {
  from(table) {
    initMockDB();
    return new MockQueryBuilder(table);
  },
  auth: {
    getUser: async () => {
      initMockDB();
      const session = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEYS.session) || 'null');
      if (session && session.user) {
        return { data: { user: session.user }, error: null };
      }
      return { data: { user: null }, error: null };
    },
    getSession: async () => {
      initMockDB();
      const session = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEYS.session) || 'null');
      return { data: { session }, error: null };
    },
    // 구글 소셜 로그인 모의 처리
    signInWithOAuth: async ({ provider, options }) => {
      console.log(`Mocking OAuth Login with ${provider}... Redirecting inside SPA.`);
      return { data: { provider }, error: null };
    },
    // 로그아웃
    signOut: async () => {
      localStorage.removeItem(MOCK_STORAGE_KEYS.session);
      return { error: null };
    },
    // 모의 테스트용 간이 로그인 함수 (개발용 추가)
    mockLogin: async (email) => {
      initMockDB();
      const users = getMockData('users');
      let userRecord = users.find(u => u.email === email);
      
      if (!userRecord) {
        // 존재하지 않으면 가입/대기 상태로 생성
        userRecord = {
          email: email,
          name: email.split('@')[0],
          role: 'applicant',
          is_sysadmin: false,
          status: 'pending',
          department_id: null
        };
        users.push(userRecord);
        saveMockData('users', users);
      }
      
      const depts = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEYS.departments) || '[]');
      const deptObj = depts.find(d => d.id === userRecord.department_id);
      const deptName = deptObj ? deptObj.name : '미기입';
      
      const newSession = {
        access_token: `mock-token-${Math.random()}`,
        user: {
          id: `mock-uid-${userRecord.email}`,
          email: userRecord.email,
          user_metadata: {
            full_name: userRecord.name,
            role: userRecord.role,
            is_sysadmin: userRecord.is_sysadmin,
            status: userRecord.status,
            department_id: userRecord.department_id,
            department: deptName
          }
        }
      };
      
      localStorage.setItem(MOCK_STORAGE_KEYS.session, JSON.stringify(newSession));
      // Auth 변경 통보
      if (authChangeCallback) {
        authChangeCallback('SIGNED_IN', newSession);
      }
      return { data: newSession, error: null };
    },
    onAuthStateChange: (callback) => {
      authChangeCallback = callback;
      // 초기 상태 로드 후 바로 트리거
      const session = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEYS.session) || 'null');
      setTimeout(() => {
        if (session) {
          callback('SIGNED_IN', session);
        } else {
          callback('SIGNED_OUT', null);
        }
      }, 50);
      
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authChangeCallback = null;
            }
          }
        }
      };
    }
  }
};

let authChangeCallback = null;

// 최종 클라이언트 선택 내보내기
export const supabase = isMockMode ? mockSupabase : supabaseInstance;
export const isMock = isMockMode;
