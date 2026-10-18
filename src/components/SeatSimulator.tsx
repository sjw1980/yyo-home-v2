import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Archive,
  Armchair,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RotateCcw,
  X,
  Zap,
} from 'lucide-react';
import SeatDiagram from './SeatDiagram';
import {
  AXIS_CONFIG,
  AXIS_ORDER,
  INITIAL_POSITIONS,
  MODE_CONFIG,
  MODE_ORDER,
  MODE_SPEC_LABELS,
  POSE_AXES,
  POSE_SLOT_COUNT,
  POSE_STORAGE_KEY,
  RELAX_ON_AXES,
  RELAX_ON_TARGETS,
  RELAX_STATE_LABEL,
  axisForDirection,
  capturePose,
  clamp,
  lrSign,
  modeAxes,
  modeCode,
  normalizePose,
  poseDrift,
  poseEta,
  primaryAxis,
  relaxApplyRatio,
  relaxPreset,
  relaxStateKey,
  rotateMode,
  type AxisKey,
  type Direction,
  type ModeKey,
  type RelaxPhase,
  type RelaxRun,
  type RelaxStatus,
  type SavedPose,
} from '../seatConfig';
import { translations } from '../data';

/** 시뮬레이션 틱 주기 (ms) — 데스크톱 앱의 30ms 시뮬레이션 루프에 대응 */
const TICK_MS = 30;

/** 포즈 슬롯 저장 길이 (ms) — 짧으면 실수하고, 길으면 답답하다 */
const SLOT_HOLD_MS = 620;
/** 저장 완료 후 슬롯이 반짝이는 시간 (ms) */
const SLOT_FLASH_MS = 520;
/** 슬롯 지문(fingerprint) 막대를 그려줄 대표 축 */
const SLOT_FINGER_AXES: AxisKey[] = ['recline', 'legrest', 'cushion', 'tilt', 'slide', 'height'];

/**
 * 컨트롤 버튼 — 공용 방향 로커는 폐기했다.
 * 각 컨트롤(C1~C8)이 **자기 축의 방향 버튼만** 자기 줄에 가진다.
 * 라벨은 MODE_SPEC_LABELS 에서 주어(모드명)을 버리고 목적어만 남긴다 — '럼버 전진' → '전진'.
 */
const DIR_CHEVRON: Record<Direction, typeof ChevronUp> = {
  up: ChevronUp,
  down: ChevronDown,
  left: ChevronLeft,
  right: ChevronRight,
};
/**
 * 방향 버튼 배치 순서 — **위쪽의 축별 위치 바와 같은 자리에 놓는다.**
 *  좌우 축(lrAxis) 을 조작하는 버튼을 좌측, 상하 축(udAxis) 을 조작하는 버튼을 우측.
 *  럼버(4방향) 는 바가 `LMB | LMH` 순서이므로 버튼도 `◀ ▶ | ▲ ▼` 가 그 아래에 나란히 선다.
 *  (2버튼 컨트롤은 상대 순서가 그대로라 표시가 변하지 않는다: 상하 전용 = ▲▼, 좌우 전용 = ◀▶)
 */
const DIR_ORDER: Direction[] = ['left', 'right', 'up', 'down'];

/** '럼버 전진' → '전진' (버튼에는 목적어만, 전체 문구는 title 에 남긴다) */
const shortDirLabel = (text: string) => {
  const i = text.indexOf(' ');
  return i > 0 ? text.slice(i + 1) : text;
};


type ControlMode = 'manual' | 'auto';
/** HMI 시퀀스 로그 톤 */
type LogTone = 'ok' | 'hot' | 'dim';
interface LogEntry {
  t: string;
  msg: string;
  tone: LogTone;
}
type DemoPhase = 'idle' | 'mode_transition' | 'value_tuning' | 'up_delay' | 'relax_demo';

interface SeatSimulatorProps {
  currentLang: 'ko' | 'en';
}

/**
 * DPSS 전동 시트 시뮬레이터
 * (ref: seat_simulator/seat_main.py — 6가지 DPSS 모드 / 10개 축 물리 모델 / AUTO DEMO 상태머신)
 */
