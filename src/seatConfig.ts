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


export const MODE_ORDER: ModeKey[] = [
  'tilt',
  'legrest',
  'cushion',
  'bolster',
  'recline',
  'height',
  'lumber',
  'slide',
  'relaxation',
];

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
    lrAxis: 'legrest',
    udAxis: null,
    desc: { ko: '좌우: 종아리 받침대 각도 조작', en: 'L/R: calf support angle' },
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
    desc: { ko: '좌우: 럼버 전후 / 상하: 럼버 높이 (4-Way)', en: 'L/R: fore-aft / U/D: height (4-Way)' },
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
    desc: { ko: 'On: 릴렉션 포즈 적용 / Off: 직전 값 복귀', en: 'On: apply relax pose / Off: restore' },
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
    up: null,
    down: null,
    left: { ko: '레그레스트 올림', en: 'Legrest Up' },
    right: { ko: '레그레스트 내림', en: 'Legrest Down' },
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
    left: { ko: '럼버 전후', en: 'Lumbar Middle' },
    right: { ko: '럼버 수축', en: 'Lumbar Deflation' },
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

export interface RelaxPresetResult {
  /** 갱신할 축 목표값 */
  targets: Partial<Record<AxisKey, number>>;
  /** Off 시 복원할 스냅샷 (Off 이후면 null) */
  snapshot: Partial<Record<AxisKey, number>> | null;
}

/**
 * 릴렉스 On/Off 프리셋 계산 (순수 함수)
 *  On  : 현재 값 스냅샷 저장(처음 On 일 때만) + RELAX_ON_TARGETS 목표 / 릴렉스 100%
 *  Off : 스냅샷 값으로 복귀(스냅샷 없으면 초기값) / 릴렉스 0%
 */
export function relaxPreset(
  positions: Record<AxisKey, number>,
  snapshot: Partial<Record<AxisKey, number>> | null,
  on: boolean,
): RelaxPresetResult {
  const relaxConf = AXIS_CONFIG.relaxation_return;
  const targets: Partial<Record<AxisKey, number>> = {
    relaxation_return: on ? relaxConf.max : relaxConf.min,
  };

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

/** 좌(L) 조작에 수치가 증가하는 축 — 레그레스트 올림 / 볼스터 조임 / 쿠션 신장(도해의 FWD = 좌) */
const LEFT_INCREASE_AXES: AxisKey[] = ['legrest', 'bolster', 'cushion'];

/**
 * 방향 조작 시 수치 부호 규칙 (seat_main._execute_direction_step 대응)
 *  - legrest / bolster / cushion 은 좌(L) 조작 시 수치 증가
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

