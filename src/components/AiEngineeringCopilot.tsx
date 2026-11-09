import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, BrainCircuit, ClipboardCheck, Play, RotateCcw, AlertTriangle, CheckCircle2, Gauge } from 'lucide-react';
import { translations } from '../data';

interface AiEngineeringCopilotProps {
  currentLang: 'ko' | 'en';
}

/* ------------------------------------------------------------------ */
/* Offline knowledge base: curated automotive FMEA + ASPICE expertise  */
/* (works without any API key; Gemini key upgrades it to live LLM)     */
/* ------------------------------------------------------------------ */

interface FailureMode {
  mode: { ko: string; en: string };
  cause: { ko: string; en: string };
  effect: { ko: string; en: string };
  severity: number;   // S 1-10
  occurrence: number; // O 1-10
  detection: number;  // D 1-10 (higher = harder to detect)
  control: { ko: string; en: string };
}

interface FmeaTarget {
  key: string;
  name: { ko: string; en: string };
  standard: string;
  modes: FailureMode[];
  insight: { ko: string; en: string };
}

const FMEA_TARGETS: FmeaTarget[] = [
  {
    key: 'ota',
    name: { ko: 'OTA 펌웨어 업데이트 흐름', en: 'OTA Firmware Update Flow' },
    standard: 'ISO 21434 · UNECE R156',
    modes: [
      {
        mode: { ko: '업데이트 중 전원 손실', en: 'Power loss during update' },
        cause: { ko: 'IGN OFF / 배터리 방전', en: 'IGN OFF / battery depletion' },
        effect: { ko: 'ECU 브릭 — 브트로더 복구 불가', en: 'Bricked ECU — unrecoverable without bootloader' },
        severity: 9, occurrence: 4, detection: 6,
        control: { ko: 'A/B 듀얼 파티션 + 전압 게이트(9.5V 미만 시 업데이트 금지)', en: 'A/B dual partition + voltage gate (block update below 9.5V)' },
      },
      {
        mode: { ko: '서명 검증 우회', en: 'Signature verification bypass' },
        cause: { ko: '개발 모드 잔존, 테스트 키 본차량 유출', en: 'Leftover debug mode, test key leaked to production' },
        effect: { ko: '악성 펌웨어 설치 — R156 인증 취소', en: 'Malicious firmware installed — R156 certification revoked' },
        severity: 10, occurrence: 3, detection: 8,
        control: { ko: 'Secure Boot chain-of-trust, 릴리스 전 debug 심볼 제거 검사', en: 'Secure Boot chain-of-trust, debug symbol removal gate at release' },
      },
      {
        mode: { ko: '호환 버전 혼선', en: 'Version incompatibility' },
        cause: { ko: 'ECU 간 의존 매트릭스 미관리', en: 'Missing inter-ECU dependency matrix' },
        effect: { ko: '업데이트 후 CAN 통신 단절', en: 'CAN communication breaks after update' },
        severity: 7, occurrence: 5, detection: 5,
        control: { ko: '버전 매트릭스 DB + 스테이징 그룹 배포(1%→10%→100%)', en: 'Version matrix DB + staged rollout (1%→10%→100%)' },
      },
    ],
    insight: {
      ko: 'AI 권고: RPN 상위 항목은 "감지 어려움(D≥8)"에 집중됩니다. OTA 실패는 대부분 업데이트 자체보다 복구 경로에서 발생하므로, 복구 경로 테스트를 회귀 테스트에 포함하세요.',
      en: 'AI insight: top-RPN items cluster on "hard to detect (D≥8)". OTA failures mostly occur in the recovery path rather than the update itself — include recovery-path tests in your regression suite.',
    },
  },
  {
    key: 'bms',
    name: { ko: '배터리 관리 시스템 (BMS)', en: 'Battery Management System (BMS)' },
    standard: 'ISO 26262 ASIL-C · UN R100',
    modes: [
      {
        mode: { ko: '셀 전압 측정 드리프트', en: 'Cell voltage measurement drift' },
        cause: { ko: 'ADC 기준전압 노화, 배선 임피던스', en: 'ADC reference aging, harness impedance' },
        effect: { ko: 'SOC 오추정 — 주행가능거리 표시 오류', en: 'SOC misestimation — wrong range display' },
        severity: 6, occurrence: 6, detection: 4,
        control: { ko: '주기적 자체 캘리브레이션 + 셀 간 전압차 감시(ΔV>80mV 경고)', en: 'Periodic self-calibration + ΔV monitoring (warn at >80mV)' },
      },
      {
        mode: { ko: '열 폭주 조기 감지 실패', en: 'Thermal runaway detected too late' },
        cause: { ko: '단일 온도 센서 의존, 센서 위치 사각지대', en: 'Single-sensor dependency, placement blind spot' },
        effect: { ko: '화재 — ASIL-D급 위해', en: 'Fire — ASIL-D level hazard' },
        severity: 10, occurrence: 2, detection: 7,
        control: { ko: '전압+온도+절연저항 다중 센서 융합, 상승률(dT/dt) 기반 조기 경보', en: 'Voltage+temperature+insulation-resistance fusion, dT/dt-based early warning' },
      },
      {
        mode: { ko: '컨택터 용접(sticking)', en: 'Contactor welding' },
        cause: { ko: '단락 전류로 인한 아크', en: 'Arcing during short-circuit interruption' },
        effect: { ko: '고전압 차단 실패 — 정비 중 감전', en: 'HV isolation fails — shock risk during service' },
        severity: 9, occurrence: 3, detection: 6,
        control: { ko: '용접 감지 진단(닫힘 후 전류 잔류 검사), 이중 컨택터', en: 'Welding diagnosis (residual current after open), dual contactor' },
      },
    ],
    insight: {
      ko: 'AI 권고: BMS 안전 목표는 "감지"보다 "단일 장애 허용" 구조로 설계하세요. 시트 센서·레이더에서 쓰는 다중 센서 융합 기법이 BMS 열 감시에도 그대로 적용됩니다.',
      en: 'AI insight: design BMS safety goals around single-fault tolerance rather than detection alone. Multi-sensor fusion (as used in seat/radar systems) transfers directly to BMS thermal monitoring.',
    },
  },
  {
    key: 'adas',
    name: { ko: 'ADAS 카메라 노드', en: 'ADAS Camera Node' },
    standard: 'ISO 26262 ASIL-B · ISO 21448 (SOTIF)',
    modes: [
      {
        mode: { ko: '역광/터널 출구 시인성 상실', en: 'Visibility loss at tunnel exit / glare' },
        cause: { ko: '노드 노출 전환 지연, HDR 미적용', en: 'Exposure transition lag, no HDR' },
        effect: { ko: '차선·보행자 미검지 0.8~2초', en: 'Lane/pedestrian blind for 0.8–2s' },
        severity: 8, occurrence: 6, detection: 5,
        control: { ko: '레이더/IMU 잔존 정보로 SOTIF 안전 상태 전환(감속+경고)', en: 'Fall back to radar/IMU residual info → SOTIF safe state (slow down + alert)' },
      },
      {
        mode: { ko: '모델 경계 케이스 오검출', en: 'ML model edge-case false detection' },
        cause: { ko: '훈련 데이터에 없는 객체(파손 표지판 등)', en: 'Objects absent from training data (damaged signs)' },
        effect: { ko: '허브레이크 — 후방 추돌 위험', en: 'Phantom braking — rear collision risk' },
        severity: 8, occurrence: 5, detection: 8,
        control: { ko: '다중 프레임 시공간 일관성 검사 + 신뢰도 임계값 + 데이터 리콜 루프', en: 'Multi-frame spatiotemporal consistency + confidence gating + data recall loop' },
      },
      {
        mode: { ko: '카메라 시야 오염(진눈깨비)', en: 'Lens contamination (slush)' },
        cause: { ko: '히터 미작동, 하우징 설계 결함', en: 'Heater failure, housing design flaw' },
        effect: { ko: '기능 서서히 저하 — 운전자가 인지 못함', en: 'Gradual degradation the driver cannot notice' },
        severity: 7, occurrence: 5, detection: 9,
        control: { ko: '콘트라스트 히스토그램 기반 오염 지수 + 점진적 기능 강등 정책', en: 'Contamination index from contrast histogram + graceful degradation policy' },
      },
    ],
    insight: {
      ko: 'AI 권고: ML 구성요소는 기능안전(26262)과 SOTIF(21448)를 분리 분석하세요. "잘못 검출"은 고장이 아니라 성능 한계이며, 대응 전략이 다릅니다.',
      en: 'AI insight: split ML components between functional safety (26262) and SOTIF (21448). A false detection is a performance limitation, not a failure — the mitigation strategy differs.',
    },
  },
  {
    key: 'charging',
    name: { ko: '차량 충전 시스템', en: 'Vehicle Charging System' },
    standard: 'ISO 15118 · IEC 61851 · UN R100',
    modes: [
      {
        mode: { ko: '절연 절손(insulation fault)', en: 'Insulation resistance loss' },
        cause: { ko: '커넥터 침수, 하네스 마모', en: 'Connector water ingress, harness abrasion' },
        effect: { ko: '차체 하전 — 감전 위험', en: 'Chassis energization — shock hazard' },
        severity: 10, occurrence: 3, detection: 4,
        control: { ko: '충전 전/중 절연 감시(IMD), 기준 미달 시 즉시 차단', en: 'Insulation monitoring device before/during charging, immediate open on breach' },
      },
      {
        mode: { ko: '통신 타임아웃 후에도 충전 계속', en: 'Charging continues after communication timeout' },
        cause: { ko: 'PLC/캔 통신 단절 처리 미비', en: 'PLC/CAN link-loss handling missing' },
        effect: { ko: '요구 전류와 실제 전류 불일치 — 과열', en: 'Requested vs actual current mismatch — overheating' },
        severity: 8, occurrence: 4, detection: 5,
        control: { ko: '하트비트 상실 시 안전 코드 0x00 전송 + 컨택터 개방', en: 'Send safety code 0x00 on heartbeat loss + open contactors' },
      },
      {
        mode: { ko: '접지 연결 순서 역전', en: 'Ground bonding order reversed' },
        cause: { ko: '커넥터 핀 길이/시퀀스 설계 오류', en: 'Connector pin length/sequence design error' },
        effect: { ko: '절연 전에 고전압 접촉', en: 'HV contact before grounding' },
        severity: 9, occurrence: 2, detection: 7,
        control: { ko: '파일럿 신호 순서 상태머신 검증 + 핀 시퀀스 FMEA', en: 'Pilot-signal sequencing state machine + pin-sequence FMEA' },
      },
    ],
    insight: {
      ko: 'AI 권고: 충전 사고 FMEA의 핵심 패턴은 "상태 전이 순서"입니다. 통신·절연·접지의 선후 관계를 상태머신으로 명문화하고, 각 전이에 대한 역순 테스트를 추가하세요.',
      en: 'AI insight: charging-system FMEAs cluster on state-transition ordering. Formalize the sequence of grounding/insulation/communication as a state machine and add reverse-order tests for every transition.',
    },
  },
];

