import { Phone, Mail, MapPin, ShieldAlert, Award, FileText } from 'lucide-react';
import { translations } from '../data';

interface FooterProps {
  currentLang: 'ko' | 'en';
  onNavigate: (section: string) => void;
}

export default function Footer({ currentLang, onNavigate }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#101514] text-stone-300 py-16 font-sans border-t border-[#313f3c]/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Segment Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-12 border-b border-[#212927]">
          
          {/* Logo / Tagline */}
          <div className="md:col-span-4 space-y-4">
            <span className="font-sans text-2xl font-bold tracking-[0.15em] text-white block select-none">
              YYO
            </span>
            <p className="text-xs text-stone-400 font-sans tracking-wide">
              {translations['Company Register Title'][currentLang]}
            </p>
            <p className="text-xs text-stone-500 font-light leading-relaxed max-w-sm">
              {currentLang === 'ko' 
                ? "인위적이지 않고 본래 그대로 흐르며 기술적 수성을 사수합니다. 소프트웨어 정의 자동차(SDV)를 밝히는 정밀 부트로더 하드웨어 및 칩셋 협업 전문 기업."
                : "Engineered with maximum digital focus and safety. Developing standard Software-Defined Vehicle (SDV) middleware platform layers and deep embedded diagnostics."
              }
            </p>
          </div>

          {/* Quick links */}
          <div className="md:col-span-2 space-y-3 text-xs">
            <h4 className="text-[10px] uppercase font-bold text-[#7dbaaf] tracking-widest">
              NAVIGATION
            </h4>
            <ul className="space-y-2 font-light text-stone-400">
              <li>
                <button onClick={() => onNavigate('about')} className="hover:text-white transition cursor-pointer select-none">
                  {translations['About'][currentLang]}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('services')} className="hover:text-white transition cursor-pointer select-none">
                  {translations['Points We Serve'][currentLang]}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('mission')} className="hover:text-white transition cursor-pointer select-none">
                  {translations['Our Core Mission'][currentLang]}
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('location')} className="hover:text-white transition cursor-pointer select-none">
                  {translations['Find Us'][currentLang]}
                </button>
              </li>
            </ul>
          </div>

          {/* Core assurances */}
          <div className="md:col-span-3 space-y-3 text-xs">
            <h4 className="text-[10px] uppercase font-bold text-[#7dbaaf] tracking-widest">
              STANDARDS & ASSURANCES
            </h4>
            <ul className="space-y-2.5 text-stone-500 font-light leading-relaxed">
              <li className="flex items-center space-x-2">
                <Award className="w-3.5 h-3.5 text-[#56807d]" />
                <span>ISO 26262 ASIL-D Safety Confirmed</span>
              </li>
              <li className="flex items-center space-x-2">
                <ShieldAlert className="w-3.5 h-3.5 text-[#56807d]" />
                <span>UN ECE R155/R156 Cybersecurity</span>
              </li>
              <li className="flex items-center space-x-2">
                <FileText className="w-3.5 h-3.5 text-[#56807d]" />
                <span>AUTOSAR Standard Platforms Bound</span>
              </li>
            </ul>
          </div>

          {/* Contacts info */}
          <div className="md:col-span-3 space-y-3 text-xs">
            <h4 className="text-[10px] uppercase font-bold text-[#7dbaaf] tracking-widest">
              GET IN TOUCH
            </h4>
            <ul className="space-y-2.5 text-stone-400 font-light">
              <li className="flex items-start space-x-2">
                <Mail className="w-3.5 h-3.5 text-stone-500 flex-shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span>ceo@yyo.co.kr</span>
                  <span>cto@yyo.co.kr</span>
                </div>
              </li>
              <li className="flex items-start space-x-2">
                <MapPin className="w-3.5 h-3.5 text-stone-500 flex-shrink-0 mt-0.5" />
                <span>{translations['YYO address'][currentLang]}</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Legal disclosures & registration representing Seo Jae-woo */}
        <div className="pt-8 text-[11px] text-stone-500 leading-relaxed font-light space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:justify-between sm:items-center">
          <div className="space-y-1">
            <p className="font-semibold text-stone-400">{translations['Company Register Title'][currentLang]}</p>
            <p>
              {translations['Company Register Body'][currentLang]}
            </p>
          </div>
          <div className="pt-4 sm:pt-0 text-left sm:text-right text-[10px] font-mono tracking-wider text-stone-600">
            <p>{translations['Footer Disclaimer'][currentLang]}</p>
            <p className="mt-1">Handcrafted with premium precision & safety.</p>
          </div>
        </div>

      </div>
    </footer>
  );
}
