import { motion } from 'motion/react';
import { ArrowRight, Cpu, Code2, Terminal } from 'lucide-react';
import { translations } from '../data';

interface HeroProps {
  currentLang: 'ko' | 'en';
  onExploreServices: () => void;
  onOpenEmulator: () => void;
  onOpenTechBlog: () => void;
}

export default function Hero({
  currentLang,
  onExploreServices,
  onOpenEmulator,
  onOpenTechBlog
}: HeroProps) {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center bg-[#0d1111] overflow-hidden py-16">
      
      {/* Background Matrix/Grid Overlay to look extremely technical */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#56807d_1.2px,transparent_1.2px)] [background-size:24px_24px] z-0" />

      {/* Cyberpunk cockpit / electric vehicle Unsplash background */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&q=80&w=1920"
          alt="Futuristic Automotive Dashboard HUD"
          className="w-full h-full object-cover filter brightness-[0.35] contrast-[1.05]"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1111] via-[#0d1111]/70 to-[#1c2321]/60" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-left text-white mt-8">
        <div className="max-w-3xl">
          
          {/* Tech Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="inline-flex items-center space-x-2 bg-[#56807d]/20 backdrop-blur-md border border-[#71a09d]/30 px-4 py-2 rounded-full mb-8"
          >
            <Cpu className="w-3.5 h-3.5 text-[#7dbaaf]" />
            <span className="text-[10px] sm:text-xs tracking-[0.25em] font-bold text-[#b4cfc9] uppercase">
              {translations['Start-up tech. company'][currentLang]} — YYO
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.2 }}
            className="font-sans text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-white mb-6"
          >
            <span className="block font-medium text-[#7dbaaf] text-lg sm:text-2xl tracking-[0.1em] mb-3 font-mono">
              {translations['Automotive With AI'][currentLang]}
            </span>
            <span className="leading-snug">
              {translations['Yunyulon Tagline'][currentLang]}
            </span>
          </motion.h1>

          {/* Slogan details */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.4 }}
            className="text-stone-300 font-light text-sm sm:text-base leading-relaxed max-w-2xl mb-10 font-sans"
          >
            {translations['Yunyulon Description'][currentLang]}
          </motion.p>

          {/* Interactive CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.6 }}
            className="flex flex-wrap gap-4 items-center"
          >
            <button
              onClick={onExploreServices}
              id="hero-explore-services"
              className="group flex items-center justify-center space-x-3 bg-[#7dbaaf] hover:bg-[#68a398] text-[#0d1111] transition-all duration-305 px-6 sm:px-8 py-3.5 rounded-xl text-xs sm:text-sm font-semibold tracking-wider cursor-pointer"
            >
              <span>{currentLang === 'ko' ? '제공 기술 서비스' : 'Technical Services'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </button>

            <button
              onClick={onOpenEmulator}
              id="hero-open-emulator"
              className="flex items-center justify-center space-x-2 border border-[#7dbaaf]/40 bg-stone-900/40 backdrop-blur-sm hover:bg-[#7dbaaf]/15 transition-all px-6 sm:px-8 py-3.5 rounded-xl text-[#7dbaaf] text-xs sm:text-sm font-medium tracking-wider cursor-pointer"
            >
              <Terminal className="w-4 h-4 mr-1 animate-pulse" />
              <span>{translations['Diagnostics Simulator'][currentLang]}</span>
            </button>

            <button
              onClick={onOpenTechBlog}
              id="hero-open-blog"
              className="flex items-center justify-center space-x-2 border border-[#313f3c] bg-transparent hover:bg-white/5 transition-all px-6 sm:px-8 py-3.5 rounded-xl text-stone-300 text-xs sm:text-sm font-light tracking-widest cursor-pointer"
            >
              <Code2 className="w-4 h-4 mr-1 text-[#9bb09e]" />
              <span>{translations['Start-up tech. company'][currentLang]} — {translations['Get started'][currentLang]}</span>
            </button>
          </motion.div>

        </div>

        {/* Technical vertical status log sidebars representing professional automotive signals */}
        <div className="absolute right-8 bottom-4 hidden xl:flex flex-col items-end space-y-3 font-mono text-[10px] text-stone-500">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7dbaaf] animate-ping" />
            <span className="text-[#a4bca8]">SYS: ACTIVE_OK</span>
          </div>
          <p>ISO 26262 / ASIL-D Compliant Process</p>
          <p>DoIP Standard: ISO 13400</p>
          <p>AUTOSAR Core: Classic & Adaptive Stack</p>
        </div>

      </div>
    </section>
  );
}
