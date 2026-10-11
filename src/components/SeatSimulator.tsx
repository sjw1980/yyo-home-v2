import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Armchair, Gauge, RotateCcw, SlidersHorizontal, Zap } from 'lucide-react';
import SeatDiagram from './SeatDiagram';
import {
  AXIS_CONFIG,
  AXIS_ORDER,
  INITIAL_POSITIONS,
  MODE_CONFIG,
  MODE_ORDER,
  MODE_SPEC_LABELS,
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

  // ================= 시뮬레이션 상태 (ref) =================
  const posRef = useRef<Record<AxisKey, number>>({ ...INITIAL_POSITIONS });
  const tgtRef = useRef<Record<AxisKey, number>>({ ...INITIAL_POSITIONS });
  const pressRef = useRef<{ axis: AxisKey; dir: Direction } | null>(null);
  const modeRef = useRef<ModeKey>('tilt');
  const controlModeRef = useRef<ControlMode>('manual');
  const langRef = useRef<'ko' | 'en'>(currentLang);
  const keyHeldRef = useRef<Set<string>>(new Set());
  const relaxSnapshotRef = useRef<Partial<Record<AxisKey, number>> | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const demoRef = useRef<{
    phase: DemoPhase;
    delay: number;
    targetMode: ModeKey;
    targetAxis: AxisKey;
    targetValue: number;
  }>({ phase: 'idle', delay: 0, targetMode: 'tilt', targetAxis: 'tilt', targetValue: 50 });

  langRef.current = currentLang;

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
    setRelaxOn(false);
    posRef.current = { ...INITIAL_POSITIONS };
    tgtRef.current = { ...INITIAL_POSITIONS };
    setFrame((f) => f + 1);
  };

  const handlePress = (dir: Direction) => {
    // 수동 조작 시작 시 AUTO DEMO 정지
    if (controlModeRef.current === 'auto') setControlMode('manual');

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
  const modeConf = MODE_CONFIG[mode];
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
   * 모드 카드 안의 조작 버튼 — 모드에 필요한 방향 버튼만 카드 안에 배치한다.
   * (컴포넌트 대신 함수 호출로 렌더링 → 30ms 리렌더 시 리마운트/조작 유실 방지)
   */
  const modeButton = (modeKey: ModeKey, dir: Direction, glyph: string) => {
    const label = MODE_SPEC_LABELS[modeKey][dir];
    if (!label) return null;
    const active = pressed === dir && mode === modeKey;
    return (
      <button
        key={dir}
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          if (modeRef.current !== modeKey) selectMode(modeKey);
          handlePress(dir);
        }}
        onPointerUp={() => handleRelease()}
        onPointerLeave={() => {
          if (active) handleRelease();
        }}
        title={label[currentLang]}
        className={`flex-1 min-w-0 h-9 rounded-md border flex flex-col items-center justify-center gap-[1px] transition-all select-none
          ${
            active
              ? 'bg-[#7dbaaf] text-[#0d1111] border-[#7dbaaf] shadow'
              : 'border-[#313f3c] text-[#9bb09e] hover:border-[#7dbaaf]/60 hover:text-[#7dbaaf] cursor-pointer'
          }`}
      >
        <span className="text-[10px] leading-none">{glyph}</span>
        <span className="text-[7.5px] leading-none px-0.5 truncate max-w-full">
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
        className={`flex-1 h-9 rounded-md border flex flex-col items-center justify-center gap-[1px] transition-all select-none
          ${
            active
              ? on
                ? 'bg-[#e0b96a] text-[#0d1111] border-[#e0b96a] shadow'
                : 'bg-[#7dbaaf] text-[#0d1111] border-[#7dbaaf] shadow'
              : 'border-[#313f3c] text-[#9bb09e] hover:border-[#7dbaaf]/60 hover:text-[#7dbaaf] cursor-pointer'
          }`}
      >
        <span className="text-[11px] leading-none">{on ? '⏻' : '↺'}</span>
        <span className="text-[8px] leading-none font-bold">{on ? 'ON' : 'OFF'}</span>
      </button>
    );
  };

  /** 모드 카드 버튼 클러스터 — 릴렉스는 On/Off, 그 외 모드는 방향 버튼 */
  const cardButtons = (modeKey: ModeKey) => {
    if (modeKey === 'relaxation') {
      return (
        <>
          {relaxButton(true)}
          {relaxButton(false)}
        </>
      );
    }
    return (
      <>
        {modeButton(modeKey, 'up', '▲')}
        {modeButton(modeKey, 'down', '▼')}
        {modeButton(modeKey, 'left', '◀')}
        {modeButton(modeKey, 'right', '▶')}
      </>
    );
  };

  return (
    <section
      id="seat-simulator"
      ref={sectionRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className="relative py-24 bg-[#050908] border-t border-[#313f3c]/40 focus:outline-none"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ================= 헤더 ================= */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-[#0d1614] border border-[#7dbaaf]/30 rounded-full mb-6">
            <Armchair className="w-3.5 h-3.5 text-[#7dbaaf]" />
            <span className="text-xs font-mono tracking-widest text-[#7dbaaf] uppercase">
              DPSS Seat Simulator
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
            {t('Seat Simulator Title')}
          </h2>
          <p className="text-slate-400 max-w-3xl mx-auto leading-relaxed text-sm md:text-base">
            {t('Seat Simulator Subtitle')}
          </p>
        </div>

        {/* ================= 상태 스트립 ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-[#080d0c] border border-[#313f3c]/60 rounded-xl px-4 py-3 flex items-center space-x-3">
            <SlidersHorizontal className="w-4 h-4 text-[#7dbaaf] flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-mono text-[9px] text-stone-600 tracking-wider">DPSS MODE</p>
              <p className="text-xs font-bold text-slate-200 truncate">
                M{modeConf.status} · {modeConf.name[currentLang]}
              </p>
            </div>
          </div>
          <div className="bg-[#080d0c] border border-[#313f3c]/60 rounded-xl px-4 py-3 flex items-center space-x-3">
            <Gauge className="w-4 h-4 text-[#7dbaaf] flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-mono text-[9px] text-stone-600 tracking-wider">CONTROL MODE</p>
              <p
                className={`text-xs font-bold truncate ${
                  controlMode === 'auto' ? 'text-[#e0b96a]' : 'text-slate-200'
                }`}
              >
                {controlMode === 'auto' ? 'AUTO DEMO' : 'MANUAL'}
              </p>
            </div>
          </div>
          <div className="bg-[#080d0c] border border-[#313f3c]/60 rounded-xl px-4 py-3 flex items-center space-x-3">
            <Armchair className="w-4 h-4 text-[#7dbaaf] flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9px] text-stone-600 tracking-wider">ACTIVE AXIS</p>
              <p className="text-xs font-bold text-slate-200 truncate">
                {focusConf.name[currentLang]}{' '}
                <span className="font-mono text-[#7dbaaf]">{fmtAxis(focusAxis, pos[focusAxis])}</span>
              </p>
            </div>
            <span className="font-mono text-[9px] text-stone-600 flex-shrink-0">{focusConf.code}</span>
          </div>
        </div>

        {/* ===== 모드 셀렉터 (모드별로 필요한 조작 버튼을 카드 안에 배치) ===== */}
        <div className="bg-[#080d0c] rounded-2xl border border-[#313f3c]/60 overflow-hidden shadow-2xl">
          <div className="bg-[#131d1b] border-b border-[#313f3c]/60 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <SlidersHorizontal className="w-4 h-4 text-[#7dbaaf]" />
              <span className="font-mono text-[11px] tracking-wider text-slate-200">
                {t('Seat Mode Panel')}
              </span>
              <span className="font-mono text-[9px] text-stone-600">{MODE_ORDER.length} MODES</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setControlMode(controlMode === 'auto' ? 'manual' : 'auto')}
                className={`h-8 px-3 rounded-lg border text-[10px] font-bold font-mono transition-all flex items-center space-x-1.5
                  ${
                    controlMode === 'auto'
                      ? 'bg-[#e0b96a] text-[#0d1111] border-[#e0b96a]'
                      : 'border-[#313f3c] text-stone-400 hover:border-[#e0b96a]/60 hover:text-[#e0b96a] cursor-pointer'
                  }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{controlMode === 'auto' ? 'AUTO DEMO ON' : 'AUTO DEMO'}</span>
              </button>
              <button
                type="button"
                onClick={resetPose}
                className="h-8 px-3 rounded-lg border border-[#313f3c] text-[10px] font-mono text-stone-400 hover:border-[#7dbaaf]/60 hover:text-[#7dbaaf] transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('Seat Reset Pose')}</span>
              </button>
            </div>
          </div>

          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {MODE_ORDER.map((key) => {
              const conf = MODE_CONFIG[key];
              const selected = mode === key;
              const lr = conf.lrAxis;
              const ud = conf.udAxis;
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-3 flex flex-col transition-all ${
                    selected
                      ? 'bg-[#12211e] border-[#7dbaaf] shadow-lg'
                      : 'bg-[#0b1211] border-[#222c2a] hover:border-[#3d4d49]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectMode(key)}
                    className="text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`font-mono text-[9.5px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                          selected
                            ? 'bg-[#7dbaaf] text-[#0d1111] font-bold'
                            : 'bg-[#16211e] text-stone-500'
                        }`}
                      >
                        M{conf.status}
                      </span>
                      <span
                        className={`text-[12px] font-bold truncate ${
                          selected ? 'text-slate-100' : 'text-stone-400'
                        }`}
                      >
                        {conf.name[currentLang]}
                      </span>
                    </div>
                    <p
                      className={`font-mono text-[9px] mt-1.5 truncate ${
                        selected ? 'text-[#7dbaaf]' : 'text-stone-600'
                      }`}
                    >
                      {lr ? `${AXIS_CONFIG[lr].code} ${fmtAxis(lr, pos[lr])}` : ''}
                      {lr && ud ? ' · ' : ''}
                      {ud ? `${AXIS_CONFIG[ud].code} ${fmtAxis(ud, pos[ud])}` : ''}
                    </p>
                  </button>

                  <div className="flex gap-1 mt-2.5">{cardButtons(key)}</div>
                </div>
              );
            })}
          </div>

          <p className="px-5 pb-4 text-[10px] text-stone-600 font-mono leading-relaxed">
            {t('Seat Control Hint')}
          </p>
        </div>

        {/* ===== 시트 물리 모델 + 실시간 모니터 ===== */}
        <div className="mt-6 bg-[#080d0c] rounded-2xl border border-[#313f3c]/60 overflow-hidden shadow-2xl">
          <div className="bg-[#131d1b] border-b border-[#313f3c]/60 px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Armchair className="w-4 h-4 text-[#7dbaaf]" />
              <span className="font-mono text-[11px] tracking-wider text-slate-200">
                {t('Seat Diagram Panel')}
              </span>
            </div>
            <span className="font-mono text-[10px] text-[#7dbaaf]">
              {focusConf.name[currentLang]} · {focusConf.code}
            </span>
          </div>

          <div className="grid lg:grid-cols-12">
            {/* ---- 시트 형상 + 모션 바 ---- */}
            <div className="lg:col-span-8 flex flex-col">
              <div className="flex-1 bg-[radial-gradient(circle_at_50%_35%,#0e1a17_0%,#050908_70%)] px-3 py-2">
                <SeatDiagram
                  positions={pos}
                  targets={tgt}
                  activeAxis={activeAxis}
                  lang={currentLang}
                />
              </div>

              <div className="border-t border-[#313f3c]/60 px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[9.5px] text-stone-500">
                    {focusConf.min}
                    {focusConf.unit}
                  </span>
                  <span className="font-mono text-[10px] text-stone-400">
                    {activeAxis ? 'OPERATION' : 'IDLE'} · {focusConf.name[currentLang]}
                  </span>
                  <span className="font-mono text-[9.5px] text-stone-500">
                    {focusConf.max}
                    {focusConf.unit}
                  </span>
                </div>
                <div className="relative h-3 rounded-full bg-[#101917] border border-[#222c2a] overflow-hidden">
                  <div
                    className="absolute inset-y-0 bg-[#16241f]"
                    style={{ left: `${softLeft}%`, width: `${Math.max(softRight - softLeft, 0)}%` }}
                  />
                  <div
                    className="absolute inset-y-0 w-[2px] bg-[#e0b96a]/80"
                    style={{ left: `${clamp(tgtPct, 0, 100)}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-[#7dbaaf]/80 rounded-r"
                    style={{ width: `${clamp(pct, 0, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-mono text-[9px] text-stone-600">
                    SOFT {focusConf.softMin}
                    {focusConf.unit} ~ {focusConf.softMax}
                    {focusConf.unit}
                  </span>
                  <span className="font-mono text-[11px] text-[#7dbaaf] font-bold">
                    {fmtAxis(focusAxis, pos[focusAxis])}
                  </span>
                </div>
              </div>
            </div>

            {/* ---- 실시간 모니터 (시트 패널 내부) ---- */}
            <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-[#313f3c]/60 p-4">
              <p className="font-mono text-[10px] tracking-wider text-stone-500 mb-3">
                {t('Seat Axis Monitor')}
              </p>
              <div className="space-y-2">
                {AXIS_ORDER.map((key) => {
                  const conf = AXIS_CONFIG[key];
                  const value = pos[key];
                  const ratio = clamp(((value - conf.min) / (conf.max - conf.min)) * 100, 0, 100);
                  const tRatio = clamp(((tgt[key] - conf.min) / (conf.max - conf.min)) * 100, 0, 100);
                  const sMin = ((conf.softMin - conf.min) / (conf.max - conf.min)) * 100;
                  const sMax = ((conf.softMax - conf.min) / (conf.max - conf.min)) * 100;
                  const isActive = activeAxis === key;
                  return (
                    <div key={key} className="flex items-center space-x-2">
                      <span
                        className={`w-[70px] text-[10px] truncate ${
                          isActive ? 'text-[#7dbaaf] font-bold' : 'text-stone-500'
                        }`}
                      >
                        {conf.name[currentLang]}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-[#101917] border border-[#222c2a] overflow-hidden relative">
                        <div
                          className="absolute inset-y-0 bg-[#16241f]"
                          style={{ left: `${sMin}%`, width: `${Math.max(sMax - sMin, 0)}%` }}
                        />
                        <div
                          className={`absolute inset-y-0 left-0 rounded-r ${
                            isActive ? 'bg-[#7dbaaf]/85' : 'bg-[#3d4d49]'
                          }`}
                          style={{ width: `${ratio}%` }}
                        />
                        <div
                          className="absolute inset-y-0 w-[2px] bg-[#e0b96a]/80"
                          style={{ left: `${tRatio}%` }}
                        />
                      </div>
                      <span
                        className={`w-[54px] text-right font-mono text-[9.5px] ${
                          isActive ? 'text-[#7dbaaf]' : 'text-stone-500'
                        }`}
                      >
                        {fmtAxis(key, value)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10.5px] text-stone-500 mt-4 leading-relaxed border-t border-[#313f3c]/40 pt-3">
                {focusConf.desc[currentLang]}
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 flex items-center justify-center space-x-2 text-stone-500 text-xs font-mono text-center">
          <Armchair className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t('Seat Disclaimer')}</span>
        </div>
      </div>
    </section>
  );
}