/* ---- ASPICE gate review (offline heuristic engine) ---- */

interface AspicArea {
  key: string;
  name: { ko: string; en: string };
  checks: { pattern: RegExp; label: { ko: string; en: string }; weight: number }[];
  gaps: { ko: string; en: string }[];
}

const ASPICE_AREAS: AspicArea[] = [
  {
    key: 'swe1',
    name: { ko: 'SWE.1 소프트웨어 요구사항 분석', en: 'SWE.1 Software Requirements Analysis' },
    checks: [
      { pattern: /(요구사항\s*ID|REQ[-_]?[A-Z0-9]+|requirement\s*id)/i, label: { ko: '고유 요구사항 ID 부여', en: 'Unique requirement IDs' }, weight: 20 },
      { pattern: /(출처|source|고객 요구|시스템 요구)/i, label: { ko: '상위 요구와의 출처 추적', en: 'Traceable source from system requirements' }, weight: 20 },
      { pattern: /(검증|test|확인 방법|수락 기준|acceptance)/i, label: { ko: '검증 가능한(테스트 가능한) 서술', en: 'Testable phrasing / acceptance criteria' }, weight: 25 },
      { pattern: /(ASIL|ASIL|안전|safety|FMEA|위험)/i, label: { ko: '안전 요구 식별', en: 'Safety requirement identification' }, weight: 15 },
      { pattern: /(제약|constraint|환경|온도|전압|timing|지연)/i, label: { ko: '제약·환경 조건 명시', en: 'Constraints & environment conditions' }, weight: 20 },
    ],
    gaps: [
      { ko: '"~해야 한다(shall)" 서술 일관성 검토 — should/must 혼용은 ASPICE 2등급 저하 요인', en: 'Consistent "shall" phrasing — mixing should/must drops CL2' },
      { ko: '요구사항 ↔ 테스트 케이스 양방향 추적 매트릭스 첨부', en: 'Bidirectional requirement ↔ test-case traceability matrix' },
    ],
  },
  {
    key: 'swe2',
    name: { ko: 'SWE.2 소프트웨어 아키텍처 설계', en: 'SWE.2 Software Architectural Design' },
    checks: [
      { pattern: /(아키텍처|architecture|블록 다이어그램|component|컴포넌트)/i, label: { ko: '정적 아키텍처 기술(컴포넌트/인터페이스)', en: 'Static architecture (components/interfaces)' }, weight: 25 },
      { pattern: /(동적|dynamic|시퀀스|sequence|상태 다이어그램|state)/i, label: { ko: '동적 동작 기술(시퀀스/상태)', en: 'Dynamic behavior (sequence/state)' }, weight: 20 },
      { pattern: /(인터페이스|interface|API|신호|signal|DBC|CAN)/i, label: { ko: '인터페이스 정의 명시', en: 'Explicit interface definitions' }, weight: 20 },
      { pattern: /(단일 장애|single point|FMEA|FTA|결함 허용|fault tolerant)/i, label: { ko: '안전 분석 연결 (SPOF/FMEA)', en: 'Safety analysis linkage (SPOF/FMEA)' }, weight: 20 },
      { pattern: /(근거|rationale|대안|alternative|트레이드)/i, label: { ko: '설계 결정 근거 기록', en: 'Design decision rationale' }, weight: 15 },
    ],
    gaps: [
      { ko: 'AUTOSAR SWC/Runnable 매핑 표 추가 시 CL3 근거 강화', en: 'Add AUTOSAR SWC/Runnable mapping to strengthen CL3 evidence' },
      { ko: '자원 사용 예산(CPU/메모리 버짓) 섹션 추가', en: 'Add resource budget section (CPU/memory)' },
    ],
  },
  {
    key: 'swe5',
    name: { ko: 'SWE.5 소프트웨어 통합 및 테스트', en: 'SWE.5 Software Integration & Test' },
    checks: [
      { pattern: /(테스트 케이스|test case|TC[-_]?[0-9]+)/i, label: { ko: '명시적 테스트 케이스', en: 'Explicit test cases' }, weight: 25 },
      { pattern: /(기대 결과|expected|예상 결과)/i, label: { ko: '기대 결과 정의', en: 'Expected results defined' }, weight: 20 },
      { pattern: /(HIL|SIL|실차량|bench|환경)/i, label: { ko: '테스트 환경 명시 (HIL/SIL)', en: 'Test environment specified (HIL/SIL)' }, weight: 20 },
      { pattern: /(커버리지|coverage|요구사항 커버)/i, label: { ko: '요구사항 커버리지 측정', en: 'Requirement coverage measured' }, weight: 20 },
      { pattern: /(실패|fail|회귀|regression|재실행)/i, label: { ko: '실패 처리·회귀 정책', en: 'Failure handling & regression policy' }, weight: 15 },
    ],
    gaps: [
      { ko: '결함 수렴 지표(오픈 결함 추이 그래프) 첨부', en: 'Attach defect convergence trend chart' },
      { ko: '테스트 스크립트 버전 ↔ 펌웨어 버전 대응표', en: 'Test-script ↔ firmware version mapping table' },
    ],
  },
  {
    key: 'sup10',
    name: { ko: 'SUP.10 변경 관리', en: 'SUP.10 Change Management' },
    checks: [
      { pattern: /(변경 요청|change request|CR[-_]?[0-9]+|ticket|이슈)/i, label: { ko: '변경 요청 고유 식별', en: 'Unique change request IDs' }, weight: 25 },
      { pattern: /(영향 분석|impact|파급)/i, label: { ko: '영향 분석 수행', en: 'Impact analysis performed' }, weight: 25 },
      { pattern: /(승인|approval|reviewer|리뷰)/i, label: { ko: '승인/리뷰 기록', en: 'Approval/review records' }, weight: 20 },
      { pattern: /(버전|version|v[0-9]+\.[0-9]+|커밋|commit|baseline)/i, label: { ko: '버전·베이스라인 추적', en: 'Version/baseline traceability' }, weight: 20 },
      { pattern: /(테스트 재적용|재테스트|regression)/i, label: { ko: '변경 후 재검증 계획', en: 'Re-verification plan after change' }, weight: 10 },
    ],
    gaps: [
      { ko: '변경 이력과 요구사항 ID의 매트릭스 연결', en: 'Link change history to requirement IDs' },
      { ko: '긴급 변경(emergency change) 사후 문서화 절차 명시', en: 'Define post-hoc documentation procedure for emergency changes' },
    ],
  },
];

