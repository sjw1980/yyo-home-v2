import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  CloudRain, Gauge, Thermometer, Droplets, Sun, Moon, SlidersHorizontal,
  Repeat, Wind, SprayCan, RotateCw, Timer, Zap, Snowflake, AlertTriangle, Play,
} from 'lucide-react';
import { translations } from '../data';

interface WiperSimulatorProps {
  currentLang: 'ko' | 'en';
}

type RainLevel = 'none' | 'mist' | 'light' | 'moderate' | 'heavy' | 'torrential';
type Pattern = 'constant' | 'gusting' | 'intermittent';
type Contam = 'clean' | 'dusty' | 'oily';
type Lever = 'OFF' | 'INT' | 'LO' | 'HI';
type WState = 'IDLE' | 'AWAY' | 'HOME' | 'HOLD';

const RAIN_TARGET: Record<RainLevel, number> = {
  none: 0, mist: 0.15, light: 0.35, moderate: 0.55, heavy: 0.75, torrential: 0.95,
};
const CONTAM_OFFSET: Record<Contam, number> = { clean: 0, dusty: 0.15, oily: 0.28 };
const START_TH = 0.35;
const STOP_TH = 0.25;

interface SimEvent {
  id: number;
  icon: 'stall' | 'freeze' | 'false' | 'washer' | 'rear' | 'defrost' | 'resume';
  at: string;
}

interface SimState {
  rain: number;
  sensor: number;
  state: WState;
  progress: number;
  hold: number;
  interval: number;
  cyclesPerMin: number;
  motor: number;
  washer: number;
  freeze: boolean;
  thaw: number;
  rear: number; // -1 idle, 0..1 sweep progress
  autoOn: boolean;
  events: SimEvent[];
}

interface Inputs {
  level: RainLevel;
  pattern: Pattern;
  speed: number;
  temp: number;
  contam: Contam;
  night: boolean;
  lever: Lever;
  sens: number;
  auto: boolean;
  gear: 'D' | 'R';
  defrost: boolean;
}

const DEFAULT_INPUTS: Inputs = {
  level: 'moderate', pattern: 'constant', speed: 60, temp: 15, contam: 'clean',
  night: false, lever: 'INT', sens: 5, auto: true, gear: 'D', defrost: false,
};

const PRESETS: Record<string, Partial<Inputs> & { rearTrigger?: boolean }> = {
  highway: { level: 'torrential', pattern: 'constant', speed: 110, temp: 12, contam: 'clean', night: false, lever: 'INT', sens: 5, auto: true, gear: 'D', defrost: false },
  urban: { level: 'moderate', pattern: 'gusting', speed: 45, temp: 18, contam: 'clean', night: false, lever: 'INT', sens: 6, auto: true, gear: 'D', defrost: false },
  dirty: { level: 'none', pattern: 'constant', speed: 30, temp: 20, contam: 'oily', night: false, lever: 'INT', sens: 5, auto: true, gear: 'D', defrost: false },
  winter: { level: 'heavy', pattern: 'constant', speed: 60, temp: -8, contam: 'clean', night: true, lever: 'INT', sens: 7, auto: true, gear: 'D', defrost: false },
  rear: { level: 'light', pattern: 'constant', speed: 5, temp: 10, contam: 'clean', night: false, lever: 'OFF', sens: 5, auto: false, gear: 'R', defrost: false, rearTrigger: true },
};

const EVENT_ICON: Record<SimEvent['icon'], typeof Zap> = {
  stall: Zap, freeze: Snowflake, false: AlertTriangle, washer: SprayCan,
  rear: Repeat, defrost: Wind, resume: Play,
};
const EVENT_KEY: Record<SimEvent['icon'], string> = {
  stall: 'Ev stall', freeze: 'Ev freeze', false: 'Ev false', washer: 'Ev washer',
  rear: 'Ev rear', defrost: 'Ev defrost', resume: 'Ev resume',
};

