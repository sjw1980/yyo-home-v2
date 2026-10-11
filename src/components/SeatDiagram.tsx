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

  const fmt = (axis: AxisKey, value: number) =>
    `${value.toFixed(AXIS_CONFIG[axis].unit === '°' ? 1 : 0)}${AXIS_CONFIG[axis].unit}`;

  /** 활성 축 수치 라벨 (함수 호출로 렌더링 → 리렌더 시 리마운트 방지) */
  const partTag = (
    axis: AxisKey,
    x: number,
    y: number,
    anchor: 'start' | 'middle' | 'end' = 'middle',
  ) => (
    <g className="pointer-events-none select-none">
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        fontSize="10"
        fontFamily="monospace"
        fill={on(axis) ? '#7dbaaf' : '#6f8480'}
        fontWeight={on(axis) ? 700 : 400}
      >
        {AXIS_CONFIG[axis].name[lang]} {fmt(axis, positions[axis])}
      </text>
      {on(axis) && (
        <text x={x} y={y + 12} textAnchor={anchor} fontSize="8.5" fontFamily="monospace" fill="#e0b96ad0">
          TGT {fmt(axis, targets[axis])}
        </text>
      )}
    </g>
  );

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
      {/* 슬라이드 현재 위치 인디케이터 */}
      <polygon
        points={`${285 + slidePx},356 ${277 + slidePx},344 ${293 + slidePx},344`}
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
      {partTag('height', 104, 320, 'end')}

      {/* ================= 시트 본체 (슬라이드 + 하이트 변환) ================= */}
      <g transform={`translate(${slidePx}, ${-heightPx})`}>
        {/* 등받이 (리클라이너 회전) */}
        <g transform={`rotate(${reclineDeg}, ${PIVOT_X + 6}, ${PAN_Y})`}>
          <path
            d={`M ${PIVOT_X + 2} ${PAN_Y + 4}
                L ${PIVOT_X + 6} ${PAN_Y - 152}
                Q ${PIVOT_X + 8} ${PAN_Y - 172} ${PIVOT_X + 30} ${PAN_Y - 174}
                L ${PIVOT_X + 52} ${PAN_Y - 174}
                Q ${PIVOT_X + 68} ${PAN_Y - 172} ${PIVOT_X + 66} ${PAN_Y - 150}
                L ${PIVOT_X + 58} ${PAN_Y + 4} Z`}
            fill="url(#seatPad)"
            stroke={strokeOf('recline')}
            strokeWidth="2.4"
            filter={glowOf('recline')}
          />
          {/* 헤드레스트 */}
          <rect
            x={PIVOT_X + 12}
            y={PAN_Y - 224}
            width="52"
            height="42"
            rx="14"
            fill="url(#seatPad)"
            stroke={strokeOf('recline')}
            strokeWidth="2.2"
          />
          <line
            x1={PIVOT_X + 30}
            y1={PAN_Y - 182}
            x2={PIVOT_X + 30}
            y2={PAN_Y - 174}
            stroke="#4a5f59"
            strokeWidth="4"
          />
          {/* 럼버 서포트 (전후 돌출 + 상하 위치) */}
          <ellipse
            cx={PIVOT_X + 8 - lumbarPush}
            cy={lumbarY}
            rx={12 + lumbarPush * 0.7}
            ry="26"
            fill={fillOf('lumber', '#2a3b36')}
            stroke={strokeOf('lumber', '#5c726c')}
            strokeWidth="2"
            filter={glowOf('lumber')}
          />
          <line
            x1={PIVOT_X + 62}
            y1={lumbarY}
            x2={PIVOT_X + 84}
            y2={lumbarY}
            stroke={strokeOf('lumber_height', '#3c4f4a')}
            strokeWidth="1.4"
            strokeDasharray="4 4"
          />
          <polygon
            points={`${PIVOT_X + 84},${lumbarY - 5} ${PIVOT_X + 92},${lumbarY} ${PIVOT_X + 84},${lumbarY + 5}`}
            fill={strokeOf('lumber_height', '#3c4f4a')}
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
          {partTag('bolster', PIVOT_X - 54, PAN_Y - bolsterH - 16)}

          {/* 레그레스트 (레그 피벗 회전) */}
          <g transform={`rotate(${legDeg}, ${legPivotX}, ${legPivotY})`}>
            <path
              d={`M ${legPivotX} ${legPivotY - 8}
                  L ${legPivotX - 78} ${legPivotY - 2}
                  Q ${legPivotX - 92} ${legPivotY + 2} ${legPivotX - 90} ${legPivotY + 16}
                  L ${legPivotX - 8} ${legPivotY + 20} Z`}
              fill="url(#seatPad)"
              stroke={strokeOf('legrest')}
              strokeWidth="2.4"
              filter={glowOf('legrest')}
            />
          </g>
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

        {partTag('tilt', cushionFrontX - 12, PAN_Y - 30, 'end')}
        {partTag('cushion', cushionFrontX - 12, PAN_Y + 44, 'end')}
        {partTag('legrest', legPivotX - 96, legPivotY + 46, 'end')}
        {partTag('recline', PIVOT_X + 108, PAN_Y - 120, 'start')}
        {partTag('lumber', PIVOT_X + 108, lumbarY - 34, 'start')}
        {partTag('lumber_height', PIVOT_X + 108, lumbarY + 44, 'start')}
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

      {/* 슬라이드 수치 */}
      {partTag('slide', 285 + slidePx, 340)}
    </svg>
  );
}


