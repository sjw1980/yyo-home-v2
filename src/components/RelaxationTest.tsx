import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, Terminal, Play, RotateCcw, Send, Settings, CheckCircle, Database, AlertCircle, RefreshCw } from 'lucide-react';
import { translations } from '../data';

interface RelaxationTestProps {
  currentLang: 'ko' | 'en';
  onClose?: () => void;
}

interface LogLine {
  id: string;
  timestamp: string;
  type: 'tx' | 'rx' | 'sys' | 'success' | 'err';
  text: string;
}

export default function RelaxationTest({ currentLang, onClose }: RelaxationTestProps) {
  // Simulator states
  const [selectedEcu, setSelectedEcu] = useState<string>('0x7E0');
  const [selectedCmd, setSelectedCmd] = useState<string>('0x10_0x03');
  const [logs, setLogs] = useState<LogLine[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      type: 'sys',
      text: 'YYO Diagnostic Bus Monitor Initialized.'
    },
    {
      id: 'init-2',
      timestamp: new Date().toLocaleTimeString(),
      type: 'sys',
      text: 'Current Standard: ISO 14229 (UDS on CAN-FD), Baud Rate: 500kbps'
    }
  ]);

  // OTA state
  const [isOtaActive, setIsOtaActive] = useState<boolean>(false);
  const [otaProgress, setOtaProgress] = useState<number>(0);
  const [otaStepIndex, setOtaStepIndex] = useState<number>(-1);

  const consoleContainerRef = useRef<HTMLDivElement>(null);

  const ecus = [
    { id: '0x7E0', name: { ko: 'Engine Control Module (ECM)', en: 'Engine Control Module (ECM)' } },
    { id: '0x7E2', name: { ko: 'Body Control Module (BCM)', en: 'Body Control Module (BCM)' } },
    { id: '0x7E3', name: { ko: 'ADAS Sensor Fusion Node', en: 'ADAS Sensor Fusion Node' } },
    { id: '0x7E4', name: { ko: 'Telematics Control Unit (TCU)', en: 'Telematics Control Unit (TCU)' } }
  ];

  const udsCommands = [
    { id: '0x10_0x03', hexValue: '0x10 0x03', label: { ko: 'Diagnostic Session Control (Extended)', en: 'Diagnostic Session Control (Extended)' } },
    { id: '0x22_0xF1_0x90', hexValue: '0x22 0xF1 0x90', label: { ko: 'Read Data By Identifier (VIN Info)', en: 'Read Data By Identifier (VIN Info)' } },
    { id: '0x19_0x02', hexValue: '0x19 0x02', label: { ko: 'Read DTC By Status Mask', en: 'Read DTC By Status Mask' } },
    { id: '0x27_0x01', hexValue: '0x27 0x01', label: { ko: 'Security Access (Seed Request)', en: 'Security Access (Seed Request)' } },
    { id: '0x14_0xFF', hexValue: '0x14 0xFF 0xFF 0xFF', label: { ko: 'Clear Diagnostic Trouble Codes', en: 'Clear Diagnostic Trouble Codes' } }
  ];

  // Auto scroll console container specifically without moving the general window viewport
  useEffect(() => {
    if (consoleContainerRef.current) {
      consoleContainerRef.current.scrollTo({
        top: consoleContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [logs]);

  const addLog = (type: 'tx' | 'rx' | 'sys' | 'success' | 'err', text: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
        type,
        text
      }
    ]);
  };

  // Simulated CAN Transmit
  const handleTransmit = () => {
    if (isOtaActive) return;

    const reqLabel = udsCommands.find(c => c.id === selectedCmd);
    const hexBytes = reqLabel ? reqLabel.hexValue : '0x00';
    
    // Log transmission
    addLog('tx', `[Tx Request] ID: ${selectedEcu} | DATA: ${hexBytes}`);

    // ECU Response Simulation
    setTimeout(() => {
      const respId = '0x' + (parseInt(selectedEcu, 16) + 8).toString(16).toUpperCase();
      
      switch (selectedCmd) {
        case '0x10_0x03':
          addLog('rx', `[Rx Response] ID: ${respId} | DATA: 06 50 03 00 32 01 F4 00 [Session Control: SUCCESS]`);
          addLog('success', `✔ [ECU: ${selectedEcu}] Transitioned to Extended Diagnostics Session safely.`);
          break;
        case '0x22_0xF1_0x90':
          addLog('rx', `[Rx Response] ID: ${respId} | DATA: 10 14 62 F1 90 59 59 4F ... [Read VIN: SUCCESS]`);
          addLog('success', `✔ [ECU: ${selectedEcu}] Decoded VIN: "YYOAUTO2026M0812"`);
          break;
        case '0x19_0x02':
          addLog('rx', `[Rx Response] ID: ${respId} | DATA: 04 59 02 01 00 00 00 00 [Read DTC: SUCCESS]`);
          addLog('success', `✔ [ECU: ${selectedEcu}] Active DTC count: 0 (System fully operational)`);
          break;
        case '0x27_0x01':
          addLog('rx', `[Rx Response] ID: ${respId} | DATA: 04 67 01 A3 F4 2E 90 11 [Security Access Seed: SUCCESS]`);
          addLog('sys', `[Seed Handled] Exchanged Seed [A3 F4 2E] -> Key dispatched via SHA-256 calculation.`);
          addLog('success', `✔ [ECU: ${selectedEcu}] Security Access level 1 GRANTED.`);
          break;
        case '0x14_0xFF':
          addLog('rx', `[Rx Response] ID: ${respId} | DATA: 01 54 00 00 00 00 00 00 [Clear Codes: SUCCESS]`);
          addLog('success', `✔ [ECU: ${selectedEcu}] All diagnostic trouble memories flushed successfully.`);
          break;
        default:
          addLog('err', `✘ [ECU: ${selectedEcu}] Format mismatch error (NRC 0x12)`);
      }
    }, 450);
  };

  // Animated sequential OTA Boot sequence
  const startOtaUpdate = () => {
    if (isOtaActive) return;
    setIsOtaActive(true);
    setOtaProgress(0);
    setOtaStepIndex(0);
    setLogs([]); // flush terminal logs for clean visual look

    addLog('sys', '▶ Starting YYO Over-the-Air (OTA) secure partition firmware update sequence.');
  };

  const otaSteps = [
    { progress: 10, log: 'Reading boot partitions metadata... Current Active Bank: A (v1.0.2)' },
    { progress: 20, log: 'Establishing secure communication socket with YYO Cloud Repository.' },
    { progress: 30, log: 'Requesting transition to Boot Programming Session: Send UDS Frame [0x10 0x02]... Success.' },
    { progress: 42, log: 'Key authorized securely. Erasing target flash sector Bank B (Partition size: 4096KB).' },
    { progress: 55, log: 'Writing encrypted binary blocks into flash Bank B (Completed [Block 1/4]).' },
    { progress: 70, log: 'Writing encrypted binary blocks into flash Bank B (Completed [Block 2/4]).' },
    { progress: 85, log: 'Writing encrypted binary blocks into flash Bank B (Completed [Block 3/4]).' },
    { progress: 95, log: 'Writing encrypted binary blocks into flash Bank B (Completed [Block 4/4]).' },
    { progress: 98, log: 'Validating cryptographic signature hash via RSA-2048 & SHA-256 ... Integrity CHECK OK.' },
    { progress: 100, log: 'Updating partition state ... Swapped Active Bank: B ... Booting v2.0.0 Stable code. UPDATE SUCCESSFUL!' }
  ];

  useEffect(() => {
    if (isOtaActive && otaStepIndex >= 0 && otaStepIndex < otaSteps.length) {
      const timer = setTimeout(() => {
        const step = otaSteps[otaStepIndex];
        setOtaProgress(step.progress);
        
        let type: 'sys' | 'success' = 'sys';
        if (step.progress === 100) {
          type = 'success';
          setIsOtaActive(false);
        }
        addLog(type, `[OTA Progress ${step.progress}%] ${step.log}`);
        
        setOtaStepIndex(otaStepIndex + 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isOtaActive, otaStepIndex]);

  const clearLogs = () => {
    setLogs([
      {
        id: `clear-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'sys',
        text: 'Bus analyzer register cleared by user request.'
      }
    ]);
  };

  return (
    <section id="emulator" className="py-24 bg-[#0d1111] text-stone-100 border-b border-[#212927]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-[10px] sm:text-xs tracking-[0.25em] font-semibold text-[#7dbaaf] uppercase block mb-3">
            TECHNICAL EXPERIENCE ZONE
          </span>
          <h2 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {translations['Interactive Simulator Title'][currentLang]}
          </h2>
          <div className="mt-4 w-12 h-[2px] bg-[#7dbaaf] mx-auto" />
          <p className="mt-4 text-xs sm:text-sm text-stone-400 font-light leading-relaxed">
            {translations['Interactive Simulator Subtitle'][currentLang]}
          </p>
        </div>

        {/* Simulator Core Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Controllers Side */}
          <div className="lg:col-span-5 lg:h-[580px] bg-[#1c2321] rounded-2xl p-6 sm:p-8 border border-[#313f3c]/50 flex flex-col justify-between shadow-inner">
            <div className="space-y-6">
              <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#7dbaaf] border-b border-[#313f3c]/40 pb-3">
                <Settings className="w-4 h-4 text-[#7dbaaf] animate-spin" style={{ animationDuration: '6s' }} />
                <span>EMULATOR CONTROLLER PANEL</span>
              </div>

              {/* ECU Selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-stone-300 block">
                  {translations['Simulator Select ECU'][currentLang]}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {ecus.map((ecu) => (
                    <button
                      key={ecu.id}
                      onClick={() => !isOtaActive && setSelectedEcu(ecu.id)}
                      disabled={isOtaActive}
                      className={`text-left text-xs px-4 py-3 rounded-lg border transition-all select-none cursor-pointer flex justify-between items-center
                        ${selectedEcu === ecu.id
                          ? 'border-[#7dbaaf] bg-[#7dbaaf]/10 text-white font-semibold'
                          : 'border-[#313f3c] text-stone-400 hover:border-stone-500 hover:text-stone-200'
                        }
                        ${isOtaActive ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <span>{ecu.name[currentLang]}</span>
                      <span className="font-mono text-[10px] text-[#7dbaaf] bg-[#141b19] px-2 py-0.5 rounded border border-[#2b3532]">
                        {ecu.id}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* UDS Command Selector */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-medium text-stone-300 block">
                  {translations['Simulator Select Command'][currentLang]}
                </label>
                <select
                  value={selectedCmd}
                  onChange={(e) => setSelectedCmd(e.target.value)}
                  disabled={isOtaActive}
                  className="w-full bg-[#141b19] border border-[#313f3c] text-stone-300 text-xs rounded-lg p-3 focus:border-[#7dbaaf] focus:ring-1 focus:ring-[#7dbaaf] outline-none cursor-pointer"
                >
                  {udsCommands.map((cmd) => (
                    <option key={cmd.id} value={cmd.id}>
                      [{cmd.hexValue}] — {cmd.label[currentLang]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Simulated Transmission Trigger button / OTA updates */}
            <div className="space-y-3 pt-4 border-t border-[#313f3c]/40">
              <button
                onClick={handleTransmit}
                disabled={isOtaActive}
                className="w-full flex items-center justify-center space-x-2 bg-[#7dbaaf] hover:bg-[#68a398] disabled:bg-stone-850 text-[#0d1111] disabled:text-stone-500 py-3 rounded-xl text-xs font-bold tracking-wider hover:shadow-lg transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{translations['Simulator Send Button'][currentLang]}</span>
              </button>

              <button
                onClick={startOtaUpdate}
                disabled={isOtaActive}
                className="w-full flex items-center justify-center space-x-2 border border-[#7dbaaf]/30 hover:border-[#7dbaaf]/60 bg-[#56807d]/10 hover:bg-[#56807d]/20 disabled:bg-stone-900 text-stone-100 disabled:text-stone-500 py-3 rounded-xl text-xs font-bold tracking-wider transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isOtaActive ? 'animate-spin' : ''}`} />
                <span>{translations['Simulator OTA Button'][currentLang]}</span>
              </button>
            </div>
          </div>

          {/* Console / Terminal Terminal Side */}
          <div className="lg:col-span-7 bg-[#080d0c] rounded-2xl border border-[#313f3c]/60 overflow-hidden flex flex-col justify-stretch lg:h-[580px] min-h-[460px] shadow-2xl relative">
            
            {/* Terminal Window Header Decoration */}
            <div className="bg-[#131d1b] border-b border-[#313f3c]/60 px-5 py-4 flex items-center justify-between select-none">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-[#7dbaaf]" />
                <span className="font-mono text-xs tracking-wider text-slate-200">
                  {translations['Simulator Console Header'][currentLang]}
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={clearLogs}
                  className="text-[10px] font-mono text-stone-500 hover:text-stone-300 flex items-center space-x-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>CLEAR BUS</span>
                </button>
                <div className="flex space-x-1.5 pl-2 border-l border-stone-800">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600/40" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-600/40" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-600/40" />
                </div>
              </div>
            </div>

            {/* Console Log Content list */}
            <div ref={consoleContainerRef} className="flex-1 min-h-0 p-6 font-mono text-[11px] leading-relaxed space-y-3 overflow-y-auto bg-black/40">
              {logs.map((log) => {
                let colorClass = 'text-stone-400';
                if (log.type === 'tx') colorClass = 'text-[#7dbaaf] font-medium';
                if (log.type === 'rx') colorClass = 'text-amber-300';
                if (log.type === 'sys') colorClass = 'text-stone-500 text-[10.5px] italic';
                if (log.type === 'success') colorClass = 'text-green-400 font-bold';
                if (log.type === 'err') colorClass = 'text-red-400 font-bold';

                return (
                  <div key={log.id} className="border-b border-stone-900/40 pb-1.5 flex items-start space-x-2">
                    <span className="text-stone-600 select-none text-[10px]">{log.timestamp}</span>
                    <p className={`${colorClass} whitespace-pre-wrap`}>
                      {log.text}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* OTA Progress visual overlay bar at the bottom */}
            {isOtaActive && (
              <div className="bg-[#141c1a]/95 border-t border-[#313f3c]/60 p-5 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#7dbaaf] font-mono flex items-center space-x-1">
                    <Database className="w-3.5 h-3.5 text-[#7dbaaf] animate-pulse" />
                    <span>SECURE PARTITION FIRMWARE SWAP FLASH</span>
                  </span>
                  <span className="font-mono text-stone-200">{otaProgress}%</span>
                </div>
                <div className="w-full bg-[#0d1211] h-2 rounded-full overflow-hidden border border-[#2b3532]/40">
                  <div
                    className="h-full bg-gradient-to-r from-[#56807d] to-[#7dbaaf] transition-all duration-300"
                    style={{ width: `${otaProgress}%` }}
                  />
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Disclaimer / Standards Note */}
        <div className="mt-8 flex items-center space-x-2 text-stone-500 text-xs font-mono justify-center">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Simulated stack represents production-grade ISO-14229 Standard protocol sequences.</span>
        </div>

      </div>
    </section>
  );
}
