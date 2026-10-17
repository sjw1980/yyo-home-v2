import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Armchair, RotateCcw, Zap } from 'lucide-react';
import SeatDiagram from './SeatDiagram';
import {
  AXIS_CONFIG,
  AXIS_ORDER,
  INITIAL_POSITIONS,
  MODE_CONFIG,
  MODE_ORDER,
  MODE_SPEC_LABELS,
  RELAX_SEQUENCE_AXES,
  RELAX_STATE_LABEL,
  axisForDirection,
  clamp,
  lrSign,
  modeCode,
  primaryAxis,
  relaxPreset,
  relaxStateKey,
  rotateMode,
  type AxisKey,
  type Direction,
  type ModeKey,
  type RelaxPhase,
  type RelaxRun,
  type RelaxStatus,
} from '../seatConfig';
import { translations } from '../data';

/** 시뮬레이션 틱 주기 (ms) — 데스크톱 앱의 30ms 시뮬레이션 루프에 대응 */
const TICK_MS = 30;

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
   * 릴렉스 On/Off 프리셋으로 "이동 중"인 축集合
   * — 타깃(노란) 마커는 이 축들에 대해서만 표시한다 (수동/AUTO 조작 중에는 목표=현재라 무의미)
   */
  const relaxAxesRef = useRef<Set<AxisKey>>(new Set());
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

    const prev = relaxRef.current;
    const hadSnapshot = relaxSnapshotRef.current !== null;
    const result = relaxPreset(posRef.current, relaxSnapshotRef.current, on);
    Object.assign(tgtRef.current, result.targets);
    relaxSnapshotRef.current = result.snapshot;

    // 이동이 실제로 발생하는 축만 타깃 마커 대상으로 등록 (Off 시 스냅샷 복귀 구간 포함)
    const moving = new Set<AxisKey>();
    RELAX_SEQUENCE_AXES.forEach((k) => {
      const target = result.targets[k];
      if (target !== undefined && Math.abs(target - posRef.current[k]) > 0.05) moving.add(k);
    });
    relaxAxesRef.current = moving;

    if (on) {
      pushLog(
        prev.phase === 'partial'
          ? `RELAX RESUME · ${Math.round(clamp(posRef.current.relaxation_return, 0, 100))}% → 100%`
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
    RELAX_SEQUENCE_AXES.forEach((k) => {
      tgtRef.current[k] = posRef.current[k];
    });
    relaxAxesRef.current = new Set();
    const pct = Math.round(clamp(posRef.current.relaxation_return, 0, 100));
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
    modeRef.current = MODE_ORDER[0];
    setMode(MODE_ORDER[0]);
    relaxSnapshotRef.current = null;
    relaxAxesRef.current = new Set();
    setRelax('off', null);
    pushLog('POSE RESET · INITIAL VALUES', 'ok');
    posRef.current = { ...INITIAL_POSITIONS };
    tgtRef.current = { ...INITIAL_POSITIONS };
    setFrame((f) => f + 1);
  };

  const handlePress = (dir: Direction) => {
    // 수동 조작 시작 시 AUTO DEMO 정지
    if (controlModeRef.current === 'auto') setControlMode('manual');
    // 수동 오버라이드 = 릴렉스 시퀀스 중단 (100% 이전이면 부분 적용 상태로 유지)
    interruptRelaxSequence('MANUAL OVERRIDE');

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
      setRelax(settled, null);
      pushLog(
        settled === 'on'
          ? 'RELAX POSE APPLIED · 100% · 6 AXES HOLDING'
          : 'RELAX RELEASED · SNAPSHOT RESTORED',
        settled === 'on' ? 'ok' : 'dim',
      );
    }

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
  const span = focusConf.max - focusConf.min;
  const pct = ((pos[focusAxis] - focusConf.min) / span) * 100;
  const tgtPct = ((tgt[focusAxis] - focusConf.min) / span) * 100;
  const softLeft = ((focusConf.softMin - focusConf.min) / span) * 100;
  const softRight = ((focusConf.softMax - focusConf.min) / span) * 100;

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
   * 4방향 로커 키 (Cabin HMI 스타일)
   * — 현재 모드에 정의된 방향만 활성 키로 렌더링하고, 나머지는 자리표시자로 채운다.
   */
  const rockerKey = (dir: Direction, glyph: string) => {
    const label = MODE_SPEC_LABELS[mode][dir];
    if (!label) {
      return <span key={dir} className="rounded-[10px] border border-white/[.05] bg-white/[.02]" />;
    }
    const active = pressed === dir;
    return (
      <button
        key={dir}
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          handlePress(dir);
        }}
        onPointerUp={() => handleRelease()}
        onPointerLeave={() => {
          if (active) handleRelease();
        }}
        title={label[currentLang]}
        className={`h-11 rounded-[10px] border flex flex-col items-center justify-center gap-[2px] transition-all select-none
          ${
            active
              ? 'bg-[#f0a53c] text-[#0a0d0f] border-[#f0a53c] shadow-[0_0_18px_rgba(240,165,60,.4)]'
              : 'border-white/[.12] text-[#93a2a4] hover:border-[#f0a53c]/60 hover:text-[#ffc276] cursor-pointer'
          }`}
      >
        <span className="text-[13px] leading-none">{glyph}</span>
        <span className="text-[7.5px] leading-none px-1 truncate max-w-full uppercase tracking-[.1em]">
          {label[currentLang]}
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
    const from = relaxSnapshotRef.current?.[k] ?? INITIAL_POSITIONS[k];
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

  const etaMax = Math.max(
    0,
    ...[...CHOREO_AXES, 'relaxation_return' as AxisKey].map((k) => etaOf(k)),
  );
  /** 배너 톤 — 이동 중(앰버) / 릴렉스 포즈 유지(민트) / 부분 적용(딤앰버) / 유휴(그레이) */
  const running = ghostPose || (activeAxis !== null && etaOf(activeAxis) > 0);
  const bannerTone: 'run' | 'hold' | 'partial' | 'idle' = running
    ? 'run'
    : relax.phase === 'on'
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
      : relax.phase === 'on'
        ? 'RELAX POSE APPLIED · 100% · 6 AXES HOLDING'
        : relax.phase === 'partial'
          ? `RELAX PARTIAL · ${relaxPct.toFixed(0)}% APPLIED · ON = RESUME 100% / OFF = RESTORE`
          : 'SYSTEM IDLE · SELECT A MODE AND HOLD A DIRECTION KEY';

  /** 릴렉스 프리셋 패널 상태 안내문 */
  const relaxHint =
    relax.run === 'on'
      ? currentLang === 'ko'
        ? '릴렉션 포즈 적용 중 — 다른 모드를 고르거나 로커를 조작하면 중단되어 부분 적용이 됩니다.'
        : 'Applying relax pose — picking another mode or using the rocker interrupts it into PARTIAL.'
      : relax.run === 'off'
        ? currentLang === 'ko'
          ? '스냅샷 복귀 중…'
          : 'Restoring snapshot…'
        : relax.phase === 'on'
          ? currentLang === 'ko'
            ? '릴렉션 포즈 유지 중. Off 를 누르면 스냅샷으로 6축이 동시에 복귀합니다.'
            : 'Relax pose holding. Off restores the 6-axis snapshot together.'
          : relax.phase === 'partial'
            ? currentLang === 'ko'
              ? '시퀀스 중단 — ON 은 100% 까지 이어서 적용하고, OFF 는 스냅샷으로 복귀합니다.'
              : 'Sequence interrupted — ON resumes to 100%, OFF restores the snapshot.'
            : currentLang === 'ko'
              ? 'ON 을 누르면 현재 6축이 스냅샷으로 저장되고 릴렉션 포즈로 이동합니다.'
              : 'ON saves the current 6 axes as a snapshot, then drives the relax pose.';

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
      className="relative py-20 bg-[#0a0d0f] text-[#e8eef0] font-hmi border-t border-white/10 overflow-hidden focus:outline-none"
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
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#f0a53c]/40 bg-[#f0a53c]/10 mb-5">
            <span className="w-[7px] h-[7px] rounded-full bg-[#f0a53c] shadow-[0_0_10px_#f0a53c]" />
            <span className="text-[11px] tracking-[.3em] uppercase text-[#ffc276]">
              Cabin HMI · DPSS Seat Simulator
            </span>
          </div>
          <h2 className="font-hmi-cond text-4xl md:text-5xl font-bold uppercase tracking-[.04em] text-white mb-3">
            {t('Seat Simulator Title')}
          </h2>
          <p className="text-[#8d9c9e] max-w-3xl leading-relaxed text-sm md:text-base">
            {t('Seat Simulator Subtitle')}
          </p>
        </div>

        {/* ================= HMI 콘솔 ================= */}
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0a0d0f] shadow-[0_40px_90px_-50px_rgba(0,0,0,1)]">
          {/* ---- 스테이터스 바 ---- */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 md:px-8 py-3 border-b border-white/10 bg-white/[.02]">
            <span className="font-hmi-cond text-[20px] md:text-[22px] font-bold tracking-[.14em] text-white whitespace-nowrap">
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
            {/* ============ 좌측: 릴렉스 프리셋(상단) + 드라이브 모드 시퀀스 ============ */}
            <div className="bg-[#0a0d0f] p-5 flex flex-col min-h-0">
              {/* ---- 릴렉스 프리셋 레이어 — 모드 트랙보다 상위에 둔다 (어떤 모드에서도 항상 노출) ---- */}
              <div className="pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-3">
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
                <p className="text-[11.5px] text-[#8d9c9e] leading-relaxed mt-3">{relaxHint}</p>
              </div>

              <p className="text-[11px] tracking-[.32em] uppercase text-[#6f7f82] mb-4">
                Drive Modes{' '}
                <b className="text-[#f0a53c] font-semibold">{modeCode(mode)}</b>
              </p>
              <div className="space-y-2">
                {MODE_ORDER.map((key) => {
                  const conf = MODE_CONFIG[key];
                  const selected = mode === key;
                  const axis = primaryAxis(key);
                  const confAxis = AXIS_CONFIG[axis];
                  const ratio = clamp(
                    ((pos[axis] - confAxis.min) / (confAxis.max - confAxis.min)) * 100,
                    0,
                    100,
                  );
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectMode(key)}
                      className={`w-full text-left px-3 py-2.5 rounded-[12px] border transition-all cursor-pointer ${
                        selected
                          ? 'border-[#f0a53c]/50 bg-[linear-gradient(90deg,rgba(240,165,60,.14),rgba(240,255,255,0))]'
                          : 'border-white/[.07] bg-white/[.035] hover:border-white/20'
                      }`}
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
                        <span className="font-hmi-cond text-[17px] font-bold text-[#e9f1f2] whitespace-nowrap">
                          {fmtAxis(axis, pos[axis])}
                        </span>
                      </div>
                      <div className="h-[4px] rounded-full bg-white/[.07] mt-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#f0a53c,#ffd9a3)]"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ================= 중앙: 포즈 스테이지 ================= */}
            <div
              className="relative flex flex-col min-h-[520px]"
              style={{ background: 'radial-gradient(72% 62% at 50% 58%, #141b1e 0%, #0a0d0f 78%)' }}
            >
              <div className="absolute top-4 left-6 text-[11px] tracking-[.28em] uppercase text-[#6f7f82]">
                Relax Pose · <b className="text-[#f0a53c] font-semibold">Current</b> vs{' '}
                <span className="text-[#5fd6a4]">Target Pose</span>
              </div>
              <div className="absolute top-4 right-6 flex gap-4 text-[11px] tracking-[.2em] uppercase text-[#8d9c9e]">
                <span className="flex items-center gap-2">
                  <i className="w-4 border-t-2 border-[#f0a53c]" />
                  Current
                </span>
                <span className="flex items-center gap-2">
                  <i className="w-4 border-t-2 border-dashed border-[#5fd6a4]" />
                  Relax Target
                </span>
              </div>

              <div className="flex-1 min-h-0 px-3 pt-12 pb-1">
                <SeatDiagram
                  positions={pos}
                  targets={tgt}
                  activeAxis={activeAxis}
                  lang={currentLang}
                  ghost={ghostPose}
                />
              </div>

              {/* 포커스 축 트래블 바 */}
              <div className="px-6 pb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-hmi-cond text-[12px] tracking-[.18em] uppercase text-[#6f7f82]">
                    {focusConf.code} · {focusConf.name[currentLang]}
                  </span>
                  <span className="font-hmi-cond text-[15px] font-bold text-[#e9f1f2]">
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
              </div>

              {/* 상태 배너 */}
              <div className="flex justify-center px-3 pb-3">
                <div
                  className={`flex items-center gap-3 px-5 py-2 rounded-full border text-[12px] tracking-[.18em] uppercase text-center ${
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
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      bannerTone === 'run'
                        ? 'bg-[#f0a53c] shadow-[0_0_12px_#f0a53c]'
                        : bannerTone === 'hold'
                          ? 'bg-[#5fd6a4] shadow-[0_0_12px_#5fd6a4]'
                          : bannerTone === 'partial'
                            ? 'bg-[#c9a273]'
                            : 'bg-[#4f5c5f]'
                    }`}
                  />
                  {bannerText}
                </div>
              </div>

              {/* 축별 코리오그래피 */}
              <div className="mx-4 md:mx-6 mb-4 md:mb-5 px-4 py-3 rounded-[14px] border border-white/[.09] bg-white/[.045]">
                {choreo.map((row) => (
                  <div key={row.key} className="flex items-center gap-3 mb-1.5 last:mb-0">
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
                <div className="flex justify-between text-[10px] tracking-[.14em] text-[#4f5c5f] ml-[64px] mt-1.5">
                  <span>0 s</span>
                  <span>2 s</span>
                  <span>4 s</span>
                  <span>6 s</span>
                  <span>8 s</span>
                  <span>10 s</span>
                </div>
              </div>
            </div>

            {/* ================= 우측: 진행률 · 텔레메트리 · 로그 ================= */}
            <div className="bg-[#0a0d0f] p-5 flex flex-col min-h-0">
              <p className="text-[11px] tracking-[.32em] uppercase text-[#6f7f82] mb-1">
                Preset Progress
              </p>
              <div className="flex justify-center">
                <svg width="196" height="196" viewBox="0 0 252 252">
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

              <div className="px-3.5 py-3 rounded-[12px] border border-[#f0a53c]/40 bg-[#f0a53c]/10">
                <p className="text-[14px] font-bold text-[#ffd9a3]">
                  {MODE_CONFIG[mode].name[currentLang]}
                </p>
                <p className="text-[11px] tracking-[.16em] uppercase text-[#a3895f] mt-0.5">
                  {MODE_CONFIG[mode].subName}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                {(['recline', 'legrest', 'cushion', 'tilt'] as AxisKey[]).map((k) => (
                  <div
                    key={k}
                    className="px-3 py-2 rounded-[11px] border border-white/[.08] bg-white/[.04]"
                  >
                    <p className="text-[10px] tracking-[.2em] uppercase text-[#6f7f82]">
                      {AXIS_CONFIG[k].name[currentLang]}
                    </p>
                    <p className="font-hmi-cond text-[22px] font-bold text-[#e9f1f2] leading-tight">
                      {pos[k].toFixed(AXIS_CONFIG[k].unit === '°' ? 1 : 0)}
                      <small className="text-[12px] text-[#8d9c9e] ml-0.5">
                        {AXIS_CONFIG[k].unit}
                      </small>
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-[11px] tracking-[.32em] uppercase text-[#6f7f82] mt-5 mb-2">
                Direction Rocker
              </p>
              {/* 로커는 8개 드라이브 모드 전용 — 릴렉스는 좌측 프리셋 레이어에서 조작한다 */}
              <div className="grid grid-cols-3 gap-2">
                <span />
                {rockerKey('up', '▲')}
                <span />
                {rockerKey('left', '◀')}
                <span className="flex items-center justify-center rounded-[10px] border border-white/[.06] text-[9px] tracking-[.18em] uppercase text-[#4f5c5f]">
                  HOLD
                </span>
                {rockerKey('right', '▶')}
                <span />
                {rockerKey('down', '▼')}
                <span />
              </div>

              <p className="text-[11px] tracking-[.32em] uppercase text-[#6f7f82] mt-5 mb-2">
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

