import { ServiceSection, MissionSection, TranslationDictionary } from './types';

export const services: ServiceSection[] = [
  {
    title: {
      ko: "Bootloader & OTA (Over-the-Air) 업데이트",
      en: "Bootloader & OTA (Over-the-Air) Updates"
    },
    content: {
      ko: "무선(OTA) 업데이트를 신뢰성 높게 수행하도록 차량 내 전자제어장치(ECU)의 펌웨어를 안전하고 신속하게 갱신할 수 있는 부트로더 아키텍처를 설계하고 공급합니다.",
      en: "Developed a robust bootloader system that enables seamless firmware updates for Electronic Control Units (ECUs) in vehicles. Our solution ensures secure and efficient over-the-air updates, enhancing vehicle functionality and safety."
    },
    iconName: "Cpu",
    techDetails: {
      standard: "ISO 14229, ISO 13400 (DoIP)",
      summary: {
        ko: "보안 부트(Secure Boot), 무결성 검증, 이중 파티션 스왑(Dual Partition Swap) 및 비상 복구 모드 지원.",
        en: "Supports cryptographic integrity signatures, Secure Boot, hash authentication, and fail-safe Dual Partition switching."
      }
    }
  },
  {
    title: {
      ko: "UDS (Unified Diagnostic Services)",
      en: "UDS (Unified Diagnostic Services)"
    },
    content: {
      ko: "차량의 전반적인 고장 파악 및 상세 캘리브레이션을 위해 UDS 진단 프로토콜 스택을 완벽 지원합니다. 진단 툴과 전장 장치 간 유연한 통신 및 고장 코드(DTC) 관리를 제공합니다.",
      en: "Implemented UDS protocols for comprehensive vehicle diagnostics. Our UDS stack facilitates communication between diagnostic tools and ECUs, enabling efficient fault detection, troubleshooting, and maintenance."
    },
    iconName: "Wrench",
    techDetails: {
      standard: "ISO 14229-1 (UDS on CAN/IP)",
      summary: {
        ko: "진단 세션 제어, 보안 액세스 잠금 해제(Seed-and-Key), 정밀 실시간 실측 데이터 및 영구 진단코드(DTC) 관리 수행.",
        en: "Enables diagnostic session transitioning, secure seed-and-key authorization, and advanced on-board DTC management."
      }
    }
  },
  {
    title: {
      ko: "임베디드 결합 CI/CD 정밀 구축",
      en: "Streamlining CI/CD for Embedded Systems"
    },
    content: {
      ko: "임베디드 물리 타겟 빌드 자동화와 온-타겟 가상 에뮬레이션 테스트를 결합한 통합 파이프라인으로 소프트웨어 소스 신뢰성을 최상으로 담보하며 릴리즈 속도를 향상시킵니다.",
      en: "Leverage Git for version control, collaboration, and code quality. Automate build, test, and deployment stages for efficiency and consistency. Rigorous unit, integration, and regression tests ensure reliable code."
    },
    iconName: "GitMerge",
    techDetails: {
      standard: "Automotive SPICE (ASPICE) SWE.3-SWE.6",
      summary: {
        ko: "컴파일러 툴체인 가상화, HIL(Hardware-in-the-Loop) 시스템 파이프라인 밀착 융합 및 실시간 단위 회기 보안 검측.",
        en: "Automated compiler toolchains paired with virtual target execution and Hardware-in-the-Loop emulation."
      }
    }
  },
  {
    title: {
      ko: "기능안전 표준화 & 사이버 보안 설계",
      en: "Ensuring Functional Safety and Cybersecurity"
    },
    content: {
      ko: "도로 위의 운전자 안전을 위협하는 전장 오작동을 미연에 방지하는 ISO 26262 규격을 기획 설계하며, UN 법규 기반 해킹 방지 프로세스 및 보안 통신망을 구축합니다.",
      en: "Ensured ISO 26262 Compliance: Our rigorous validation of safety-critical software minimizes risks, while robust cybersecurity safeguards protect interconnected vehicle networks and data privacy."
    },
    iconName: "Shield",
    techDetails: {
      standard: "ISO 26262, UN ECE R155/R156",
      summary: {
        ko: "전기·전자(E/E) 가혹 조건 설계 대응, ASIL-D 검증 파이프라인 수립 및 보안 침입 탐지 프로세스 설계.",
        en: "Highest ASIL-D safety requirements qualification combined with Cryptographic Hardware Security Modules (HSM)."
      }
    }
  },
  {
    title: {
      ko: "AUTOSAR Classic/Adaptive 개발",
      en: "AUTOSAR Classic/Adaptive Architecture"
    },
    content: {
      ko: "자동차 범용 표준 구조인 오토사(AUTOSAR) 버전에 기반하여 다중 제어 환경 소프트웨어의 높은 확장성과 재사용성을 대응하고 이기종 디바이스 연동 복잡도를 낮춥니다.",
      en: "Leveraged AUTOSAR (Automotive Open System Architecture) to create a standardized platform for ECU development. Our AUTOSAR-compliant software architecture streamlines collaboration, reduces development time, and ensures compatibility across different vehicle components."
    },
    iconName: "Layers",
    techDetails: {
      standard: "AUTOSAR Classic / Adaptive Standards",
      summary: {
        ko: "RTE 인터페이스 매핑, 마이크로컨트롤러 추상화 계층(MCAL) 정밀 커스터마이징, 및 복잡 장치 드라이버(CDD) 설계.",
        en: "Architects layers including RTE, MCAL, and critical Complex Device Drivers (CDD) for high-speed processors."
      }
    }
  }
];