function initialSim(): SimState {
  return {
    rain: 0, sensor: 0, state: 'IDLE', progress: 0, hold: 0, interval: 0,
    cyclesPerMin: 0, motor: 0.4, washer: 0, freeze: false, thaw: 0, rear: -1,
    autoOn: false, events: [],
  };
}

export default function WiperSimulator({ currentLang }: WiperSimulatorProps) {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const inputsRef = useRef<Inputs>(inputs);
  inputsRef.current = inputs;

  const simRef = useRef<SimState>(initialSim());
  const [sim, setSim] = useState<SimState>(simRef.current);

  const tRef = useRef(0);
  const mistRef = useRef(false);
  const washerRef = useRef(false);
  const rearRef = useRef(false);
  const prevGearRef = useRef<'D' | 'R'>('D');
  const cycleTimesRef = useRef<number[]>([]);
  const evIdRef = useRef(1);
  const falseEvRef = useRef(-100);
  const defrostEvRef = useRef(-100);

  const pushEvent = (s: SimState, icon: SimEvent['icon']) => {
    const at = new Date().toLocaleTimeString(currentLang === 'ko' ? 'ko-KR' : 'en-US', { hour12: false });
    s.events = [{ id: evIdRef.current++, icon, at }, ...s.events].slice(0, 5);
  };

  useEffect(() => {
    const iv = window.setInterval(() => {
      const dt = 0.05;
      tRef.current += dt;
      const t = tRef.current;
      const inp = inputsRef.current;
      const s = simRef.current;

      // ---- rain physics ----
      let target = RAIN_TARGET[inp.level];
      if (inp.pattern === 'gusting') target *= 0.55 + 0.45 * Math.sin(t * 0.7);
      if (inp.pattern === 'intermittent') target = Math.sin(t * 0.5) > 0 ? target : target * 0.05;
      s.rain += (target - s.rain) * 0.08;
      const contamOff = CONTAM_OFFSET[inp.contam] * (0.8 + 0.2 * Math.sin(t * 1.3));
      s.sensor = Math.min(1, Math.max(0, s.rain + contamOff));

      // ---- gear edge: rear wiper ----
      if (inp.gear !== prevGearRef.current) {
        if (inp.gear === 'R' && s.rear < 0) { s.rear = 0; pushEvent(s, 'rear'); }
        prevGearRef.current = inp.gear;
      }
      if (rearRef.current) { rearRef.current = false; if (s.rear < 0) s.rear = 0; pushEvent(s, 'rear'); }
      if (s.rear >= 0) {
        s.rear += dt / 1.2;
        if (s.rear >= 1) s.rear = -1;
      }

      // ---- washer trigger ----
      if (washerRef.current) {
        washerRef.current = false;
        s.washer = 3;
        pushEvent(s, 'washer');
      }

      // ---- freeze protection / thaw ----
      if (s.freeze && inp.defrost) {
        s.thaw -= dt;
        if (s.thaw <= 0) { s.freeze = false; pushEvent(s, 'resume'); }
      }

      // ---- control logic: who wants the wiper to run, and at what interval ----
      let wantRun = false;
      let interval = 0;
      const speedFactor = inp.speed <= 40 ? 1 : inp.speed >= 100 ? 0.35 : 1 - ((inp.speed - 40) / 60) * 0.65;

      if (inp.lever === 'HI') { wantRun = true; interval = 0; }
      else if (inp.lever === 'LO') { wantRun = true; interval = 1.6; }
      else if (inp.lever === 'INT') { wantRun = true; interval = (63 - inp.sens * 6) * speedFactor; }

      if (inp.auto) {
        if (s.autoOn) { if (s.sensor < STOP_TH) s.autoOn = false; }
        else if (s.sensor > START_TH) s.autoOn = true;
        if (s.autoOn) {
          wantRun = true;
          let ai = (34 * (1 - s.sensor) + 2) * speedFactor;
          if (inp.speed > 100) ai = Math.min(ai, 4);
          if (inp.night && s.sensor > 0.6) ai *= 0.7;
          interval = Math.min(40, Math.max(1.5, ai));
        }
      }

      // defroster-linked wiping (no rain, defroster ON)
      if (inp.defrost && !s.freeze && inp.lever !== 'OFF' && s.rain < 0.05 && s.washer === 0) {
        wantRun = true;
        interval = Math.max(interval, 20);
        if (t - defrostEvRef.current > 25) { defrostEvRef.current = t; pushEvent(s, 'defrost'); }
      }

      if (mistRef.current) { wantRun = true; interval = 0; }
      if (s.freeze) wantRun = false;
      s.interval = interval;

      // false-wipe diagnosis
      if (inp.auto && s.autoOn && s.rain < 0.12 && s.sensor > START_TH && t - falseEvRef.current > 12) {
        falseEvRef.current = t;
        pushEvent(s, 'false');
      }

      // ---- wiper state machine ----
      const sweepDur = s.washer > 0 ? 1.0 : inp.lever === 'HI' ? 0.9 : inp.lever === 'LO' ? 1.2 : 1.5;
      if (s.state === 'IDLE') {
        if (wantRun) { s.state = 'AWAY'; s.progress = 0; }
      } else if (s.state === 'AWAY') {
        s.progress += dt / sweepDur;
        if (s.progress >= 1) { s.progress = 1; s.state = 'HOME'; }
      } else if (s.state === 'HOME') {
        s.progress -= dt / sweepDur;
        if (s.progress <= 0) {
          s.progress = 0;
          // cycle complete
          cycleTimesRef.current.push(t);
          if (s.washer > 0) s.washer -= 1;
          if (mistRef.current) mistRef.current = false;
          // stall check (freeze physics)
          if (inp.temp < 0 && !s.freeze && Math.random() < Math.min(0.4, -inp.temp * 0.04)) {
            s.freeze = true;
            s.thaw = 6;
            s.motor = 12;
            pushEvent(s, 'stall');
            pushEvent(s, 'freeze');
          }
          if (wantRun) { s.state = 'HOLD'; s.hold = interval; }
          else s.state = 'IDLE';
        }
      } else if (s.state === 'HOLD') {
        if (!wantRun) { s.state = 'IDLE'; }
        else { s.hold -= dt; if (s.hold <= 0) { s.state = 'AWAY'; s.progress = 0; } }
      }

      // ---- motor current ----
      const sweeping = s.state === 'AWAY' || s.state === 'HOME';
      const base = sweeping ? 4.2 + 0.6 * Math.sin(t * 9) : 0.4;
      s.motor += (base - s.motor) * (s.motor > 8 ? 0.25 : 0.35);

      // ---- cycles/min ----
      cycleTimesRef.current = cycleTimesRef.current.filter((ct) => t - ct <= 60);
      s.cyclesPerMin = cycleTimesRef.current.length;

      setSim({ ...s, events: [...s.events] });
    }, 50);
    return () => window.clearInterval(iv);
  }, []);

  const applyPreset = (key: string) => {
    const p = PRESETS[key];
    setInputs((prev) => ({ ...prev, ...p, gear: p.gear ?? prev.gear }));
    prevGearRef.current = p.gear ?? 'D';
    if (p.rearTrigger) rearRef.current = true;
  };

  // droplet field (fixed positions, opacity driven by rain)
  const droplets = useMemo(() => {
    const pts: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 150; i++) {
      pts.push({
        x: 75 + Math.random() * 250,
        y: 85 + Math.random() * 145,
        r: 1.2 + Math.random() * 2.2,
      });
    }
    return pts;
  }, []);

  const wiperAngle = -78 + sim.progress * 112;
  const stateLabel = sim.state === 'IDLE'
    ? translations['St IDLE'][currentLang]
    : sim.state === 'HOLD'
      ? translations['St HOLD'][currentLang]
      : translations['St SWEEP'][currentLang];

  const t = translations;
  const L = (k: string) => t[k][currentLang];

  return (
    <section id="wiper-simulator" className="py-20 bg-[#1c2321] border-t border-[#313f3c]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-[#2c3a35] rounded-xl border border-[#3d4f48]">
            <CloudRain className="w-7 h-7 text-[#8fbf9f]" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-stone-100">{L('Wiper Simulator Title')}</h2>
            <p className="text-[#9bb09e] mt-1 max-w-3xl">{L('Wiper Simulator Subtitle')}</p>
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.keys(PRESETS).map((key) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className="px-3 py-1.5 rounded-lg bg-[#2c3a35] border border-[#3d4f48] text-xs font-semibold text-[#9bb09e] hover:text-stone-100 hover:border-[#8fbf9f]/50 transition-colors"
            >
              {L(`Preset ${key}`)}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_1.35fr_1fr] gap-4">
          {/* ---------------- INPUT PANEL ---------------- */}
          <div className="bg-[#222b28] rounded-2xl border border-[#313f3c] p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#a9d4b8]">
              <Play className="w-4 h-4" /> {L('Wiper Inputs')}
            </div>

            {/* rain level */}
            <div>
              <div className="flex items-center gap-2 text-xs text-[#9bb09e] mb-1.5">
                <CloudRain className="w-4 h-4 text-[#8fbf9f]" /> {L('Wiper Rain Level')}
                <span className="ml-auto font-mono text-stone-100">{sim.rain.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(RAIN_TARGET) as RainLevel[]).map((lv) => (
                  <button
                    key={lv}
                    onClick={() => setInputs((p) => ({ ...p, level: lv }))}
                    className={`px-1.5 py-1 rounded text-[11px] ${inputs.level === lv ? 'bg-[#8fbf9f] text-[#1c2321] font-bold' : 'bg-[#2c3a35] text-[#9bb09e]'}`}
                  >
                    {L(`Lvl ${lv}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* pattern */}
            <div>
              <div className="flex items-center gap-2 text-xs text-[#9bb09e] mb-1.5">
                <RotateCw className="w-4 h-4 text-[#8fbf9f]" /> {L('Wiper Pattern')}
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['constant', 'gusting', 'intermittent'] as Pattern[]).map((pv) => (
                  <button
                    key={pv}
                    onClick={() => setInputs((p) => ({ ...p, pattern: pv }))}
                    className={`px-1.5 py-1 rounded text-[11px] ${inputs.pattern === pv ? 'bg-[#8fbf9f] text-[#1c2321] font-bold' : 'bg-[#2c3a35] text-[#9bb09e]'}`}
                  >
                    {L(`Pat ${pv}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* speed */}
            <div>
              <div className="flex items-center gap-2 text-xs text-[#9bb09e] mb-1.5">
                <Gauge className="w-4 h-4 text-[#8fbf9f]" /> {L('Wiper Speed')}
                <span className="ml-auto font-mono text-stone-100">{inputs.speed} km/h</span>
              </div>
              <input
                type="range" min={0} max={220} value={inputs.speed}
                onChange={(e) => setInputs((p) => ({ ...p, speed: Number(e.target.value) }))}
                className="w-full accent-[#8fbf9f]"
              />
            </div>

            {/* temperature */}
            <div>
              <div className="flex items-center gap-2 text-xs text-[#9bb09e] mb-1.5">
                <Thermometer className={`w-4 h-4 ${inputs.temp < 0 ? 'text-[#7fb3d5]' : 'text-[#8fbf9f]'}`} /> {L('Wiper Temp')}
                <span className={`ml-auto font-mono ${inputs.temp < 0 ? 'text-[#7fb3d5]' : 'text-stone-100'}`}>{inputs.temp} ℃</span>
              </div>
              <input
                type="range" min={-20} max={50} value={inputs.temp}
                onChange={(e) => setInputs((p) => ({ ...p, temp: Number(e.target.value) }))}
                className="w-full accent-[#8fbf9f]"
              />
            </div>

            {/* contamination */}
            <div>
              <div className="flex items-center gap-2 text-xs text-[#9bb09e] mb-1.5">
                <Droplets className="w-4 h-4 text-[#8fbf9f]" /> {L('Wiper Contam')}
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['clean', 'dusty', 'oily'] as Contam[]).map((cv) => (
                  <button
                    key={cv}
                    onClick={() => setInputs((p) => ({ ...p, contam: cv }))}
                    className={`px-1.5 py-1 rounded text-[11px] ${inputs.contam === cv ? 'bg-[#8fbf9f] text-[#1c2321] font-bold' : 'bg-[#2c3a35] text-[#9bb09e]'}`}
                  >
                    {L(`Ct ${cv}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* day / night */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2 text-xs text-[#9bb09e]">
                {inputs.night ? <Moon className="w-4 h-4 text-[#8fbf9f]" /> : <Sun className="w-4 h-4 text-[#d9b36a]" />}
                {L('Wiper Light')}
              </span>
              <div className="ml-auto flex gap-1">
                <button
                  onClick={() => setInputs((p) => ({ ...p, night: false }))}
                  className={`px-2 py-1 rounded text-[11px] ${!inputs.night ? 'bg-[#8fbf9f] text-[#1c2321] font-bold' : 'bg-[#2c3a35] text-[#9bb09e]'}`}
                >{L('Day')}</button>
                <button
                  onClick={() => setInputs((p) => ({ ...p, night: true }))}
                  className={`px-2 py-1 rounded text-[11px] ${inputs.night ? 'bg-[#8fbf9f] text-[#1c2321] font-bold' : 'bg-[#2c3a35] text-[#9bb09e]'}`}
                >{L('Night')}</button>
              </div>
            </div>

            <div className="border-t border-[#313f3c]" />

            {/* lever */}
            <div>
              <div className="flex items-center gap-2 text-xs text-[#9bb09e] mb-1.5">
                <SlidersHorizontal className="w-4 h-4 text-[#8fbf9f]" /> {L('Wiper Lever')}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(['OFF', 'INT', 'LO', 'HI'] as Lever[]).map((lv) => (
                  <button
                    key={lv}
                    onClick={() => setInputs((p) => ({ ...p, lever: lv }))}
                    className={`px-1.5 py-1.5 rounded text-[11px] font-mono ${inputs.lever === lv ? 'bg-[#8fbf9f] text-[#1c2321] font-bold' : 'bg-[#2c3a35] text-[#9bb09e]'}`}
                  >
                    {lv}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { mistRef.current = true; }}
                className="mt-1 w-full px-2 py-1 rounded text-[11px] bg-[#2c3a35] border border-[#3d4f48] text-[#9bb09e] hover:text-stone-100"
              >
                MIST (1 cycle)
              </button>
            </div>

            {/* sensitivity */}
            <div>
              <div className="flex items-center gap-2 text-xs text-[#9bb09e] mb-1.5">
                <SlidersHorizontal className="w-4 h-4 text-[#8fbf9f]" /> {L('Wiper Sens')}
                <span className="ml-auto font-mono text-stone-100">{inputs.sens}</span>
              </div>
              <input
                type="range" min={1} max={10} value={inputs.sens}
                onChange={(e) => setInputs((p) => ({ ...p, sens: Number(e.target.value) }))}
                className="w-full accent-[#8fbf9f]"
              />
            </div>

            {/* toggles: auto / gear / defrost / washer */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setInputs((p) => ({ ...p, auto: !p.auto }))}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] ${inputs.auto ? 'bg-[#8fbf9f] text-[#1c2321] font-bold' : 'bg-[#2c3a35] text-[#9bb09e]'}`}
              >
                <CloudRain className="w-3.5 h-3.5" /> AUTO {inputs.auto ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setInputs((p) => ({ ...p, gear: p.gear === 'D' ? 'R' : 'D' }))}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] ${inputs.gear === 'R' ? 'bg-[#d9b36a] text-[#1c2321] font-bold' : 'bg-[#2c3a35] text-[#9bb09e]'}`}
              >
                <Repeat className="w-3.5 h-3.5" /> {L('Wiper Gear')}: {inputs.gear}
              </button>
              <button
                onClick={() => setInputs((p) => ({ ...p, defrost: !p.defrost }))}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] ${inputs.defrost ? 'bg-[#7fb3d5] text-[#1c2321] font-bold' : 'bg-[#2c3a35] text-[#9bb09e]'}`}
              >
                <Wind className="w-3.5 h-3.5" /> {L('Wiper Defrost')} {inputs.defrost ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => { washerRef.current = true; }}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] bg-[#2c3a35] border border-[#3d4f48] text-[#9bb09e] hover:text-stone-100"
              >
                <SprayCan className="w-3.5 h-3.5" /> {L('Wiper Washer')}
              </button>
            </div>
          </div>

          {/* ---------------- CENTER: CAR SVG ---------------- */}
          <div className="bg-[#222b28] rounded-2xl border border-[#313f3c] p-4 flex flex-col">
            <svg viewBox="0 0 400 300" className="w-full">
              {/* sky / night */}
              <rect x="0" y="0" width="400" height="300" rx="16" fill={inputs.night ? '#141b18' : '#1b2622'} />
              {inputs.night && (
                <>
                  <circle cx="350" cy="35" r="14" fill="#d9b36a" opacity="0.5" />
                  <circle cx="60" cy="30" r="1.5" fill="#c4e0cc" opacity="0.6" />
                  <circle cx="120" cy="45" r="1" fill="#c4e0cc" opacity="0.5" />
                  <circle cx="220" cy="25" r="1.2" fill="#c4e0cc" opacity="0.5" />
                </>
              )}
              {/* car body */}
              <path d="M 30 250 Q 30 235 50 232 L 350 232 Q 370 235 370 250 L 370 285 Q 370 292 362 292 L 38 292 Q 30 292 30 285 Z" fill="#2c3a35" stroke="#3d4f48" strokeWidth="2" />
              {/* windshield */}
              <polygon points="70,75 330,75 362,232 38,232" fill={inputs.night ? '#182420' : '#20302c'} stroke="#4a5f57" strokeWidth="2.5" />
              {/* rain streaks on glass */}
              {droplets.map((d, i) => {
                const op = Math.max(0, Math.min(0.85, sim.rain * 1.8 - (i / droplets.length) * 1.3));
                if (op <= 0.02) return null;
                return <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#7fb3d5" opacity={op} />;
              })}
              {/* wiper arms */}
              {[150, 262].map((px) => (
                <g key={px} transform={`rotate(${wiperAngle} ${px} 228)`}>
                  <line x1={px} y1={228} x2={px} y2={118} stroke="#c4e0cc" strokeWidth="3.5" strokeLinecap="round" />
                  <line x1={px - 14} y1={122} x2={px + 14} y2={114} stroke="#e6f2ea" strokeWidth="5" strokeLinecap="round" />
                </g>
              ))}
              <circle cx="150" cy="228" r="5" fill="#4a5f57" />
              <circle cx="262" cy="228" r="5" fill="#4a5f57" />
              {/* washer spray */}
              {sim.washer > 0 && (
                <g opacity="0.85">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <circle key={i} cx={120 + i * 40} cy={238 - i * 4} r={2.5} fill="#7fb3d5" />
                  ))}
                </g>
              )}
              {/* hood nozzles */}
              <rect x="110" y="236" width="180" height="4" rx="2" fill="#3d4f48" />
            </svg>

            {/* rain sensor gauge */}
            <div className="mt-4">
              <div className="flex items-center gap-2 text-xs text-[#9bb09e] mb-1">
                <CloudRain className="w-3.5 h-3.5 text-[#8fbf9f]" /> {L('Out Sensor')}
                <span className="ml-auto font-mono text-stone-100">{sim.sensor.toFixed(2)}</span>
              </div>
              <div className="relative h-3 rounded-full bg-[#2c3a35] overflow-hidden">
                <div className="h-full rounded-full bg-[#7fb3d5]" style={{ width: `${sim.sensor * 100}%` }} />
                <div className="absolute top-0 bottom-0 w-px bg-[#c97b6b]" style={{ left: `${STOP_TH * 100}%` }} />
                <div className="absolute top-0 bottom-0 w-px bg-[#d9b36a]" style={{ left: `${START_TH * 100}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-[#6f8377] mt-0.5 font-mono">
                <span>0</span>
                <span>stop {STOP_TH}</span>
                <span>start {START_TH}</span>
                <span>1.0</span>
              </div>
            </div>

            {/* interval prediction ring */}
            <div className="mt-4 flex items-center gap-4">
              <div className="w-24 h-24 relative flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#313f3c" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42" fill="none" stroke="#8fbf9f" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${Math.min(1, sim.interval / 60) * 264} 264`}
                  />
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-bold text-stone-100 text-sm">{sim.interval > 0 ? sim.interval.toFixed(1) : '—'}</span>
                  <span className="text-[9px] text-[#6f8377]">sec</span>
                </span>
              </div>
              <div className="text-xs text-[#9bb09e] leading-relaxed">
                <Timer className="inline w-3.5 h-3.5 mr-1 text-[#8fbf9f]" />
                {L('Out Interval')} — f(rain, speed)
                <div className="mt-1 font-mono text-[11px] text-stone-200">
                  speed {inputs.speed} km/h → factor {inputs.speed <= 40 ? '1.00' : inputs.speed >= 100 ? '0.35' : (1 - ((inputs.speed - 40) / 60) * 0.65).toFixed(2)}
                </div>
                {inputs.night && sim.sensor > 0.6 && (
                  <div className="mt-0.5 text-[#d9b36a]">night glare compensation −30%</div>
                )}
              </div>
            </div>
          </div>

          {/* ---------------- OUTPUT PANEL ---------------- */}
          <div className="bg-[#222b28] rounded-2xl border border-[#313f3c] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#a9d4b8]">
              <Zap className="w-4 h-4" /> {L('Wiper Outputs')}
            </div>

            {/* wiper state */}
            <div className="flex items-center gap-2 rounded-lg bg-[#2c3a35] px-3 py-2">
              <RotateCw className={`w-4 h-4 ${sim.state === 'AWAY' || sim.state === 'HOME' ? 'text-[#8fbf9f] animate-spin' : 'text-[#6f8377]'}`} style={{ animationDuration: '2s' }} />
              <span className="text-xs text-[#9bb09e]">{L('Out State')}</span>
              <span className="ml-auto font-mono text-sm text-stone-100">{stateLabel}</span>
            </div>

            {/* cycle rate */}
            <div className="flex items-center gap-2 rounded-lg bg-[#2c3a35] px-3 py-2">
              <Timer className="w-4 h-4 text-[#8fbf9f]" />
              <span className="text-xs text-[#9bb09e]">{L('Out Rate')}</span>
              <span className="ml-auto font-mono text-sm text-stone-100">{sim.cyclesPerMin}</span>
            </div>

            {/* motor load */}
            <div className="rounded-lg bg-[#2c3a35] px-3 py-2">
              <div className="flex items-center gap-2 mb-1.5">
                <Zap className={`w-4 h-4 ${sim.motor > 8 ? 'text-[#c97b6b]' : 'text-[#8fbf9f]'}`} />
                <span className="text-xs text-[#9bb09e]">{L('Out Motor')}</span>
                <span className={`ml-auto font-mono text-sm ${sim.motor > 8 ? 'text-[#e8b0a0]' : 'text-stone-100'}`}>{sim.motor.toFixed(1)} A</span>
              </div>
              <div className="h-2 rounded-full bg-[#1c2321] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${sim.motor > 8 ? 'bg-[#c97b6b]' : 'bg-[#8fbf9f]'}`}
                  style={{ width: `${Math.min(100, (sim.motor / 12) * 100)}%` }}
                />
              </div>
            </div>

            {/* freeze / washer / rear indicators */}
            <div className="grid grid-cols-3 gap-2">
              <div className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 ${sim.freeze ? 'bg-[#7fb3d5]/20 border border-[#7fb3d5]/50' : 'bg-[#2c3a35]'}`}>
                <Snowflake className={`w-4 h-4 ${sim.freeze ? 'text-[#7fb3d5] animate-pulse' : 'text-[#6f8377]'}`} />
                <span className="text-[10px] text-[#9bb09e]">{L('Out Freeze')}</span>
              </div>
              <div className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 ${sim.washer > 0 ? 'bg-[#7fb3d5]/20 border border-[#7fb3d5]/50' : 'bg-[#2c3a35]'}`}>
                <SprayCan className={`w-4 h-4 ${sim.washer > 0 ? 'text-[#7fb3d5]' : 'text-[#6f8377]'}`} />
                <span className="text-[10px] text-[#9bb09e]">washer</span>
              </div>
              <div className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 ${sim.rear >= 0 ? 'bg-[#d9b36a]/20 border border-[#d9b36a]/50' : 'bg-[#2c3a35]'}`}>
                <Repeat className={`w-4 h-4 ${sim.rear >= 0 ? 'text-[#d9b36a] animate-spin' : 'text-[#6f8377]'}`} style={{ animationDuration: '1.5s' }} />
                <span className="text-[10px] text-[#9bb09e]">{L('Out Rear')}</span>
              </div>
            </div>

            {/* AUTO state */}
            <div className="flex items-center gap-2 rounded-lg bg-[#2c3a35] px-3 py-2">
              <CloudRain className={`w-4 h-4 ${sim.autoOn ? 'text-[#8fbf9f]' : 'text-[#6f8377]'}`} />
              <span className="text-xs text-[#9bb09e]">RAIN-AUTO</span>
              <span className={`ml-auto font-mono text-sm ${sim.autoOn ? 'text-[#a9d4b8]' : 'text-[#6f8377]'}`}>{sim.autoOn ? 'ACTIVE' : '—'}</span>
            </div>

            {/* events */}
            <div>
              <div className="flex items-center gap-2 text-xs text-[#9bb09e] mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#d9b36a]" /> {L('Out Events')}
              </div>
              <div className="space-y-1.5 min-h-[110px]">
                {sim.events.length === 0 && (
                  <div className="text-[11px] text-[#6f8377]">—</div>
                )}
                {sim.events.map((ev) => {
                  const Icon = EVENT_ICON[ev.icon];
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2 rounded-lg bg-[#2c3a35] px-2.5 py-1.5"
                    >
                      <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${ev.icon === 'stall' || ev.icon === 'false' ? 'text-[#c97b6b]' : ev.icon === 'freeze' ? 'text-[#7fb3d5]' : ev.icon === 'resume' ? 'text-[#8fbf9f]' : 'text-[#d9b36a]'}`} />
                      <div className="text-[11px] text-stone-200 leading-snug">
                        {L(EVENT_KEY[ev.icon])}
                        <span className="ml-1.5 font-mono text-[10px] text-[#6f8377]">{ev.at}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-[#6f8377]">{L('Wiper Disclaimer')}</p>
      </div>
    </section>
  );
}
