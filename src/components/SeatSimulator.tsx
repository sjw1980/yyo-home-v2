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
  RELAX_ON_AXES,
  axisForDirection,
  clamp,
  lrSign,
  primaryAxis,
  relaxPreset,
  rotateMode,
  type AxisKey,
  type Direction,
  type ModeKey,
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
type DemoPhase = 'idle' | 'mode_transition' | 'value_tuning' | 'up_delay';

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
  const [mode, setMode] = useState<ModeKey>('tilt');
  const [controlMode, setControlModeState] = useState<ControlMode>('manual');
  const [pressed, setPressed] = useState<Direction | null>(null);
  const [activeAxis, setActiveAxis] = useState<AxisKey | null>(null);
  const [relaxOn, setRelaxOn] = useState(false);
  const [, setFrame] = useState(0);
  /** 시퀀스 로그 (HMI 우측 패널) — 조작/축 완료 시점에만 갱신 */
  const [log, setLog] = useState<LogEntry[]>([
    { t: '--:--:--', msg: 'SYSTEM READY · 10 AXES ONLINE', tone: 'dim' },
  ]);

  // ================= 시뮬레이션 상태 (ref) =================
  const posRef = useRef<Record<AxisKey, number>>({ ...INITIAL_POSITIONS });
  const tgtRef = useRef<Record<AxisKey, number>>({ ...INITIAL_POSITIONS });
  const pressRef = useRef<{ axis: AxisKey; dir: Direction } | null>(null);
  const modeRef = useRef<ModeKey>('tilt');
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
  }>({ phase: 'idle', delay: 0, targetMode: 'tilt', targetAxis: 'tilt', targetValue: 50 });

  langRef.current = currentLang;

  /** HMI 시퀀스 로그 적재 (최신 6건 유지) */
  const pushLog = (msg: string, tone: LogTone = 'dim') => {
    const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLog((prev) => [{ t: stamp, msg, tone }, ...prev].slice(0, 6));
  };

  // ================= 공통 제어 =================
  /**
   * 릴렉스 On/Off 프리셋
   *  On  : On 이전 값 스냅샷을 저장하고 RELAX_ON_TARGETS 로 이동 (릴렉스 100%)
   *  Off : 스냅샷 값으로 복귀 (릴렉스 0%)
   */
  const applyRelaxPreset = (on: boolean) => {
    pressRef.current = null;
    setPressed(null);

    const result = relaxPreset(posRef.current, relaxSnapshotRef.current, on);
    Object.assign(tgtRef.current, result.targets);
    relaxSnapshotRef.current = result.snapshot;

    // 이동이 실제로 발생하는 축만 타깃 마커 대상으로 등록 (Off 시 스냅샷 복귀 구간 포함)
    const moving = new Set<AxisKey>();
    ([...RELAX_ON_AXES, 'relaxation_return'] as AxisKey[]).forEach((k) => {
      const target = result.targets[k];
      if (target !== undefined && Math.abs(target - posRef.current[k]) > 0.05) moving.add(k);
    });
    relaxAxesRef.current = moving;

    pushLog(
      on ? 'RELAX ON · SNAPSHOT SAVED (6AX)' : 'RELAX OFF · RESTORE SNAPSHOT',
      on ? 'hot' : 'ok',
    );
    setRelaxOn(on);
    setActiveAxis('relaxation_return');
    setFrame((f) => f + 1);
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
    modeRef.current = next;
    setMode(next);
    pushLog(`MODE → M${MODE_CONFIG[next].status} · ${MODE_CONFIG[next].subName.toUpperCase()}`);
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
        targetAxis: 'tilt',
        targetValue: 50,
      };
    }
  };

  const resetPose = () => {
    demoRef.current.phase = 'idle';
    controlModeRef.current = 'manual';
    setControlModeState('manual');
    stopMotion();
    modeRef.current = 'tilt';
    setMode('tilt');
    relaxSnapshotRef.current = null;
    relaxAxesRef.current = new Set();
    setRelaxOn(false);
    pushLog('POSE RESET · INITIAL VALUES', 'ok');
    posRef.current = { ...INITIAL_POSITIONS };
    tgtRef.current = { ...INITIAL_POSITIONS };
    setFrame((f) => f + 1);
  };

  const handlePress = (dir: Direction) => {
    // 수동 조작 시작 시 AUTO DEMO 정지
    if (controlModeRef.current === 'auto') setControlMode('manual');
    // 수동 조작 구간에서는 타깃 마커를 표시하지 않는다
    relaxAxesRef.current = new Set();

    // 릴렉스 모드는 방향 조작 대신 On/Off 프리셋을 사용한다
    if (modeRef.current === 'relaxation') return;

    const axis = axisForDirection(modeRef.current, dir);
    if (!axis) return;

    const prev = pressRef.current;
    if (prev && prev.dir !== dir) tgtRef.current[prev.axis] = posRef.current[prev.axis];

    pressRef.current = { axis, dir };
    setPressed(dir);
    setActiveAxis(axis);
  };

  /** 릴렉스 On/Off 버튼 (수동 조작 시작 시 AUTO DEMO 정지) */
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
    if (demo.phase === 'mode_transition' && moving) return;

    if (demo.phase === 'mode_transition') {
      const next = rotateMode(demo.targetMode, 1);
      demo.targetMode = next;
      selectMode(next);

      // 릴렉스 모드는 축 조작 대신 On/Off 프리셋을 교대로 시연한다
      if (next === 'relaxation') {
        applyRelaxPreset(relaxSnapshotRef.current === null);
        demo.phase = 'up_delay';
        demo.delay = 2.5;
        return;
      }

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
      // 릴렉스 모드: →/↑ = On, ←/↓ = Off (프리셋이라 홀드 조작 없음)
      if (modeRef.current === 'relaxation') {
        handleRelaxButton(e.key === 'ArrowRight' || e.key === 'ArrowUp');
        return;
      }
      keyHeldRef.current.add(e.key);
      handlePress(keyMap[e.key]);
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

  /** 릴렉스 모드용 On/Off 프리셋 버튼 (On = 릴렉션 포즈, Off = 직전 값 복귀) */
  const relaxButton = (on: boolean) => {
    const active = relaxOn === on;
    return (
      <button
        key={on ? 'relax-on' : 'relax-off'}
        type="button"
        onClick={() => {
          if (modeRef.current !== 'relaxation') selectMode('relaxation');
          handleRelaxButton(on);
        }}
        title={on ? '릴렉션 포즈 적용' : '직전 값으로 복귀'}
        className={`flex-1 h-10 rounded-[10px] border flex flex-col items-center justify-center gap-[2px] transition-all select-none
          ${
            active
              ? on
                ? 'bg-[#f0a53c] text-[#0a0d0f] border-[#f0a53c] shadow-[0_0_18px_rgba(240,165,60,.35)]'
                : 'bg-white/10 text-white border-white/25'
              : 'border-white/[.12] text-[#93a2a4] hover:border-[#f0a53c]/60 hover:text-[#ffc276] cursor-pointer'
          }`}
      >
        <span className="text-[11px] leading-none">{on ? '⏻' : '↺'}</span>
        <span className="text-[9px] leading-none font-bold tracking-[.2em]">{on ? 'ON' : 'OFF'}</span>
      </button>
    );
  };


  // ================= HMI 렌더 계산 =================
  /** 릴렉스 프리셋 적용률 (0~100) */
  const relaxPct = clamp(pos.relaxation_return, 0, 100);
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
  /** 배너 톤 — 이동 중(앰버) / 릴렉스 포즈 유지(민트) / 유휴(그레이) */
  const running = ghostPose || (activeAxis !== null && etaOf(activeAxis) > 0);
  const bannerTone: 'run' | 'hold' | 'idle' = running ? 'run' : relaxOn ? 'hold' : 'idle';
  const bannerText = ghostPose
    ? `RLX RUNNING · ${relaxPct.toFixed(0)}% APPLIED · ETA ${etaMax.toFixed(1)} s`
    : running && activeAxis
      ? `${AXIS_CONFIG[activeAxis].code} RUNNING · ${fmtAxis(activeAxis, pos[activeAxis])} → ${fmtAxis(
          activeAxis,
          tgt[activeAxis],
        )} · ETA ${etaOf(activeAxis).toFixed(1)} s`
      : relaxOn
        ? 'RELAX POSE APPLIED · 6 AXES HOLDING'
        : 'SYSTEM IDLE · SELECT A MODE AND HOLD A DIRECTION KEY';

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
              Mode {String(MODE_CONFIG[mode].status).padStart(2, '0')} ·{' '}
              {MODE_CONFIG[mode].name[currentLang]}
              {mode === 'relaxation' ? (relaxOn ? ' · ON' : ' · OFF') : ''}
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
            {/* ================= 좌측: 드라이브 모드 시퀀스 ================= */}
            <div className="bg-[#0a0d0f] p-5 flex flex-col min-h-0">
              <p className="text-[11px] tracking-[.32em] uppercase text-[#6f7f82] mb-4">
                Drive Modes{' '}
                <b className="text-[#f0a53c] font-semibold">
                  M{String(MODE_CONFIG[mode].status).padStart(2, '0')}
                </b>
              </p>
              <div className="space-y-2">
                {MODE_ORDER.map((key) => {
                  const conf = MODE_CONFIG[key];
                  const selected = mode === key;
                  const axis = primaryAxis(key);
                  const confAxis = AXIS_CONFIG[axis];
                  const isRelax = key === 'relaxation';
                  const ratio = isRelax
                    ? clamp(pos.relaxation_return, 0, 100)
                    : clamp(((pos[axis] - confAxis.min) / (confAxis.max - confAxis.min)) * 100, 0, 100);
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
                          M{conf.status}
                        </span>
                        <span className="flex-1 text-[12.5px] text-[#8d9c9e] truncate">
                          {conf.name[currentLang]}
                        </span>
                        <span className="font-hmi-cond text-[17px] font-bold text-[#e9f1f2] whitespace-nowrap">
                          {isRelax
                            ? `${clamp(pos.relaxation_return, 0, 100).toFixed(0)}%`
                            : fmtAxis(axis, pos[axis])}
                        </span>
                      </div>
                      <div className="h-[4px] rounded-full bg-white/[.07] mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isRelax && relaxOn
                              ? 'bg-[linear-gradient(90deg,#3fae86,#5fd6a4)]'
                              : 'bg-[linear-gradient(90deg,#f0a53c,#ffd9a3)]'
                          }`}
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-auto pt-4 border-t border-white/10">
                <p className="text-[11px] tracking-[.32em] uppercase text-[#6f7f82] mb-3">
                  Relax Preset
                </p>
                <div className="flex gap-2">{relaxButton(true)}{relaxButton(false)}</div>
                <p className="text-[11.5px] text-[#8d9c9e] leading-relaxed mt-3">
                  Off 시{' '}
                  <b className="text-[#e9f1f2] font-hmi-cond text-[13px]">
                    {relaxSnapshotRef.current ? '스냅샷' : '초기값'}
                  </b>{' '}
                  으로 6축 동시 복귀 · Priority RCL
                </p>
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
                        : 'border-white/10 bg-white/[.03] text-[#7f8f92]'
                  }`}
                >
                  <i
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      bannerTone === 'run'
                        ? 'bg-[#f0a53c] shadow-[0_0_12px_#f0a53c]'
                        : bannerTone === 'hold'
                          ? 'bg-[#5fd6a4] shadow-[0_0_12px_#5fd6a4]'
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
                    stroke="url(#hmiArc)"
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
                    fill="#5fd6a4"
                  >
                    {relaxPct > 99
                      ? 'SEQUENCE COMPLETE'
                      : running
                        ? `ETA ${etaMax.toFixed(1)} s`
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
              {mode === 'relaxation' ? (
                <button
                  type="button"
                  onClick={() => handleRelaxButton(!relaxOn)}
                  className={`w-full h-[86px] rounded-[10px] border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    relaxOn
                      ? 'border-[#5fd6a4]/50 bg-[#5fd6a4]/10 text-[#8fe6c2]'
                      : 'border-white/[.12] text-[#93a2a4] hover:border-[#f0a53c]/60 hover:text-[#ffc276]'
                  }`}
                >
                  <span className="font-hmi-cond text-[26px] font-bold leading-none">
                    {relaxOn ? 'OFF' : 'ON'}
                  </span>
                  <span className="text-[9.5px] tracking-[.22em] uppercase">
                    {relaxOn ? 'Restore Snapshot' : 'Apply Relax Pose'}
                  </span>
                </button>
              ) : (
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
              )}

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