export const missions: MissionSection[] = [
  {
    title: {
      ko: "AI 기반 차량 최적화 지능 구현",
      en: "AI-Driven Vehicle Innovations"
    },
    content: {
      ko: "머신러닝과 딥러닝을 차량 임베디드 디바이스에 통합하여 예측 기반 제어 알고리즘 및 결함 조기 예측 기술을 연구합니다.",
      en: "Explore AI applications in autonomous driving, predictive maintenance, and personalized user experiences."
    },
    iconName: "Brain"
  },
  {
    title: {
      ko: "소프트웨어 중심 자동차(SDV) 미들웨어 구축",
      en: "Development of Software-Defined Vehicle"
    },
    content: {
      ko: "하드웨어 변경 없이도 완전한 전장 업데이트를 제공하도록 중앙 집중형 컴퓨팅 통합 및 서비스 지향 미들웨어 설계를 주도합니다.",
      en: "Implement robust safety measures, validate algorithms, and address ethical considerations in SDV development."
    },
    iconName: "Workflow"
  },
  {
    title: {
      ko: "국제 규격 기능안전 등급 만전",
      en: "Functional Safety Compliance"
    },
    content: {
      ko: "가혹한 모빌리티 주행 스트레스에서도 차량용 장치가 일관되고 예측 가능한 복원 성능을 내도록 설계 공정을 통제합니다.",
      en: "Ensure adherence to ISO 26262 standards for safety-critical systems in automotive software and hardware."
    },
    iconName: "Fingerprint"
  },
  {
    title: {
      ko: "초연결 네트워크 위협 차단 프로토콜",
      en: "Cybersecurity for Connected Vehicles"
    },
    content: {
      ko: "차량의 무선 데이터 공유망에 탑재되는 세션 암호화 장치를 세밀 검증하며, CAN / DoIP 통신의 해킹 탈취를 영구 차단합니다.",
      en: "Safeguard vehicle networks, prevent cyberattacks, and maintain data privacy in an interconnected ecosystem."
    },
    iconName: "Lock"
  },
  {
    title: {
      ko: "소프웨어 애자일 공정 체질화",
      en: "Agile Development Practices"
    },
    content: {
      ko: "폭포수형 개발 정체를 벗어나, 고유 스프린트 주기를 정립해 품질 회귀 테스트를 단축하고 모빌리티 파트너와의 수시 연동을 실현합니다.",
      en: "Adopt agile methodologies, streamline development processes, and foster cross-functional collaboration."
    },
    iconName: "Command"
  }
];

