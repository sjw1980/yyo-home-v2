/**
 * seatConfig.ts — DPSS(Driver Position Setting System) 전동 시트 시뮬레이터 정의
 *
 * D:\Works\power_seat_simulation\seat_simulator\seat_main.py 의
 *  AXIS_CONFIG / MODE_CONFIG / MODE_SPEC_LABELS 를 React 웹용으로 이식한 모듈입니다.
 *  (가동 범위·소프트 리밋·모터 속도[unit/s] 등 물리 상수는 데스크톱 앱과 동일)
 */

export type AxisKey =
  | 'slide'
  | 'recline'
  | 'height'
  | 'tilt'
  | 'legrest'
  | 'cushion'
  | 'bolster'
  | 'lumber'
  | 'lumber_height'
  | 'relaxation_return';

export type ModeKey =
  | 'tilt'
  | 'legrest'
  | 'cushion'
  | 'bolster'
  | 'recline'
  | 'height'
  | 'lumber'
  | 'slide'
  | 'relaxation';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface LocalizedText {
  ko: string;
  en: string;
}

export interface AxisConfig {
  key: AxisKey;
  name: LocalizedText;
  /** DBC 축 식별자 (로그 표기용) */
  code: string;
  unit: string;
  min: number;
  max: number;
  softMin: number;
  softMax: number;
  /** 모터 속도 (unit / s) */
  speed: number;
  desc: LocalizedText;
}

export interface ModeConfig {
  key: ModeKey;
  /** DPSS_Mode_status 값 (0x15A) */
  status: number;
  name: LocalizedText;
  subName: string;
  /** 좌우(L/R) 조작 축 (상하 전용 모드는 null) */
  lrAxis: AxisKey | null;
  /** 상하(U/D) 조작 축 (없으면 null) */
  udAxis: AxisKey | null;
  desc: LocalizedText;
}

export const AXIS_ORDER: AxisKey[] = [
  'slide',
  'recline',
  'height',
  'tilt',
  'legrest',
  'cushion',
  'bolster',
  'lumber',
  'lumber_height',
  'relaxation_return',
];

