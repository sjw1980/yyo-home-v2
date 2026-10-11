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
  | 'tilt_legrest'
  | 'cushion_bolster'
  | 'recline_height'
  | 'lumber'
  | 'slide'
  | 'relaxation_return';

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
  /** 좌우(L/R) 조작 축 */
  lrAxis: AxisKey;
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
    desc: { ko: '종아리 받침대 각도를 상/하로 조절합니다.', en: 'Raises or lowers the calf support.' },
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
    desc: { ko: '사이드 볼스터 밀착 정도를 조절합니다.', en: 'Inflates the side bolster support.' },
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
    name: { ko: '릴렉스 & 리턴', en: 'Relax / Return' },
    code: 'RLX',
    unit: '%',
    min: 0,
    max: 100,
    softMin: 0,
    softMax: 100,
    speed: 20,
    desc: { ko: '좌: 리턴 조작 / 우: 릴렉션 조작', en: 'Left: Return / Right: Relaxation' },
  },
};


export const MODE_ORDER: ModeKey[] = [
  'tilt_legrest',
  'cushion_bolster',
  'recline_height',
  'lumber',
  'slide',
  'relaxation_return',
];

export const MODE_CONFIG: Record<ModeKey, ModeConfig> = {
  tilt_legrest: {
    key: 'tilt_legrest',
    status: 1,
    name: { ko: '틸트 & 레그레스트', en: 'Tilt & Legrest' },
    subName: 'Tilt / Legrest Control',
    lrAxis: 'legrest',
    udAxis: 'tilt',
    desc: { ko: '상하: 틸트 조작 / 좌우: 레그레스트 조작', en: 'U/D: Tilt / L/R: Legrest' },
  },
  cushion_bolster: {
    key: 'cushion_bolster',
    status: 2,
    name: { ko: '쿠션 & 볼스터', en: 'Cushion & Bolster' },
    subName: 'Cushion / Bolster Control',
    lrAxis: 'bolster',
    udAxis: 'cushion',
    desc: { ko: '상하: 쿠션 조작 / 좌우: 볼스터 조작', en: 'U/D: Cushion / L/R: Bolster' },
  },
  recline_height: {
    key: 'recline_height',
    status: 3,
    name: { ko: '리클라이너 & 하이트', en: 'Recline & Height' },
    subName: 'Recline / Height Control',
    lrAxis: 'recline',
    udAxis: 'height',
    desc: { ko: '좌우: 리클라이너 조작 / 상하: 하이트 조작', en: 'L/R: Recline / U/D: Height' },
  },
  lumber: {
    key: 'lumber',
    status: 4,
    name: { ko: '럼버 서포트', en: 'Lumbar Support' },
    subName: 'Lumbar Support Control',
    lrAxis: 'lumber',
    udAxis: 'lumber_height',
    desc: { ko: '좌우: 럼버 전후 조작 / 상하: 럼버 높이 조작', en: 'L/R: Fore-Aft / U/D: Height' },
  },
  slide: {
    key: 'slide',
    status: 5,
    name: { ko: '슬라이드', en: 'Slide' },
    subName: 'Slide Control',
    lrAxis: 'slide',
    udAxis: null,
    desc: { ko: '좌우: 슬라이드 전후 조작 (상하 조작 없음)', en: 'L/R: Slide travel (no U/D axis)' },
  },
  relaxation_return: {
    key: 'relaxation_return',
    status: 6,
    name: { ko: '릴렉스 & 리턴', en: 'Relax & Return' },
    subName: 'Relax / Return Control',
    lrAxis: 'relaxation_return',
    udAxis: null,
    desc: { ko: '좌: 리턴 조작 / 우: 릴렉션 조작', en: 'Left: Return / Right: Relaxation' },
  },
};