export const translations: TranslationDictionary = {
  // Navigation
  "About": {
    ko: "회사 소개",
    en: "About"
  },
  "Mission": {
    ko: "미션",
    en: "Mission"
  },
  "Points We Serve": {
    ko: "제공 기술 서비스",
    en: "Points We Serve"
  },
  "Our Core Mission": {
    ko: "주요 미션",
    en: "Our Core Mission"
  },
  "Contact": {
    ko: "문의 및 협업",
    en: "Contact"
  },
  "Find Us": {
    ko: "찾아오시는 길",
    en: "Find Us"
  },
  "Diagnostics Simulator": {
    ko: "전장 진단 에뮬레이터",
    en: "Diagnostics Simulator"
  },
  "Language": {
    ko: "언어",
    en: "Language"
  },

  // Hero section
  "Start-up tech. company": {
    ko: "기술 스타트업",
    en: "Start-up tech. company"
  },
  "Yunyulon Tagline": {
    ko: "오직 자동차 전장이지만, 자동차 전장과 관련된 모든 것을 완벽히 다룹니다.",
    en: "Only Automotive, but Everything with Automotive."
  },
  "Automotive With AI": {
    ko: "인공지능과 한층 격조 높은 전장 융합",
    en: "Automotive With AI"
  },
  "Yunyulon Description": {
    ko: "우리는 고품격 전장 임베디드 코딩, 규격 표준 아키텍처 설계, 그리고 인공지능(AI) 기술을 조화롭게 결합한 한층 지능화된 모빌리티 제품 및 소프트웨어 엔지니어링 서비스를 만듭니다.",
    en: "We specialize in software development, creating embedded software, and building high-performance automotive products or services with integrated AI technology."
  },
  "Explore": {
    ko: "서비스 탐색",
    en: "Explore"
  },
  "Learn more": {
    ko: "상세 사항",
    en: "Learn more"
  },
  "Get started": {
    ko: "기술 블로그",
    en: "Tech. Blog"
  },

  // About Section
  "Look us, What we are": {
    ko: "우리는 이렇습니다",
    en: "Look us, What we are"
  },
  "About Company Name": {
    ko: "주식회사 윤율온 (YYO Co., Ltd.)",
    en: "Yunyulon Co., Ltd. (YYO)"
  },
  "Yunyulon History Body": {
    ko: "주식회사 윤율온(YYO)은 급변하는 글로벌 모빌리티 질서 속에서 소프트웨어 정의 자동차(SDV)의 두뇌가 되는 임베디드 인텔리전스를 개발하는 기술 전문 기업입니다. 우리는 CAN/DoIP 통신 기반 고성능 펌웨어 플래시 부트로더 하드웨어 인프라부터 UDS 진단 규격 준수, AUTOSAR 소프트웨어 레이어, 견고한 ISO 26262 안전 프로세스 수립까지 글로벌 규격에 부합하는 최고의 모빌리티 컨설팅 및 엔지니어링을 제공합니다.",
    en: "Yunyulon (YYO) is a dynamic technology company at the intersection of embedded software engineering and automotive digital innovation. Our mission is to revolutionize the global automotive landscape with highly secure Software-Defined Vehicle (SDV) middleware, AUTOSAR standard platform layers, secure diagnostic services, and reliable failure-prevention protocols complying with safety guidelines."
  },

  // Find Us & Parking
  "Address Title": {
    ko: "사옥 위치 안내",
    en: "Office Address"
  },
  "YYO address": {
    ko: "경기도 안양시 동안구 부림로 169번길 41 (윤율온)",
    en: "41, Burim-ro 169beon-gil, Dongan-gu, Anyang-si, Gyeonggi-do, Republic of Korea"
  },
  "car parking way": {
    ko: "차량으로 외부에서 비보호 우회전 진입 시 101동을 우측에 끼고 돌아서 101동과 102동 사이의 지하 주차장 입구로 진입합니다. 지하 1층 만차 시에는 101동을 회전하여 지하 2층~5층으로 내려가 주차하실 수 있으며, 출차 시에는 103동과 104동 사이의 출구를 통해 지상으로 출차하게 됩니다.",
    en: "When entering by car, keep Building 101 on your right as you turn around it, and enter the underground parking ramp between Buildings 101 and 102. If B1 is full, loop around Building 101 to descend to B2–B5. To exit, simply use the short ramp straight up between Buildings 103 and 104."
  },
  "Parking Guide": {
    ko: "주차 지원 예법",
    en: "Underground Parking Guide"
  },

  // Contact Form
  "Contact form": {
    ko: "제작 문의 및 협업 양식",
    en: "Contact and Collaboration Form"
  },
  "Do you have any question? Feel free to reach out.": {
    ko: "프로젝트 제안이나 전장 솔루션 도입 협업이 필요하신가요? 언제든 연락 부탁 드립니다.",
    en: "Have a question, feedback, or collaboration idea? We’d love to hear from you! Feel free to reach out using this simple form."
  },
  "Tell us everything": {
    ko: "무엇이든 상세히 기록해 주시면 전문가가 신속히 회답합니다.",
    en: "Provide any requirements or questions, and our engineering experts will respond promptly."
  },
  "Name": {
    ko: "성함 / 연락처",
    en: "Name / Contact Info"
  },
  "Your Name": {
    ko: "윤율온 전장 파트너님",
    en: "Your Name"
  },
  "Email": {
    ko: "회답 이메일",
    en: "Email Address"
  },
  "Your Email": {
    ko: "email@example.com",
    en: "Your Email"
  },
  "Message": {
    ko: "협업 세부 제안",
    en: "Proposals & Message"
  },
  "Your Message": {
    ko: "예) DoIP 부트로더 탑재 단말 개발에 관한 일정 및 사양 협의...",
    en: "E.g., Inquiring about UDS protocol diagnostic integration and ISO 26262 engineering services timelines..."
  },
  "Submit": {
    ko: "신속한 제안 송신",
    en: "Submit Secure Message"
  },
  "Message Sending": {
    ko: "전송 전송 중...",
    en: "Sending your proposal..."
  },
  "Message Sent Successfully": {
    ko: "제안이 성공적으로 전달되었습니다! 기재해주신 연락처로 기술팀이 곧 회답하겠습니다.",
    en: "Your proposal has been successfully transmitted! Our engineering team will contact you shortly."
  },

  // Terminal Simulator labels
  "Interactive Simulator Title": {
    ko: "독자 전장 소프트웨어 실시간 제어 에뮬레이터",
    en: "Interactive Embedded Software ECU Diagnostic Terminal"
  },
  "Interactive Simulator Subtitle": {
    ko: "주식회사 윤율온의 하이엔드 UDS 진단 프로토콜 및 복잡 디바이스 부트 기능을 직접 가상 시뮬레이션해 보세요.",
    en: "Experience our production-grade UDS diagnostic services and binary flash transfer logs in real-time."
  },
  "Simulator Select ECU": {
    ko: "에뮬레이트할 가상 전장 모듈 단말(ECU):",
    en: "Select Target Electronic Control Unit (ECU):"
  },
  "Simulator Select Command": {
    ko: "송출할 UDS 진단 명령어 선택:",
    en: "Select Unified Diagnostic Service (UDS) Frame:"
  },
  "Simulator Send Button": {
    ko: "진단 패킷 전송 (Send CAN Frame)",
    en: "Transmit CAN Diagnostic Request"
  },
  "Simulator OTA Button": {
    ko: "안전 무선(OTA) 부트 업데이트 개시",
    en: "Execute Simulated Fail-Safe OTA Flash Update"
  },
  "Simulator Console Header": {
    ko: "차량 내부 CAN 버스 실시간 분석 로그",
    en: "Real-Time Controller Area Network (CAN) Bus Monitored Frame Logs"
  },

  // Footer / Corporate Info
  "Company Register Title": {
    ko: "주식회사 윤율온 (Yunyulon Co., Ltd.)",
    en: "Yunyulon Co., Ltd. (Short: YYO)"
  },
  "Company Register Body": {
    ko: "대표이사: 이지혜 | 사업자등록번호: 220-81-80125 | 통신판매업신고번호: 제 2024-서울안양-0812호 | 개인정보보호책임자: 이지혜",
    en: "CEO: LEE JI HYE | Business Registration No: 220-81-80125 | Mail Order Declaration: No. 2024-SeoulAnyang-0812 | Chief Privacy Officer: LEE JI HYE"
  },
  "Footer Disclaimer": {
    ko: "© 2026 주식회사 윤율온. All Rights Reserved. 본 사이트에 수록된 임베디드 아키텍처 및 진단 알고리즘은 오토사 표준을 준수합니다.",
    en: "© 2026 Yunyulon Co., Ltd. All Rights Reserved. All embedded architectures on this system conform perfectly to AUTOSAR and ISO standards."
  }
};