export const AXIS_CONFIG: Record<AxisKey, AxisConfig> = {
  slide: {
    key: 'slide',
    name: { ko: '슬라이드', en: 'Slide' },
    code: 'SLD',
    unit: 'mm',
    min: 0,
    max: 300,
    softMin: 20,
    softMax: 280,
    speed: 40,
    desc: { ko: '시트 전체를 전/후로 이동시킵니다.', en: 'Travels the whole seat forward / backward.' },
  },
  recline: {
    key: 'recline',
    name: { ko: '리클라이너', en: 'Recline' },
    code: 'RCL',
    unit: '°',
    min: 0,
    max: 60,
    softMin: 5,
    softMax: 55,
    speed: 10,
    desc: { ko: '등받이 각도를 전/후로 조절합니다.', en: 'Tilts the seat back forward / backward.' },
  },
  height: {
    key: 'height',
    name: { ko: '하이트', en: 'Height' },
    code: 'HGT',
    unit: 'mm',
    min: 0,
    max: 100,
    softMin: 10,
    softMax: 90,
    speed: 15,
    desc: { ko: '시트 전체 높이를 상/하로 조절합니다.', en: 'Raises or lowers the whole seat.' },
  },
  tilt: {
    key: 'tilt',
    name: { ko: '틸트', en: 'Tilt' },
    code: 'TLT',
    unit: '°',
    min: 0,
    max: 15,
    softMin: 2,
    softMax: 13,
    speed: 3,
    desc: { ko: '쿠션 앞단의 경사각을 상/하로 조절합니다.', en: 'Angles the front of the seat cushion.' },
  },
  legrest: {
    key: 'legrest',
    name: { ko: '레그레스트', en: 'Legrest' },
    code: 'LEG',
    unit: '°',
    min: 0,
    max: 45,
    softMin: 4,
    softMax: 41,
    speed: 8,
    desc: {
      ko: '종아리 받침대를 회전시킵니다. 0° = 시트에 수직으로 아래를 향함, 최대 = 수평 전개.',
      en: 'Rotates the calf support. 0° = folded straight down (90° to the seat), max = horizontal.',
    },
  },
  cushion: {
    key: 'cushion',
    name: { ko: '쿠션', en: 'Cushion' },
    code: 'CSH',
    unit: 'mm',
    min: 0,
    max: 60,
    softMin: 5,
    softMax: 55,
    speed: 15,
    desc: { ko: '시트 쿠션 익스텐션 길이를 조절합니다.', en: 'Extends the seat cushion length.' },
  },
  bolster: {
    key: 'bolster',
    name: { ko: '볼스터', en: 'Bolster' },
    code: 'BLS',
    unit: 'mm',
    min: 0,
    max: 40,
    softMin: 5,
    softMax: 35,
    speed: 10,
    desc: {
      ko: '등받이 좌우 볼스터가 상체를 감싸는 정도를 조절합니다.',
      en: 'Closes the backrest side bolsters around the torso.',
    },
  },
  lumber: {
    key: 'lumber',
    name: { ko: '럼버 전후', en: 'Lumbar Fore/Aft' },
    code: 'LMB',
    unit: 'mm',
    min: 0,
    max: 50,
    softMin: 5,
    softMax: 45,
    speed: 10,
    desc: { ko: '요추 받침대의 돌출/전후 위치를 조절합니다.', en: 'Protrudes the lumbar bladder support.' },
  },
  lumber_height: {
    key: 'lumber_height',
    name: { ko: '럼버 상하', en: 'Lumbar Height' },
    code: 'LMH',
    unit: 'mm',
    min: 0,
    max: 50,
    softMin: 5,
    softMax: 45,
    speed: 10,
    desc: { ko: '요추 받침대의 상/하 높이 위치를 조절합니다.', en: 'Moves the lumbar support up / down.' },
  },
  relaxation_return: {
    key: 'relaxation_return',
    name: { ko: '릴렉스', en: 'Relax' },
    code: 'RLX',
    unit: '%',
    min: 0,
    max: 100,
    softMin: 0,
    softMax: 100,
    speed: 20,
    desc: { ko: '릴렉션 포즈 적용률 (On/Off 프리셋)', en: 'Relax pose ratio (On/Off preset)' },
  },
};


/**
 * 로커(4방향)로 조작하는 드라이브 모드 순서 — 화면 상단 → 하단 = C1 → C8
 *
 * 정렬 근거 (우선순위 순)
 *  1. 흔한 기능이 상위 : 양산 시트의 필수 사양(시트 전체 이동 · 등받이 각도 · 럼버)을 앞에,
 *                       프리미엄 사양(쿠션 신장 · 틸트 · 레그레스트)을 뒤에 둔다.
 *  2. 오래된 기술이 상위 : 같은 군 안에서는 먼저 실용화된 축부터 (slide→height,
 *                       recline→lumber→bolster, cushion→tilt→legrest).
 *  3. 물리적으로 비슷한 기능 근접 : 시트가 움직이는 부위 기준으로 3개 군
 *     ① 시트 전체 이동  C1 슬라이드 · C2 하이트
 *     ② 등받이          C3 리클라이너 · C4 럼버 · C5 볼스터
 *     ③ 방석 전방       C6 쿠션 신장 · C7 틸트 · C8 레그레스트
 *
 * 릴렉스는 다른 모드와 동일 선상에 놓지 않는다.
 * 특정 축을 조작하는 모드가 아니라, 직전 포즈를 스냅샷으로 두고 6축에 한꺼번에
 * 겹쳐지는 **독립 프리셋 레이어** 이므로 MODE_ORDER 에서 제외하고
 * RELAX_PRESET_KEY 로 따로 다룬다.
 */
