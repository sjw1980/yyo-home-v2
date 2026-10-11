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
  relaxPoseAt,
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
  const [mode, setMode] = useState<ModeKey>('tilt_legrest');
  const [controlMode, setControlModeState] = useState<ControlMode>('manual');
  const [pressed, setPressed] = useState<Direction | null>(null);
  const [activeAxis, setActiveAxis] = useState<AxisKey | null>(null);
  const [, setFrame] = useState(0);

  // ================= 시뮬레이션 상태 (ref) =================
  const posRef = useRef<Record<AxisKey, number>>({ ...INITIAL_POSITIONS });
  const tgtRef = useRef<Record<AxisKey, number>>({ ...INITIAL_POSITIONS });
  const pressRef = useRef<{ axis: AxisKey; dir: Direction } | null>(null);
  const modeRef = useRef<ModeKey>('tilt_legrest');
  const controlModeRef = useRef<ControlMode>('manual');
  const langRef = useRef<'ko' | 'en'>(currentLang);
  const keyHeldRef = useRef<Set<string>>(new Set());
  const relaxActiveRef = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const demoRef = useRef<{
    phase: DemoPhase;
    delay: number;
    targetMode: ModeKey;
    targetAxis: AxisKey;
    targetValue: number;
  }>({ phase: 'idle', delay: 0, targetMode: 'tilt_legrest', targetAxis: 'tilt', targetValue: 50 });

  langRef.current = currentLang;

  // ================= 공통 제어 =================
  /**
   * 릴렉스 & 리턴 포즈 동기화 (M6 전용)
   * 데스크톱 앱은 이미지 전환만 수행하나, 웹 버전에서는 릴렉스 %에 따라 7개 축이 실제 포즈로 이동한다.
   * (조작 이력이 있을 때만 구동 → 모드 진입만으로 시트가 점프하지 않음)
   */
  const syncRelaxPose = () => {
    if (!relaxActiveRef.current) return;
    const pose = relaxPoseAt(posRef.current.relaxation_return / 100);
    Object.assign(posRef.current, pose);
    Object.assign(tgtRef.current, pose);
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
    modeRef.current = 'tilt_legrest';
    setMode('tilt_legrest');
    relaxActiveRef.current = false;
    posRef.current = { ...INITIAL_POSITIONS };
    tgtRef.current = { ...INITIAL_POSITIONS };
    setFrame((f) => f + 1);
  };

  const handlePress = (dir: Direction) => {
    // 수동 조작 시작 시 AUTO DEMO 정지
    if (controlModeRef.current === 'auto') setControlMode('manual');

    const axis = axisForDirection(modeRef.current, dir);
    if (!axis) return;

    const prev = pressRef.current;
    if (prev && prev.dir !== dir) tgtRef.current[prev.axis] = posRef.current[prev.axis];

    pressRef.current = { axis, dir };
    if (axis === 'relaxation_return') relaxActiveRef.current = true;
    setPressed(dir);
    setActiveAxis(axis);
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

      const conf = MODE_CONFIG[next];
      const axis = conf.lrAxis;
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
      const conf = MODE_CONFIG[demo.targetMode];
      const confAxis = AXIS_CONFIG[axis];
      const step = confAxis.speed * dt * (conf.lrFine ? 0.35 : 1);
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

    // 릴렉스 & 리턴 포즈 동기화
    syncRelaxPose();

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
  const focusAxis: AxisKey = activeAxis ?? modeConf.lrAxis;
  const focusConf = AXIS_CONFIG[focusAxis];
  const span = focusConf.max - focusConf.min;
  const pct = ((pos[focusAxis] - focusConf.min) / span) * 100;
  const tgtPct = ((tgt[focusAxis] - focusConf.min) / span) * 100;
  const softLeft = ((focusConf.softMin - focusConf.min) / span) * 100;
  const softRight = ((focusConf.softMax - focusConf.min) / span) * 100;

  const fmtAxis = (axis: AxisKey, value: number) =>
    `${value.toFixed(AXIS_CONFIG[axis].unit === '°' ? 1 : 0)}${AXIS_CONFIG[axis].unit}`;

  /**
   * 4-Way 디렉션 패드 버튼
   * (컴포넌트 대신 함수 호출로 렌더링 → 30ms 리렌더 시 리마운트/조작 유실 방지)
   */
  const padButton = (dir: Direction, glyph: string) => {
    const label = MODE_SPEC_LABELS[mode][dir];
    const disabled = !label;
    return (
      <button
        key={dir}
        type="button"
        disabled={disabled}
        onPointerDown={(e) => {
          e.preventDefault();
          if (!disabled) handlePress(dir);
        }}
        onPointerUp={() => {
          if (!disabled) handleRelease();
        }}
        onPointerLeave={() => {
          if (pressed === dir) handleRelease();
        }}
        title={label ? label[currentLang] : '—'}
        className={`h-16 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all select-none
          ${
            pressed === dir
              ? 'bg-[#7dbaaf] text-[#0d1111] border-[#7dbaaf] shadow-lg'
              : disabled
                ? 'border-[#222c2a] text-[#2f3b38] cursor-not-allowed'
                : 'border-[#313f3c] text-[#9bb09e] hover:border-[#7dbaaf]/60 hover:text-[#7dbaaf] cursor-pointer'
          }`}
      >
        <span className="text-sm leading-none">{glyph}</span>
        <span className="text-[8.5px] leading-tight px-1 text-center">
          {label ? label[currentLang] : '—'}
        </span>
      </button>
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
              <p className="text-xs font-bold text-slate-200 truncate">{modeConf.name[currentLang]}</p>
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

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* ===== A. MODE SELECT + AXIS MONITOR ===== */}
          <div className="lg:col-span-4 bg-[#080d0c] rounded-2xl border border-[#313f3c]/60 flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-[#131d1b] border-b border-[#313f3c]/60 px-5 py-3.5 flex items-center space-x-2">
              <SlidersHorizontal className="w-4 h-4 text-[#7dbaaf]" />
              <span className="font-mono text-[11px] tracking-wider text-slate-200">
                {t('Seat Mode Panel')}
              </span>
            </div>

            <div className="p-4 space-y-2">
              {MODE_ORDER.map((key) => {
                const conf = MODE_CONFIG[key];
                const selected = mode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectMode(key)}
                    className={`w-full text-left rounded-xl border px-3.5 py-3 transition-all
                      ${
                        selected
                          ? 'bg-[#12211e] border-[#7dbaaf] shadow-lg'
                          : 'bg-[#0b1211] border-[#222c2a] hover:border-[#3d4d49] cursor-pointer'
                      }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                          selected
                            ? 'bg-[#7dbaaf] text-[#0d1111] font-bold'
                            : 'bg-[#16211e] text-stone-500'
                        }`}
                      >
                        M{conf.status}
                      </span>
                      <span
                        className={`text-[13px] font-bold truncate ${
                          selected ? 'text-slate-100' : 'text-stone-400'
                        }`}
                      >
                        {conf.name[currentLang]}
                      </span>
                    </div>
                    <p
                      className={`font-mono text-[9.5px] mt-1.5 truncate ${
                        selected ? 'text-[#7dbaaf]' : 'text-stone-600'
                      }`}
                    >
                      {conf.desc[currentLang]}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* ---- AXIS MONITOR ---- */}
            <div className="px-4 pb-4 mt-auto">
              <div className="border-t border-[#313f3c]/60 pt-3.5">
                <p className="font-mono text-[10px] tracking-wider text-stone-500 mb-2.5">
                  {t('Seat Axis Monitor')}
                </p>
                <div className="space-y-1.5">
                  {AXIS_ORDER.map((key) => {
                    const conf = AXIS_CONFIG[key];
                    const value = pos[key];
                    const ratio = clamp(((value - conf.min) / (conf.max - conf.min)) * 100, 0, 100);
                    const isActive = activeAxis === key;
                    return (
                      <div key={key} className="flex items-center space-x-2">
                        <span
                          className={`w-[68px] text-[10px] truncate ${
                            isActive ? 'text-[#7dbaaf] font-bold' : 'text-stone-500'
                          }`}
                        >
                          {conf.name[currentLang]}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-[#101917] border border-[#222c2a] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isActive ? 'bg-[#7dbaaf]' : 'bg-[#3d4d49]'
                            }`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                        <span
                          className={`w-[52px] text-right font-mono text-[9.5px] ${
                            isActive ? 'text-[#7dbaaf]' : 'text-stone-500'
                          }`}
                        >
                          {fmtAxis(key, value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ===== B. VIRTUAL SEAT PHYSICS MODEL ===== */}
          <div className="lg:col-span-5 bg-[#080d0c] rounded-2xl border border-[#313f3c]/60 flex flex-col overflow-hidden shadow-2xl">
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

            <div className="flex-1 bg-[radial-gradient(circle_at_50%_35%,#0e1a17_0%,#050908_70%)] px-3 py-2">
              <SeatDiagram positions={pos} targets={tgt} activeAxis={activeAxis} lang={currentLang} />
            </div>

            {/* ---- MOTION BAR (소프트 리밋 구간 / 타깃 / 현재 위치) ---- */}
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
              <p className="text-[10.5px] text-stone-500 mt-2.5 leading-relaxed">
                {focusConf.desc[currentLang]}
              </p>
            </div>
          </div>

          {/* ===== C. CONTROL PANEL ===== */}
          <div className="lg:col-span-3 bg-[#080d0c] rounded-2xl border border-[#313f3c]/60 flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-[#131d1b] border-b border-[#313f3c]/60 px-5 py-3.5 flex items-center space-x-2">
              <Gauge className="w-4 h-4 text-[#7dbaaf]" />
              <span className="font-mono text-[11px] tracking-wider text-slate-200">
                {t('Seat Control Panel')}
              </span>
            </div>

            <div className="p-5 flex-1 flex flex-col">
              {/* 활성 축 표시 */}
              <div className="bg-[#050908] border border-[#243029] rounded-lg px-3.5 py-3 mb-4">
                <p className="font-mono text-[9px] text-stone-600 tracking-wider mb-1">
                  CURRENT / TARGET
                </p>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-bold text-slate-100 truncate">
                    {focusConf.name[currentLang]}
                  </span>
                  <span className="font-mono text-lg text-[#7dbaaf] font-bold leading-none">
                    {fmtAxis(focusAxis, pos[focusAxis])}
                  </span>
                </div>
                <p className="font-mono text-[9px] text-[#e0b96a] mt-1 text-right">
                  TGT {fmtAxis(focusAxis, tgt[focusAxis])}
                </p>
              </div>

              {/* 4-Way 디렉션 패드 */}
              <div className="grid grid-cols-3 gap-2">
                <div />
                {padButton('up', '▲')}
                <div />
                {padButton('left', '◀')}
                <div className="h-16 flex items-center justify-center font-mono text-[9px] text-stone-600">
                  4-WAY
                </div>
                {padButton('right', '▶')}
                <div />
                {padButton('down', '▼')}
                <div />
              </div>

              <p className="font-mono text-[9.5px] text-stone-600 mt-3 leading-relaxed">
                {modeConf.desc[currentLang]}
              </p>

              {/* 제어 모드 전환 */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setControlMode('manual')}
                  className={`h-10 rounded-lg border text-[11px] font-bold font-mono transition-all
                    ${
                      controlMode === 'manual'
                        ? 'bg-[#7dbaaf] text-[#0d1111] border-[#7dbaaf]'
                        : 'border-[#313f3c] text-stone-400 hover:border-[#7dbaaf]/60 hover:text-[#7dbaaf] cursor-pointer'
                    }`}
                >
                  MANUAL
                </button>
                <button
                  type="button"
                  onClick={() => setControlMode('auto')}
                  className={`h-10 rounded-lg border text-[11px] font-bold font-mono transition-all flex items-center justify-center space-x-1.5
                    ${
                      controlMode === 'auto'
                        ? 'bg-[#e0b96a] text-[#0d1111] border-[#e0b96a]'
                        : 'border-[#313f3c] text-stone-400 hover:border-[#e0b96a]/60 hover:text-[#e0b96a] cursor-pointer'
                    }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>AUTO</span>
                </button>
              </div>

              <button
                type="button"
                onClick={resetPose}
                className="mt-2 h-10 w-full rounded-lg border border-[#313f3c] text-[11px] font-mono text-stone-400 hover:border-[#7dbaaf]/60 hover:text-[#7dbaaf] transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('Seat Reset Pose')}</span>
              </button>

              <p className="text-[10px] text-stone-600 font-mono leading-relaxed mt-auto pt-5">
                {t('Seat Control Hint')}
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





