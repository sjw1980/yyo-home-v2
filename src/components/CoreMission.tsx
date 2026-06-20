import { motion } from 'motion/react';
import { Brain, Workflow, Fingerprint, Lock, Command, Sparkles } from 'lucide-react';
import { missions, translations } from '../data';

interface CoreMissionProps {
  currentLang: 'ko' | 'en';
}

const iconMap: Record<string, any> = {
  Brain,
  Workflow,
  Fingerprint,
  Lock,
  Command
};

export default function CoreMission({ currentLang }: CoreMissionProps) {
  return (
    <section id="mission" className="py-24 bg-[#0d1111] text-stone-100 border-b border-[#212927]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-center justify-center space-x-2 msg-bubble bg-[#56807d]/10 border border-[#71a09d]/30 px-4 py-1.5 rounded-full w-fit mx-auto text-[#7dbaaf] mb-4"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs uppercase tracking-[0.25em] font-semibold">
              {translations['Our Core Mission'][currentLang]}
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-white"
          >
            {currentLang === 'ko' ? '윤율온의 미래 지향 핵심 미션' : 'Future-Oriented Core Missions of YYO'}
          </motion.h2>
          <div className="mt-4 w-12 h-[2px] bg-[#7dbaaf] mx-auto" />
          <p className="mt-4 text-xs sm:text-sm text-stone-400 font-light leading-relaxed">
            {currentLang === 'ko' 
              ? '완벽한 전장 품질과 안전 규격을 위해 윤율온 엔지니어들이 지향하는 기술적 정점입니다.'
              : 'The technical targets pursued by YYO engineers for perfect automotive quality and standard compliance.'
            }
          </p>
        </div>

        {/* Mission Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {missions.map((mission, index) => {
            const IconComponent = iconMap[mission.iconName] || Brain;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-[#1c2321] border border-[#313f3c]/40 rounded-2xl p-6 sm:p-8 hover:border-[#7dbaaf]/40 transition-all duration-300 flex flex-col justify-between group shadow-lg"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#56807d]/10 border border-[#71a09d]/20 flex items-center justify-center text-[#7dbaaf] mb-6 group-hover:bg-[#7dbaaf]/20 transition-all duration-300">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3 group-hover:text-[#7dbaaf] transition-colors duration-300">
                    {mission.title[currentLang]}
                  </h3>
                  <p className="text-stone-400 font-light text-xs sm:text-sm leading-relaxed">
                    {mission.content[currentLang]}
                  </p>
                </div>
                <div className="mt-6 text-[10px] font-mono text-stone-600 tracking-wider">
                  MISSION 0{index + 1}
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