export const MODE_ORDER: ModeKey[] = [
  'slide', // C1  시트 전체 전/후
  'height', // C2  시트 전체 상/하
  'recline', // C3  등받이 각도
  'lumber', // C4  등받이 안쪽 럼버 (전후 + 상하)
  'bolster', // C5  등받이 좌우 윙
  'cushion', // C6  방석 전방 신장
  'tilt', // C7  방석 앞단 경사
  'legrest', // C8  방석에서 전개되는 종아리 받침
];

/**
 * 화면 표시용 조작 코드 (C1~C8)
 * — 배열 순서가 그대로 코드 번호가 된다. `MODE_CONFIG[].status` 는 DPSS 신호값(0x15A)이라
 *    표시 코드와 일부러 분리했다 (프로토콜 값은 순서와 무관하게 고정).
 */
export function modeCode(modeKey: ModeKey): string {
  const idx = MODE_ORDER.indexOf(modeKey);
  return idx >= 0 ? `C${idx + 1}` : 'C—';
}

/** 릴렉스 프리셋 레이어 키 (DPSS Mode 09) — 모드 트랙이 아닌 프리셋 패널에서 조작한다 */
export const RELAX_PRESET_KEY: ModeKey = 'relaxation';

export const MODE_CONFIG: Record<ModeKey, ModeConfig> = {
  tilt: {
    key: 'tilt',
    status: 1,
    name: { ko: '틸트', en: 'Tilt' },
    subName: 'Cushion Tilt Control',
    lrAxis: null,
    udAxis: 'tilt',
    desc: { ko: '상하: 쿠션 경사각 조작', en: 'U/D: cushion angle' },
  },
  legrest: {
    key: 'legrest',
    status: 2,
    name: { ko: '레그레스트', en: 'Legrest' },
    subName: 'Legrest Control',
    lrAxis: null,
    udAxis: 'legrest',
    desc: { ko: '상하: 종아리 받침대 각도 조작', en: 'U/D: calf support angle' },
  },
  cushion: {
    key: 'cushion',
    status: 3,
    name: { ko: '쿠션 익스텐션', en: 'Cushion Extension' },
    subName: 'Cushion Extension Control',
    lrAxis: 'cushion',
    udAxis: null,
    desc: { ko: '좌우: 쿠션 신장/수축', en: 'L/R: cushion extend / retract' },
  },
  bolster: {
    key: 'bolster',
    status: 4,
    name: { ko: '볼스터', en: 'Bolster' },
    subName: 'Backrest Side Bolster',
    lrAxis: 'bolster',
    udAxis: null,
    desc: { ko: '좌우: 등받이 볼스터 조임/풀림', en: 'L/R: backrest bolster grip' },
  },
  recline: {
    key: 'recline',
    status: 5,
    name: { ko: '리클라이너', en: 'Recline' },
    subName: 'Seat Back Recline',
    lrAxis: 'recline',
    udAxis: null,
    desc: { ko: '좌우: 등받이 각도 조작', en: 'L/R: seat back angle' },
  },
  height: {
    key: 'height',
    status: 6,
    name: { ko: '하이트', en: 'Height' },
    subName: 'Seat Height Control',
    lrAxis: null,
    udAxis: 'height',
    desc: { ko: '상하: 시트 높이 조작', en: 'U/D: seat height' },
  },
  lumber: {
    key: 'lumber',
    status: 7,
    name: { ko: '럼버 서포트', en: 'Lumbar Support' },
    subName: 'Lumbar Support Control',
    lrAxis: 'lumber',
    udAxis: 'lumber_height',
    desc: {
      ko: '좌우: 럼버 전진/후진 / 상하: 럼버 높이 (4-Way)',
      en: 'L/R: fore-aft / U/D: height (4-Way)',
    },
  },
  slide: {
    key: 'slide',
    status: 8,
    name: { ko: '슬라이드', en: 'Slide' },
    subName: 'Slide Control',
    lrAxis: 'slide',
    udAxis: null,
    desc: { ko: '좌우: 시트 전후 이동 조작', en: 'L/R: seat travel' },
  },
  relaxation: {
    key: 'relaxation',
    status: 9,
    name: { ko: '릴렉스', en: 'Relax' },
    subName: 'Relaxation Preset',
    lrAxis: 'relaxation_return',
    udAxis: null,
    desc: {
      ko: '드라이브 모드가 아닌 독립 프리셋 레이어 — On: 릴렉션 포즈 / Off: 스냅샷 복귀',
      en: 'Standalone preset layer (not a drive mode) — On: relax pose / Off: restore snapshot',
    },
  },
};

