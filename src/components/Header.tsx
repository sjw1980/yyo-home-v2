import { useState } from 'react';
import { Menu, X, Globe, Cpu, ShieldAlert, Navigation, Mail, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations } from '../data';
import YOLogo from './YOLogo';

interface HeaderProps {
  currentLang: 'ko' | 'en';
  onToggleLang: () => void;
  activeSection: string;
  onNavigate: (sectionId: string) => void;
}

export default function Header({
  currentLang,
  onToggleLang,
  activeSection,
  onNavigate
}: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'about', label: translations['About'][currentLang], icon: Cpu },
    { id: 'services', label: translations['Points We Serve'][currentLang], icon: Activity },
    { id: 'mission', label: translations['Our Core Mission'][currentLang], icon: ShieldAlert },
    { id: 'emulator', label: translations['Diagnostics Simulator'][currentLang], icon: Cpu },
    { id: 'contact', label: translations['Contact'][currentLang], icon: Mail },
    { id: 'location', label: translations['Find Us'][currentLang], icon: Navigation }
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#1c2321]/95 text-stone-100 backdrop-blur-md border-b border-[#313f3c]/60 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo */}
          <div 
            className="flex-shrink-0 flex items-center cursor-pointer group" 
            onClick={() => onNavigate('hero')}
            id="header-logo"
          >
            {/* Beautiful Custom App Logo */}
            <YOLogo variant="original" size={40} className="mr-3 transition-transform group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="font-sans text-xl font-bold tracking-[0.15em] text-white">
                YYO
              </span>
              <span className="font-sans text-[10px] tracking-wider text-[#9bb09e] font-light mt-[-2px]">
                {currentLang === 'ko' ? '주식회사 윤율온' : 'Yunyulon'}
              </span>
            </div>
          </div>

          {/* Desktop Navigation Menu */}
          <nav className="hidden lg:flex items-center space-x-8">
            {menuItems.map((item) => {
              const isSelected = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  id={`nav-${item.id}`}
                  className={`text-xs tracking-wider transition-all duration-300 relative py-2 font-medium uppercase select-none cursor-pointer
                    ${isSelected 
                      ? 'text-[#7dbaaf]' 
                      : 'text-stone-300 hover:text-white'
                    }
                  `}
                >
                  <span>{item.label}</span>
                  {isSelected && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#7dbaaf]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Language Switch Button */}
          <div className="flex items-center space-x-4">
            <button
              onClick={onToggleLang}
              id="btn-toggle-lang"
              className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-[#313f3c] hover:bg-[#313f3c]/40 hover:border-[#71a09d]/30 transition-all text-xs tracking-wider text-[#9bb09e] hover:text-[#7dbaaf] font-semibold cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{currentLang === 'en' ? '한국어' : 'English'}</span>
            </button>

            {/* Mobile Drawer Trigger Icon */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              id="btn-mobile-menu"
              className="lg:hidden p-2 text-stone-300 hover:text-white transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-[#1c2321] border-b border-[#313f3c]/60 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                const isSelected = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setIsOpen(false);
                      onNavigate(item.id);
                    }}
                    id={`mobile-nav-${item.id}`}
                    className={`flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-xs tracking-wider transition-all font-medium uppercase
                      ${isSelected
                        ? 'bg-[#56807d]/20 text-[#7dbaaf] border-l-2 border-[#7dbaaf]'
                        : 'text-stone-300 hover:bg-[#313f3c]/40 hover:text-white'
                      }
                    `}
                  >
                    <IconComponent className="w-4 h-4 text-[#9bb09e]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
