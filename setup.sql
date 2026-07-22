-- ==========================================
-- 감면신청 웹앱 데이터베이스 구축 스크립트 (Supabase PostgreSQL용)
-- ==========================================

-- 기존 테이블이 있다면 정리 (초기화용, 운영환경 주의)
DROP TABLE IF EXISTS access_logs CASCADE;
DROP TABLE IF EXISTS request_edit_logs CASCADE;
DROP TABLE IF EXISTS request_status_logs CASCADE;
DROP TABLE IF EXISTS discount_requests CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS code_options CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS clinic_departments CASCADE;

-- 1. 소속 부서 목록 테이블 (departments)
CREATE TABLE departments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    level integer NOT NULL,
    parent_id uuid REFERENCES departments(id) ON DELETE CASCADE,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. 진료과 & 의료인 매핑 테이블 (clinic_departments)
CREATE TABLE clinic_departments (
    name text PRIMARY KEY, -- '코드 (의료인명)' 결합명
    code text NOT NULL,    -- 진료과 코드 (예: RM_1, IM_1)
    doctor_name text NOT NULL, -- 의료인 이름 (예: 서휘, 고인영)
    created_at timestamp with time zone DEFAULT now()
);

-- 3. 공통 코드 옵션 테이블 (code_options)
CREATE TABLE code_options (
    id serial PRIMARY KEY,
    category text NOT NULL, -- 'discount_type' 또는 'discount_reason'
    code text NOT NULL,
    value text NOT NULL,
    sort_order integer DEFAULT 0,
    CONSTRAINT uniq_category_code UNIQUE (category, code)
);

-- 4. 사용자 및 권한 테이블 (users)
CREATE TABLE users (
    email text PRIMARY KEY, -- 구글 로그인 이메일
    name text NOT NULL,
    role text NOT NULL DEFAULT 'applicant' CHECK (role IN ('applicant', 'team_manager', 'admin', 'manager')),
    is_sysadmin boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 5. 감면 신청 정보 테이블 (discount_requests)
CREATE TABLE discount_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    discount_type text NOT NULL, -- 외래/입원/검진/기타
    patient_no text NOT NULL, -- 병록번호
    patient_name text NOT NULL, -- 대상자 이름
    relationship text NOT NULL, -- 본인/부/모/배우자/자녀 등
    clinic_dept text NOT NULL, -- 진료과 (clinic_departments의 name 참조 가능하도록 구성)
    clinic_date date NOT NULL, -- 진료일자 (추가)
    reason_category text NOT NULL, -- 신청사유 (코드 또는 텍스트)
    details text, -- 상세 내용
    applicant_dept text NOT NULL, -- 신청자 소속 부서
    applicant_email text NOT NULL, -- 신청자 구글 이메일
    applicant_name text NOT NULL, -- 신청자 이름
    ip_address text, -- 신청 시점 IP
    discount_amount numeric DEFAULT 0, -- 감면금액 (원무팀 입력)
    admin_notes text, -- 원무팀 확인 메모
    status text NOT NULL DEFAULT '신청완료' CHECK (status IN ('신청완료', '원무확인중', '보완요청', '담당자 승인', '최종승인', '반려', '거절')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 6. 상태 변경 이력 테이블 (request_status_logs)
CREATE TABLE request_status_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid REFERENCES discount_requests(id) ON DELETE CASCADE,
    from_status text,
    to_status text NOT NULL,
    changed_by_email text NOT NULL,
    changed_by_name text NOT NULL,
    changed_at timestamp with time zone DEFAULT now()
);

-- 7. 수정 이력 테이블 (request_edit_logs)
CREATE TABLE request_edit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid REFERENCES discount_requests(id) ON DELETE CASCADE,
    field_name text NOT NULL,
    before_value text,
    after_value text,
    edited_by_email text NOT NULL,
    edited_by_name text NOT NULL,
    edited_at timestamp with time zone DEFAULT now()
);

-- 8. 조회 및 접근 로그 테이블 (access_logs)
CREATE TABLE access_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid REFERENCES discount_requests(id) ON DELETE CASCADE,
    accessed_by_email text NOT NULL,
    accessed_by_name text NOT NULL,
    action text NOT NULL DEFAULT '상세조회',
    accessed_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 초기 시드 데이터 삽입
-- ==========================================

