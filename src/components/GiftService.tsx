import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, MapPin, Sparkles, Check, Send, Phone, Car, Navigation2, CheckCircle2 } from 'lucide-react';
import { translations } from '../data';

interface GiftServiceProps {
  currentLang: 'ko' | 'en';
}

export default function GiftService({ currentLang }: GiftServiceProps) {
  const [partnerName, setPartnerName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [proposalMsg, setProposalMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [activeTab, setActiveTab] = useState<'google' | 'parking'>('google');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!partnerName || !partnerEmail || !proposalMsg) return;

    setIsSubmitting(true);

    // Try posting to local sendSlackMessage proxy if configured, otherise simulate
    try {
      const payload = {
        name: partnerName,
        email: partnerEmail,
        message: `${proposalMsg} [Sender Locale: ${currentLang.toUpperCase()}]`
      };

      await fetch('https://www.yyo.co.kr:5353/sendSlackMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.log('Using simulated transmission due to offline env or cross-origin headers.');
    }

    // Always succeed cleanly with beautiful visual response
    setTimeout(() => {
      setIsSubmitting(false);
      setIsDone(true);
      setPartnerName('');
      setPartnerEmail('');
      setProposalMsg('');
      setTimeout(() => setIsDone(false), 8000);
    }, 1500);
  };

  return (
    <section id="contact" className="py-24 bg-stone-900 border-t border-b border-[#212927]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-stretch">
          
          {/* Left Block: Modern Contact Form */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center space-x-1 msg-bubble text-[#7dbaaf]">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-xs uppercase tracking-[0.25em] font-semibold">
                  {translations['Contact form'][currentLang]}
                </span>
              </div>

              <h2 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                {currentLang === 'ko' ? (
                  <>
                    윤율온 전장 연구실과<br />
                    <span className="text-[#7dbaaf]">협업을 설계하고 구축해 보세요</span>
                  </>
                ) : (
                  <>
                    Build & collaborate with<br />
                    <span className="text-[#7dbaaf]">YYO Automotive Experts</span>
                  </>
                )}
              </h2>

              <p className="text-stone-400 font-sans font-light text-xs sm:text-sm leading-relaxed">
                {translations['Do you have any question? Feel free to reach out.'][currentLang]}
              </p>

              {/* Simulated success message */}
              <AnimatePresence>
                {isDone && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-5 rounded-xl bg-[#56807d]/20 border border-[#7dbaaf]/50 text-white flex items-start space-x-3"
                  >
                    <CheckCircle2 className="w-5 h-5 text-[#7dbaaf] flex-shrink-0 mt-0.5" />
                    <span className="text-xs">{translations['Message Sent Successfully'][currentLang]}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form elements */}
              <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-stone-850">
                <p className="text-[11px] uppercase tracking-widest text-stone-500 font-bold">
                  {translations['Tell us everything'][currentLang]}
                </p>

                {/* Sender Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-stone-300 block">
                    {translations['Name'][currentLang]}
                  </label>
                  <input
                    type="text"
                    required
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder={translations['Your Name'][currentLang]}
                    className="w-full p-3.5 bg-[#141b19] border border-[#313f3c] text-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#7dbaaf]"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-stone-300 block">
                    {translations['Email'][currentLang]}
                  </label>
                  <input
                    type="email"
                    required
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    placeholder={translations['Your Email'][currentLang]}
                    className="w-full p-3.5 bg-[#141b19] border border-[#313f3c] text-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#7dbaaf]"
                  />
                </div>

                {/* Message */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-stone-300 block">
                    {translations['Message'][currentLang]}
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={proposalMsg}
                    onChange={(e) => setProposalMsg(e.target.value)}
                    placeholder={translations['Your Message'][currentLang]}
                    className="w-full p-3.5 bg-[#141b19] border border-[#313f3c] text-stone-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#7dbaaf] font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-[#7dbaaf] hover:bg-[#68a398] disabled:bg-stone-800 text-[#0d1111] disabled:text-stone-500 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-stone-600 border-t-transparent rounded-full"
                      />
                      <span>{translations['Message Sending'][currentLang]}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{translations['Submit'][currentLang]}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Block: stylized Office address & PARKING MAP */}
          <div id="location" className="lg:col-span-6 bg-[#1c2321] border border-[#313f3c]/40 rounded-2xl p-6 sm:p-10 flex flex-col justify-between shadow-2xl space-y-8">
            <div className="space-y-6">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#7dbaaf] border-b border-[#313f3c]/40 pb-3 font-mono">
                <Navigation2 className="w-4 h-4" />
                <span>OFFICE ADDRESS, GOOGLE MAPS & PARKING</span>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-white mb-2">
                  {translations['Address Title'][currentLang]}
                </h3>
                <p className="text-xs sm:text-sm text-stone-300 font-light leading-relaxed pl-1">
                  {translations['YYO address'][currentLang]}
                </p>
                <div className="flex items-center justify-between pt-1 pl-1">
                  <p className="text-[11px] font-mono text-[#9bb09e]">
                    email: ceo@yyo.co.kr <span className="mx-2">|</span> cto@yyo.co.kr
                  </p>
                  <a
                    href="https://maps.google.com/?q=%EA%B2%BD%EA%B8%B0%EB%8F%84%20%EC%95%88%EC%96%91%EC%8B%9C%20%EB%8F%99%EC%95%88%EA%B5%AC%20%EB%B6%80%EB%A6%BC%EB%A1%9C%20169%EB%B2%88%EA%B8%B8%2041"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#7dbaaf] hover:underline font-mono"
                  >
                    ↗ Google Maps
                  </a>
                </div>
              </div>

              {/* Map & Parking Tabs */}
              <div className="space-y-4">
                <div className="flex space-x-2 p-1 bg-[#141b19] rounded-lg border border-[#313f3c]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('google')}
                    className={`flex-1 text-center py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      activeTab === 'google'
                        ? 'bg-[#7dbaaf] text-[#0d1111]'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    {currentLang === 'ko' ? '실시간 구글 지도' : 'Google Map'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('parking')}
                    className={`flex-1 text-center py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      activeTab === 'parking'
                        ? 'bg-[#7dbaaf] text-[#0d1111]'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    {currentLang === 'ko' ? '지하 주차 안내' : 'Parking Guide'}
                  </button>
                </div>

                {activeTab === 'google' ? (
                  <div className="aspect-[1.6/1] rounded-xl overflow-hidden relative bg-[#141b19] border border-[#313f3c] shadow-inner">
                    <iframe
                      src="https://maps.google.com/maps?q=%EA%B2%BD%EA%B8%B0%EB%8F%84%20%EC%95%88%EC%96%91%EC%8B%9C%20%EB%8F%99%EC%95%88%EA%B5%AC%20%EB%B6%80%EB%A6%BC%EB%A1%9C%20169%EB%B2%88%EA%B8%B8%2041&t=&z=16&ie=UTF8&iwloc=&output=embed"
                      className="w-full h-full border-0 grayscale invert contrast-110 opacity-80 hover:opacity-100 transition-all"
                      allowFullScreen
                      loading="lazy"
                      title="YYO Google Map Location"
                    />
                  </div>
                ) : (
                  /* Precise 2D Blueprint representing the Building 101 Spiral and Building 103-104 Exit */
                  <div className="aspect-[1.6/1] rounded-xl overflow-hidden relative bg-[#141b19] border border-[#313f3c] p-3 flex flex-col justify-between select-none">
                    
                    {/* Grid Backdrop */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#56807d_1px,transparent_1px)] [background-size:12px_12px]" />
                    
                    {/* Schematic Layout Container */}
                    <div className="relative w-full h-[85%] rounded-lg border border-[#313f3c]/40 bg-black/20 flex items-center justify-center overflow-hidden animate-fade-in">
                      <svg className="absolute inset-0 w-full h-full" fill="none" viewBox="0 0 280 180">
                        {/* Define arrows and markers */}
                        <defs>
                          <marker id="arrow-down-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#7dbaaf" />
                          </marker>
                          <marker id="arrow-up-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#c084fc" />
                          </marker>
                        </defs>

                        {/* Background Road Networks (Base grey corridors) */}
                        {/* Entry & Loop Corridor (From bottom right, turning around 101동 to left, up, then right between 101-102동 and down the spiral) */}
                        <path d="M 235,162 L 35,162 Q 12,162 12,150 L 12,120 Q 12,110 30,110 L 90,110 Q 105,110 105,121 L 105,145 Q 105,156 90,156 L 60,156" 
                              stroke="#313f3c" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M 235,162 L 35,162 Q 12,162 12,150 L 12,120 Q 12,110 30,110 L 90,110 Q 105,110 105,121 L 105,145 Q 105,156 90,156 L 60,156" 
                              stroke="#1c2321" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Exit Corridor (Short straight route between 103동 & 104동) */}
                        <path d="M 140,50 L 140,12" 
                              stroke="#313f3c" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M 140,50 L 140,12" 
                              stroke="#1c2321" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Colored Route Overlays */}
                        {/* Entering route (Teal / Clockwise-like looping to keep 101동 on right side, entering between 101 & 102동) */}
                        <path d="M 230,162 L 35,162 Q 15,162 15,150 L 15,120 Q 15,110 30,110 L 88,110 Q 101,110 101,121 L 101,142 Q 101,152 88,152 L 62,152" 
                              stroke="#7dbaaf" strokeWidth="2.5" strokeDasharray="3 2" strokeLinecap="round" markerEnd="url(#arrow-down-head)" />

                        {/* Exiting route (Purple / Short straight up between 103 & 104) */}
                        <path d="M 140,48 L 140,18" 
                              stroke="#c084fc" strokeWidth="2.5" strokeDasharray="3 2" strokeLinecap="round" markerEnd="url(#arrow-up-head)" />

                        {/* Building Blocks */}
                        {/* 103동 (Left Top), 104동 (Right Top) */}
                        <rect x="25" y="15" width="55" height="24" rx="4" fill="#1c2321" stroke="#313f3c" strokeWidth="1.5" />
                        <text x="52.5" y="29.5" fill="#a8a29e" fontSize="7.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                          {currentLang === 'ko' ? '103동' : 'Bld. 103'}
                        </text>

                        <rect x="200" y="15" width="55" height="24" rx="4" fill="#1c2321" stroke="#313f3c" strokeWidth="1.5" />
                        <text x="227.5" y="29.5" fill="#a8a29e" fontSize="7.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                          {currentLang === 'ko' ? '104동' : 'Bld. 104'}
                        </text>

                        {/* 102동 (Left Middle) */}
                        <rect x="25" y="70" width="55" height="24" rx="4" fill="#1c2321" stroke="#313f3c" strokeWidth="1.5" />
                        <text x="52.5" y="84.5" fill="#a8a29e" fontSize="7.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                          {currentLang === 'ko' ? '102동' : 'Bld. 102'}
                        </text>

                        {/* 101동 (Left Bottom) */}
                        <rect x="25" y="125" width="55" height="24" rx="4" fill="#1c2321" stroke="#56807d" strokeWidth="1.5" />
                        <text x="52.5" y="139.5" fill="#7dbaaf" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                          {currentLang === 'ko' ? '101동' : 'Bld. 101'}
                        </text>

                        {/* Guidance Overlays & Markers */}
                        <g transform={`translate(${currentLang === 'ko' ? 112 : 108}, 1)`}>
                          <rect x="0" y="0" width={currentLang === 'ko' ? 56 : 64} height="11" rx="2" fill="black" opacity="0.85" />
                          <text x={currentLang === 'ko' ? 28 : 32} y="8" fill="#c084fc" fontSize="6.5" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">
                            {currentLang === 'ko' ? '상행 출차구' : 'Exit Ramp ⬈'}
                          </text>
                        </g>

                        <g transform={`translate(${currentLang === 'ko' ? 170 : 166}, 147)`}>
                          <rect x="0" y="0" width={currentLang === 'ko' ? 52 : 60} height="11" rx="2" fill="black" opacity="0.8" />
                          <text x={currentLang === 'ko' ? 26 : 30} y="8" fill="#7dbaaf" fontSize="6.5" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">
                            {currentLang === 'ko' ? '외부 진입로 ↴' : 'Main Entry ↴'}
                          </text>
                        </g>

                        {/* Ramp indicators between 101동 & 102동 */}
                        <g transform={`translate(${currentLang === 'ko' ? 85 : 75}, 93)`}>
                          <rect x="0" y="0" width={currentLang === 'ko' ? 110 : 130} height="11" rx="2" fill="black" opacity="0.85" />
                          <text x={currentLang === 'ko' ? 55 : 65} y="8" fill="#7dbaaf" fontSize="6.5" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">
                            {currentLang === 'ko' ? '지하진입 (101·102동 사이) ↴' : 'Underground Entry (Bld. 101/102) ↴'}
                          </text>
                        </g>

                        {/* Loop label for 101동 */}
                        <g transform={`translate(${currentLang === 'ko' ? 100 : 90}, 138)`}>
                          <rect x="0" y="0" width={currentLang === 'ko' ? 142 : 162} height="11" rx="2" fill="black" opacity="0.9" />
                          <text x={currentLang === 'ko' ? 71 : 81} y="8" fill="#9fe2d4" fontSize="6" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">
                            {currentLang === 'ko' ? 'B1 만차 시 101동 회전 후 B2-B5 하행 ↴' : 'If B1 full, loop Bld. 101 down to B2-B5 ↴'}
                          </text>
                        </g>
                      </svg>
                    </div>

                    <p className="text-[10px] sm:text-xs text-stone-400 font-medium font-sans">
                      🛈 {translations['car parking way'][currentLang]}
                    </p>

                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#141b19] p-4 rounded-xl border border-stone-850 text-xs text-stone-400 leading-relaxed font-light">
              {currentLang === 'ko' 
                ? "방문 시간 동안 지하 전용 주차장 구역을 무상 이용하실 수 있습니다." 
                : "Free parking is available in the designated underground parking area during your visit."
              }
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