/** 원형 조작기 주변 4-Way 기능 라벨 (circular_button.py MODE_SPEC_LABELS 대응) */
export const MODE_SPEC_LABELS: Record<ModeKey, Record<Direction, LocalizedText | null>> = {
  tilt_legrest: {
    up: { ko: '틸트 올림', en: 'Tilt Up' },
    down: { ko: '틸트 내림', en: 'Tilt Down' },
    left: { ko: '레그레스트 올림', en: 'Legrest Up' },
    right: { ko: '레그레스트 내림', en: 'Legrest Down' },
  },
  cushion_bolster: {
    up: { ko: '쿠션 팽창', en: 'Cushion Inflation' },
    down: { ko: '쿠션 수축', en: 'Cushion Deflation' },
    left: { ko: '볼스터 팽창', en: 'Bolster Inflation' },
    right: { ko: '볼스터 수축', en: 'Bolster Deflation' },
  },
  recline_height: {
    up: { ko: '하이트 상승', en: 'Height Up' },
    down: { ko: '하이트 하강', en: 'Height Down' },
    left: { ko: '리클라이너 전진', en: 'Recline Fwd' },
    right: { ko: '리클라이너 후진', en: 'Recline Back' },
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
  relaxation_return: {
    up: null,
    down: null,
    left: { ko: '릴턴 (원위치)', en: 'Relax Return' },
    right: { ko: '릴렉션 모드', en: 'Relax Mode' },
  },
};

/** 초기 포지션: 각 축 중앙값, 릴렉스 & 리턴만 0%(리턴 상태) */
export const INITIAL_POSITIONS: Record<AxisKey, number> = AXIS_ORDER.reduce(
  (acc, key) => {
    const conf = AXIS_CONFIG[key];
    acc[key] = key === 'relaxation_return' ? 0 : (conf.min + conf.max) / 2;
    return acc;
  },
  {} as Record<AxisKey, number>,
);

/** 리턴(기본 드라이빙) 포즈 — 릴렉스 & 리턴 0% */
export const RETURN_POSE: Record<AxisKey, number> = {
  slide: 150,
  recline: 12,
  height: 50,
  tilt: 7.5,
  legrest: 0,
  cushion: 30,
  bolster: 24,
  lumber: 25,
  lumber_height: 25,
  relaxation_return: 0,
};

/** 릴렉션(풀 릴렉스) 포즈 — 릴렉스 & 리턴 100% */
export const RELAX_POSE: Record<AxisKey, number> = {
  slide: 215,
  recline: 48,
  height: 38,
  tilt: 4,
  legrest: 38,
  cushion: 52,
  bolster: 12,
  lumber: 30,
  lumber_height: 18,
  relaxation_return: 100,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio;
}

/** 릴렉스 비율(0~1)에 따른 파생 축 목표 포즈 (릴렉스 & 리턴 모드 전용) */
export function relaxPoseAt(ratio: number): Partial<Record<AxisKey, number>> {
  const r = clamp(ratio, 0, 1);
  const derived: AxisKey[] = ['slide', 'recline', 'height', 'tilt', 'legrest', 'cushion', 'bolster'];
  const pose: Partial<Record<AxisKey, number>> = {};
  derived.forEach((key) => {
    pose[key] = lerp(RETURN_POSE[key], RELAX_POSE[key], r);
  });
  return pose;
}

/** 조작 방향 → 대상 축 매핑 (기존 기능 = 좌우, 병합 기능 = 상하) */
export function axisForDirection(modeKey: ModeKey, direction: Direction): AxisKey | null {
  const conf = MODE_CONFIG[modeKey];
  if (!conf) return null;
  if (direction === 'up' || direction === 'down') return conf.udAxis;
  return conf.lrAxis;
}

/**
 * 좌우(L/R) 조작 시 수치 부호 규칙 (seat_main._execute_direction_step 대응)
 *  - legrest / bolster 는 좌(L) 조작 시 수치 증가
 *  - 그 외 축은 좌(L) = 감소, 우(R) = 증가
 */
export function lrSign(axisKey: AxisKey, direction: Direction): number {
  if (direction === 'left') return axisKey === 'legrest' || axisKey === 'bolster' ? 1 : -1;
  if (direction === 'right') return axisKey === 'legrest' || axisKey === 'bolster' ? -1 : 1;
  if (direction === 'up') return 1;
  return -1;
}

/** 모드 회전 (원형 조작기 외곽 CW/CCW) */
export function rotateMode(modeKey: ModeKey, step: number): ModeKey {
  const idx = MODE_ORDER.indexOf(modeKey);
  const next = (idx + step + MODE_ORDER.length) % MODE_ORDER.length;
  return MODE_ORDER[next];
}

