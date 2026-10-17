import type { AxisKey, LocalizedText } from '../seatConfig';
import { AXIS_CONFIG, clamp } from '../seatConfig';

/**
 * SeatDiagram — 전동 시트 사이드뷰 (Cabin HMI 라인아트)
 * 스타일 기준: mockups/README.md — Cabin HMI 계열 B(릴렉스 시퀀스)
 *  · 현재 포즈 : 화이트 라인 + 조작 중인 축만 앰버(#f0a53c) 글로우
 *  · 타깃 포즈 : 릴렉스 프리셋 이동 중에만 민트(#5fd6a4) 점선 고스트로 겹쳐 표시
 * 형상 계산(슬라이드/하이트/리클라이너/틸트/레그레스트/쿠션/럼버)은 기존 물리 모델과 동일하다.
 * 볼스터는 자동차 시트와 같이 **등받이 좌우(엉덩이~어깨)를 감싸는 사이드 윙**으로 렌더링한다(좌판 아님).
 */

interface SeatDiagramProps {
  positions: Record<AxisKey, number>;
  targets: Record<AxisKey, number>;
  activeAxis: AxisKey | null;
  lang: 'ko' | 'en';
  /** 릴렉스 타깃 고스트 포즈 표시 여부 (이동 중인 축이 있을 때만 true) */
  ghost?: boolean;
  labels?: LocalizedText;
}

const PIVOT_X = 300;
const PAN_Y = 268;

/** 레그레스트 패드 길이(px) — 0°(수직 폴딩)에서 바닥 레일에 닿지 않는 길이 */
const LEGREST_LEN = 70;
/** 축 0° 일 때 레그레스트 화면 회전각: 쿠션(시트)에 대해 90° 아래 = 수직 폴딩 */
const LEGREST_DOWN_DEG = -90;

/* ---- Cabin HMI 팔레트 ---- */
const AMBER = '#f0a53c';
const MINT_DASH = 'rgba(95,214,164,.55)';
const LINE = 'rgba(255,255,255,.58)';
const LINE_SOFT = 'rgba(255,255,255,.34)';
const COND = "'Barlow Condensed', sans-serif";
const SANS = "'Rajdhani', sans-serif";

/** 점 (x,y) 를 (cx,cy) 기준으로 deg 만큼 회전 */
function rotatePoint(x: number, y: number, deg: number, cx: number, cy: number) {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: cx + (x - cx) * c - (y - cy) * s, y: cy + (x - cx) * s + (y - cy) * c };
}

/** 축 값 → 화면 형상 변환 (현재 포즈 / 고스트 포즈에서 공유) */
function geometry(pose: Record<AxisKey, number>) {
  const slidePx = (clamp(pose.slide, 0, 300) / 300) * 110 - 55;
  const heightPx = (clamp(pose.height, 0, 100) / 100) * 46;
  const extPx = (clamp(pose.cushion, 0, 60) / 60) * 46;
  const tiltDeg = clamp(pose.tilt, 0, 15);
  const reclineDeg = clamp(pose.recline, 0, 60);
  /** 볼스터: 등받이 좌우 윙 — 엉덩이~어깨를 값이 클수록 등판 안쪽으로 감싼다 */
  const bolsterPush = (clamp(pose.bolster, 0, 40) / 40) * 20;
  const lumbarPush = (clamp(pose.lumber, 0, 50) / 50) * 11;
  const lumbarY = 214 - (clamp(pose.lumber_height, 0, 50) / 50) * 62;

  const cushionFrontX = PIVOT_X - 118 - extPx;
  const legPivotX = cushionFrontX + 4;
  const legPivotY = PAN_Y + 16;

  /**
   * 레그레스트 회전각
   *  축 0°     : 쿠션 대비 90° 아래 — 아래를 향하는 수직 폴딩 상태
   *  축 max(45): 쿠션과 수평 — 허벅지/종아리 지지 전개 상태
   */
  const legRot =
    LEGREST_DOWN_DEG + (clamp(pose.legrest, 0, 45) / AXIS_CONFIG.legrest.max) * -LEGREST_DOWN_DEG;

  return {
    slidePx,
    heightPx,
    extPx,
    tiltDeg,
    reclineDeg,
    bolsterPush,
    lumbarPush,
    lumbarY,
    cushionFrontX,
    legPivotX,
    legPivotY,
    legRot,
  };
}

