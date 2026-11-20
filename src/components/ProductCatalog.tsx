import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { services, translations } from '../data';
import { ServiceSection } from '../types';
import { Cpu, Wrench, GitMerge, Shield, Layers, HelpCircle, X, ChevronRight, Binary, Terminal } from 'lucide-react';

interface ProductCatalogProps {
  currentLang: 'ko' | 'en';
}

// Map Lucide icons correctly by name
const iconMap: Record<string, any> = {
  Cpu: Cpu,
  Wrench: Wrench,
  GitMerge: GitMerge,
  Shield: Shield,
  Layers: Layers
};

export default function ProductCatalog({ currentLang }: ProductCatalogProps) {
  const [selectedService, setSelectedService] = useState<ServiceSection | null>(null);

  const handleOpenDetail = (service: ServiceSection) => {
    setSelectedService(service);
  };

  return (
    <section id="services" className="py-24 bg-[#141b19] border-b border-[#212927]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Title */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-[10px] sm:text-xs tracking-[0.25em] font-semibold text-[#7dbaaf] uppercase block mb-3">
            YYO ENGINEERING PORTFOLIO
          </span>
          <h2 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {translations['Points We Serve'][currentLang]}
          </h2>
          <div className="mt-4 w-12 h-[2px] bg-[#7dbaaf] mx-auto" />
          <p className="mt-4 text-xs sm:text-sm text-stone-400 font-light leading-relaxed">
            {currentLang === 'ko'
              ? '주식회사 윤율온(YYO)은 풍부한 실무 노하우를 바탕으로 글로벌 표준 규격을 만족하는 프리미엄 차량용 임베디드 및 엔지니어링 기술 솔루션을 설계 및 탑재합니다.'
              : 'Our team delivers highly-specialized engineering stacks crafted under structural functional safety regulations, ensuring reliable performance across automotive systems.'
            }
          </p>
        </div>

        {/* Technical Service Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => {
            const IconComponent = iconMap[service.iconName] || Cpu;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-[#1c2321] rounded-2xl p-8 border border-[#313f3c]/40 hover:border-[#71a09d]/50 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between group h-full cursor-pointer"
                onClick={() => handleOpenDetail(service)}
                id={`service-card-${index}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-[#56807d]/10 border border-[#71a09d]/30 flex items-center justify-center text-[#7dbaaf] transition-transform group-hover:scale-105">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    {service.techDetails && (
                      <span className="text-[9px] font-mono tracking-wider text-stone-500 bg-[#141b19] px-2.5 py-1 rounded-full border border-[#2b3532]">
                        {service.techDetails.standard}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-white tracking-tight mb-3">
                    {service.title[currentLang]}
                  </h3>
                  
                  <p className="text-xs text-stone-400 leading-relaxed font-light mb-6">
                    {service.content[currentLang]}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#313f3c]/40">
                  <span className="text-[10px] font-mono font-medium text-[#7dbaaf] uppercase tracking-wider group-hover:text-[#9fe2d4] transition-colors">
                    {currentLang === 'ko' ? '자세히 보기' : 'Explore Specifications'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-[#7dbaaf] group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Technical Detail Sheet Modal */}
        <AnimatePresence>
          {selectedService && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedService(null)}
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              />

              {/* Modal Box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                id="service-detail-modal"
                className="relative bg-[#1c2321] border border-[#71a09d]/30 rounded-2xl shadow-2xl p-6 sm:p-10 max-w-2xl w-full z-10 text-stone-100 overflow-hidden"
              >
                {/* Tech lines */}
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#56807d] via-[#7dbaaf] to-[#56807d]" />

                {/* Close Trigger Button */}
                <button
                  onClick={() => setSelectedService(null)}
                  className="absolute top-4 right-4 p-2 bg-[#141b19] text-stone-400 hover:text-white rounded-full border border-[#313f3c] transition-colors cursor-pointer"
                  aria-label="Close Details"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#56807d]/20 border border-[#71a09d]/30 flex items-center justify-center text-[#7dbaaf]">
                    {(() => {
                      const Icon = iconMap[selectedService.iconName] || Cpu;
                      return <Icon className="w-5 h-5" />;
                    })()}
                  </div>
                  <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.2em] bg-[#56807d]/10 text-[#7dbaaf] px-3 py-1 rounded-md">
                    {selectedService.techDetails?.standard || 'AUTO STANDARD'}
                  </span>
                </div>

                <h3 className="font-sans text-2xl font-bold tracking-tight text-white mb-4">
                  {selectedService.title[currentLang]}
                </h3>

                <p className="text-sm text-stone-300 leading-relaxed font-light mb-8">
                  {selectedService.content[currentLang]}
                </p>

                {/* Deep engineering block representing real automotive codes */}
                {selectedService.techDetails && (
                  <div className="bg-[#141b19] border border-[#313f3c]/60 rounded-xl p-5 space-y-4">
                    <div className="flex items-center space-x-2 text-xs font-mono text-[#7dbaaf]">
                      <Binary className="w-4 h-4" />
                      <span className="font-bold tracking-wide">TECHNICAL COMPLIANCE & ARCHITECTURES</span>
                    </div>
                    <div className="text-xs text-stone-400 space-y-2 leading-relaxed">
                      <div className="flex items-start">
                        <span className="font-semibold text-stone-300 w-24 flex-shrink-0 font-mono">STANDARD:</span>
                        <span>{selectedService.techDetails.standard}</span>
                      </div>
                      <div className="flex items-start">
                        <span className="font-semibold text-stone-300 w-24 flex-shrink-0 font-mono">CORE SCOPE:</span>
                        <span>{selectedService.techDetails.summary[currentLang]}</span>
                      </div>
                    </div>
                    
                    {/* Simulated code snippet / block based on standard to show extreme technical detail */}
                    <div className="pt-4 border-t border-[#313f3c]/40">
                      <p className="text-[10.5px] font-mono text-stone-500 mb-1.5 flex items-center">
                        <Terminal className="w-3.5 h-3.5 mr-1 text-[#7dbaaf]" />
                        <span>Autosar/RTE Software Component Mock Configuration Frame</span>
                      </p>
                      <pre className="text-[10px] font-mono bg-black/60 text-[#a0c5bd] p-3 rounded-lg overflow-x-auto block border border-[#2b3532]/40 whitespace-pre-wrap">
                        {`/* YYO Auto-generated SW-C Header */
#include "Rte_Diagnostic.h"
#define YYO_ASIL_LEVEL_D

Std_ReturnType Service_Diagnostics_Process(void) {
    if (Rte_Read_Port_SessionState() == YYO_DIAG_ACTIVE) {
        return Rte_Write_Port_DiagResponse(${selectedService.techDetails?.standard.includes('14229') ? '0x50' : '0x00'});
    }
    return RTE_E_OK;
}`}
                      </pre>
                    </div>
                  </div>
                )}

              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </section>
  );
}
