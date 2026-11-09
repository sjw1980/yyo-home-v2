# Wiper Simulator — 요구사양 v0.1

yyo.co.kr "바디 컨트롤 데모" 시리즈의 첫 번째: **레인센싱 와이퍼 시뮬레이터**.
seat 시뮬레이터와 동일한 톤(조작기 + CAN 로그 + 실시간 물리 모델)로 구현한다.

---

## 1. 시뮬레이션 대상

전면 와이퍼 시스템 (BCM 제어, LIN 모터 또는 CAN 제어 BLDC 모터 가정):

- 운전석/조수석 와이퍼 2조 (파라렐 링크 암)
- 레인 센서 (front camera module 내장형 또는 글로즈 하단 광학식)
- 속도 신호 (cluster/CAN 보디 채널)
- washer (노즐 + 펌프)
- 후방 와이퍼 (R 기어 연동 옵션)

## 2. 입력 팩터 (시뮬레이터 조작 가능 항목)

### 2.1 환경 입력
| # | 팩터 | 값 범위 | 비고 |
|---|------|--------|------|
| E1 | 강우 강도 | none / mist / light / moderate / heavy / torrential | 레인센서 광량으로 환산 |
| E2 | 차량 속도 | 0–220 km/h | 간격·속도 커브 핵심 |
| E3 | 강우 지속 패턴 | constant / gusting / intermittent | 센서 히스테리시스 테스트용 |
| E4 | 외기 온도 | -20–50 ℃ | 결빙 모드 트리거 |
| E5 | 글래스 오염도 | clean / dusty / oily | 센서 오검출 시뮬레이션용 |
| E6 | 전조등/야간 | day / night | 야간 glare → 간격 단축 전략 |

### 2.2 사용자 설정 (드라이버 조작기)
| # | 항목 | 값 |
|---|------|-----|
| U1 | 레버 모드 | OFF / INT / LO / HI / MIST(1회) |
| U2 | INT 감도 다이얼 | 1–10 (기준 간격 3–60 s) |
| U3 | 레인센싱 AUTO on/off | OEM 옵션 |
| U4 | washer 레버 당김 | washer + 2~3 cycle |

### 2.3 차량 상태 입력
| # | 항목 | 연동 |
|---|------|------|
| V1 | 기어 (D/R) | R → 후방 와이퍼 + washer |
| V2 | front defroster ON | HVAC 연동: 디포스트 시 자동 INT |
| V3 | ADAS 전방카메라 상태 | 카메라 경고 시 와이퍼 우선순위 상향 |
| V4 | 모터 전류 | 결빙/장애 시 stall 검출 |

## 3. 제어 요구사항 (FR)

- **FR-1 (속도 보간)**: AUTO 모드에서 목표 인터벌 = f(강우 강도, 차량 속도).
  기준: 저속(<40) = 센서 기반 순수 간격, 고속(>100) = 간격 상한 4 s 강제 —
  고속일수록 물방울 확산 속도가 빨라지는 효과 +_wind noise_ 트레이드오프 반영.
- **FR-2 (레인센서 모델)**: 광학식 TIR(total internal reflection) 모델 — 글로즈 표면
  물방울이 적외산 반사를 감소 → 수신 광량 ↓ → 강우 지수. 오염도(E5)는 false-positive 유발.
- **FR-3 (히스테리시스)**: 강우 지수 상승/하강 임계값 분리 (예: 0.35 start / 0.25 stop)
  + 최소 dwell 2 s — 플러핑 방지.
- **FR-4 (예측 선제 동작)**: 내비게이션/기상 데이터로 5분 내 강우 예상 시 사전 1 cycle
  + 감도 사전 보정 (특허 트렌드: map/weather 연동 선제 와이핑).
- **FR-5 (washer 연동)**: washer 작동 → 즉시 2~3 연속 full cycle → AUTO 복귀.
- **FR-6 (결빙 보호)**: 외기온 < 0 ℃ AND stall 전류 > threshold → 암 정지 +
  "defroster 대기" 이벤트 로그. 해빙 후 자동 재시도.
- **FR-7 (후방 와이퍼)**: R 기어 진입 시 washer + 1 cycle (SUV 기본 패턴).
- **FR-8 (야간 전략)**: night + heavy → 인터벌 30% 단축 (글레어 저감).
- **FR-9 (park home)**: OFF 전환 시 암이 home position 도달 후 정지 (mid-sweep cutoff 금지).
- **FR-10 (MIST)**: 레버 MIST → 1 cycle만, AUTO 상태 복원.