/** 모드 카드 안 방향 버튼 라벨 (null = 해당 방향 조작 없음) */
export const MODE_SPEC_LABELS: Record<ModeKey, Record<Direction, LocalizedText | null>> = {
  tilt: {
    up: { ko: '틸트 상승', en: 'Tilt Up' },
    down: { ko: '틸트 하강', en: 'Tilt Down' },
    left: null,
    right: null,
  },
  legrest: {
    up: { ko: '레그레스트 올림', en: 'Legrest Up' },
    down: { ko: '레그레스트 내림', en: 'Legrest Down' },
    left: null,
    right: null,
  },
  cushion: {
    up: null,
    down: null,
    left: { ko: '쿠션 신장', en: 'Cushion Extend' },
    right: { ko: '쿠션 수축', en: 'Cushion Retract' },
  },
  bolster: {
    up: null,
    down: null,
    left: { ko: '볼스터 조임', en: 'Bolster Tighten' },
    right: { ko: '볼스터 풀림', en: 'Bolster Release' },
  },
  recline: {
    up: null,
    down: null,
    left: { ko: '등받이 전진', en: 'Recline Fwd' },
    right: { ko: '등받이 후진', en: 'Recline Back' },
  },
  height: {
    up: { ko: '시트 상승', en: 'Height Up' },
    down: { ko: '시트 하강', en: 'Height Down' },
    left: null,
    right: null,
  },
  lumber: {
    up: { ko: '럼버 상단', en: 'Lumbar Upper' },
    down: { ko: '럼버 하단', en: 'Lumbar Lower' },
    left: { ko: '럼버 전진', en: 'Lumbar Forward' },
    right: { ko: '럼버 후진', en: 'Lumbar Backward' },
  },
  slide: {
    up: null,
    down: null,
    left: { ko: '슬라이드 전진', en: 'Slide Forward' },
    right: { ko: '슬라이드 후진', en: 'Slide Backward' },
  },
  relaxation: {
    up: null,
    down: null,
    left: null,
    right: null,
  },
};

/** 초기 포지션: 각 축 중앙값, 릴렉스만 0%(Off 상태) */
export const INITIAL_POSITIONS: Record<AxisKey, number> = AXIS_ORDER.reduce(
  (acc, key) => {
    const conf = AXIS_CONFIG[key];
    acc[key] = key === 'relaxation_return' ? 0 : (conf.min + conf.max) / 2;
    return acc;
  },
  {} as Record<AxisKey, number>,
);

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 릴렉스 On 프리셋 목표값
 *  - 리클라이너 최대 / 틸트 최대 / 레그레스트 최대 / 쿠션 최대 신장
 *  - 슬라이드 · 하이트는 중간 위치
 * Off 는 On 이전 값(스냅샷)으로 복귀합니다.
 */
export const RELAX_ON_TARGETS: Partial<Record<AxisKey, number>> = {
  recline: AXIS_CONFIG.recline.max,
  tilt: AXIS_CONFIG.tilt.max,
  slide: (AXIS_CONFIG.slide.min + AXIS_CONFIG.slide.max) / 2,
  legrest: AXIS_CONFIG.legrest.max,
  cushion: AXIS_CONFIG.cushion.max,
  height: (AXIS_CONFIG.height.min + AXIS_CONFIG.height.max) / 2,
};

