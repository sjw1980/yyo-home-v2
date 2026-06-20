import { motion } from 'motion/react';
import { translations } from '../data';
import { Award, ShieldCheck, Heart, Sparkles, Terminal, Activity } from 'lucide-react';

interface BrandStoryProps {
  currentLang: 'ko' | 'en';
}

export default function BrandStory({ currentLang }: BrandStoryProps) {
  return (
    <section id="about" className="py-24 bg-stone-900 text-stone-100 overflow-hidden border-b border-[#212927]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Header Block */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-center justify-center space-x-2 msg-bubble bg-[#56807d]/10 border border-[#71a09d]/30 px-4 py-1.5 rounded-full w-fit mx-auto text-[#7dbaaf] mb-6"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs uppercase tracking-[0.25em] font-light">
              {translations['Look us, What we are'][currentLang]}
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="font-sans text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white"
          >
            {translations['About Company Name'][currentLang]}
          </motion.h2>
          <div className="mt-4 w-12 h-[2px] bg-[#7dbaaf] mx-auto" />
        </div>

        {/* Storytelling Grid (Image + Text) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
          
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-7 space-y-6 text-stone-300 font-sans text-sm sm:text-base leading-relaxed font-light"
          >
            <p className="text-lg text-white font-medium pl-4 border-l-2 border-[#7dbaaf]">
              {currentLang === 'ko' 
                ? "“오직 자동차 전장이지만, 자동차 전장과 관련된 모든 것을 깊이 있게 해결합니다.”" 
                : "“Only Automotive, but we cover the absolute depths of everything within Automotive.”"
              }
            </p>
            <p className="text-stone-400">
              {translations['Yunyulon History Body'][currentLang]}
            </p>
            
            <div className="pt-6 border-t border-stone-800 flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#56807d]/20 border border-[#71a09d]/30 flex items-center justify-center text-[#7dbaaf] font-bold text-sm">
                YYO
              </div>
              <div className="text-xs tracking-widest text-[#9bb09e]">
                <span className="font-semibold text-white">주식회사 윤율온</span>
                <span className="text-stone-600 mx-2">|</span>
                <span className="text-stone-400">CEO LEE JI HYE (이지혜)</span>
              </div>
            </div>
          </motion.div>

          {/* Elegant Visual Side with high-tech dashboard HUD mockup representing real automotive start-up */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-5 relative"
          >
            <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-[#313f3c]/50 relative group bg-black/40">
              <img
                src="https://images.unsplash.com/photo-1508974239320-0a029497e820?auto=format&fit=crop&q=80&w=800"
                alt="High-Tech Diagnostic Control HUD Simulation"
                className="w-full h-full object-cover filter brightness-[0.6] saturation-[0.85] transition-transform duration-700 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-[#1c2321]/30 mix-blend-multiply" />
              
              {/* Floating diagnostic telemetry box inside graphic to keep UI highly unique and distinct */}
              <div className="absolute inset-x-6 bottom-6 bg-[#131a19]/90 border border-[#313f3c] p-6 rounded-xl backdrop-blur-md">
                <span className="text-[10px] tracking-[0.3em] font-bold text-[#7dbaaf] block mb-1">
                  YYO CORE INFRASTRUCTURE
                </span>
                <span className="text-xs font-mono text-stone-300 leading-relaxed block">
                  {currentLang === 'ko' 
                    ? "✓ 오토사 표준 기반 전장 이식\n✓ 무선 펌웨어(OTA) 정밀 플래시 전송\n✓ 실시간 UDS 기반 자가 진단 데이터 수집"
                    : "✓ AUTOSAR Platform Standard Integrated\n✓ Over-the-Air Bootloader Flash Operations\n✓ In-vehicle CAN message analyzer telemetry"
                  }
                </span>
              </div>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