type Geo = ReturnType<typeof geometry>;

interface SeatShapeProps {
  geo: Geo;
  /** current = 현재 포즈(화이트/앰버) · ghost = 릴렉스 타깃 포즈(민트 점선) */
  variant: 'current' | 'ghost';
  isActive?: (axis: AxisKey) => boolean;
}

/** 시트 본체 라인아트 — 현재/고스트 포즈를 동일한 형상으로 렌더링한다 */
function SeatShape({ geo, variant, isActive }: SeatShapeProps) {
  const ghost = variant === 'ghost';
  const act = (axis: AxisKey) => !ghost && !!isActive?.(axis);
  const stroke = (axis: AxisKey) => (ghost ? MINT_DASH : act(axis) ? AMBER : LINE);
  const width = (axis: AxisKey) => (ghost ? 1.8 : act(axis) ? 3 : 2.4);
  const glow = (axis: AxisKey) => (act(axis) ? 'url(#hmiGlow)' : undefined);
  const pad = (axis: AxisKey) =>
    ghost ? 'none' : act(axis) ? 'rgba(240,165,60,.1)' : 'url(#hmiFade)';

  const {
    extPx,
    tiltDeg,
    reclineDeg,
    bolsterPush,
    lumbarPush,
    lumbarY,
    cushionFrontX,
    legPivotX,
    legPivotY,
    legRot,
  } = geo;

  /** 볼스터 윙 선단 x — 등판 안쪽으로 감기는 정도 (베지어 중간점) */
  const bolsterTipX = PIVOT_X - 5 - bolsterPush * 0.75;

  return (
    <g
      transform={`translate(${geo.slidePx}, ${-geo.heightPx})`}
      fill="none"
      strokeDasharray={ghost ? '6 6' : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 등받이 (리클라이너 회전) */}
      <g transform={`rotate(${reclineDeg}, ${PIVOT_X + 4}, ${PAN_Y})`}>
        <path
          d={`M ${PIVOT_X + 2} ${PAN_Y + 4}
              L ${PIVOT_X + 3} ${PAN_Y - 150}
              Q ${PIVOT_X + 4} ${PAN_Y - 170} ${PIVOT_X + 19} ${PAN_Y - 172}
              L ${PIVOT_X + 21} ${PAN_Y - 172}
              Q ${PIVOT_X + 32} ${PAN_Y - 170} ${PIVOT_X + 31} ${PAN_Y - 148}
              L ${PIVOT_X + 27} ${PAN_Y + 4} Z`}
          stroke={stroke('recline')}
          strokeWidth={width('recline')}
          fill={pad('recline')}
          filter={glow('recline')}
        />
        {/* 사이드 볼스터 — 엉덩이에서 어깨까지 등받이 좌우를 감싸는 롱 윙 */}
        <path
          d={`M ${PIVOT_X + 3} ${PAN_Y + 2}
              C ${PIVOT_X - 8 - bolsterPush} ${PAN_Y - 26}
                ${PIVOT_X - 8 - bolsterPush} ${PAN_Y - 112}
                ${PIVOT_X + 3} ${PAN_Y - 138} Z`}
          stroke={stroke('bolster')}
          strokeWidth={ghost ? 1.6 : 2.2}
          fill={pad('bolster')}
          filter={glow('bolster')}
        />
        {/* 윙 패딩 내측 라인 */}
        <path
          d={`M ${PIVOT_X + 2} ${PAN_Y - 8}
              C ${PIVOT_X - 2 - bolsterPush * 0.55} ${PAN_Y - 32}
                ${PIVOT_X - 2 - bolsterPush * 0.55} ${PAN_Y - 106}
                ${PIVOT_X + 2} ${PAN_Y - 130}`}
          stroke={ghost ? MINT_DASH : act('bolster') ? AMBER : LINE_SOFT}
          strokeWidth="1.4"
          fill="none"
        />
        {/* 먼 쪽 볼스터(절선) — 좌우 한 쌍이 몸을 감싼다는 표시 */}
        {!ghost && (
          <path
            d={`M ${PIVOT_X + 14} ${PAN_Y - 4}
                C ${PIVOT_X + 8 - bolsterPush * 0.5} ${PAN_Y - 30}
                  ${PIVOT_X + 8 - bolsterPush * 0.5} ${PAN_Y - 110}
                  ${PIVOT_X + 14} ${PAN_Y - 134}`}
            stroke="rgba(255,255,255,.2)"
            strokeWidth="1.3"
            strokeDasharray="3 4"
            fill="none"
          />
        )}
        {/* 감김 방향 인디케이터 */}
        {!ghost && act('bolster') && (
          <g stroke={AMBER} strokeWidth="1.8" fill="none" strokeLinecap="round">
            <path d={`M ${bolsterTipX - 4} ${PAN_Y - 72} l -5 4 l 5 4`} />
            <path d={`M ${bolsterTipX + 3} ${PAN_Y - 72} l -5 4 l 5 4`} opacity=".45" />
          </g>
        )}

        {/* 헤드레스트 */}
        <rect
          x={PIVOT_X + 1}
          y={PAN_Y - 222}
          width="34"
          height="40"
          rx="12"
          stroke={stroke('recline')}
          strokeWidth={ghost ? 1.8 : 2.2}
          fill={pad('recline')}
        />
        <line
          x1={PIVOT_X + 17}
          y1={PAN_Y - 182}
          x2={PIVOT_X + 17}
          y2={PAN_Y - 172}
          stroke={ghost ? MINT_DASH : LINE_SOFT}
          strokeWidth={ghost ? 1.8 : 2.6}
        />
        {/* 럼버 서포트 (전후 돌출 + 상하 위치) */}
        <ellipse
          cx={PIVOT_X + 5 - lumbarPush}
          cy={lumbarY}
          rx={9 + lumbarPush * 0.5}
          ry="24"
          stroke={stroke('lumber')}
          strokeWidth={ghost ? 1.6 : 2}
          fill={pad('lumber')}
          filter={glow('lumber')}
        />
      </g>


      {/* 쿠션 (틸트 회전) */}
      <g transform={`rotate(${tiltDeg}, ${PIVOT_X}, ${PAN_Y})`}>
        <path
          d={`M ${PIVOT_X + 4} ${PAN_Y - 6}
              L ${cushionFrontX + 16} ${PAN_Y - 6}
              Q ${cushionFrontX} ${PAN_Y - 4} ${cushionFrontX} ${PAN_Y + 10}
              L ${cushionFrontX + 2} ${PAN_Y + 20}
              L ${PIVOT_X + 4} ${PAN_Y + 24} Z`}
          stroke={stroke('tilt')}
          strokeWidth={width('tilt')}
          fill={pad('tilt')}
          filter={glow('tilt')}
        />
        {/* 쿠션 익스텐션 (전후 신장) */}
        <rect
          x={cushionFrontX - 2}
          y={PAN_Y - 4}
          width={extPx + 4}
          height="18"
          rx="7"
          stroke={stroke('cushion')}
          strokeWidth={ghost ? 1.6 : 2.2}
          fill={pad('cushion')}
          filter={glow('cushion')}
        />
        {/* 레그레스트 (레그 피벗 회전 — 0° 이면 쿠션에 수직으로 아래를 향함) */}
        <g transform={`rotate(${legRot}, ${legPivotX}, ${legPivotY})`}>
          <path
            d={`M ${legPivotX} ${legPivotY - 8}
                L ${legPivotX - (LEGREST_LEN - 12)} ${legPivotY - 2}
                Q ${legPivotX - LEGREST_LEN} ${legPivotY + 2} ${legPivotX - LEGREST_LEN + 2} ${legPivotY + 16}
                L ${legPivotX - 8} ${legPivotY + 20} Z`}
            stroke={stroke('legrest')}
            strokeWidth={width('legrest')}
            fill={pad('legrest')}
            filter={glow('legrest')}
          />
        </g>
        {/* 레그 피벗 */}
        <circle
          cx={legPivotX}
          cy={legPivotY}
          r="3.6"
          fill={ghost ? 'none' : act('legrest') ? AMBER : '#0a0d0f'}
          stroke={stroke('legrest')}
          strokeWidth={ghost ? 1.6 : 1.8}
        />
      </g>

      {/* 시트 프레임 (고스트 포즈에는 그리지 않음) */}
      {!ghost && (
        <rect
          x={PIVOT_X - 12}
          y={PAN_Y + 24}
          width="60"
          height="10"
          rx="4"
          fill="none"
          stroke={LINE_SOFT}
          strokeWidth="1.6"
        />
      )}
    </g>
  );
}