/** 릴렉스 On/Off 로 구동되는 축 목록 */
export const RELAX_ON_AXES = Object.keys(RELAX_ON_TARGETS) as AxisKey[];

/**
 * 릴렉스 프리셋 상태 (3상태)
 *  - off     : 해제 (적용률 0% / 스냅샷 없음)
 *  - on      : 릴렉션 포즈 100% 적용 완료
 *  - partial : 100% 도달 전에 중단됨 — ON 도 OFF 도 아닌 중간 상태
 *              (이동 중 모드 전환이나 수동 조작이 들어오면 이 상태로 빠진다)
 */
export type RelaxPhase = 'off' | 'on' | 'partial';

/** 지금 이동 중인 시퀀스의 방향 (정지 중이면 null) */
export type RelaxRun = 'on' | 'off' | null;

export interface RelaxStatus {
  /** 확정된 상태 (이동 중에는 도착 후 확정될 값) */
  phase: RelaxPhase;
  /** 이동 방향 — null 이면 정지 상태 */
  run: RelaxRun;
}

/** 상태 표시 라벨 (chip · 배너 · 링 하단용) */
export const RELAX_STATE_LABEL: Record<RelaxPhase | 'run-on' | 'run-off', LocalizedText> = {
  off: { ko: 'OFF', en: 'OFF' },
  on: { ko: 'ON', en: 'ON' },
  partial: { ko: '부분 적용', en: 'PARTIAL' },
  'run-on': { ko: '적용 중', en: 'APPLYING' },
  'run-off': { ko: '복귀 중', en: 'RESTORING' },
};

/** 이동 중이면 run 을 우선한 표시 상태 키 */
export function relaxStateKey(status: RelaxStatus): RelaxPhase | 'run-on' | 'run-off' {
  if (status.run === 'on') return 'run-on';
  if (status.run === 'off') return 'run-off';
  return status.phase;
}

export interface RelaxPresetResult {
  /** 갱신할 축 목표값 */
  targets: Partial<Record<AxisKey, number>>;
  /** Off 시 복원할 스냅샷 (Off 이후면 null) */
  snapshot: Partial<Record<AxisKey, number>> | null;
}

/**
 * 릴렉스 On/Off 프리셋 계산 (순수 함수)
 *  On  : 현재 값 스냅샷 저장(스냅샷이 없을 때만) + RELAX_ON_TARGETS 목표
 *        — 부분 적용(PARTIAL) 상태에서 다시 On 을 누르면 스냅샷을 유지한 채 100% 까지 재개한다
 *  Off : 스냅샷 값으로 복귀(스냅샷 없으면 초기값)
 *
 * `relaxation_return`(RLX) 은 여기에서 목표를 주지 않는다 — 모터를 돌리는 축이 아니라
 * 6축의 실제 포즈 진행률을 나타내는 **파생 신호** 이므로 시뮬레이션 틱에서
 * relaxApplyRatio() 로 계산해 채운다.
 */
export function relaxPreset(
  positions: Record<AxisKey, number>,
  snapshot: Partial<Record<AxisKey, number>> | null,
  on: boolean,
): RelaxPresetResult {
  const targets: Partial<Record<AxisKey, number>> = {};

  if (on) {
    RELAX_ON_AXES.forEach((k) => {
      const conf = AXIS_CONFIG[k];
      targets[k] = clamp(RELAX_ON_TARGETS[k] as number, conf.min, conf.max);
    });
    if (snapshot) return { targets, snapshot };

    const next: Partial<Record<AxisKey, number>> = {};
    RELAX_ON_AXES.forEach((k) => {
      next[k] = positions[k];
    });
    return { targets, snapshot: next };
  }

  RELAX_ON_AXES.forEach((k) => {
    targets[k] = snapshot?.[k] ?? INITIAL_POSITIONS[k];
  });
  return { targets, snapshot: null };
}

