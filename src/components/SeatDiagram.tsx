import type { AxisKey, LocalizedText } from '../seatConfig';
import { AXIS_CONFIG, clamp } from '../seatConfig';

/**
 * SeatDiagram — 전동 시트 2축 사이드뷰 물리 모델 (base_seat.png + 마스크 렌더링 대응)
 * 슬라이드/하이트/리클라이너/틸트/레그레스트/쿠션/볼스터/럼버 실시간 형상 반영
 */

interface SeatDiagramProps {
  positions: Record<AxisKey, number>;
  targets: Record<AxisKey, number>;
  activeAxis: AxisKey | null;
  lang: 'ko' | 'en';
  labels?: LocalizedText;
}

const PIVOT_X = 300;
const PAN_Y = 268;

/** 레그레스트 패드 길이(px) — 0°(수직 폴딩)에서 바닥 레일에 닿지 않는 길이 */
const LEGREST_LEN = 70;
/** 축 0° 일 때 레그레스트 화면 회전각: 쿠션(시트)에 대해 90° 아래 = 수직 폴딩 */
const LEGREST_DOWN_DEG = -90;

export default function SeatDiagram({ positions, targets, activeAxis, lang }: SeatDiagramProps) {
  /** 축 활성 여부 → 강조 스타일 */
  const on = (axis: AxisKey) => activeAxis === axis;
  const strokeOf = (axis: AxisKey, base = '#5c726c') => (on(axis) ? '#7dbaaf' : base);
  const fillOf = (axis: AxisKey, base = '#22302c') => (on(axis) ? '#2f4f49' : base);
  const glowOf = (axis: AxisKey) => (on(axis) ? 'url(#seatGlow)' : undefined);

  // ---- 기하 변환 값 ----
  const slidePx = (clamp(positions.slide, 0, 300) / 300) * 110 - 55;
  const heightPx = (clamp(positions.height, 0, 100) / 100) * 46;
  const extPx = (clamp(positions.cushion, 0, 60) / 60) * 46;
  const tiltDeg = clamp(positions.tilt, 0, 15);
  const legDeg = clamp(positions.legrest, 0, 45);
  const reclineDeg = clamp(positions.recline, 0, 60);
  const bolsterH = 8 + (clamp(positions.bolster, 0, 40) / 40) * 18;
  const lumbarPush = (clamp(positions.lumber, 0, 50) / 50) * 11;
  const lumbarY = 214 - (clamp(positions.lumber_height, 0, 50) / 50) * 62;

  const cushionFrontX = PIVOT_X - 118 - extPx;
  const legPivotX = cushionFrontX + 4;
  const legPivotY = PAN_Y + 16;

  /**
   * 레그레스트 회전각
   *  축 0°    : 쿠션 대비 90° 아래 — 아래를 향하는 수직 폴딩 상태
   *  축 max(45): 쿠션과 수평 — 허벅지/종아리 지지 전개 상태
   * 축 0~45° 구간을 화면상 90° 회전(수직 → 수평)으로 매핑한다.
   */
  const legRot =
    LEGREST_DOWN_DEG + (legDeg / AXIS_CONFIG.legrest.max) * -LEGREST_DOWN_DEG;

  const fmt = (axis: AxisKey, value: number) =>
    `${value.toFixed(AXIS_CONFIG[axis].unit === '°' ? 1 : 0)}${AXIS_CONFIG[axis].unit}`;

  /** 라벨 클램프 경계 (시트 그룹이 translate 되므로 로컬 좌표로 보정) */
  const tagLeft = { left: 4 - slidePx };
  const tagRight = { right: 556 - slidePx };

  /** 라벨 폭 추정 (CJK 2칸 / ASCII 1칸) */
  const labelWidth = (s: string) =>
    Array.from(s).reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 10.6 : 6), 0);

  /**
   * 부품 수치 라벨
   *  - 최상단 오버레이 레이어에서만 호출되어 시트 본체에 가려지지 않는다
   *  - 어두운 칩 배경을 깔아 본체 위에서도 읽히도록 한다
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
    const w = Math.max(labelWidth(main), labelWidth(sub)) + 10;
    const h = active ? 25 : 14;
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
          fill="#070c0b"
          opacity="0.9"
          stroke={active ? '#7dbaaf' : '#243230'}
          strokeWidth="0.9"
        />
        <text
          x={ax}
          y={y}
          textAnchor={anchor}
          fontSize="10"
          fontFamily="monospace"
          fill={active ? '#8fd0c2' : '#9fb3ae'}
          fontWeight={active ? 700 : 400}
        >
          {main}
        </text>
        {active && (
          <text
            x={ax}
            y={y + 11.5}
            textAnchor={anchor}
            fontSize="8.5"
            fontFamily="monospace"
            fill="#e0b96a"
          >
            {sub}
          </text>
        )}
      </g>
    );
  };

  return (
    <svg viewBox="0 0 560 420" className="w-full h-full select-none">
      <defs>
        <linearGradient id="seatPad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#33463f" />
          <stop offset="100%" stopColor="#18241f" />
        </linearGradient>
        <filter id="seatGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="seatGrid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#1b2523" strokeWidth="1" />
        </pattern>
      </defs>

      {/* 배경 그리드 */}
      <rect x="0" y="0" width="560" height="420" fill="url(#seatGrid)" opacity="0.55" />

      {/* 바닥 레일 + 슬라이드 스트로크 */}
      <line x1="60" y1="382" x2="510" y2="382" stroke="#31403c" strokeWidth="2" />
      <line x1="150" y1="368" x2="420" y2="368" stroke="#3d514c" strokeWidth="6" strokeLinecap="round" />
      {Array.from({ length: 13 }, (_, i) => (
        <line
          key={i}
          x1={150 + i * 22.5}
          y1="362"
          x2={150 + i * 22.5}
          y2="374"
          stroke={i % 4 === 0 ? '#5c726c' : '#33443f'}
          strokeWidth="1.4"
        />
      ))}
      {/* 슬라이드 현재 위치 (레일 하이라이트) */}
      <rect
        x={285 + slidePx - 3.5}
        y="358"
        width="7"
        height="20"
        rx="3.5"
        fill={on('slide') ? '#7dbaaf' : '#4c635d'}
        filter={glowOf('slide')}
      />
      <text x="150" y="398" fontSize="9" fontFamily="monospace" fill="#5f736e">
        FWD
      </text>
      <text x="404" y="398" fontSize="9" fontFamily="monospace" fill="#5f736e">
        AFT
      </text>

      {/* 하이트 리프트 메커니즘 (팬티그래프) */}
      <g stroke={strokeOf('height')} strokeWidth="3.5" strokeLinecap="round" filter={glowOf('height')}>
        <line x1={292 + slidePx} y1="366" x2={332 + slidePx} y2={PAN_Y + 34 - heightPx} />
        <line x1={332 + slidePx} y1="366" x2={292 + slidePx} y2={PAN_Y + 34 - heightPx} />
      </g>
      <line
        x1="112"
        y1={PAN_Y + 34 - heightPx}
        x2="112"
        y2="366"
        stroke={strokeOf('height', '#3c4f4a')}
        strokeWidth="1.4"
        strokeDasharray="4 4"
      />

      {/* ================= 시트 본체 (슬라이드 + 하이트 변환) ================= */}
      <g transform={`translate(${slidePx}, ${-heightPx})`}>
        {/* 등받이 (리클라이너 회전) — 슬림 패드 */}
        <g transform={`rotate(${reclineDeg}, ${PIVOT_X + 4}, ${PAN_Y})`}>
          <path
            d={`M ${PIVOT_X + 2} ${PAN_Y + 4}
                L ${PIVOT_X + 3} ${PAN_Y - 150}
                Q ${PIVOT_X + 4} ${PAN_Y - 170} ${PIVOT_X + 19} ${PAN_Y - 172}
                L ${PIVOT_X + 21} ${PAN_Y - 172}
                Q ${PIVOT_X + 32} ${PAN_Y - 170} ${PIVOT_X + 31} ${PAN_Y - 148}
                L ${PIVOT_X + 27} ${PAN_Y + 4} Z`}
            fill="url(#seatPad)"
            stroke={strokeOf('recline')}
            strokeWidth="2.4"
            filter={glowOf('recline')}
          />
          {/* 헤드레스트 */}
          <rect
            x={PIVOT_X + 1}
            y={PAN_Y - 222}
            width="34"
            height="40"
            rx="12"
            fill="url(#seatPad)"
            stroke={strokeOf('recline')}
            strokeWidth="2.2"
          />
          <line
            x1={PIVOT_X + 17}
            y1={PAN_Y - 182}
            x2={PIVOT_X + 17}
            y2={PAN_Y - 172}
            stroke="#4a5f59"
            strokeWidth="3.4"
          />
          {/* 럼버 서포트 (전후 돌출 + 상하 위치) */}
          <ellipse
            cx={PIVOT_X + 5 - lumbarPush}
            cy={lumbarY}
            rx={9 + lumbarPush * 0.5}
            ry="24"
            fill={fillOf('lumber', '#2a3b36')}
            stroke={strokeOf('lumber', '#5c726c')}
            strokeWidth="2"
            filter={glowOf('lumber')}
          />
        </g>

        {/* 쿠션 (틸트 회전) */}
        <g transform={`rotate(${tiltDeg}, ${PIVOT_X}, ${PAN_Y})`}>
          {/* 시트 팬 본체 */}
          <path
            d={`M ${PIVOT_X + 4} ${PAN_Y - 6}
                L ${cushionFrontX + 16} ${PAN_Y - 6}
                Q ${cushionFrontX} ${PAN_Y - 4} ${cushionFrontX} ${PAN_Y + 10}
                L ${cushionFrontX + 2} ${PAN_Y + 20}
                L ${PIVOT_X + 4} ${PAN_Y + 24} Z`}
            fill="url(#seatPad)"
            stroke={strokeOf('tilt')}
            strokeWidth="2.4"
            filter={glowOf('tilt')}
          />
          {/* 쿠션 익스텐션 (전후 신장) */}
          <rect
            x={cushionFrontX - 2}
            y={PAN_Y - 4}
            width={extPx + 4}
            height="18"
            rx="7"
            fill={fillOf('cushion', '#26332f')}
            stroke={strokeOf('cushion')}
            strokeWidth="2.2"
            filter={glowOf('cushion')}
          />
          {/* 사이드 볼스터 (팽창) */}
          <rect
            x={PIVOT_X - 96}
            y={PAN_Y - 6 - bolsterH}
            width="86"
            height={bolsterH}
            rx={bolsterH / 2}
            fill={fillOf('bolster', '#2a3b36')}
            stroke={strokeOf('bolster')}
            strokeWidth="2.2"
            filter={glowOf('bolster')}
          />
          {/* 레그레스트 (레그 피벗 회전 — 0° 이면 쿠션에 수직으로 아래를 향함) */}
          <g transform={`rotate(${legRot}, ${legPivotX}, ${legPivotY})`}>
            <path
              d={`M ${legPivotX} ${legPivotY - 8}
                  L ${legPivotX - (LEGREST_LEN - 12)} ${legPivotY - 2}
                  Q ${legPivotX - LEGREST_LEN} ${legPivotY + 2} ${legPivotX - LEGREST_LEN + 2} ${legPivotY + 16}
                  L ${legPivotX - 8} ${legPivotY + 20} Z`}
              fill="url(#seatPad)"
              stroke={strokeOf('legrest')}
              strokeWidth="2.4"
              filter={glowOf('legrest')}
            />
          </g>
          {/* 레그 피벗 */}
          <circle
            cx={legPivotX}
            cy={legPivotY}
            r="3.6"
            fill={on('legrest') ? '#7dbaaf' : '#3d514c'}
            stroke="#0b1412"
            strokeWidth="1.2"
          />
        </g>

        {/* 시트 프레임 */}
        <rect
          x={PIVOT_X - 12}
          y={PAN_Y + 24}
          width="60"
          height="10"
          rx="4"
          fill="#1a2320"
          stroke="#3d514c"
          strokeWidth="1.6"
        />
      </g>

      {/* 릴렉스 On/Off 배지 */}
      {activeAxis === 'relaxation_return' && (
        <g>
          <rect
            x="196"
            y="34"
            width="168"
            height="34"
            rx="10"
            fill="#16211e"
            stroke={positions.relaxation_return > 50 ? '#e0b96a' : '#7dbaaf'}
            strokeWidth="1.6"
          />
          <text
            x="280"
            y="56"
            textAnchor="middle"
            fontSize="12"
            fontFamily="monospace"
            fill={positions.relaxation_return > 50 ? '#e0b96a' : '#7dbaaf'}
            fontWeight="700"
          >
            RELAX {positions.relaxation_return > 50 ? 'ON' : 'OFF'}{' '}
            {positions.relaxation_return.toFixed(0)}%
          </text>
        </g>
      )}

      {/* ================= 부품 수치 오버레이 (본체를 가리지 않도록 최상단) ================= */}
      <g transform={`translate(${slidePx}, ${-heightPx})`}>
        {partTag('tilt', cushionFrontX - 24, PAN_Y - 30, 'end', tagLeft)}
        {partTag('bolster', PIVOT_X - 58, PAN_Y - bolsterH - 22, 'middle', tagRight)}
        {partTag('cushion', cushionFrontX - 24, PAN_Y + 38, 'end', tagLeft)}
        {partTag('legrest', cushionFrontX - 24, PAN_Y + 60, 'end', tagLeft)}
        {partTag('recline', PIVOT_X + 96, PAN_Y - 168, 'start', tagRight)}
        {partTag('lumber', PIVOT_X + 96, lumbarY - 16, 'start', tagRight)}
        {partTag('lumber_height', PIVOT_X + 96, lumbarY + 16, 'start', tagRight)}
      </g>
      {partTag('height', 100, 356, 'end', { left: 4 })}
      {partTag('slide', 285 + slidePx, 338, 'middle', { left: 4, right: 556 })}
    </svg>
  );
}