## 4. CAN/LIN 메시지 모델 (화면 로그용)

| Message | ID 예시 | 신호 | 주기 |
|---------|--------|------|------|
| WiperSwitchInfo | 0x3A1 | lever_mode, sensitivity | event/100ms |
| RainSensorStatus | 0x3A2 | rain_index(0~1), sensor_fault | 100 ms |
| VehicleSpeed | 0x150 (shared) | speed_kmh | 20 ms |
| WiperActuation | 0x3A3 | state(IDLE/SWEEP_HOME/SWEEP_AWAY/HOLD), motor_current, cycle_count | 50 ms |
| BCM_WiperDiag | 0x7B3 | stall, freeze, blade_wear | event |

seat 시뮬레이터의 CAN FD 로그 컴포넌트 패턴 재사용.

## 5. UI 요구사항

- **차량 정면 SVG**: 2개의 와이퍼 암이 실제로 스윕 애니메이션 (home ↔ full sweep),
  속도·강우에 따라 sweep 속도 변화 (HI ≈ 1.3 s/cycle, INT 가변).
- **글로즈 비전 영역**: 강우 강도에 따라 물방울 파티클 밀도 변화 (canvas 또는 SVG circle).
- **레인센서 게이지**: rain_index 실시간 바 + start/stop 임계선 표시.
- **인터벌 예측 링**: 현재 계산된 목표 간격 시각화 (f(rain, speed) 커브 그래프 오버레이).
- **CAN 로그 패널**: 하단 실시간 프레임 흐름 (seat와 동일 컴포넌트).
- **시나리오 프리셋 버튼**: `고속 고속도로 폭우`, `도심 간헐 비`, `세차 후 오염 센서`,
  `겨울 결빙 stall`, `주차 후 후방 와이퍼` — 각 프리셋이 입력 팩터 일괄 세팅.
- **이상 동작 체험**: 오염도 최대 + AUTO → false wiping 발생 → 원인을 로그로 설명.

## 6. 특허·기술 선행조사 (팩터 도출 근거)

검색으로 확인된 대표 문헌 (Google Patents / Justia / 학술):

1. **EP0308990A1** — 속도 감지 기반 간헐 와이퍼 제어 (speed-dependent interval 원형 특허).
2. **US4527105A** — windshield condition(오염/습윤) 센싱 와이퍼 제어.
3. **US5780719** — rain sensor + 속도 복합 인터벌 제어.
4. **US6958585B1** — 광학 레인센서 기반 자동 제어 (TIR 방식 계열).
5. **US8441221B2** — 강우 강도 추정과 와이퍼 동작 최적화.
6. **US10780860** — (Justia 확인) 카메라/센서 융합 windshield 상태 기반 제어.
7. **CN111559344A / KR102899076B1** — 최근 중국/한국 출원: 이미지·딥러닝 기반 windshield
   rain detection + 와이퍼 제어 (camera-based trend 확인).
8. 학술: *Video-Based Windshield Rain Detection and Wiper Control Using Holistic-View
   Deep Learning* (2019), IARJSET 2024 자동 레인센싱 설계 논문 — camera 기반 추세 근거.

**특허에서 도출한 추가 팩터** (위 FR에 반영):
- 속도 의존 인터벌 (FR-1), 센서 히스테리시스 (FR-3), 오염 false-positive (FR-2/E5),
  washer-와이퍼 연동 (FR-5), stall/결빙 보호 (FR-6), camera/ADAS 융합 (V3),
  기상·맵 데이터 선제 와이핑 (FR-4).

규격 앵커: **FMVSS 104** (와이퍼 시야 확보 성능), OEM generally: HI 45–110 cycles/min.

## 7. 비기능 요구

- API 키 불필요 (순수 물리 모델 + 규칙 엔진) — 현재 사이트 데모 정책 유지.
- seat 시뮬레이터와 공용 스타일 (다크 그린 팔레트, CAN 로그 컴포넌트).
- ko/en 이중 언어 (translations dictionary).
- 60 fps sweep 애니메이션 (motion/react).

## 8. 구현 범위 (v1)

Section `#wiper-simulator`, `WiperSimulator.tsx`:
SVG 전면 차 + 2암 sweep, 레인센서 게이지, 조작기(레버/다이얼), 프리셋 5종, CAN 로그.
미구현(roadmap): 후방 와이퍼 애니메이션, 결빙 stall 물리, camera-based 모드.
