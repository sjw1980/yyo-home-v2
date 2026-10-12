# 시트 다이어그램 / 시뮬레이터 UI 비주얼 컨셉 5종

`src/components/SeatDiagram.tsx` · `SeatSimulator.tsx` 의 현재 모습(짙은 초록 단색 사각형 위주)을
대신할 수 있는 **시각 컨셉 5가지**를 앱 코드 수정 없이 독립 HTML 목업으로 만든 폴더입니다.
각 파일은 1440×900 고정이며, 브라우저로 열면 그대로 동작 화면(정적 목업)입니다.

| # | 파일 | 컨셉 이름 | 한 줄 요약 | 가장 잘 맞는 용도 | 실제 이식 난이도 |
|---|------|-----------|------------|------------------|------------------|
| 1 | `concept-1-aurora-glass.html` / `.png` | **Aurora Glass** | 다크 그린+민트 브랜드 팔레트, 글래스 패널, 그라디언트 쿠션, 라이브 데이터 칩 | 지금 UI의 연장선 — 가장 무난한 리프레시 | ★☆☆ (CSS/gradient 만 추가) |
| 2 | `concept-2-blueprint-cad.html` / `.png` | **Blueprint CAD** | 엔지니어링 드로잉(그리드·치수선·연장선·타이틀 블록), 타깃 형상은 고스트 점선 | 기술 검토·고객 리포트·특허/검증 자료 | ★★☆ (치수선 SVG 신규) |
| 3 | `concept-3-studio-render.html` / `.png` | **Studio Render** | 밝은 스튜디오 배경, 소프트 섀도+머티리얼 그라디언트, 부품 리스트 리드선 | 영업/제안서, 인쇄물, 경영진 보고 | ★★☆ (그라디언트+섀도 필터) |
| 4 | `concept-4-cabin-hmi.html` / `.png` | **Cabin HMI** | 차량 인포테인먼트 스타일 — 라인아트 시트, 액추에이터 목록, 리클라이너 다이얼, 하단 독 | 실차 HMI 느낌의 데모·전시용 시연 | ★★★ (레이아웃 재구성) |
| 5 | `concept-5-xray-thermal.html` / `.png` | **X-Ray Thermal** | 메시 와이어프레임 + 착좌 압력 히트맵 + 스캔 빔 + 티레메트리 스트립 | 센서/검증 데이터 시각화, 기술 데모 | ★★★ (히트맵 레이어 필요) |

## 공통으로 담은 정보 구조

다섯 컨셉 모두 `src/seatConfig.ts` 의 실제 축 정의를 기준으로 했습니다.

- 축 코드: `SLD`(슬라이드 0–300 mm) · `RCL`(리클라이너 0–60°) · `HGT`(하이트 0–100 mm) ·
  `TLT`(틸트 0–15°) · `LEG`(레그레스트 0–45°) · `CSH`(쿠션 0–60 mm) · `BLS`(볼스터) ·
  `LMB`(럼버 전후) · `LMH`(럼버 상하) · `RLX`(릴렉스 %)
- 목업에 쓴 예시 값: 슬라이드 150 mm, 하이트 50 mm, 틸트 7.5°, 레그레스트 22.0°, 리클라이너 32.5°, 럼버 +18 mm
  (→ `INITIAL_POSITIONS` 의 중간값 150/50/7.5/22.5/30 근방 + 릴렉스 진행 중 상태)
- 시트 형상(헤드레스트·등받이·럼버·쿠션·레그레스트·팬티그래프·레일)은 컨셉 간에 동일한 좌표계를 써서,
  컨셉을 바꿔도 부품 위치가 어긋나 보이지 않도록 했습니다.

## 미리보기 (PNG 다시 만들기)

```powershell
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
foreach ($n in 'concept-1-aurora-glass','concept-2-blueprint-cad','concept-3-studio-render','concept-4-cabin-hmi','concept-5-xray-thermal') {
  & $chrome --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
    --window-size=1440,900 --virtual-time-budget=9000 `
    --screenshot="D:\Works\yyo-home-v2\mockups\$n.png" `
    "file:///D:/Works/yyo-home-v2/mockups/$n.html"
}
```