export default function SeatSimulator({ currentLang }: SeatSimulatorProps) {
  const t = (key: string, fallback = '') => translations[key]?.[currentLang] ?? fallback;

  // ================= UI 상태 =================
  const [mode, setMode] = useState<ModeKey>(MODE_ORDER[0]);
  const [controlMode, setControlModeState] = useState<ControlMode>('manual');
  const [pressed, setPressed] = useState<Direction | null>(null);
  const [activeAxis, setActiveAxis] = useState<AxisKey | null>(null);
  /**
   * 릴렉스 프리셋 상태 (모드와 독립적인 레이어)
   *  phase : off / on(100% 적용) / partial(100% 이전 중단 — ON 도 OFF 도 아님)
   *  run   : 현재 이동 중인 시퀀스 방향 (정지 중이면 null)
   * — 시뮬레이션 루프에서 참조해야 하므로 ref 를 정본으로 두고 state 에 미러링한다.
   */
  const relaxRef = useRef<RelaxStatus>({ phase: 'off', run: null });
  const [relax, setRelaxState] = useState<RelaxStatus>(relaxRef.current);
  const [, setFrame] = useState(0);
  /** 시퀀스 로그 (HMI 우측 패널) — 조작/축 완료 시점에만 갱신 */
  const [log, setLog] = useState<LogEntry[]>([
    { t: '--:--:--', msg: 'SYSTEM READY · 10 AXES ONLINE', tone: 'dim' },
  ]);

  // ================= 시뮬레이션 상태 (ref) =================
  const posRef = useRef<Record<AxisKey, number>>({ ...INITIAL_POSITIONS });
  const tgtRef = useRef<Record<AxisKey, number>>({ ...INITIAL_POSITIONS });
  const pressRef = useRef<{ axis: AxisKey; dir: Direction } | null>(null);
  const modeRef = useRef<ModeKey>(MODE_ORDER[0]);
  const controlModeRef = useRef<ControlMode>('manual');
  const langRef = useRef<'ko' | 'en'>(currentLang);
  const keyHeldRef = useRef<Set<string>>(new Set());
  const relaxSnapshotRef = useRef<Partial<Record<AxisKey, number>> | null>(null);
  /**
   * 적용률(RLX) 0% 기준선이 되는 OFF 포즈
   * — On 직전 포즈, Off 중에는 복귀 대상 포즈(복귀가 끝날 때까지 유지)
   */
  const relaxOffRef = useRef<Partial<Record<AxisKey, number>> | null>(null);
  /** 이번 릴렉스 명령의 시작 지점 (코리오그래피 이동 구간 표시용 — Off 복귀 구간도 포함) */
  const relaxFromRef = useRef<Partial<Record<AxisKey, number>> | null>(null);
  /**
   * 릴렉스 On/Off 프리셋으로 "이동 중"인 축集合
   * — 타깃(노란) 마커는 이 축들에 대해서만 표시한다 (수동/AUTO 조작 중에는 목표=현재라 무의미)
   */
  const relaxAxesRef = useRef<Set<AxisKey>>(new Set());

  /**
   * 포즈 슬롯 (사용자 메모리 프리셋 2개)
   *  slots       : 슬롯에 기록된 포즈 (null = 빈 슬롯)
   *  slotHold    : 지금 길게 누르는 중인 슬롯 인덱스 (저장 채움 바용)
   *  slotPreview : 마우스가 올라간 슬롯 — 시트 라인아트에 고스트로 미리 보여준다
   *  slotFlash   : 방금 저장한 슬롯 (짧게 반짝임)
   * — 채움 바는 engineTick 의 30ms 리렌더로 갱신하므로 별도 타이머가 필요 없다.
   */
  const [slots, setSlots] = useState<(SavedPose | null)[]>(() =>
    Array.from({ length: POSE_SLOT_COUNT }, () => null),
  );
  const [slotHold, setSlotHold] = useState<number | null>(null);
  const [slotPreview, setSlotPreview] = useState<number | null>(null);
  const [slotFlash, setSlotFlash] = useState<{ index: number; at: number } | null>(null);
  const slotTimerRef = useRef<{ index: number; start: number; timer: number } | null>(null);
  /**
   * 지금 슬롯 호출로 이동 중임을 나타내는 **유일한** 연결 표시
   * — total 은 진행률(시간 기준)의 기준선, pose 는 도착 판정용 스냅샷.
   *   전 축이 도착하면 engineTick 이 이 ref 를 비우고, 카드는 다시 조용한 저장 상태로 돌아간다.
   */
  const slotTravelRef = useRef<{ index: number; total: number; pose: SavedPose } | null>(null);
  /** localStorage 에서 한 번이라도 읽었는지 (첫 렌더 전 빈 값으로 덮어쓰지 않기 위해) */
  const slotsHydratedRef = useRef(false);

  const sectionRef = useRef<HTMLElement>(null);
  const demoRef = useRef<{
    phase: DemoPhase;
    delay: number;
    targetMode: ModeKey;
    targetAxis: AxisKey;
    targetValue: number;
    /** 모드 전환 카운터 (4사이클마다 릴렉스 프리셋 시연) */
    cycle: number;
    /** 릴렉스 시연 단계 (0 = On 적용 중, 1 = Off 복귀 중) */
    relaxStep: number;
  }>({
    phase: 'idle',
    delay: 0,
    targetMode: MODE_ORDER[0],
    targetAxis: primaryAxis(MODE_ORDER[0]),
    targetValue: 50,
    cycle: 0,
    relaxStep: 0,
  });

  /** 릴렉스 상태 갱신 (ref 정본 + state 미러) */
  const setRelax = (phase: RelaxPhase, run: RelaxRun) => {
    relaxRef.current = { phase, run };
    setRelaxState(relaxRef.current);
  };

  langRef.current = currentLang;

  /** HMI 시퀀스 로그 적재 (최신 6건 유지) */
  const pushLog = (msg: string, tone: LogTone = 'dim') => {
    const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLog((prev) => [{ t: stamp, msg, tone }, ...prev].slice(0, 6));
  };

  // ================= 릴렉스 프리셋 레이어 (드라이브 모드와 독립) =================
  /**
   * 릴렉스 On/Off 프리셋 적용
   *  On  : 스냅샷이 없으면 현재 6축을 저장하고 RELAX_ON_TARGETS 로 이동 (릴렉스 100% 목표)
   *        — 부분 적용 상태에서 누르면 스냅샷을 유지한 채 100% 까지 재개한다
   *  Off : 스냅샷 값으로 복귀 (릴렉스 0%)
   */
  const applyRelaxPreset = (on: boolean) => {
    pressRef.current = null;
    setPressed(null);
    releaseSlotLink();

    const prev = relaxRef.current;
    const hadSnapshot = relaxSnapshotRef.current !== null;
    const prevSnapshot = relaxSnapshotRef.current;
    const result = relaxPreset(posRef.current, relaxSnapshotRef.current, on);
    Object.assign(tgtRef.current, result.targets);
    relaxSnapshotRef.current = result.snapshot;
    // 적용률 0% 기준선 — On 은 직전 포즈, Off 는 복귀 대상 포즈 (복귀 완료까지 유지)
    relaxOffRef.current = on ? result.snapshot : prevSnapshot;

    // 이번 명령의 시작 지점 기록 (코리오그래피가 Off 복귀 구간도 올바르게 그리도록)
    const from: Partial<Record<AxisKey, number>> = {};
    RELAX_ON_AXES.forEach((k) => {
      from[k] = posRef.current[k];
    });
    relaxFromRef.current = from;

    // 이동이 실제로 발생하는 축만 타깃 마커 대상으로 등록 (Off 시 스냅샷 복귀 구간 포함)
    const moving = new Set<AxisKey>();
    RELAX_ON_AXES.forEach((k) => {
      const target = result.targets[k];
      if (target !== undefined && Math.abs(target - posRef.current[k]) > 0.05) moving.add(k);
    });
    relaxAxesRef.current = moving;

    if (on) {
      pushLog(
        prev.phase === 'partial'
          ? `RELAX RESUME · ${Math.round(relaxApplyRatio(posRef.current, relaxOffRef.current))}% → 100%`
          : hadSnapshot
            ? 'RELAX ON · TARGET 100% (6AX)'
            : 'RELAX ON · SNAPSHOT SAVED (6AX)',
        'hot',
      );
    } else {
      pushLog('RELAX OFF · RESTORE SNAPSHOT', 'ok');
    }

    // 이동이 끝나면 engineTick 에서 phase 가 확정된다 (이동 중에는 run 라벨이 우선 표시)
    setRelax(on ? 'on' : 'off', moving.size ? (on ? 'on' : 'off') : null);
    setActiveAxis('relaxation_return');
    setFrame((f) => f + 1);
  };

  /**
   * 릴렉스 시퀀스 중단 — 100% 도달 전에 모드 전환/수동 조작이 들어오면
   * 전 축을 현재 위치에서 세우고 ON 도 OFF 도 아닌 '부분 적용(PARTIAL)' 상태로 둔다.
   *  (이후 On = 100% 까지 재개 / Off = 스냅샷 복귀)
   */
  const interruptRelaxSequence = (reason: string) => {
    if (relaxRef.current.run === null) return;
    RELAX_ON_AXES.forEach((k) => {
      tgtRef.current[k] = posRef.current[k];
    });
    relaxAxesRef.current = new Set();
    const pct = Math.round(relaxApplyRatio(posRef.current, relaxOffRef.current));
    setRelax('partial', null);
    pushLog(`RELAX INTERRUPTED · ${pct}% PARTIAL · ${reason}`, 'hot');
  };

  /** 현재 조작 중단 (현재 위치를 타깃으로 고정) */
  const stopMotion = () => {
    const prev = pressRef.current;
    if (prev) tgtRef.current[prev.axis] = posRef.current[prev.axis];
    pressRef.current = null;
    setPressed(null);
    setActiveAxis(null);
  };

  const selectMode = (next: ModeKey) => {
    if (next === modeRef.current) return;
    stopMotion();
    // 모드 전환 = 릴렉스 시퀀스 중단 (100% 이전이라면 부분 적용 상태로 유지)
    interruptRelaxSequence(`CONTROL → ${modeCode(next)}`);
    modeRef.current = next;
    setMode(next);
    pushLog(`CONTROL → ${modeCode(next)} · ${MODE_CONFIG[next].subName.toUpperCase()}`);
    setFrame((f) => f + 1);
  };

  const rotateModeBy = (step: number) => selectMode(rotateMode(modeRef.current, step));

  const setControlMode = (next: ControlMode) => {
    if (controlModeRef.current === next) return;
    if (next === 'manual') {
      demoRef.current.phase = 'idle';
      stopMotion();
    }
    controlModeRef.current = next;
    setControlModeState(next);
    pushLog(next === 'auto' ? 'AUTO DEMO ENGAGED' : 'AUTO DEMO OFF · MANUAL', 'hot');
    if (next === 'auto') {
      demoRef.current = {
        phase: 'mode_transition',
        delay: 0,
        targetMode: modeRef.current,
        targetAxis: primaryAxis(modeRef.current),
        targetValue: 50,
        cycle: 0,
        relaxStep: 0,
      };
    }
  };

  const resetPose = () => {
    demoRef.current.phase = 'idle';
    controlModeRef.current = 'manual';
    setControlModeState('manual');
    stopMotion();
    releaseSlotLink();
    modeRef.current = MODE_ORDER[0];
    setMode(MODE_ORDER[0]);
    relaxSnapshotRef.current = null;
    relaxOffRef.current = null;
    relaxFromRef.current = null;
    relaxAxesRef.current = new Set();
    setRelax('off', null);
    pushLog('POSE RESET · INITIAL VALUES', 'ok');
    posRef.current = { ...INITIAL_POSITIONS };
    tgtRef.current = { ...INITIAL_POSITIONS };
    setFrame((f) => f + 1);
  };

  const handlePress = (dir: Direction, fromMode?: ModeKey) => {
    // 수동 조작 시작 시 AUTO DEMO 정지
    if (controlModeRef.current === 'auto') setControlMode('manual');
    // 컨트롤의 버튼을 누르면 그 컨트롤이 곧 현재 조작 대상이 된다
    if (fromMode && fromMode !== modeRef.current) selectMode(fromMode);
    // 수동 오버라이드 = 릴렉스 시퀀스 중단 (100% 이전이면 부분 적용 상태로 유지)
    interruptRelaxSequence('MANUAL OVERRIDE');
    // 슬롯 호출로 이동 중이었으면 그 연결도 함께 끊는다 (슬롯은 계속 시트를 쫓지 않는다)
    releaseSlotLink();

    const axis = axisForDirection(modeRef.current, dir);
    if (!axis) return;

    const prev = pressRef.current;
    if (prev && prev.dir !== dir) tgtRef.current[prev.axis] = posRef.current[prev.axis];

    pressRef.current = { axis, dir };
    setPressed(dir);
    setActiveAxis(axis);
  };

  /** 릴렉스 On/Off 버튼 (모드와 무관하게 항상 조작 가능) */
  const handleRelaxButton = (on: boolean) => {
    if (controlModeRef.current === 'auto') setControlMode('manual');
    applyRelaxPreset(on);
  };

  const handleRelease = () => stopMotion();

  // ================= 포즈 슬롯 (메모리 프리셋 저장 / 호출) =================
  /** 슬롯에 현재 포즈를 새긴다 (길게 누르기 완료 시점) */
  const saveSlot = (index: number) => {
    const pose = capturePose(posRef.current);
    setSlots((prev) => {
      const next = [...prev];
      next[index] = pose;
      return next;
    });
    setSlotHold(null);
    setSlotFlash({ index, at: performance.now() });
    slotTravelRef.current = null;
    pushLog(
      `SLOT P${index + 1} ETCHED · ${POSE_AXES.length} AXES · RCL ${pose.recline?.toFixed(1) ?? '—'}°`,
      'ok',
    );
  };

  /**
   * 슬롯 호출 — 저장된 포즈로 전 축을 모터 속도대로 이동시킨다
   *  슬롯 호출은 수동 포즈 명령이다 : 릴렉스 시퀀스가 달리면 중단하고,
   *  ON 이었던 릴렉스는 더 이상 릴렉션 포즈에 있지 않으므로 부분 적용으로 강등한다.
   */
  const recallSlot = (index: number) => {
    const pose = slots[index];
    if (!pose) {
      pushLog(`SLOT P${index + 1} EMPTY · HOLD TO SAVE`, 'hot');
      return;
    }
    if (controlModeRef.current === 'auto') setControlMode('manual');
    pressRef.current = null;
    setPressed(null);
    setActiveAxis(null);
    interruptRelaxSequence(`SLOT P${index + 1} RECALL`);

    /**
     * 릴렉스 ON 상태에서 슬롯을 부르면 포즈가 릴렉션 포즈에서 벗어나므로 부분 적용으로 강등한다.
     * 단 슬롯에 릴렉션 포즈 자체를 새겨둔 경우(릴렉스 ON 상태에서 저장)에는 ON 을 그대로 유지한다.
     */
    if (relaxRef.current.phase === 'on') {
      const atRelaxPose = RELAX_ON_AXES.every(
        (k) => Math.abs((pose[k] ?? posRef.current[k]) - (RELAX_ON_TARGETS[k] as number)) <= 0.05,
      );
      setRelax(atRelaxPose ? 'on' : 'partial', null);
    }

    POSE_AXES.forEach((k) => {
      const value = pose[k];
      if (value === undefined) return;
      tgtRef.current[k] = clamp(value, AXIS_CONFIG[k].min, AXIS_CONFIG[k].max);
    });

    const eta = poseEta(pose, posRef.current);
    slotTravelRef.current = { index, total: eta, pose };
    pushLog(
      eta > 0.05
        ? `SLOT P${index + 1} RECALL · ${poseDrift(pose, posRef.current)} AXES · ETA ${eta.toFixed(1)} s`
        : `SLOT P${index + 1} ALREADY MATCHED`,
      'hot',
    );
    setFrame((f) => f + 1);
  };

  const clearSlot = (index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setSlotPreview((prev) => (prev === index ? null : prev));
    if (slotTravelRef.current?.index === index) slotTravelRef.current = null;
    pushLog(`SLOT P${index + 1} CLEARED`, 'dim');
  };

  /**
   * 슬롯 ↔ 시트 연결 해제
   * 슬롯은 스냅샷일 뿐 현재 포즈와 실시간으로 묶여 있지 않다. 호출로 인한 이동이
   * 수동 조작·릴렉스·리셋으로 끊기면 "그 포즈로 가는 중" 이라는 표시도 함께 접는다.
   */
  const releaseSlotLink = () => {
    slotTravelRef.current = null;
  };

  const cancelSlotHold = () => {
    if (slotTimerRef.current) window.clearTimeout(slotTimerRef.current.timer);
    slotTimerRef.current = null;
    setSlotHold(null);
  };

  /**
   * 슬롯 누르기 시작 — SLOT_HOLD_MS 를 채우면 저장, 그 전에 떼면 호출
   * (하나의 카드를 누르는 강도로 두 동작을 나눠 쓴다 — 저장 버튼/확인창이 필요 없다)
   */
  const beginSlotHold = (index: number) => {
    cancelSlotHold();
    setSlotHold(index);
    const timer = window.setTimeout(() => {
      slotTimerRef.current = null;
      saveSlot(index);
    }, SLOT_HOLD_MS);
    slotTimerRef.current = { index, start: performance.now(), timer };
  };

  /** 손을 뗐을 때 — 저장이 채워지기 전이라면 호출로 처리한다 */
  const endSlotHold = (index: number) => {
    const held = slotTimerRef.current;
    cancelSlotHold();
    if (!held || held.index !== index) return;
    if (performance.now() - held.start < SLOT_HOLD_MS) recallSlot(index);
  };

  // ================= AUTO DEMO (ref: run_auto_demo) =================
  const runAutoDemo = (dt: number) => {
    const demo = demoRef.current;
    const pos = posRef.current;
    const tgt = tgtRef.current;

    if (demo.phase === 'idle') {
      demo.delay += dt;
      if (demo.delay >= 1.0) {
        demo.delay = 0;
        demo.phase = 'mode_transition';
      }
      return;
    }
    if (demo.phase === 'up_delay') {
      demo.delay -= dt;
      if (demo.delay <= 0) {
        demo.delay = 0;
        demo.phase = 'mode_transition';
      }
      return;
    }

    // 진행 중인 축이 있으면 대기 (기존 동작: 모든 축 수렴 후 다음 단계)
    let moving = false;
    for (const k of AXIS_ORDER) {
      if (Math.abs(pos[k] - tgt[k]) > 0.05) {
        moving = true;
        break;
      }
    }

    // 릴렉스 프리셋 레이어 시연 — 모드 전환과 무관하게 겹쳐 동작하므로 축 수렴을 기다린다
    if (demo.phase === 'relax_demo') {
      if (moving) return;
      demo.delay -= dt;
      if (demo.delay > 0) return;
      if (demo.relaxStep === 0) {
        // On(100%) 유지 후 → Off 로 스냅샷 복귀
        demo.relaxStep = 1;
        applyRelaxPreset(false);
        demo.delay = 1.5;
      } else {
        demo.phase = 'mode_transition';
        demo.delay = 0;
      }
      return;
    }

    if (demo.phase === 'mode_transition' && moving) return;

    if (demo.phase === 'mode_transition') {
      // 4사이클마다 릴렉스 프리셋(On → Off)을 시연한다 — 모드 트랙과는 별개의 레이어
      demo.cycle += 1;
      if (demo.cycle % 4 === 0) {
        demo.relaxStep = 0;
        applyRelaxPreset(true);
        demo.phase = 'relax_demo';
        demo.delay = 2.0;
        return;
      }

      const next = rotateMode(demo.targetMode, 1);
      demo.targetMode = next;
      selectMode(next);

      const axis = primaryAxis(next);
      const confAxis = AXIS_CONFIG[axis];
      const range = confAxis.softMax - confAxis.softMin;
      demo.targetAxis = axis;
      demo.targetValue = clamp(
        confAxis.softMin + range * (0.25 + Math.random() * 0.5),
        confAxis.softMin,
        confAxis.softMax,
      );
      setActiveAxis(axis);
      demo.phase = 'value_tuning';
      return;
    }

    if (demo.phase === 'value_tuning') {
      const axis = demo.targetAxis;
      const diff = demo.targetValue - pos[axis];
      if (Math.abs(diff) < 0.5) {
        tgt[axis] = demo.targetValue;
        demo.phase = 'up_delay';
        demo.delay = 2.0;
        return;
      }
      const confAxis = AXIS_CONFIG[axis];
      const step = confAxis.speed * dt;
      tgt[axis] = clamp(
        tgt[axis] + Math.sign(diff) * Math.max(step, Math.abs(diff)),
        confAxis.min,
        confAxis.max,
      );
    }
  };

  // ================= 시뮬레이션 틱 (ref: run_simulation_tick) =================
  const engineTick = () => {
    const dt = TICK_MS / 1000;
    const pos = posRef.current;
    const tgt = tgtRef.current;

    if (controlModeRef.current === 'auto') runAutoDemo(dt);

    for (const key of AXIS_ORDER) {
      const conf = AXIS_CONFIG[key];
      const diff = tgt[key] - pos[key];
      if (Math.abs(diff) < 0.01) {
        pos[key] = tgt[key];
        continue;
      }
      const step = conf.speed * dt;
      pos[key] = diff > 0 ? Math.min(pos[key] + step, tgt[key]) : Math.max(pos[key] - step, tgt[key]);
      // 하드 리밋 클램프
      pos[key] = clamp(pos[key], conf.min, conf.max);
    }

    // 릴렉스 프리셋 이동을 완료한 축은 타깃 마커 대상에서 제외 (+ 시퀀스 로그)
    if (relaxAxesRef.current.size > 0) {
      const done: AxisKey[] = [];
      relaxAxesRef.current.forEach((k) => {
        if (Math.abs(tgt[k] - pos[k]) < 0.05) {
          done.push(k);
          relaxAxesRef.current.delete(k);
        }
      });
      done.forEach((k) => {
        const conf = AXIS_CONFIG[k];
        pushLog(
          `${conf.code} ${pos[k].toFixed(conf.unit === '°' ? 1 : 0)}${conf.unit} DONE`,
          'ok',
        );
      });
    }

    // 릴렉스 시퀀스 이동 완료 → 상태를 확정한다 (이동 중에는 run 라벨이 우선 표시됨)
    if (relaxAxesRef.current.size === 0 && relaxRef.current.run !== null) {
      const settled = relaxRef.current.phase;
      // OFF 복귀까지 끝나면 적용률 기준선을 내린다 (이후 RLX = 0 으로 고정)
      if (settled === 'off') relaxOffRef.current = null;
      setRelax(settled, null);
      pushLog(
        settled === 'on'
          ? 'RELAX POSE APPLIED · 100% · 6 AXES HOLDING'
          : 'RELAX RELEASED · SNAPSHOT RESTORED',
        settled === 'on' ? 'ok' : 'dim',
      );
    }

    // RLX(적용률) 는 모터를 돌리는 축이 아니라 파생 신호 — 6축의 실제 포즈 진행률을 반영한다
    // 포즈 슬롯 호출 이동 완료 → 연결을 여기서 끊는다.
    // 슬롯은 스냅샷일 뿐 현재 포즈와 실시간으로 묶여 있지 않으므로, 도착과 동시에
    // 카드의 ETA·진행선은 사라지고 조용한 "저장됨" 상태로 돌아간다.
    const slotRun = slotTravelRef.current;
    if (slotRun && poseDrift(slotRun.pose, pos) === 0) {
      slotTravelRef.current = null;
      // 도착은 한 번만 반짝여 알린다 — 이후 카드는 조용한 저장 상태로 돌아간다
      setSlotFlash({ index: slotRun.index, at: performance.now() });
      pushLog(`SLOT P${slotRun.index + 1} ARRIVED · POSE REACHED · LINK RELEASED`, 'ok');
    }

    // RLX(적용률) 는 모터를 돌리는 축이 아니라 파생 신호 — 6축의 실제 포즈 진행률을 반영한다
    const applyRatio = relaxApplyRatio(pos, relaxOffRef.current);
    pos.relaxation_return = applyRatio;
    tgt.relaxation_return = applyRatio;

    // 조작 중 타깃 갱신 (ref: _execute_direction_step — 40ms 명령 스텝, 하드 리밋만 적용)
    const press = pressRef.current;
    if (press && controlModeRef.current === 'manual') {
      const conf = AXIS_CONFIG[press.axis];
      const step = conf.speed * 0.04 * lrSign(press.axis, press.dir);
      tgt[press.axis] = clamp(tgt[press.axis] + step, conf.min, conf.max);
    }

    setFrame((f) => f + 1);
  };

  // ================= 생명주기 =================
  useEffect(() => {
    const id = window.setInterval(engineTick, TICK_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 포즈 슬롯 복원 (브라우저 저장 → 화면) — 데모이므로 계정 없이 이 기기에만 남는다
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(POSE_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      setSlots(
        Array.from({ length: POSE_SLOT_COUNT }, (_, i) =>
          normalizePose(list[i] as SavedPose | null),
        ),
      );
    } catch {
      /* 손상된 저장 데이터는 그냥 빈 슬롯으로 시작한다 */
    }
  }, []);

  // 포즈 슬롯 저장 (화면 → 브라우저) — 첫 실행은 복원 전이라 덮어쓰지 않는다
  useEffect(() => {
    if (!slotsHydratedRef.current) {
      slotsHydratedRef.current = true;
      return;
    }
    try {
      window.localStorage.setItem(POSE_STORAGE_KEY, JSON.stringify(slots));
    } catch {
      /* 저장 공간이 없어도 시뮬레이터 동작에는 지장이 없다 */
    }
  }, [slots]);

  // 포커스 이탈 시 조작 해제 (_stopped 시그널 대응)
  useEffect(() => {
    const blur = () => {
      keyHeldRef.current.clear();
      handleRelease();
    };
    window.addEventListener('blur', blur);
    return () => window.removeEventListener('blur', blur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ================= 키보드 =================
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const keyMap: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    if (keyMap[e.key]) {
      e.preventDefault();
      if (e.repeat) return;
      keyHeldRef.current.add(e.key);
      handlePress(keyMap[e.key]);
      return;
    }
    // 1·2 = 포즈 슬롯 호출 / Shift+1·Shift+2 = 현재 포즈를 슬롯에 저장
    const slotIndex =
      e.code === 'Digit1' || e.key === '1' ? 0 : e.code === 'Digit2' || e.key === '2' ? 1 : -1;
    if (slotIndex >= 0 && slotIndex < POSE_SLOT_COUNT) {
      e.preventDefault();
      if (!e.repeat) (e.shiftKey ? saveSlot : recallSlot)(slotIndex);
      return;
    }
    // R = 릴렉스 프리셋 토글 (모드와 무관 — ON/적용 중이면 Off 복귀, 그 외에는 100% 까지 On)
    if (e.key === 'r' || e.key === 'R') {
      if (!e.repeat) {
        const goingOn = !(relaxRef.current.phase === 'on' || relaxRef.current.run === 'on');
        handleRelaxButton(goingOn);
      }
      return;
    }
    if (e.key === 'q' || e.key === 'Q') {
      if (!e.repeat) rotateModeBy(-1);
      return;
    }
    if (e.key === 'e' || e.key === 'E') {
      if (!e.repeat) rotateModeBy(1);
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) setControlMode(controlModeRef.current === 'auto' ? 'manual' : 'auto');
    }
  };

  const handleKeyUp = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!keyHeldRef.current.has(e.key)) return;
    keyHeldRef.current.delete(e.key);
    if (keyHeldRef.current.size === 0) handleRelease();
  };

  // ================= 렌더 계산 =================
  const pos = posRef.current;
  const tgt = tgtRef.current;
  const focusAxis: AxisKey = activeAxis ?? primaryAxis(mode);
  const focusConf = AXIS_CONFIG[focusAxis];
  /** 축 → 트래블 바 좌표 (%) — 포커스 축(큰 바)과 둘째 축(보조 바)이 같은 공식을 공유한다 */
  const travelOf = (axis: AxisKey) => {
    const conf = AXIS_CONFIG[axis];
    const axisSpan = conf.max - conf.min;
    return {
      pct: ((pos[axis] - conf.min) / axisSpan) * 100,
      tgtPct: ((tgt[axis] - conf.min) / axisSpan) * 100,
      softLeft: ((conf.softMin - conf.min) / axisSpan) * 100,
      softRight: ((conf.softMax - conf.min) / axisSpan) * 100,
    };
  };
  const { pct, tgtPct, softLeft, softRight } = travelOf(focusAxis);

  const fmtAxis = (axis: AxisKey, value: number) =>
    `${value.toFixed(AXIS_CONFIG[axis].unit === '°' ? 1 : 0)}${AXIS_CONFIG[axis].unit}`;

  /**
   * 타깃 마커(2px)의 left 위치
   * — 트랙이 overflow-hidden 이라 0%/100% 에선 마커가 통째로 잘려 보이지 않는다.
   *    (마커 폭의 절반만큼 안쪽으로 당겨 양 끝에서도 항상 보이게 한다)
   */
  const markerLeft = (valuePct: number) => {
    const p = clamp(valuePct, 0, 100);
    if (p <= 0) return '0%';
    if (p >= 100) return 'calc(100% - 2px)';
    return `calc(${p.toFixed(2)}% - 1px)`;
  };

  /**
   * 컨트롤 안 방향 버튼 — 그 컨트롤이 가진 방향만 생성된다(MODE_SPEC_LABELS 가 null 인 방향은 만들지 않는다).
   *  - 누르는 동안 연속 조작(pointerdown → pointerup/leave)
   *  - 다른 컨트롤의 버튼을 누르면 그 컨트롤로 전환된 뒤 조작된다
   *  - 버튼 라벨은 목적어만(전진/상승/조임…), 전체 문구는 title 툴팁
   */
  const controlButton = (modeKey: ModeKey, dir: Direction) => {
    const label = MODE_SPEC_LABELS[modeKey][dir];
    if (!label) return null;
    const active = pressed === dir && mode === modeKey;
    const current = mode === modeKey;
    const Chev = DIR_CHEVRON[dir];
    return (
      <button
        key={dir}
        type="button"
        title={`${modeCode(modeKey)} · ${label[currentLang]}`}
        aria-label={label[currentLang]}
        aria-pressed={active}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handlePress(dir, modeKey);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          handleRelease();
        }}
        onPointerLeave={() => {
          if (active) handleRelease();
        }}
        className={`flex items-center justify-center gap-1 min-w-0 h-[24px] rounded-[8px] border transition-all duration-150 select-none touch-none cursor-pointer
          ${
            active
              ? 'border-[#f0a53c]/70 bg-[rgba(240,165,60,.18)] text-[#ffe0b3] shadow-[0_0_14px_-4px_rgba(240,165,60,.85)]'
              : current
                ? 'border-white/[.13] bg-white/[.06] text-[#c9d6d7] hover:border-[#f0a53c]/60 hover:text-[#ffc276]'
                : 'border-white/[.07] bg-white/[.025] text-[#7f8f92] hover:border-[#f0a53c]/45 hover:text-[#ffc276]'
          }`}
      >
        <Chev className="w-[12px] h-[12px] shrink-0" strokeWidth={2.6} />
        <span className="text-[9.5px] leading-none tracking-[.04em] truncate">
          {shortDirLabel(label[currentLang])}
        </span>
      </button>
    );
  };

  /**
   * 릴렉스 프리셋 버튼 — 드라이브 모드와 무관하게 항상 조작 가능한 레이어 컨트롤
   *  On  : 스냅샷 저장 후 릴렉션 포즈로 100% 이동 (부분 적용 상태에서는 100% 까지 재개)
   *  Off : 스냅샷으로 복귀
   */
  const relaxButton = (on: boolean) => {
    const active = relax.phase === on && relax.run === null;
    const busy = relax.run === (on ? 'on' : 'off');
    /** Off 는 복귀할 스냅샷이 있을 때만 의미가 있다 */
    const disabled =
      !on && relax.phase === 'off' && relax.run === null && !relaxSnapshotRef.current;
    const caption = on
      ? relax.phase === 'partial'
        ? 'RESUME'
        : 'ON'
      : relax.phase === 'partial'
        ? 'RESTORE'
        : 'OFF';
    return (
      <button
        key={on ? 'relax-on' : 'relax-off'}
        type="button"
        disabled={disabled}
        onClick={() => handleRelaxButton(on)}
        title={
          on
            ? relax.phase === 'partial'
              ? '이어서 릴렉션 포즈 100% 적용'
              : '릴렉션 포즈 적용 (현재 값은 스냅샷으로 저장)'
            : '직전 스냅샷으로 복귀'
        }
        className={`flex-1 h-11 rounded-[10px] border flex flex-col items-center justify-center gap-[2px] transition-all
          ${
            disabled
              ? 'border-white/[.06] text-[#4f5c5f]'
              : active
                ? on
                  ? 'bg-[#5fd6a4] text-[#08120e] border-[#5fd6a4] shadow-[0_0_18px_rgba(95,214,164,.35)]'
                  : 'bg-white/10 text-white border-white/25'
                : busy
                  ? 'border-[#f0a53c] text-[#ffc276] bg-[#f0a53c]/10 animate-pulse cursor-pointer'
                  : 'border-white/[.12] text-[#93a2a4] hover:border-[#f0a53c]/60 hover:text-[#ffc276] cursor-pointer'
          }`}
      >
        <span className="text-[11px] leading-none">{on ? '⏻' : '↺'}</span>
        <span className="text-[9px] leading-none font-bold tracking-[.2em]">{caption}</span>
      </button>
    );
  };


  /**
   * 포즈 슬롯 카드 — 한 장을 누르는 **강도**만으로 두 동작을 나눠 쓴다
   *  탭       : 저장된 포즈로 이동 (호출)
   *  길게 누름 : 현재 포즈를 슬롯에 새김 (0.6초 채움 바가 다 채워지면 기록)
   *  호버     : 시트 라인아트에 저장 포즈를 민트 점선 고스트로 미리 보여준다
   *
   * 카드는 값 목록 대신 **포즈 지문**(막대 = 저장된 값) 을 보여준다.
   * ⚠ 슬롯은 스냅샷이지 시트와의 실시간 바인딩이 아니다 — 평소에는 저장본만 보이고,
   *   현재 포즈가 겹쳐 보이는 건 **호버(비교)** 와 **호출로 이동 중인 구간** 뿐이다.
   */
  const slotCard = (index: number) => {
    const pose = slots[index];
    const filled = pose !== null;
    const code = `P${index + 1}`;
    const now = posRef.current;
    const eta = filled ? poseEta(pose, now) : 0;
    const previewing = slotPreview === index;
    /**
     * 슬롯은 스냅샷이지 현재 포즈와의 실시간 바인딩이 아니다.
     * 따라서 시트와 "연결된" 상태로 보는 구간은 **호출로 실제로 이동 중일 때** 뿐이다 —
     * 도착하면 engineTick 이 slotTravelRef 를 비우고, 카드는 다시 저장본만 보여주는 조용한 상태로 돌아간다.
     */
    const recalling = filled && slotTravelRef.current?.index === index && eta > 0.05;
    /** 호출 이동 진행률 — 이동 총 시간 대비 남은 시간 (릴렉스 적용률과 같은 시간 기준) */
    const travel =
      recalling && slotTravelRef.current && slotTravelRef.current.total > 0
        ? clamp(1 - eta / slotTravelRef.current.total, 0, 1)
        : 1;
    const holding = slotHold === index && slotTimerRef.current?.index === index;
    const holdPct = holding
      ? clamp(
          ((performance.now() - (slotTimerRef.current as { start: number }).start) / SLOT_HOLD_MS) *
            100,
          0,
          100,
        )
      : 0;
    const flashAge = slotFlash?.index === index ? performance.now() - slotFlash.at : Infinity;
    const flashing = flashAge < SLOT_FLASH_MS;

    const tone = holding
      ? 'border-[#f0a53c] bg-[#f0a53c]/[.08]'
      : !filled
        ? 'border-dashed border-white/[.16] bg-white/[.02] hover:border-[#f0a53c]/55 hover:bg-[#f0a53c]/[.05]'
        : recalling
          ? 'border-[#f0a53c]/55 bg-[#f0a53c]/[.06]'
          : previewing
            ? 'border-[#5fd6a4]/45 bg-white/[.05]'
            : 'border-white/[.1] bg-white/[.04] hover:border-white/25';

    const statusText = holding
      ? `WRITING ${holdPct.toFixed(0)}%`
      : !filled
        ? currentLang === 'ko'
          ? '길게 눌러 저장'
          : 'HOLD TO SAVE'
        : recalling
          ? `ETA ${eta.toFixed(1)}s`
          : currentLang === 'ko'
            ? '저장됨'
            : 'STORED';

    const statusTone =
      holding || recalling
        ? 'text-[#ffc276]'
        : !filled
          ? 'text-[#5d6c6f]'
          : previewing
            ? 'text-[#8fe6c2]'
            : 'text-[#7f8f92]';

    return (
      <div
        key={code}
        role="button"
        tabIndex={0}
        aria-label={`${code} ${filled ? '' : 'EMPTY'}`}
        title={
          filled
            ? currentLang === 'ko'
              ? '탭 = 이 포즈로 이동 · 0.6초 누름 = 지금 포즈로 덮어쓰기 · 호버 = 미리보기'
              : 'Tap = drive to this pose · hold 0.6s = overwrite with current pose · hover = preview'
            : currentLang === 'ko'
              ? '0.6초 동안 누르면 지금 포즈가 이 슬롯에 새겨집니다'
              : 'Hold 0.6s to etch the current pose into this slot'
        }
        onPointerDown={(e) => {
          e.preventDefault();
          beginSlotHold(index);
        }}
        onPointerUp={() => endSlotHold(index)}
        onPointerCancel={cancelSlotHold}
        onPointerEnter={() => setSlotPreview(index)}
        onPointerLeave={() => {
          cancelSlotHold();
          setSlotPreview((prev) => (prev === index ? null : prev));
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();
          recallSlot(index);
        }}
        className={`group relative overflow-hidden rounded-[12px] border px-3 py-2 transition-colors select-none cursor-pointer focus:outline-none focus-visible:border-[#f0a53c]/70 ${tone}`}
      >
        {/* 길게 누르는 동안 차오르는 저장 바 */}
        {holding && (
          <i
            className="absolute inset-y-0 left-0 bg-[#f0a53c]/20 border-r-2 border-[#f0a53c]"
            style={{ width: `${holdPct}%` }}
          />
        )}
        {/* 방금 저장한 슬롯의 짧은 민트 플래시 */}
        {flashing && (
          <i
            className="absolute inset-0 bg-[#5fd6a4] pointer-events-none"
            style={{ opacity: 0.3 * (1 - flashAge / SLOT_FLASH_MS) }}
          />
        )}
        <div className="relative flex items-center gap-2.5">
          <span
            className={`font-hmi-cond text-[19px] font-bold tracking-[.1em] leading-none ${
              filled ? 'text-[#e9f1f2]' : 'text-[#4f5c5f]'
            }`}
          >
            {code}
          </span>

          {/* 포즈 지문 — 세로 막대 = 저장된 값, 흰 눈금 = 지금 위치 */}
          <span className="flex items-end gap-[3px] h-[24px]">
            {SLOT_FINGER_AXES.map((k) => {
              const conf = AXIS_CONFIG[k];
              const span = conf.max - conf.min;
              const stored = filled
                ? clamp((((pose[k] ?? INITIAL_POSITIONS[k]) - conf.min) / span) * 100, 0, 100)
                : 0;
              const live = clamp(((now[k] - conf.min) / span) * 100, 0, 100);
              return (
                <span
                  key={k}
                  className="relative w-[3px] h-full rounded-full bg-white/[.07]"
                  title={`${conf.code} · ${conf.name[currentLang]}`}
                >
                  <i
                    className={`absolute inset-x-0 bottom-0 rounded-full ${
                      filled
                        ? previewing
                          ? 'bg-[linear-gradient(0deg,#3fae86,#8fe6c2)]'
                          : 'bg-[linear-gradient(0deg,#f0a53c,#ffd9a3)]'
                        : ''
                    }`}
                    style={{ height: `${stored}%` }}
                  />
                  {/* 현재 위치 눈금은 "비교하고 있을 때"(호버 · 호출 이동 중) 만 — 평소엔 저장본만 */}
                  {(previewing || recalling) && (
                    <i
                      className="absolute -inset-x-[2px] h-[2px] rounded-full bg-white/75"
                      style={{ bottom: `calc(${live}% - 1px)` }}
                    />
                  )}
                </span>
              );
            })}
          </span>

          <span className="flex-1" />

          <span
            className={`text-[9.5px] tracking-[.14em] uppercase whitespace-nowrap ${statusTone}`}
          >
            {statusText}
          </span>
        </div>

        <div className="relative flex items-center gap-2 mt-1.5">
          <span className="flex-1 font-hmi-cond text-[9.5px] tracking-[.04em] text-[#7f8f92] truncate">
            {filled
              ? SLOT_FINGER_AXES.map((k) => `${AXIS_CONFIG[k].code} ${Math.round(pose[k] ?? 0)}`).join(
                  ' · ',
                )
              : currentLang === 'ko'
                ? '비어 있음 — 0.6초 누르면 지금 포즈가 새겨집니다'
                : 'Empty — hold 0.6s to etch the current pose'}
          </span>
          {filled && (
            <button
              type="button"
              aria-label={`${code} clear`}
              title={currentLang === 'ko' ? '슬롯 비우기' : 'Clear slot'}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                clearSlot(index);
              }}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-5 h-5 -mr-1 rounded-[6px] border border-white/[.12] text-[#7f8f92] hover:border-[#f0a53c]/60 hover:text-[#ffc276] flex items-center justify-center cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 호출 이동 중에만 — 도착하면 이 선과 함께 슬롯↔시트 연결은 끝난다 */}
        {recalling && (
          <i
            className="absolute bottom-0 left-0 h-[2px] bg-[linear-gradient(90deg,#f0a53c,#ffd9a3)]"
            style={{ width: `${travel * 100}%` }}
          />
        )}
      </div>
    );
  };

  // ================= HMI 렌더 계산 =================
  /** 릴렉스 프리셋 적용률 (0~100) */
  const relaxPct = clamp(pos.relaxation_return, 0, 100);
  /** 릴렉스 표시 상태 — 이동 중이면 진행 방향(APPLYING/RESTORING)을 우선한다 */
  const relaxKey = relaxStateKey(relax);
  const relaxLabel = RELAX_STATE_LABEL[relaxKey][currentLang];
  /** 상태별 강조 톤 (이동 중 앰버 / ON 민트 / 부분 적용 딤앰버 / OFF 그레이) */
  const relaxTone =
    relax.run !== null
      ? {
          text: 'text-[#ffc276]',
          chip: 'border-[#f0a53c]/50 bg-[#f0a53c]/10 text-[#ffc276]',
          dot: 'bg-[#f0a53c]',
        }
      : relax.phase === 'on'
        ? {
            text: 'text-[#8fe6c2]',
            chip: 'border-[#5fd6a4]/50 bg-[#5fd6a4]/10 text-[#8fe6c2]',
            dot: 'bg-[#5fd6a4]',
          }
        : relax.phase === 'partial'
          ? {
              text: 'text-[#c9a273]',
              chip: 'border-[#f0a53c]/30 bg-[#f0a53c]/[.07] text-[#c9a273]',
              dot: 'bg-[#c9a273]',
            }
          : {
              text: 'text-[#93a2a4]',
              chip: 'border-white/[.12] bg-white/[.04] text-[#93a2a4]',
              dot: 'bg-[#6f7f82]',
            };
  /** 축 잔여 이동 시간 (s) */
  const etaOf = (axis: AxisKey) => {
    const conf = AXIS_CONFIG[axis];
    const diff = Math.abs(tgt[axis] - pos[axis]);
    return diff < 0.05 ? 0 : diff / conf.speed;
  };
  const movingAxes = AXIS_ORDER.filter((k) => Math.abs(tgt[k] - pos[k]) > 0.05);
  /** 릴렉스 프리셋으로 이동 중일 때만 타깃 고스트 포즈를 겹쳐 그린다 */
  const ghostPose = relaxAxesRef.current.size > 0;
  /**
   * 포즈 슬롯 미리보기 — 슬롯에 마우스를 올리면 저장된 포즈를 같은 고스트 문법으로
   * 시트에 얹는다. 누르기 전에 "어디까지 움직이는지" 를 몸으로 확인할 수 있다.
   */
  const previewPose = slotPreview !== null ? slots[slotPreview] : null;
  const diagramTargets = (
    previewPose ? { ...pos, ...previewPose } : tgt
  ) as Record<AxisKey, number>;
  const showGhost = previewPose !== null || ghostPose;
  const previewCode = `P${(slotPreview ?? 0) + 1}`;
  const clock = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  /** 코리오그래피 표시 순서 (릴렉스 시퀀스 우선순위) */
  const CHOREO_AXES: AxisKey[] = ['recline', 'legrest', 'cushion', 'tilt', 'slide', 'height'];
  const choreo = CHOREO_AXES.map((k) => {
    const conf = AXIS_CONFIG[k];
    const span = conf.max - conf.min;
    const from =
      relaxFromRef.current?.[k] ?? relaxSnapshotRef.current?.[k] ?? INITIAL_POSITIONS[k];
    const to = tgt[k];
    const travel = Math.abs(to - from);
    const progress = travel < 0.05 ? 0 : clamp((pos[k] - from) / (to - from), 0, 1);
    const state = travel < 0.05 ? 'idle' : progress >= 1 ? 'done' : progress > 0 ? 'run' : 'idle';
    return {
      key: k,
      code: conf.code,
      left: state === 'idle' ? 0 : ((Math.min(from, to) - conf.min) / span) * 100,
      width:
        state === 'idle'
          ? clamp(((pos[k] - conf.min) / span) * 100, 0, 100)
          : (Math.abs(pos[k] - from) / span) * 100,
      seconds: travel / conf.speed,
      remaining: etaOf(k),
      state,
    };
  });

  /** 현재 컨트롤이 조작하는 축 (좌우 + 상하) — 텔레메트리 타일 강조·표기용 */
  const drivenAxes = modeAxes(mode);
  /**
   * 4방향 컨트롤(럼버)의 둘째 축 = 포커스 축이 아닌 쪽.
   * 조작 축이 아니어도 위치는 계속 보여야 하므로 중앙에 보조 트래블 바를 따로 둔다.
   */
  const secondaryAxis: AxisKey | null = drivenAxes.find((k) => k !== focusAxis) ?? null;
  const secondary = secondaryAxis ? { axis: secondaryAxis, ...travelOf(secondaryAxis) } : null;

  const etaMax = Math.max(0, ...CHOREO_AXES.map((k) => etaOf(k)));
  /** 배너 톤 — 이동 중(앰버) / 미리보기·릴렉스 유지(민트) / 부분 적용(딤앰버) / 유휴(그레이) */
  const running = ghostPose || (activeAxis !== null && etaOf(activeAxis) > 0);
  /** 슬롯 미리보기 배너 — 실제로 움직이지 않을 때만 자리를 빌린다 */
  const previewBanner =
    previewPose && !running
      ? poseDrift(previewPose, pos) === 0
        ? `PREVIEW · SLOT ${previewCode} · ALREADY MATCHED`
        : `PREVIEW · SLOT ${previewCode} · ${poseDrift(previewPose, pos)} AXES TO TRAVEL · ETA ${poseEta(
            previewPose,
            pos,
          ).toFixed(1)} s`
      : null;
  const bannerTone: 'run' | 'hold' | 'partial' | 'idle' = running
    ? 'run'
    : previewBanner || relax.phase === 'on'
      ? 'hold'
      : relax.phase === 'partial'
        ? 'partial'
        : 'idle';
  const bannerText = ghostPose
    ? `RLX ${relax.run === 'off' ? 'RESTORING' : 'APPLYING'} · ${relaxPct.toFixed(0)}% APPLIED · ETA ${etaMax.toFixed(1)} s`
    : running && activeAxis
      ? `${AXIS_CONFIG[activeAxis].code} RUNNING · ${fmtAxis(activeAxis, pos[activeAxis])} → ${fmtAxis(
          activeAxis,
          tgt[activeAxis],
        )} · ETA ${etaOf(activeAxis).toFixed(1)} s`
      : (previewBanner ??
        (relax.phase === 'on'
          ? 'RELAX POSE APPLIED · 100% · 6 AXES HOLDING'
          : relax.phase === 'partial'
            ? `RELAX PARTIAL · ${relaxPct.toFixed(0)}% APPLIED · ON = RESUME 100% / OFF = RESTORE`
            : 'SYSTEM IDLE · SELECT A MODE AND HOLD A DIRECTION KEY'));

  /** 릴렉스 프리셋 패널 상태 안내문 — 한 줄로 끝난다 (패널 높이 = 우측 컬럼 높이 예산) */
  const relaxHint =
    relax.run === 'on'
      ? currentLang === 'ko'
        ? '이동 중 — 조작 시 부분 적용'
        : 'Moving — any input interrupts'
      : relax.run === 'off'
        ? currentLang === 'ko'
          ? '스냅샷 복귀 중…'
          : 'Restoring snapshot…'
        : relax.phase === 'on'
          ? currentLang === 'ko'
            ? 'OFF = 스냅샷 복귀'
            : 'OFF restores the snapshot'
          : relax.phase === 'partial'
            ? currentLang === 'ko'
              ? 'ON = 이어서 · OFF = 복귀'
              : 'ON resumes · OFF restores'
            : currentLang === 'ko'
              ? 'ON = 지금 6축을 스냅샷 저장'
              : 'ON snapshots the current 6 axes';

  /** 진행률 링 (270° 호) */
  const RING_R = 104;
  const RING_C = 2 * Math.PI * RING_R;
  const RING_ARC = 0.75;

  return (
    <section
      id="seat-simulator"
      ref={sectionRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className="relative py-10 md:py-14 bg-[#0a0d0f] text-[#e8eef0] font-hmi border-t border-white/10 overflow-hidden focus:outline-none"
    >
      {/* 앰비언트 글로우 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 55% at 50% 112%, rgba(240,165,60,.16), transparent 72%), radial-gradient(55% 45% at 92% 2%, rgba(95,214,164,.1), transparent 70%)',
        }}
      />

      <div className="relative max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* ================= 헤더 ================= */}
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-[#f0a53c]/40 bg-[#f0a53c]/10 mb-3">
            <span className="w-[7px] h-[7px] rounded-full bg-[#f0a53c] shadow-[0_0_10px_#f0a53c]" />
            <span className="text-[10.5px] tracking-[.3em] uppercase text-[#ffc276]">
              Cabin HMI · DPSS Seat Simulator
            </span>
          </div>
          <h2 className="font-hmi-cond text-3xl md:text-[40px] font-bold uppercase tracking-[.04em] text-white mb-2">
            {t('Seat Simulator Title')}
          </h2>
          <p className="text-[#8d9c9e] max-w-3xl leading-relaxed text-[13px] md:text-sm">
            {t('Seat Simulator Subtitle')}
          </p>
        </div>

        {/* ================= HMI 콘솔 ================= */}
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0a0d0f] shadow-[0_40px_90px_-50px_rgba(0,0,0,1)]">
          {/* ---- 스테이터스 바 ---- */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 md:px-8 py-2.5 border-b border-white/10 bg-white/[.02]">
            <span className="font-hmi-cond text-[18px] md:text-[20px] font-bold tracking-[.14em] text-white whitespace-nowrap">
              YYO · SEAT CONTROL
            </span>
            <span className="text-[11px] tracking-[.26em] uppercase text-[#7f8f92] truncate">
              Control {modeCode(mode)} ·{' '}
              {MODE_CONFIG[mode].name[currentLang]}
            </span>
            {/* 릴렉스는 모드와 동급이 아니다 — 겹쳐지는 프리셋 레이어로 별도 칩에 표시 */}
            <span
              className={`flex items-center gap-1.5 px-2 py-[3px] rounded-full border text-[10px] tracking-[.18em] uppercase whitespace-nowrap ${relaxTone.chip}`}
            >
              <i
                className={`w-[6px] h-[6px] rounded-full ${relaxTone.dot} ${
                  relax.run ? 'animate-pulse' : ''
                }`}
              />
              Rlx {relaxLabel}
              {relax.phase === 'partial' || relax.run ? ` ${relaxPct.toFixed(0)}%` : ''}
            </span>
            <div className="flex-1 min-w-[8px]" />
            <span className="flex items-center gap-2 text-[12px] tracking-[.12em] text-[#a9b7b9] whitespace-nowrap">
              <i className="w-[7px] h-[7px] rounded-full bg-[#5fd6a4] shadow-[0_0_10px_#5fd6a4]" />
              Ignition ON
            </span>
            <span
              className={`flex items-center gap-2 text-[12px] tracking-[.12em] whitespace-nowrap ${
                movingAxes.length ? 'text-[#ffc276]' : 'text-[#a9b7b9]'
              }`}
            >
              <i
                className={`w-[7px] h-[7px] rounded-full ${
                  movingAxes.length ? 'bg-[#f0a53c] shadow-[0_0_10px_#f0a53c]' : 'bg-[#4f5c5f]'
                }`}
              />
              {movingAxes.length} Axes Active
            </span>
            <span className="hidden md:flex items-center gap-2 text-[12px] tracking-[.12em] text-[#a9b7b9] whitespace-nowrap">
              <i
                className={`w-[7px] h-[7px] rounded-full ${
                  relaxSnapshotRef.current
                    ? 'bg-[#5fd6a4] shadow-[0_0_10px_#5fd6a4]'
                    : 'bg-[#4f5c5f]'
                }`}
              />
              Snapshot {relaxSnapshotRef.current ? 'Saved' : 'Empty'}
            </span>
            <span className="font-hmi-cond text-[22px] font-semibold tracking-[.1em] text-white">
              {clock}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setControlMode(controlMode === 'auto' ? 'manual' : 'auto')}
                className={`h-8 px-3 rounded-[10px] border text-[11px] tracking-[.16em] uppercase transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  controlMode === 'auto'
                    ? 'bg-white/10 text-white border-white/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,.16)]'
                    : 'border-white/[.12] text-[#93a2a4] hover:border-[#f0a53c]/60 hover:text-[#ffc276] cursor-pointer'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Auto Demo</span>
              </button>
              <button
                type="button"
                onClick={resetPose}
                className="h-8 px-3 rounded-[10px] border border-white/[.12] text-[11px] tracking-[.16em] uppercase text-[#93a2a4] hover:border-[#5fd6a4]/60 hover:text-[#8fe6c2] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('Seat Reset Pose')}</span>
              </button>
            </div>
          </div>

          {/* ---- 3열 그리드 ---- */}
          <div className="grid lg:grid-cols-[316px_minmax(0,1fr)_300px] gap-px bg-white/[.07]">
            {/* ====== 좌측: 드라이브 컨트롤 C1~C8 (각 줄에 자기 방향 버튼) ====== */}
            <div className="bg-[#0a0d0f] p-5 flex flex-col min-h-0">
              <p className="text-[11px] tracking-[.32em] uppercase text-[#6f7f82] mb-4">
                Drive Controls{' '}
                <b className="text-[#f0a53c] font-semibold">{modeCode(mode)}</b>
              </p>
              <div className="space-y-2">
                {MODE_ORDER.map((key) => {
                  const conf = MODE_CONFIG[key];
                  const selected = mode === key;
                  /**
                   * 이 컨트롤이 조작하는 축 — 럼버만 두 개(전후 LMB · 상하 LMH) 다.
                   * 4방향 컨트롤은 위치 바도 축마다 나눠서 관리한다.
                   */
                  const axes = modeAxes(key);
                  const dual = axes.length > 1;
                  const dirs = DIR_ORDER.filter((d) => MODE_SPEC_LABELS[key][d] !== null);
                  return (
                    <div
                      key={key}
                      className={`rounded-[12px] border transition-all ${
                        selected
                          ? 'border-[#f0a53c]/50 bg-[linear-gradient(90deg,rgba(240,165,60,.14),rgba(240,255,255,0))]'
                          : 'border-white/[.07] bg-white/[.035] hover:border-white/20'
                      }`}
                    >
                      {/* 줄 헤더를 누르면 그 컨트롤이 현재 조작 대상으로 선택된다 */}
                      <button
                        type="button"
                        onClick={() => selectMode(key)}
                        className="w-full text-left px-3 pt-2 block cursor-pointer"
                      >
                        <div className="flex items-baseline gap-2.5">
                          <span
                            className={`font-hmi-cond text-[16px] font-bold tracking-[.1em] ${
                              selected ? 'text-[#ffc276]' : 'text-[#c9d6d7]'
                            }`}
                          >
                            {modeCode(key)}
                          </span>
                          <span className="flex-1 text-[12.5px] text-[#8d9c9e] truncate">
                            {conf.name[currentLang]}
                          </span>
                          {/* 1축 컨트롤만 값을 헤더에 싣는다 — 2축은 아래 축별 바에 각각 붙인다 */}
                          {!dual && (
                            <span className="font-hmi-cond text-[17px] font-bold text-[#e9f1f2] whitespace-nowrap">
                              {fmtAxis(axes[0], pos[axes[0]])}
                            </span>
                          )}
                        </div>
                        {/*
                          축별 위치 바 — 럼버(4방향)는 전후(LMB)와 상하(LMH) 를 한 바에 섞지 않는다.
                          각 축이 자기 라벨·자기 수치·자기 바를 갖고, 지금 조작 중인 축만 앰버로 선다.
                        */}
                        <div className="flex gap-2 mt-1.5">
                          {axes.map((k) => {
                            const axisConf = AXIS_CONFIG[k];
                            const ratio = clamp(
                              ((pos[k] - axisConf.min) / (axisConf.max - axisConf.min)) * 100,
                              0,
                              100,
                            );
                            const driven = selected && focusAxis === k;
                            return (
                              <div key={k} className="flex-1 min-w-0">
                                {dual && (
                                  <div className="flex items-baseline justify-between gap-1 leading-none mb-1">
                                    <span
                                      className={`text-[8.5px] tracking-[.18em] uppercase ${
                                        driven ? 'text-[#c9a273]' : 'text-[#5d6c6f]'
                                      }`}
                                    >
                                      {axisConf.code}
                                    </span>
                                    <span
                                      className={`font-hmi-cond text-[12px] font-bold leading-none whitespace-nowrap ${
                                        driven ? 'text-[#ffd9a3]' : 'text-[#93a2a4]'
                                      }`}
                                    >
                                      {pos[k].toFixed(axisConf.unit === '°' ? 1 : 0)}
                                      <small className="text-[8px] text-[#6f7f82] ml-[1px]">
                                        {axisConf.unit}
                                      </small>
                                    </span>
                                  </div>
                                )}
                                <div className="h-[3px] rounded-full bg-white/[.07] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[linear-gradient(90deg,#f0a53c,#ffd9a3)]"
                                    style={{ width: `${ratio}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </button>
                      {/* 이 컨트롤이 가진 방향만 버튼이 된다 — 누르는 동안 연속 조작 */}
                      <div
                        className={`grid gap-1 px-2 pt-1.5 pb-2 ${
                          dirs.length === 4 ? 'grid-cols-4' : 'grid-cols-2'
                        }`}
                      >
                        {dirs.map((d) => controlButton(key, d))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 홀드 = 연속 조작이라는 동작 규칙 (예전 로커 헤더가 하던 말) */}
              <p className="mt-3 text-[9px] leading-relaxed tracking-[.14em] uppercase text-[#4f5c5f]">
                {currentLang === 'ko'
                  ? '버튼을 누르는 동안 연속 조작 · 방향키는 선택된 컨트롤'
                  : 'HOLD A BUTTON TO RUN · ARROW KEYS DRIVE THE SELECTED CONTROL'}
              </p>
            </div>

            {/* ================= 중앙: 포즈 스테이지 ================= */}
            <div
              className="relative flex flex-col min-h-[420px]"
              style={{ background: 'radial-gradient(72% 62% at 50% 58%, #141b1e 0%, #0a0d0f 78%)' }}
            >
              <div className="absolute top-3.5 left-4 text-[10.5px] tracking-[.24em] uppercase text-[#6f7f82]">
                {previewPose ? `Slot ${previewCode} Preview` : 'Relax Pose'} ·{' '}
                <b className="text-[#f0a53c] font-semibold">Current</b> vs{' '}
                <span className="text-[#5fd6a4]">
                  {previewPose ? 'Stored Pose' : 'Target Pose'}
                </span>
              </div>
              <div className="absolute top-3.5 right-4 flex gap-4 text-[10.5px] tracking-[.2em] uppercase text-[#8d9c9e]">
                <span className="flex items-center gap-2">
                  <i className="w-4 border-t-2 border-[#f0a53c]" />
                  Current
                </span>
                <span className="flex items-center gap-2">
                  <i className="w-4 border-t-2 border-dashed border-[#5fd6a4]" />
                  {previewPose ? `Slot ${previewCode}` : 'Relax Target'}
                </span>
              </div>

              {/* ---- Now Controlling HUD — 시트 도해 좌상단의 빈 자리에 얹는 오버레이 ----
                    컬럼을 따로 소모하지 않으므로 화면 세로가 늘지 않는다.
                    앰버 테두리 타일 = 지금 조작하는 축 (조작 축 코드도 병기) */}
              <div className="absolute top-10 left-4 w-[214px] rounded-[14px] border border-[#f0a53c]/25 bg-[#0a0d0f]/85 backdrop-blur-[2px] px-3 py-2.5 shadow-[0_18px_40px_-24px_rgba(0,0,0,1)]">
                <p className="text-[9px] tracking-[.26em] uppercase text-[#6f7f82] mb-1">
                  Now Controlling
                </p>
                <p className="text-[13.5px] font-bold text-[#ffd9a3] leading-tight truncate">
                  {MODE_CONFIG[mode].name[currentLang]}
                </p>
                <p className="text-[9px] tracking-[.14em] uppercase text-[#a3895f] truncate">
                  {MODE_CONFIG[mode].subName}
                </p>
                <p className="text-[9px] tracking-[.1em] text-[#c9a273] mt-1 truncate">
                  {currentLang === 'ko' ? '조작' : 'DRIVES'} ·{' '}
                  {drivenAxes.map((k) => AXIS_CONFIG[k].code).join(' · ')}
                </p>

                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {(['recline', 'legrest', 'cushion', 'tilt'] as AxisKey[]).map((k) => (
                    <div
                      key={k}
                      className={`px-2 py-1 rounded-[9px] border transition-colors ${
                        drivenAxes.includes(k)
                          ? 'border-[#f0a53c]/45 bg-[#f0a53c]/[.08]'
                          : 'border-white/[.07] bg-white/[.03]'
                      }`}
                    >
                      <p className="text-[8.5px] tracking-[.18em] uppercase text-[#6f7f82]">
                        {AXIS_CONFIG[k].code}
                      </p>
                      <p className="font-hmi-cond text-[15px] font-bold text-[#e9f1f2] leading-tight">
                        {pos[k].toFixed(AXIS_CONFIG[k].unit === '°' ? 1 : 0)}
                        <small className="text-[9px] text-[#8d9c9e] ml-0.5">
                          {AXIS_CONFIG[k].unit}
                        </small>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-0 px-3 pt-9 pb-1">
                <SeatDiagram
                  positions={pos}
                  targets={diagramTargets}
                  activeAxis={activeAxis}
                  lang={currentLang}
                  ghost={showGhost}
                />
              </div>

              {/* 포커스 축 트래블 바 + 상태 배너 — 한 줄로 합쳐 세로 한 칸을 아낀다 */}
              <div className="px-6 pb-3">
                <div className="flex items-center gap-3 mb-1.5">
                  <span
                    className={`flex items-center gap-2 min-w-0 px-2.5 py-[3px] rounded-full border text-[10.5px] tracking-[.14em] uppercase ${
                      bannerTone === 'run'
                        ? 'border-[#f0a53c]/45 bg-[#f0a53c]/10 text-[#ffc276]'
                        : bannerTone === 'hold'
                          ? 'border-[#5fd6a4]/45 bg-[#5fd6a4]/10 text-[#8fe6c2]'
                          : bannerTone === 'partial'
                            ? 'border-[#f0a53c]/25 bg-[#f0a53c]/[.06] text-[#c9a273]'
                            : 'border-white/10 bg-white/[.03] text-[#7f8f92]'
                    }`}
                  >
                    <i
                      className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${
                        bannerTone === 'run'
                          ? 'bg-[#f0a53c] shadow-[0_0_10px_#f0a53c]'
                          : bannerTone === 'hold'
                            ? 'bg-[#5fd6a4] shadow-[0_0_10px_#5fd6a4]'
                            : bannerTone === 'partial'
                              ? 'bg-[#c9a273]'
                              : 'bg-[#4f5c5f]'
                      }`}
                    />
                    <span className="truncate">{bannerText}</span>
                  </span>
                  <span className="flex-1" />
                  <span className="font-hmi-cond text-[11px] tracking-[.18em] uppercase text-[#6f7f82] whitespace-nowrap">
                    {focusConf.code} · {focusConf.name[currentLang]}
                  </span>
                  <span className="font-hmi-cond text-[15px] font-bold text-[#e9f1f2] whitespace-nowrap">
                    {fmtAxis(focusAxis, pos[focusAxis])}
                    <span className="text-[#5fd6a4] text-[12px] ml-2">
                      TGT {fmtAxis(focusAxis, tgt[focusAxis])}
                    </span>
                  </span>
                </div>
                <div className="relative h-[10px] rounded-full bg-white/[.05] overflow-hidden">
                  <div
                    className="absolute inset-y-0 bg-white/[.06]"
                    style={{ left: `${softLeft}%`, width: `${Math.max(softRight - softLeft, 0)}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#f0a53c,#ffd9a3)]"
                    style={{ width: `${clamp(pct, 0, 100)}%` }}
                  />
                  {relaxAxesRef.current.has(focusAxis) && (
                    <div
                      className="absolute inset-y-0 w-[2px] bg-[#5fd6a4] shadow-[0_0_8px_#5fd6a4]"
                      style={{ left: markerLeft(tgtPct) }}
                    />
                  )}
                </div>
                {/*
                  둘째 축 보조 바 — 4방향 컨트롤(럼버) 은 조작 축이 아닌 쪽의 위치도 계속 보여준다.
                  전후(LMB) 를 조작하는 동안 상하(LMH) 가 어디 있는지 잃지 않는 것이 목적이다.
                */}
                {secondary && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[8.5px] tracking-[.18em] uppercase text-[#5d6c6f] whitespace-nowrap">
                      {AXIS_CONFIG[secondary.axis].code}
                    </span>
                    <div className="relative flex-1 h-[5px] rounded-full bg-white/[.05] overflow-hidden">
                      <i
                        className="absolute inset-y-0 block bg-white/[.06]"
                        style={{
                          left: `${secondary.softLeft}%`,
                          width: `${Math.max(secondary.softRight - secondary.softLeft, 0)}%`,
                        }}
                      />
                      <i
                        className="absolute inset-y-0 left-0 block rounded-full bg-[linear-gradient(90deg,rgba(240,165,60,.55),rgba(255,217,163,.55))]"
                        style={{ width: `${clamp(secondary.pct, 0, 100)}%` }}
                      />
                      {relaxAxesRef.current.has(secondary.axis) && (
                        <i
                          className="absolute inset-y-0 w-[2px] bg-[#5fd6a4] shadow-[0_0_8px_#5fd6a4]"
                          style={{ left: markerLeft(secondary.tgtPct) }}
                        />
                      )}
                    </div>
                    <span className="font-hmi-cond text-[11.5px] font-bold text-[#93a2a4] whitespace-nowrap">
                      {fmtAxis(secondary.axis, pos[secondary.axis])}
                    </span>
                  </div>
                )}
              </div>

              {/* 축별 코리오그래피 */}
              <div className="mx-4 md:mx-6 mb-3 md:mb-4 px-4 py-2.5 rounded-[14px] border border-white/[.09] bg-white/[.045]">
                {choreo.map((row) => (
                  <div key={row.key} className="flex items-center gap-3 mb-1 last:mb-0">
                    <span className="w-[52px] text-[11px] tracking-[.18em] text-[#7f8f92]">
                      {row.code}
                    </span>
                    <div className="flex-1 h-[11px] rounded-full bg-white/[.05] relative overflow-hidden">
                      <i
                        className={`absolute inset-y-0 block rounded-full ${
                          row.state === 'done'
                            ? 'bg-[linear-gradient(90deg,#3fae86,#5fd6a4)]'
                            : row.state === 'run'
                              ? 'bg-[linear-gradient(90deg,#f0a53c,#ffd9a3)]'
                              : 'bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.16)_0_6px,transparent_6px_12px)]'
                        }`}
                        style={{ left: `${row.left}%`, width: `${clamp(row.width, 0, 100)}%` }}
                      />
                    </div>
                    <span className="w-[46px] text-right font-hmi-cond text-[13px] text-[#8d9c9e]">
                      {row.state === 'idle'
                        ? '—'
                        : `${(row.state === 'run' ? row.remaining : row.seconds).toFixed(1)}s`}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-[10px] tracking-[.14em] text-[#4f5c5f] ml-[64px] mt-1">
                  <span>0 s</span>
                  <span>2 s</span>
                  <span>4 s</span>
                  <span>6 s</span>
                  <span>8 s</span>
                  <span>10 s</span>
                </div>
              </div>
            </div>

            {/* ============ 우측: 진행률 · 포즈 슬롯 · 릴렉스 프리셋 · 로그 ============ */}
            <div className="bg-[#0a0d0f] p-5 flex flex-col min-h-0">
              <p className="text-[11px] tracking-[.32em] uppercase text-[#6f7f82] mb-1">
                Preset Progress
              </p>
              <div className="flex justify-center">
                <svg width="156" height="156" viewBox="0 0 252 252">
                  <defs>
                    <linearGradient id="hmiArc" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#f0a53c" />
                      <stop offset="1" stopColor="#ffd9a3" />
                    </linearGradient>
                    <linearGradient id="hmiArcMint" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#3fae86" />
                      <stop offset="1" stopColor="#8fe6c2" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="126"
                    cy="126"
                    r="104"
                    fill="none"
                    stroke="rgba(255,255,255,.08)"
                    strokeWidth="1"
                  />
                  <g stroke="rgba(255,255,255,.22)" strokeWidth="1.4">
                    <line x1="126" y1="26" x2="126" y2="40" />
                    <line x1="176" y1="41" x2="169" y2="53" />
                    <line x1="211" y1="76" x2="199" y2="83" />
                    <line x1="226" y1="126" x2="212" y2="126" />
                    <line x1="76" y1="41" x2="83" y2="53" />
                    <line x1="41" y1="76" x2="53" y2="83" />
                    <line x1="26" y1="126" x2="40" y2="126" />
                  </g>
                  <circle
                    cx="126"
                    cy="126"
                    r={RING_R}
                    fill="none"
                    stroke="rgba(255,255,255,.09)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${RING_C * RING_ARC} ${RING_C}`}
                    transform="rotate(135 126 126)"
                  />
                  <circle
                    cx="126"
                    cy="126"
                    r={RING_R}
                    fill="none"
                    stroke={
                      relax.phase === 'on' && relax.run === null
                        ? 'url(#hmiArcMint)'
                        : 'url(#hmiArc)'
                    }
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${RING_C * RING_ARC * (relaxPct / 100)} ${RING_C}`}
                    transform="rotate(135 126 126)"
                  />
                  <circle
                    cx="126"
                    cy="126"
                    r="86"
                    fill="none"
                    stroke="rgba(95,214,164,.35)"
                    strokeWidth="1"
                    strokeDasharray="2 6"
                  />
                  <text
                    x="126"
                    y="124"
                    textAnchor="middle"
                    fontFamily="'Barlow Condensed', sans-serif"
                    fontSize="62"
                    fontWeight="700"
                    fill="#fff"
                  >
                    {relaxPct.toFixed(0)}%
                  </text>
                  <text
                    x="126"
                    y="150"
                    textAnchor="middle"
                    fontFamily="'Rajdhani', sans-serif"
                    fontSize="12"
                    letterSpacing="4"
                    fill="#8d9c9e"
                  >
                    RLX APPLIED
                  </text>
                  <text
                    x="126"
                    y="176"
                    textAnchor="middle"
                    fontFamily="'Rajdhani', sans-serif"
                    fontSize="12"
                    letterSpacing="2.4"
                    fill={
                      relax.phase === 'on' && relax.run === null
                        ? '#5fd6a4'
                        : relax.phase === 'partial'
                          ? '#c9a273'
                          : '#6f7f82'
                    }
                  >
                    {relax.run === 'on'
                      ? `APPLYING · ${etaMax.toFixed(1)}s`
                      : relax.run === 'off'
                        ? `RESTORING · ${etaMax.toFixed(1)}s`
                        : relax.phase === 'on'
                          ? 'SEQUENCE COMPLETE'
                          : relax.phase === 'partial'
                            ? 'PARTIAL · HOLDING'
                            : 'STANDBY'}
                  </text>
                </svg>
              </div>

              {/* ---- 포즈 슬롯 — 탭 = 호출 / 길게 누름 = 저장 / 호버 = 고스트 미리보기 ---- */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] tracking-[.32em] uppercase text-[#6f7f82] flex items-center gap-1.5">
                    <Archive className="w-3.5 h-3.5" />
                    Pose Slots
                  </p>
                  <span className="text-[9px] tracking-[.16em] uppercase text-[#4f5c5f]">
                    {currentLang === 'ko' ? '탭=호출 · 길게=저장' : 'TAP · HOLD'}
                  </span>
                </div>

                <div className="space-y-2">
                  {Array.from({ length: POSE_SLOT_COUNT }, (_, i) => slotCard(i))}
                </div>

                <p className="text-[10.5px] text-[#8d9c9e] leading-relaxed mt-2">
                  {currentLang === 'ko'
                    ? '호버 = 시트에 점선 미리보기'
                    : 'Hover to ghost the pose'}
                </p>
              </div>

              {/* ---- 릴렉스 프리셋 레이어 — 모드 트랙과 분리된 독립 레이어 (어떤 모드에서도 조작 가능) ---- */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] tracking-[.32em] uppercase text-[#6f7f82]">
                    Relax Preset
                  </p>
                  <span className={`text-[9.5px] tracking-[.2em] uppercase ${relaxTone.text}`}>
                    {relaxLabel}
                    {relax.phase === 'partial' || relax.run ? ` ${relaxPct.toFixed(0)}%` : ''}
                  </span>
                </div>

                {/* 3상태 인디케이터 — OFF / 부분 적용 / ON (이동 중에는 목적지 칸이 점멸) */}
                <div className="grid grid-cols-3 gap-1 mb-2">
                  {(['off', 'partial', 'on'] as RelaxPhase[]).map((phase) => {
                    const settled = relax.phase === phase && relax.run === null;
                    const passing =
                      relax.run !== null &&
                      ((phase === 'on' && relax.run === 'on') ||
                        (phase === 'off' && relax.run === 'off'));
                    return (
                      <span
                        key={phase}
                        className={`h-[22px] rounded-[7px] border flex items-center justify-center text-[9px] tracking-[.12em] uppercase transition-all ${
                          settled
                            ? phase === 'on'
                              ? 'border-[#5fd6a4]/60 bg-[#5fd6a4]/15 text-[#8fe6c2]'
                              : phase === 'partial'
                                ? 'border-[#f0a53c]/45 bg-[#f0a53c]/10 text-[#c9a273]'
                                : 'border-white/25 bg-white/10 text-white'
                            : passing
                              ? 'border-[#f0a53c]/60 text-[#ffc276] animate-pulse'
                              : 'border-white/[.07] text-[#4f5c5f]'
                        }`}
                      >
                        {RELAX_STATE_LABEL[phase][currentLang]}
                      </span>
                    );
                  })}
                </div>

                {/* 적용률 게이지 */}
                <div className="h-[5px] rounded-full bg-white/[.07] overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full ${
                      relax.phase === 'on' && relax.run === null
                        ? 'bg-[linear-gradient(90deg,#3fae86,#5fd6a4)]'
                        : 'bg-[linear-gradient(90deg,#f0a53c,#ffd9a3)]'
                    }`}
                    style={{ width: `${relaxPct}%` }}
                  />
                </div>
                <p className="text-[9.5px] tracking-[.16em] uppercase text-[#5d6c6f] mb-3">
                  {relax.run
                    ? `ETA ${etaMax.toFixed(1)} s`
                    : relax.phase === 'partial'
                      ? 'INTERRUPTED · NOT ON / NOT OFF'
                      : `${relaxPct.toFixed(0)}% APPLIED · ${
                          relaxSnapshotRef.current ? 'SNAPSHOT SAVED' : 'NO SNAPSHOT'
                        }`}
                </p>

                <div className="flex gap-2">
                  {relaxButton(true)}
                  {relaxButton(false)}
                </div>
                <p className="text-[10.5px] text-[#8d9c9e] leading-relaxed mt-2.5">{relaxHint}</p>
              </div>

              <p className="text-[11px] tracking-[.32em] uppercase text-[#6f7f82] mt-4 pt-4 border-t border-white/10 mb-2">
                Sequence Log
              </p>
              <div className="text-[12px] text-[#9fb0b2] leading-[1.75]">
                {log.map((entry, i) => (
                  <p
                    key={`${entry.t}-${i}`}
                    className={
                      entry.tone === 'hot'
                        ? 'text-[#ffc276]'
                        : entry.tone === 'ok'
                          ? 'text-[#8fe6c2]'
                          : ''
                    }
                  >
                    <span className="text-[#5d6c6f]">{entry.t}</span> {entry.msg}
                  </p>
                ))}
              </div>

              <div className="mt-auto flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={stopMotion}
                  className="flex-1 h-9 rounded-[10px] border border-white/[.12] bg-white/10 text-white text-[11.5px] tracking-[.16em] uppercase hover:border-[#f0a53c]/60 hover:text-[#ffc276] transition-all cursor-pointer"
                >
                  Abort
                </button>
                <button
                  type="button"
                  onClick={() => handleRelaxButton(false)}
                  className="flex-1 h-9 rounded-[10px] border border-white/[.12] text-[#93a2a4] text-[11.5px] tracking-[.16em] uppercase hover:border-[#5fd6a4]/60 hover:text-[#8fe6c2] transition-all cursor-pointer"
                >
                  Restore
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 컨트롤 힌트 / 면책 ================= */}
        <p className="mt-5 text-[11px] text-[#5d6c6f] leading-relaxed">{t('Seat Control Hint')}</p>
        <div className="mt-3 flex items-center justify-center gap-2 text-[#5d6c6f] text-[11px] text-center">
          <Armchair className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t('Seat Disclaimer')}</span>
        </div>
      </div>
    </section>
  );
}