/**
 * 릴렉스 프리셋 적용률 (0~100) — RLX 축 값을 그대로 쓰지 않고 6축의 **실제 포즈** 로 계산한다.
 *
 *  기준선 : OFF 포즈(스냅샷) = 0 → RELAX_ON_TARGETS(릴렉션 포즈) = 100
 *  집계   : 축별 **이동 시간** [|거리| / 모터 속도] 의 **최대값** = 가장 오래 걸리는 축
 *
 * ⚠ 최소값(min) 집계는 방향마다 다른 축을 붙잡아 시간이 어긋난다.
 *    On  : 진행률이 0에서 시작 → 가장 늦게 도착하는 축(리클라이너 3.0s)이 최소 → 3.0s 에 100% ✓
 *    Off : 진행률이 1에서 감소 → 가장 **빨리** 도착하는 축(쿠션 2.0s)이 최소 → 1.0s 먼저 0% ✗
 *    이동 시간을 기준으로 하면 On/Off 모두 전 축이 도착하는 시점에 정확히 100%/0% 가 된다.
 */
export function relaxApplyRatio(
  positions: Record<AxisKey, number>,
  offPose: Partial<Record<AxisKey, number>> | null,
): number {
  if (!offPose) return 0;

  let total = 0; // OFF 포즈 → 릴렉션 포즈 전 구간 중 최장 이동 시간
  let done = 0; // OFF 포즈 → 현재 포즈까지의 최장 이동 시간
  RELAX_ON_AXES.forEach((k) => {
    const speed = AXIS_CONFIG[k].speed;
    if (speed <= 0) return;
    const off = offPose[k] ?? INITIAL_POSITIONS[k];
    const on = RELAX_ON_TARGETS[k] ?? off;
    total = Math.max(total, Math.abs(on - off) / speed);
    done = Math.max(done, Math.abs(positions[k] - off) / speed);
  });

  if (total < 0.05) return 100; // 이동할 축이 없다 = 이미 릴렉션 포즈
  return clamp((done / total) * 100, 0, 100);
}

/** 조작 방향 → 대상 축 매핑 (기존 기능 = 좌우, 병합 기능 = 상하) */
export function axisForDirection(modeKey: ModeKey, direction: Direction): AxisKey | null {
  const conf = MODE_CONFIG[modeKey];
  if (!conf) return null;
  if (direction === 'up' || direction === 'down') return conf.udAxis;
  return conf.lrAxis;
}

/** 모드 대표 축 (표기·AUTO DEMO용 — 좌우 축 우선, 없으면 상하 축) */
export function primaryAxis(modeKey: ModeKey): AxisKey {
  const conf = MODE_CONFIG[modeKey];
  return conf.lrAxis ?? conf.udAxis ?? 'tilt';
}

/** 좌(L) 조작에 수치가 증가하는 축 — 볼스터 조임 / 쿠션 신장 / 럼버 돌출 (도해의 FWD = 좌) */
const LEFT_INCREASE_AXES: AxisKey[] = ['bolster', 'cushion', 'lumber'];

/**
 * 방향 조작 시 수치 부호 규칙 (seat_main._execute_direction_step 대응)
 *  - bolster / cushion / lumber 는 좌(L) 조작 시 수치 증가
 *    (세 축 모두 값이 커지면 화면에서 좌측(FWD)으로 움직이므로 버튼 방향과 시선이 일치한다)
 *  - 그 외 축은 좌(L) = 감소, 우(R) = 증가
 *  - 상하(U/D)는 상(U) = 증가, 하(D) = 감소
 */