- `--virtual-time-budget=9000` 은 Google Fonts 로딩을 기다리게 하는 플래그입니다(폰트가 막히면 시스템 모노/고딕으로 대체 렌더).
- 목업은 외부 JS 의존성이 없고 인라인 CSS + 인라인 SVG 뿐이라, 원하는 부분만 골라 `index.css` / 컴포넌트로 옮기기 쉽습니다.

## 컨셉별 이식 포인트

### 1. Aurora Glass — 지금 UI의 자연스러운 업그레이드
- `SeatDiagram.tsx` 의 단색 `fill` 을 `<linearGradient>` 3종(쿠션/등받이/활성축) 으로 교체하는 것부터 시작.
- 상단 상태 표시를 "라이브 칩"(RECLINE 32.5° / TGT 40.0°) 형태로 분리 → `SeatSimulator` 의 현재 모드·목표값과 1:1 대응.
- 하단 5개 타일(Slide/Height/Tilt/Legrest/Recline) 은 기존 축 리스트 UI 를 그대로 대체 가능.

### 2. Blueprint CAD — 가장 "기술다움"
- 그리드·치수선·연장선·화살표 마커·타이틀 블록이 핵심. `AXIS_CONFIG.min/max` 를 치수선 범위로 쓰면 실제 값과 동기화 가능.
- 점선 고스트 = **목표 각도(프리셋/릴렉스 On)** 형상. 현재 형상과 목표 형상을 겹쳐 보여주는 용도로 실용적.
- 단, 정보 밀도가 높아 조작 UI 와는 분리(조회 모드) 하는 편이 낫습니다.

### 3. Studio Render — 대외 문서용
- 밝은 배경이라 슬라이드/보고서에 그대로 붙일 수 있고, 머티리얼 스와치(Grafite Green/Beige/Graphite/Fabric) 로 컬러 옵션 제안까지 가능.
- 앱에 넣을 경우 `filter: drop-shadow` + SVG 그라디언트만 추가하면 되고, 다크 테마와는 대비가 커서 테마 분기 필요.

### 4. Cabin HMI — 시연·전시용
- 좌측 액추에이터 목록(축 코드+상태+현재값) / 중앙 라인아트 / 우측 리클라이너 다이얼 + 시퀀스 로그 / 하단 시트·메모리 독.
- `MODE_CONFIG` 의 9개 모드와 `axisForDirection()` 결과를 그대로 목록·다이얼에 매핑할 수 있습니다.
- `M1~M7` 모터 번호는 **연출용 플레이스홀더**입니다(실제 앱은 모터 번호 대신 `SLD/RCL/...` 축 코드를 사용).

### 5. X-Ray Thermal — 데이터 시각화
- 메시는 `clipPath` 로 시트 실루엣을 잘라낸 뒤 패턴을 얹는 방식이라 추가 자산 없이 구현됩니다.
- 히트맵/등고선은 실제 압력 센서 값이 없을 때는 연출, 센서 연동 시에는 진짜 데이터 레이어로 사용 가능.
- 우측 존 테이블(Z1 허벅지…Z5 종아리) 은 시트 센서 매트릭스(24×8 가정) 표기로, 실제 채널 수와 맞춰야 합니다.

## 추천

- **당장 앱에 반영** → 1번(Aurora Glass) 을 베이스로, 4번의 액추에이터 목록/다이얼 레이아웃을 섞는 조합이 가장 현실적입니다.
- **고객·경영진 보고** → 3번(Studio Render) 또는 2번(Blueprint CAD).
- **기술 데모·전시** → 5번(X-Ray Thermal) + 4번(Cabin HMI).

## 참고

- 이 폴더의 파일은 빌드에 포함되지 않습니다(`src/` 밖, import 되지 않음). 앱 소스는 수정하지 않았습니다.
- 폰트: 컨셉별 Google Fonts(Aurora=Inter/JetBrains Mono, CAD=JetBrains Mono, Studio=IBM Plex, HMI=Rajdhani/Barlow Condensed, X-Ray=Chakra Petch/Share Tech Mono).
  오프라인 환경에서는 시스템 폰자로 대체되므로, 실제 적용 시 `index.css` 의 폰트 스택과 통일하는 과정을 한 번 거치는 것을 권합니다.