export default function SeatDiagram({
  positions,
  targets,
  activeAxis,
  lang,
  ghost = false,
}: SeatDiagramProps) {
  /** 축 활성 여부 → 앰버 강조 */
  const on = (axis: AxisKey) => activeAxis === axis;

  const geo = geometry(positions);
  const ghostGeo = geometry(targets);
  const { slidePx, heightPx, cushionFrontX, legPivotX, legPivotY, bolsterPush, lumbarY } = geo;

  const fmt = (axis: AxisKey, value: number) =>
    `${value.toFixed(AXIS_CONFIG[axis].unit === '°' ? 1 : 0)}${AXIS_CONFIG[axis].unit}`;

  /** 라벨 클램프 경계 (시트 그룹이 translate 되므로 로컬 좌표로 보정) */
  const tagLeft = { left: 4 - slidePx };
  const tagRight = { right: 556 - slidePx };

  /** 라벨 폭 추정 (CJK 2칸 / ASCII 1칸) */
  const labelWidth = (s: string) =>
    Array.from(s).reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 10.2 : 5.8), 0);

  /**
   * 부품 수치 칩
   *  - 최상단 오버레이 레이어에서만 호출되어 시트 본체에 가려지지 않는다
   *  - 활성 축만 TGT(타깃) 값을 민트색으로 함께 노출한다
   */
  const partTag = (
    axis: AxisKey,
    x: number,
    y: number,
    anchor: 'start' | 'middle' | 'end' = 'middle',
    bounds?: { left?: number; right?: number },
  ) => {
    const main = `${AXIS_CONFIG[axis].name[lang]} ${fmt(axis, positions[axis])}`;
    const sub = `TGT ${fmt(axis, targets[axis])}`;
    const active = on(axis);
    const w = Math.max(labelWidth(main), labelWidth(sub)) + 12;
    const h = active ? 26 : 15;
    let ax = x;
    let left = anchor === 'end' ? x - w + 5 : anchor === 'middle' ? x - w / 2 : x - 5;
    // 캔버스 밖으로 밀려나지 않도록 칩 밀어내기 (라벨 텍스트도 함께 이동)
    if (bounds?.left !== undefined && left < bounds.left) {
      ax += bounds.left - left;
      left = bounds.left;
    }
    if (bounds?.right !== undefined && left + w > bounds.right) {
      const d = left + w - bounds.right;
      ax -= d;
      left -= d;
    }

    return (
      <g className="pointer-events-none select-none">
        <rect
          x={left}
          y={y - 10.5}
          width={w}
          height={h}
          rx="4"
          fill="#070a0b"
          opacity="0.92"
          stroke={active ? 'rgba(240,165,60,.55)' : 'rgba(255,255,255,.1)'}
          strokeWidth="0.9"
        />
        <text
          x={ax}
          y={y}
          textAnchor={anchor}
          fontSize="10.5"
          fontFamily={COND}
          letterSpacing=".05em"
          fill={active ? '#ffc276' : '#9fb0b2'}
          fontWeight={active ? 700 : 500}
        >
          {main}
        </text>
        {active && (
          <text
            x={ax}
            y={y + 11.5}
            textAnchor={anchor}
            fontSize="9"
            fontFamily={COND}
            letterSpacing=".06em"
            fill="#5fd6a4"
          >
            {sub}
          </text>
        )}
      </g>
    );
  };

  /** 헤드레스트 상단점 (회전 + 시트 변환 반영) — 이동 궤적 화살표용 */
  const headTop = (g: Geo) => {
    const p = rotatePoint(PIVOT_X + 18, PAN_Y - 222, g.reclineDeg, PIVOT_X + 4, PAN_Y);
    return { x: p.x + g.slidePx, y: p.y - g.heightPx };
  };
  const from = headTop(geo);
  const to = headTop(ghostGeo);
  const showTrace = ghost && Math.hypot(to.x - from.x, to.y - from.y) > 6;

  return (
    <svg viewBox="0 0 560 420" className="w-full h-full select-none">
      <defs>
        <linearGradient id="hmiFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dfeceb" stopOpacity=".16" />
          <stop offset="100%" stopColor="#dfeceb" stopOpacity=".02" />
        </linearGradient>
        <linearGradient id="hmiAmber" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd39a" />
          <stop offset="100%" stopColor="#f0a53c" />
        </linearGradient>
        <filter id="hmiGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ================= 기준 프레임 (R/Z REFERENCE) ================= */}
      <g stroke="rgba(255,255,255,.07)" strokeWidth="1">
        <line x1="40" y1="392" x2="528" y2="392" />
        <line x1="40" y1="392" x2="40" y2="26" />
        <line x1="528" y1="392" x2="528" y2="26" />
      </g>
      <g stroke="rgba(255,255,255,.05)" strokeWidth="1" strokeDasharray="3 7">
        <line x1="284" y1="26" x2="284" y2="392" />
        <line x1="40" y1="212" x2="528" y2="212" />
      </g>
      <text x="46" y="42" fontFamily={SANS} fontSize="10" letterSpacing="3" fill="#5d6c6f">
        R · Z REFERENCE
      </text>

      {/* ================= 바닥 레일 (라인아트) ================= */}
      <g stroke={LINE_SOFT} strokeWidth="1.8">
        <line x1="96" y1="366" x2="470" y2="366" />
        <line x1="96" y1="380" x2="470" y2="380" />
        {Array.from({ length: 13 }, (_, i) => (
          <line key={i} x1={150 + i * 22.5} y1="366" x2={150 + i * 22.5} y2="380" strokeWidth="1.2" />
        ))}
      </g>
      {/* 슬라이드 현재 위치 (레일 마커) */}
      <rect
        x={285 + slidePx - 3.5}
        y="358"
        width="7"
        height="24"
        rx="3.5"
        fill={on('slide') ? AMBER : 'rgba(255,255,255,.45)'}
        filter={on('slide') ? 'url(#hmiGlow)' : undefined}
      />
      <text x="100" y="396" fontFamily={COND} fontSize="11" letterSpacing="2" fill="#5d6c6f">
        FWD
      </text>
      <text x="436" y="396" fontFamily={COND} fontSize="11" letterSpacing="2" fill="#5d6c6f">
        AFT
      </text>

      {/* ================= 하이트 리프트 (팬티그래프) ================= */}
      <g
        stroke={on('height') ? AMBER : 'rgba(255,255,255,.42)'}
        strokeWidth="3"
        strokeLinecap="round"
        filter={on('height') ? 'url(#hmiGlow)' : undefined}
      >
        <line x1={292 + slidePx} y1="366" x2={332 + slidePx} y2={PAN_Y + 34 - heightPx} />
        <line x1={332 + slidePx} y1="366" x2={292 + slidePx} y2={PAN_Y + 34 - heightPx} />
      </g>
      <line
        x1="112"
        y1={PAN_Y + 34 - heightPx}
        x2="112"
        y2="366"
        stroke={on('height') ? 'rgba(240,165,60,.6)' : 'rgba(255,255,255,.22)'}
        strokeWidth="1.4"
        strokeDasharray="4 4"
      />

      {/* ================= 릴렉스 타깃 고스트 포즈 ================= */}
      {ghost && <SeatShape geo={ghostGeo} variant="ghost" />}

      {/* ================= 현재 포즈 ================= */}
      <SeatShape geo={geo} variant="current" isActive={on} />

      {/* ================= 힌지 노드 ================= */}
      <g fill="#0a0d0f" stroke="url(#hmiAmber)" strokeWidth="2.2">
        <circle cx={PIVOT_X + 4 + slidePx} cy={PAN_Y - heightPx} r="7" />
        <circle cx={legPivotX + slidePx} cy={legPivotY - heightPx} r="5" />
      </g>

      {/* ================= 릴렉스 이동 궤적 화살 ================= */}
      {showTrace && (
        <g stroke="rgba(95,214,164,.7)" strokeWidth="1.6" strokeDasharray="5 5" fill="none">
          <path
            d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2 + 20} ${(from.y + to.y) / 2 - 24} ${to.x} ${to.y}`}
          />
          <path d={`M ${to.x} ${to.y} l -13 -4 M ${to.x} ${to.y} l -3 -13`} strokeDasharray="none" />
        </g>
      )}

      {/* ================= 리드선 라벨 ================= */}
      <g fontFamily={SANS} fontSize="10.5" letterSpacing="2.2" fill="#8d9c9e">
        <g stroke="rgba(255,255,255,.22)" strokeWidth="1" fill="none">
          <path
            d={`M ${PIVOT_X + 12 + slidePx} ${PAN_Y + 8 - heightPx} L ${PIVOT_X + 66 + slidePx} ${PAN_Y + 44 - heightPx} H ${PIVOT_X + 96 + slidePx}`}
          />
          <path d={`M ${PIVOT_X + 34 + slidePx} ${PAN_Y - 150 - heightPx} H ${PIVOT_X + 66 + slidePx}`} />
          <path d="M 430 366 L 462 340 H 500" />
        </g>
        <text x={Math.min(PIVOT_X + 100 + slidePx, 470)} y={PAN_Y + 48 - heightPx}>
          P1 · PIVOT
        </text>
        <text x={Math.min(PIVOT_X + 70 + slidePx, 470)} y={PAN_Y - 146 - heightPx}>
          S2 · BACK
        </text>
        <text x="524" y="344" textAnchor="end">
          R1 · RAIL
        </text>
      </g>

      {/* ================= 부품 수치 오버레이 (본체를 가리지 않도록 최상단) ================= */}
      <g transform={`translate(${slidePx}, ${-heightPx})`}>
        {partTag('tilt', cushionFrontX - 24, PAN_Y - 30, 'end', tagLeft)}
        {partTag('bolster', PIVOT_X - 26 - bolsterPush * 0.7, PAN_Y - 68, 'end', tagLeft)}
        {partTag('cushion', cushionFrontX - 24, PAN_Y + 38, 'end', tagLeft)}
        {partTag('legrest', cushionFrontX - 24, PAN_Y + 60, 'end', tagLeft)}
        {partTag('recline', PIVOT_X + 96, PAN_Y - 168, 'start', tagRight)}
        {partTag('lumber', PIVOT_X + 96, lumbarY - 16, 'start', tagRight)}
        {partTag('lumber_height', PIVOT_X + 96, lumbarY + 16, 'start', tagRight)}
      </g>
      {partTag('height', 100, 340, 'end', { left: 4 })}
      {partTag('slide', 285 + slidePx, 338, 'middle', { left: 4, right: 556 })}
    </svg>
  );
}


