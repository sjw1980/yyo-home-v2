import { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import BrandStory from './components/BrandStory';
import ProductCatalog from './components/ProductCatalog';
import CoreMission from './components/CoreMission';
import GiftService from './components/GiftService';
import RelaxationTest from './components/RelaxationTest';
import Footer from './components/Footer';

export default function App() {
  const [currentLang, setCurrentLang] = useState<'ko' | 'en'>('ko');
  const [activeSection, setActiveSection] = useState('hero');

  // Handle language toggling
  const handleToggleLang = () => {
    setCurrentLang((prev) => (prev === 'ko' ? 'en' : 'ko'));
  };

  // Tech blog external/simulated link
  const handleOpenTechBlog = () => {
    // Open standard blog representation or notify user
    const blogUrl = 'http://yyo.co.kr';
    window.open(blogUrl, '_blank');
  };

  // Smooth Scroll Navigation to element IDs
  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId);
    
    if (sectionId === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="bg-[#0d1111] min-h-screen text-stone-100 selection:bg-[#7dbaaf]/25 selection:text-[#a0c5bd] font-sans antialiased">
      
      {/* Top Header Navigation bar */}
      <Header
        currentLang={currentLang}
        onToggleLang={handleToggleLang}
        activeSection={activeSection}
        onNavigate={handleNavigate}
      />

      {/* Main Sections */}
      <main>
        
        {/* Hero Section */}
        <Hero
          currentLang={currentLang}
          onExploreServices={() => handleNavigate('services')}
          onOpenEmulator={() => handleNavigate('emulator')}
          onOpenTechBlog={handleOpenTechBlog}
        />

        {/* Corporate Brand Description (Look Us, what we are) */}
        <BrandStory currentLang={currentLang} />

        {/* Points We Serve (Automotive specialized engineering grid) */}
        <ProductCatalog currentLang={currentLang} />

        {/* Core Missions */}
        <CoreMission currentLang={currentLang} />

        {/* Real-time CAN Bus Diagnostics & Secure OTA Simulator */}
        <RelaxationTest currentLang={currentLang} />

        {/* 사옥 위치, 주차안내, 문의하기 */}
        <GiftService currentLang={currentLang} />

      </main>

      {/* Corporate Footers */}
      <Footer
        currentLang={currentLang}
        onNavigate={handleNavigate}
      />

    </div>
  );
}