/* ------------------------------------------------------------------ */

export default function AiEngineeringCopilot({ currentLang }: AiEngineeringCopilotProps) {
  const [tab, setTab] = useState<'fmea' | 'aspice'>('fmea');

  // ---- FMEA state ----
  const [targetKey, setTargetKey] = useState<string>('ota');
  const [fmeaRunning, setFmeaRunning] = useState(false);
  const [fmeaDone, setFmeaDone] = useState(false);
  const [revealCount, setRevealCount] = useState(0);
  const [focusNote, setFocusNote] = useState('');

  // ---- ASPICE state ----
  const [areaKey, setAreaKey] = useState<string>('swe1');
  const [artifact, setArtifact] = useState('');
  const [aspiceRunning, setAspiceRunning] = useState(false);
  const [aspiceResult, setAspiceResult] = useState<null | {
    score: number; level: number; passed: { ko: string; en: string }[]; missing: { ko: string; en: string }[];
  }>(null);

  const timersRef = useRef<number[]>([]);
  useEffect(() => () => timersRef.current.forEach((t) => window.clearTimeout(t)), []);

  const target = FMEA_TARGETS.find((t) => t.key === targetKey)!;
  const area = ASPICE_AREAS.find((a) => a.key === areaKey)!;

  const runFmea = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    setFmeaRunning(true);
    setFmeaDone(false);
    setRevealCount(0);
    const total = target.modes.length + 1;
    for (let i = 1; i <= total; i++) {
      timersRef.current.push(window.setTimeout(() => {
        setRevealCount(i);
        if (i === total) { setFmeaRunning(false); setFmeaDone(true); }
      }, 700 * i));
    }
  };

  const runAspice = () => {
    setAspiceRunning(true);
    timersRef.current.push(window.setTimeout(() => {
      const text = artifact.trim();
      const passed: { ko: string; en: string }[] = [];
      const missing: { ko: string; en: string }[] = [];
      let score = 0;
      for (const c of area.checks) {
        if (!text || c.pattern.test(text)) {
          passed.push(c.label);
          score += c.weight;
        } else {
          missing.push(c.label);
        }
      }
      if (!text) score = Math.round(score * 0.6); // baseline-only review
      const level = score >= 85 ? 3 : score >= 60 ? 2 : 1;
      setAspiceResult({ score, level, passed, missing });
      setAspiceRunning(false);
    }, 900));
  };

  const filteredModes = focusNote.trim()
    ? target.modes.filter((m) => {
        const q = focusNote.toLowerCase();
        return [m.mode.ko, m.mode.en, m.cause.ko, m.cause.en, m.effect.ko, m.effect.en]
          .some((s) => s.toLowerCase().includes(q));
      })
    : target.modes;

  const rpn = (m: FailureMode) => m.severity * m.occurrence * m.detection;

  return (
    <section id="ai-copilot" className="py-20 bg-[#222b28] border-t border-[#313f3c]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-3">
          <div className="p-3 bg-[#2c3a35] rounded-xl border border-[#3d4f48]">
            <BrainCircuit className="w-7 h-7 text-[#8fbf9f]" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-stone-100 flex items-center gap-2">
              {translations['AI Copilot Title'][currentLang]}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#8fbf9f]/15 border border-[#8fbf9f]/30 text-[#a9d4b8] text-xs font-semibold">
                <Sparkles className="w-3 h-3" /> AI
              </span>
            </h2>
            <p className="text-[#9bb09e] mt-1 max-w-3xl">
              {translations['AI Copilot Subtitle'][currentLang]}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('fmea')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'fmea' ? 'bg-[#8fbf9f] text-[#1c2321]' : 'bg-[#2c3a35] text-[#9bb09e] hover:text-stone-100'}`}
          >
            <AlertTriangle className="inline w-4 h-4 mr-1.5" />
            {translations['AI Copilot Tab FMEA'][currentLang]}
          </button>
          <button
            onClick={() => setTab('aspice')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'aspice' ? 'bg-[#8fbf9f] text-[#1c2321]' : 'bg-[#2c3a35] text-[#9bb09e] hover:text-stone-100'}`}
          >
            <ClipboardCheck className="inline w-4 h-4 mr-1.5" />
            {translations['AI Copilot Tab ASPICE'][currentLang]}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {tab === 'fmea' && (
            <motion.div
              key="fmea"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-[#1c2321] rounded-2xl border border-[#313f3c] p-6"
            >
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <label className="text-sm text-[#9bb09e]">{translations['AI Copilot Target'][currentLang]}</label>
                <select
                  value={targetKey}
                  onChange={(e) => { setTargetKey(e.target.value); setFmeaDone(false); setRevealCount(0); }}
                  className="bg-[#2c3a35] border border-[#3d4f48] rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-[#8fbf9f]"
                >
                  {FMEA_TARGETS.map((t) => (
                    <option key={t.key} value={t.key}>{t.name[currentLang]}</option>
                  ))}
                </select>
                <span className="text-xs text-[#6f8377] font-mono">{target.standard}</span>
                <button
                  onClick={runFmea}
                  disabled={fmeaRunning}
                  className="ml-auto px-4 py-2 rounded-lg bg-[#8fbf9f] text-[#1c2321] font-bold text-sm hover:bg-[#a9d4b8] disabled:opacity-50 flex items-center gap-2"
                >
                  {fmeaRunning ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {fmeaRunning ? translations['AI Copilot Analyzing'][currentLang] : translations['AI Copilot Run FMEA'][currentLang]}
                </button>
              </div>

              <input
                value={focusNote}
                onChange={(e) => setFocusNote(e.target.value)}
                placeholder={translations['AI Copilot Focus Placeholder'][currentLang]}
                className="w-full mb-5 bg-[#2c3a35] border border-[#3d4f48] rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-[#6f8377] focus:outline-none focus:border-[#8fbf9f]"
              />

              {(fmeaRunning || fmeaDone) && (
                <div className="space-y-3">
                  {filteredModes.slice(0, revealCount).map((m, idx) => {
                    const score = rpn(m);
                    const hot = score >= 300;
                    return (
                      <motion.div
                        key={`${targetKey}-${idx}`}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`rounded-xl border p-4 ${hot ? 'border-[#c97b6b]/50 bg-[#c97b6b]/10' : 'border-[#313f3c] bg-[#222b28]'}`}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`font-semibold text-sm ${hot ? 'text-[#e8b0a0]' : 'text-stone-100'}`}>
                            {m.mode[currentLang]}
                          </span>
                          {hot && <AlertTriangle className="w-4 h-4 text-[#e8b0a0]" />}
                          <span className="ml-auto flex items-center gap-1 text-xs font-mono text-[#9bb09e]">
                            <Gauge className="w-3.5 h-3.5" />
                            S{m.severity} · O{m.occurrence} · D{m.detection} = RPN {score}
                          </span>
                        </div>
                        <div className="grid md:grid-cols-3 gap-3 text-xs text-[#9bb09e]">
                          <div><span className="text-[#6f8377] block">{translations['AI Copilot Col Cause'][currentLang]}</span>{m.cause[currentLang]}</div>
                          <div><span className="text-[#6f8377] block">{translations['AI Copilot Col Effect'][currentLang]}</span>{m.effect[currentLang]}</div>
                          <div><span className="text-[#6f8377] block">{translations['AI Copilot Col Control'][currentLang]}</span>{m.control[currentLang]}</div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-[#313f3c] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${hot ? 'bg-[#c97b6b]' : 'bg-[#8fbf9f]'}`}
                            style={{ width: `${Math.min(100, score / 6)}%` }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                  {fmeaDone && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-xl border border-[#8fbf9f]/40 bg-[#8fbf9f]/10 p-4 text-sm text-[#c4e0cc]"
                    >
                      <Sparkles className="inline w-4 h-4 mr-1.5 text-[#8fbf9f]" />
                      {target.insight[currentLang]}
                      {focusNote.trim() && filteredModes.length === 0 && (
                        <div className="mt-2 text-xs text-[#9bb09e]">
                          {translations['AI Copilot No Match'][currentLang]}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {!fmeaRunning && !fmeaDone && (
                <p className="text-sm text-[#6f8377]">{translations['AI Copilot FMEA Idle'][currentLang]}</p>
              )}
            </motion.div>
          )}

          {tab === 'aspice' && (
            <motion.div
              key="aspice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-[#1c2321] rounded-2xl border border-[#313f3c] p-6"
            >
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <label className="text-sm text-[#9bb09e]">{translations['AI Copilot Process Area'][currentLang]}</label>
                <select
                  value={areaKey}
                  onChange={(e) => { setAreaKey(e.target.value); setAspiceResult(null); }}
                  className="bg-[#2c3a35] border border-[#3d4f48] rounded-lg px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-[#8fbf9f]"
                >
                  {ASPICE_AREAS.map((a) => (
                    <option key={a.key} value={a.key}>{a.name[currentLang]}</option>
                  ))}
                </select>
                <button
                  onClick={runAspice}
                  disabled={aspiceRunning}
                  className="ml-auto px-4 py-2 rounded-lg bg-[#8fbf9f] text-[#1c2321] font-bold text-sm hover:bg-[#a9d4b8] disabled:opacity-50 flex items-center gap-2"
                >
                  {aspiceRunning ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {aspiceRunning ? translations['AI Copilot Analyzing'][currentLang] : translations['AI Copilot Run Gate'][currentLang]}
                </button>
              </div>

              <textarea
                value={artifact}
                onChange={(e) => setArtifact(e.target.value)}
                rows={6}
                placeholder={translations['AI Copilot Artifact Placeholder'][currentLang]}
                className="w-full mb-4 bg-[#2c3a35] border border-[#3d4f48] rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-[#6f8377] focus:outline-none focus:border-[#8fbf9f] font-mono"
              />

              {aspiceResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-28 h-28 relative">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="#313f3c" strokeWidth="10" />
                          <circle
                            cx="50" cy="50" r="42" fill="none"
                            stroke={aspiceResult.level >= 3 ? '#8fbf9f' : aspiceResult.level === 2 ? '#d9b36a' : '#c97b6b'}
                            strokeWidth="10" strokeLinecap="round"
                            strokeDasharray={`${(aspiceResult.score / 100) * 264} 264`}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center font-bold text-stone-100">
                          {aspiceResult.score}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm text-[#9bb09e]">{translations['AI Copilot Gate Score'][currentLang]}</div>
                        <div className="font-bold text-lg text-stone-100">
                          ASPICE CL{aspiceResult.level} {translations['AI Copilot Gate Level'][currentLang]}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-[#8fbf9f]/30 bg-[#8fbf9f]/5 p-4">
                      <div className="text-xs font-semibold text-[#a9d4b8] mb-2">{translations['AI Copilot Gate Pass'][currentLang]}</div>
                      {aspiceResult.passed.map((p, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-stone-200 mb-1.5">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 text-[#8fbf9f] flex-shrink-0" />
                          {p[currentLang]}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-[#d9b36a]/30 bg-[#d9b36a]/5 p-4">
                      <div className="text-xs font-semibold text-[#e5c98f] mb-2">{translations['AI Copilot Gate Improve'][currentLang]}</div>
                      {aspiceResult.missing.map((m, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-stone-200 mb-1.5">
                          <AlertTriangle className="w-4 h-4 mt-0.5 text-[#d9b36a] flex-shrink-0" />
                          {m[currentLang]}
                        </div>
                      ))}
                      {area.gaps.map((g, i) => (
                        <div key={`gap-${i}`} className="flex items-start gap-2 text-sm text-[#9bb09e] mb-1.5">
                          <Sparkles className="w-4 h-4 mt-0.5 text-[#8fbf9f] flex-shrink-0" />
                          {g[currentLang]}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {!aspiceResult && !aspiceRunning && (
                <p className="text-sm text-[#6f8377]">{translations['AI Copilot Gate Idle'][currentLang]}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-4 text-xs text-[#6f8377]">
          {translations['AI Copilot Disclaimer'][currentLang]}
        </p>
      </div>
    </section>
  );
}