-- 1. 소속 부서 데이터 추가 (SNH-ID Hub 조직도 구조 이식)
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000001', '병원장', 1, NULL, NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000002', '경영분석실', 1, NULL, NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000003', '조직문화성장실', 1, NULL, NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000004', '조직문화팀', 2, '00000000-0000-0000-0000-000000000003', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000005', 'HR팀', 2, '00000000-0000-0000-0000-000000000003', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000006', '브랜딩실', 1, NULL, NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000007', '홍보팀', 2, '00000000-0000-0000-0000-000000000006', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000008', '뉴미디어팀', 2, '00000000-0000-0000-0000-000000000006', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000009', '전담부서', 1, NULL, NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000000a', '감염관리팀', 2, '00000000-0000-0000-0000-000000000009', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000000b', '안전보건팀', 2, '00000000-0000-0000-0000-000000000009', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000000c', 'QPS팀', 2, '00000000-0000-0000-0000-000000000009', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000000d', '진료협력전담팀', 2, '00000000-0000-0000-0000-000000000009', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000000e', '통합의료', 1, NULL, NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000000f', '통합진료부', 2, '00000000-0000-0000-0000-00000000000e', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000010', '영상의학과', 3, '00000000-0000-0000-0000-00000000000f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000011', '내과', 3, '00000000-0000-0000-0000-00000000000f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000012', '소화기내과', 4, '00000000-0000-0000-0000-000000000011', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000013', '내분비내과', 4, '00000000-0000-0000-0000-000000000011', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000014', '순환기내과', 4, '00000000-0000-0000-0000-000000000011', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000015', '가정의학과', 3, '00000000-0000-0000-0000-00000000000f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000016', '통합의료전문센터', 2, '00000000-0000-0000-0000-00000000000e', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000017', '갑상선센터', 3, '00000000-0000-0000-0000-000000000016', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000018', '유방센터', 3, '00000000-0000-0000-0000-000000000016', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000019', '내과내시경센터', 3, '00000000-0000-0000-0000-000000000016', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000001a', '건강증진센터', 3, '00000000-0000-0000-0000-000000000016', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000001b', '비타민면역센터', 3, '00000000-0000-0000-0000-000000000016', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000001c', '통합지원실', 2, '00000000-0000-0000-0000-00000000000e', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000001d', '갑상선유방팀', 3, '00000000-0000-0000-0000-00000000001c', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000001e', '내과내시경팀', 3, '00000000-0000-0000-0000-00000000001c', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000001f', '건강증진팀', 3, '00000000-0000-0000-0000-00000000001c', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000020', '가정의학팀', 3, '00000000-0000-0000-0000-00000000001c', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000021', '영상의학팀', 3, '00000000-0000-0000-0000-00000000001c', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000022', '진단검사팀', 3, '00000000-0000-0000-0000-00000000001c', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000023', '재활의료', 1, NULL, NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000024', '재활진료부', 2, '00000000-0000-0000-0000-000000000023', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000025', '재활의학과', 3, '00000000-0000-0000-0000-000000000024', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000026', '한방과', 3, '00000000-0000-0000-0000-000000000024', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000027', '야간전담과', 3, '00000000-0000-0000-0000-000000000024', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000028', '재활의료전문센터', 2, '00000000-0000-0000-0000-000000000023', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000029', '뇌신경재활센터', 3, '00000000-0000-0000-0000-000000000028', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000002a', '척수손상재활센터', 3, '00000000-0000-0000-0000-000000000028', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000002b', '일상재활센터', 3, '00000000-0000-0000-0000-000000000028', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000002c', '외래재활센터', 3, '00000000-0000-0000-0000-000000000028', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000002d', '언어인지재활전문센터', 3, '00000000-0000-0000-0000-000000000028', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000002e', '재활지원', 2, '00000000-0000-0000-0000-000000000023', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000002f', '재활간호팀', 3, '00000000-0000-0000-0000-00000000002e', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000030', '5층 생활재활파트', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000031', '6층 생활재활파트', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000032', '통합병동 교육전담', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000033', '7층 생활재활파트', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000034', '8층 생활재활파트', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000035', '일상재활파트', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000036', '외래재활파트', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000037', '한방파트', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000038', 'CSR(소독실)', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000039', '5층 병동지원인력', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000003a', '5층 이동간병사', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000003b', '5층 재활지원인력', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000003c', '6층 병동지원인력', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000003d', '6층 재활지원인력', 4, '00000000-0000-0000-0000-00000000002f', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000003e', '재활치료', 3, '00000000-0000-0000-0000-00000000002e', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000003f', '재활치료1팀', 4, '00000000-0000-0000-0000-00000000003e', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000040', '재활치료2팀', 4, '00000000-0000-0000-0000-00000000003e', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000041', '재활복지', 2, '00000000-0000-0000-0000-000000000023', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000042', '사회사업팀', 3, '00000000-0000-0000-0000-000000000041', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000043', '재활코치팀', 3, '00000000-0000-0000-0000-000000000041', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000044', '경영지원', 1, NULL, NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000045', '경영지원실', 2, '00000000-0000-0000-0000-000000000044', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000046', '원무팀', 2, '00000000-0000-0000-0000-000000000044', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000047', '심사팀', 2, '00000000-0000-0000-0000-000000000044', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000048', '전산팀', 2, '00000000-0000-0000-0000-000000000044', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-000000000049', '총무팀', 2, '00000000-0000-0000-0000-000000000044', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000004a', '시설팀', 2, '00000000-0000-0000-0000-000000000044', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000004b', '재무팀', 2, '00000000-0000-0000-0000-000000000044', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000004c', '영양팀', 2, '00000000-0000-0000-0000-000000000044', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000004d', '약제팀', 2, '00000000-0000-0000-0000-000000000044', NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000004e', '나눔과행복의료재단', 1, NULL, NOW());
INSERT INTO departments (id, name, level, parent_id, created_at) VALUES ('00000000-0000-0000-0000-00000000004f', '(사)나눔으로 행복한 동행', 1, NULL, NOW());