export function lrSign(axisKey: AxisKey, direction: Direction): number {
  const leftIsIncrease = LEFT_INCREASE_AXES.includes(axisKey);
  if (direction === 'left') return leftIsIncrease ? 1 : -1;
  if (direction === 'right') return leftIsIncrease ? -1 : 1;
  if (direction === 'up') return 1;
  return -1;
}

/** 모드 회전 (원형 조작기 외곽 CW/CCW) */
export function rotateMode(modeKey: ModeKey, step: number): ModeKey {
  const idx = MODE_ORDER.indexOf(modeKey);
  const next = (idx + step + MODE_ORDER.length) % MODE_ORDER.length;
  return MODE_ORDER[next];
}

/* ============================================================================
 * 포즈 슬롯 (시트 메모리 프리셋)
 *
 * 릴렉스가 "정해진 릴렉션 포즈" 라는 고정 프리셋이라면, 포즈 슬롯은 **사용자가 지금
 * 이 자리에 앉아 만든 포즈** 를 그대로 담는 빈 그릇이다. 그래서 릴렉스 레이어와도
 * 독립적으로 동작한다 (슬롯을 부르면 릴렉스는 부분 적용으로 강등된다).
 * ==========================================================================*/

/** 슬롯에 담는 축 — RLX(relaxation_return) 는 파생 신호라 저장·구동 대상이 아니다 */
export const POSE_AXES: AxisKey[] = AXIS_ORDER.filter((k) => k !== 'relaxation_return');

/** 슬롯 수 (실차 메모리 2계열 대응 — 2개가 손에 가장 잘 붙는다) */
export const POSE_SLOT_COUNT = 2;

/** 브라우저 로컬 저장 키 — 데모이므로 계정 없이 이 기기에만 남는다 */
export const POSE_STORAGE_KEY = 'yyo.seat.pose-slots.v1';

/** 슬롯 하나에 기록된 포즈 (10축 중 구동 축 9개) */
export type SavedPose = Partial<Record<AxisKey, number>>;

/** 현재 포즈를 슬롯 기록용으로 복사 */
export function capturePose(positions: Record<AxisKey, number>): SavedPose {
  const pose: SavedPose = {};
  POSE_AXES.forEach((k) => {
    pose[k] = positions[k];
  });
  return pose;
}

/**
 * 저장해 둔 포즈를 현재 축 스펙에 맞춘다 (손상·구버전 데이터 방어)
 *  - 숫자가 아니거나 범위를 벗어난 값은 하드 리밋으로 클램프
 *  - 빠진 축은 초기값으로 채운다
 */
export function normalizePose(pose: SavedPose | null | undefined): SavedPose | null {
  if (!pose || typeof pose !== 'object') return null;

  const next: SavedPose = {};
  let known = 0;
  POSE_AXES.forEach((k) => {
    const raw = pose[k];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
    const conf = AXIS_CONFIG[k];
    next[k] = clamp(raw, conf.min, conf.max);
    known += 1;
  });

  return known > 0 ? next : null;
}

/** 슬롯 포즈까지의 잔여 이동 시간 (s) — 전 축이 도착하는 시점 = 가장 오래 걸리는 축 */
export function poseEta(pose: SavedPose, positions: Record<AxisKey, number>): number {
  let eta = 0;
  POSE_AXES.forEach((k) => {
    const target = pose[k];
    if (target === undefined) return;
    const diff = Math.abs(target - positions[k]);
    if (diff <= 0.05) return;
    eta = Math.max(eta, diff / AXIS_CONFIG[k].speed);
  });
  return eta;
}

/** 아직 목표에 도달하지 못한 축의 개수 (0 = 현재 포즈가 슬롯과 일치) */
export function poseDrift(pose: SavedPose, positions: Record<AxisKey, number>): number {
  let drift = 0;
  POSE_AXES.forEach((k) => {
    const target = pose[k];
    if (target !== undefined && Math.abs(target - positions[k]) > 0.05) drift += 1;
  });
  return drift;
}