-- 2. 진료과 & 의료인 코드 데이터 추가 (제시된 표 이미지 기준)
INSERT INTO clinic_departments (name, code, doctor_name) VALUES
('RM_1 (서휘)', 'RM_1', '서휘'),
('RM_2 (박여진)', 'RM_2', '박여진'),
('RM_3 (차은겸)', 'RM_3', '차은겸'),
('RM_4 (김인혜)', 'RM_4', '김인혜'),
('RM_5 (김완호)', 'RM_5', '김완호'),
('RD_1 (백선미)', 'RD_1', '백선미'),
('RD_2 (신수영)', 'RD_2', '신수영'),
('RD_3 (손정민)', 'RD_3', '손정민'),
('RD_5 (김현수)', 'RD_5', '김현수'),
('RD_10 (서영화)', 'RD_10', '서영화'),
('IM_1 (고인영)', 'IM_1', '고인영'),
('IM_3 (남지현)', 'IM_3', '남지현'),
('IM_5 (정민정)', 'IM_5', '정민정'),
('IM_7 (류승훈)', 'IM_7', '류승훈'),
('EI (박미경)', 'EI', '박미경'),
('CI (박민아)', 'CI', '박민아'),
('FM (황은교)', 'FM', '황은교'),
('한방 (김종삼)', '한방', '김종삼');

-- 3. 공통 코드 데이터 추가
-- 감면구분
INSERT INTO code_options (category, code, value, sort_order) VALUES
('discount_type', 'outpatient', '외래', 1),
('discount_type', 'inpatient', '입원', 2),
('discount_type', 'checkup', '검진', 3),
('discount_type', 'other', '기타', 4);

-- 신청사유
INSERT INTO code_options (category, code, value, sort_order) VALUES
('discount_reason', 'regulation', '감면규정등록', 1),
('discount_reason', 'request', '의료진 요청', 2),
('discount_reason', 'complaint', '민원', 3),
('discount_reason', 'social', '사회사업', 4),
('discount_reason', 'liability', '병원 귀책', 5),
('discount_reason', 'other', '기타 (상세내용 기재 필수)', 6);

-- 4. 테스트 계정 추가 (권한별)
INSERT INTO users (email, name, role, is_sysadmin, status, department_id) VALUES
('applicant@hospital.com', '홍신청', 'applicant', false, 'approved', '00000000-0000-0000-0000-00000000002f'), -- 재활간호팀
('team_manager@hospital.com', '이팀장', 'team_manager', false, 'approved', '00000000-0000-0000-0000-00000000002f'), -- 재활간호팀
('staff@hospital.com', '김원무', 'admin', false, 'approved', '00000000-0000-0000-0000-000000000046'),     -- 원무팀
('manager@hospital.com', '박팀장', 'manager', false, 'approved', '00000000-0000-0000-0000-000000000046'),   -- 원무팀
('sysadmin@hospital.com', '최관리', 'manager', true, 'approved', '00000000-0000-0000-0000-000000000048');  -- 전산팀
