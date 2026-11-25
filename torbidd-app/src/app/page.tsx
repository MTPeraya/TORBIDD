'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Project } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { ProjectCarousel } from '@/components/ui/ProjectCarousel';
import { isClosingSoon } from '@/lib/utils';
import { fetchPublicProjects } from '@/lib/public-project-cache';
import { isContractAwarded } from '@/services/procurement-filter';
import {
  HomeFilterTab,
  filterHomeProjects,
  getHomeOpportunitiesUrl,
} from '@/components/home/HomeFilterLogic';
import { HomeWorkflowSection } from '@/components/home/HomeWorkflowSection';

export default function HomePage() {
  const router = useRouter();
  const { language, L } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchVal, setSearchVal] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<HomeFilterTab>('all');

  const loadProjects = useCallback(() => {
    fetchPublicProjects<{ data?: Project[] }>('/api/projects?limit=1000&all=true')
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          setProjects(json.data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const closingCount = projects.filter((p) => !isContractAwarded(p) && isClosingSoon(p.deadline)).length;
  const highValueCount = projects.filter((p) => (p.budget || 0) >= 10_000_000).length;
  const aiDataCount = projects.filter((p) => p.category === 'AI' || p.category === 'Data Analytics').length;

  const filteredProjects = useMemo(() => {
    return filterHomeProjects(projects, activeFilterTab);
  }, [projects, activeFilterTab]);

  const filteredBudget = useMemo(() => {
    return filteredProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
  }, [filteredProjects]);

  // Cap at top 8 items for the carousel display
  const carouselProjects = useMemo(() => {
    return filteredProjects.slice(0, 8);
  }, [filteredProjects]);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      router.push(`/opportunities?search=${encodeURIComponent(searchVal.trim())}`);
    } else {
      router.push('/opportunities');
    }
  };

  const handleViewAll = () => {
    router.push(getHomeOpportunitiesUrl(activeFilterTab));
  };

  return (
    <div className="home-page" id="home-page">
      {/* Main Master Hero Area (Floating on Gradient Background) */}
      <div className="home-hero-wrapper">
        <div className="hero-section">
          <div className="hero-orbs">
            <div className="hero-orb hero-orb-1"></div>
            <div className="hero-orb hero-orb-2"></div>
            <div className="hero-orb hero-orb-3"></div>
          </div>

          <div className="hero-content anim-fade-up">
            <div className="hero-brand-name">TORBIDD</div>
            <div>
              <span className="hero-badge">
                <span className="hero-badge-dot"></span>
                <span>{L('heroBadge')}</span>
              </span>
            </div>
            <h1 className="hero-title">{L('heroTitle')}</h1>
            <p className="hero-subtitle">{L('heroSubtitle')}</p>

            <form className="hero-search-bar" id="heroSearchForm" onSubmit={handleHeroSearch}>
              {ICONS.search}
              <input
                type="text"
                id="heroSearchInput"
                placeholder={L('searchPlaceholder')}
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
              />
              <button type="submit">{L('searchBtn')}</button>
            </form>
          </div>

          {/* Floating Stats Chips */}
          <div className="hero-stats-row anim-fade-up anim-delay-1">
            <div className="hero-stat-chip" onClick={() => router.push('/opportunities')} role="button" tabIndex={0}>
              <span className="hero-stat-num">{projects.length}</span>
              <span className="hero-stat-label">
                {language === 'th' ? 'โอกาสที่เปิดรับ' : 'Active Opportunities'}
              </span>
            </div>

            <div className="hero-stat-chip" onClick={() => router.push('/historical')} role="button" tabIndex={0}>
              <span className="hero-stat-num">฿{(totalBudget / 1_000_000).toFixed(0)}M</span>
              <span className="hero-stat-label">
                {language === 'th' ? 'มูลค่ารวม' : 'Total Value'}
              </span>
            </div>

            <div
              className="hero-stat-chip accent"
              onClick={() => router.push('/opportunities?deadline=within7&sortBy=deadline_asc')}
              role="button"
              tabIndex={0}
              title={language === 'th' ? 'ดูโครงการที่ใกล้ปิดรับข้อเสนอภายใน 7 วัน' : 'View projects closing within 7 days'}
            >
              <span className="hero-stat-num">{closingCount}</span>
              <span className="hero-stat-label">
                {language === 'th' ? 'ใกล้ปิดรับ 7 วัน' : 'Closing in 7 days'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Core Capabilities Section (ขีดความสามารถหลักของระบบ) */}
      <div className="home-capabilities-section">
        <div className="home-capabilities-content">
          <div className="section-header capabilities-section-header anim-fade-up anim-delay-2">
            <div className="section-header-line"></div>
            <h2 className="section-header-title">{L('exploreTitle')}</h2>
            <div className="section-header-line"></div>
          </div>

          <div className="landing-grid anim-fade-up anim-delay-2">
            <div className="landing-card" onClick={() => router.push('/opportunities')} role="button" tabIndex={0}>
              <div className="landing-card-number">01</div>
              <div className="landing-card-icon">{ICONS.file}</div>
              <h3 className="landing-card-title">{L('cap1Title')}</h3>
              <p className="landing-card-desc">{L('cap1Desc')}</p>
              <span className="landing-card-link">{L('cap1Link')}</span>
            </div>

            <div className="landing-card" onClick={() => router.push('/opportunities')} role="button" tabIndex={0}>
              <div className="landing-card-number">02</div>
              <div className="landing-card-icon">{ICONS.shield}</div>
              <h3 className="landing-card-title">{L('cap2Title')}</h3>
              <p className="landing-card-desc">{L('cap2Desc')}</p>
              <span className="landing-card-link">{L('cap2Link')}</span>
            </div>

            <div className="landing-card" onClick={() => router.push('/historical')} role="button" tabIndex={0}>
              <div className="landing-card-number">03</div>
              <div className="landing-card-icon">{ICONS.chart}</div>
              <h3 className="landing-card-title">{L('cap3Title')}</h3>
              <p className="landing-card-desc">{L('cap3Desc')}</p>
              <span className="landing-card-link">{L('cap3Link')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upgraded Section Below Core Capabilities: Live Tender Showcase + Workflow + Footer */}
      <div className="home-bottom-section">
        <div className="home-bottom-content">
          {/* Live Showcase Header with Filter Pills and Dynamic CTA */}
          <div className="home-showcase-header anim-fade-up anim-delay-3">
            <div className="home-showcase-title-group">
              <h2 className="home-showcase-title">{L('liveShowcaseTitle')}</h2>
              <p className="home-showcase-subtitle">{L('liveShowcaseSubtitle')}</p>
            </div>

            <div className="home-showcase-controls">
              <div className="home-filter-pills" role="tablist" aria-label="Tender filter options">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeFilterTab === 'all'}
                  className={`home-filter-pill ${activeFilterTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveFilterTab('all')}
                >
                  <span>{L('tabFilterAll')}</span>
                  <span className="home-filter-count">{projects.length}</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeFilterTab === 'closingSoon'}
                  className={`home-filter-pill ${activeFilterTab === 'closingSoon' ? 'active' : ''}`}
                  onClick={() => setActiveFilterTab('closingSoon')}
                >
                  <span>{L('tabFilterClosingSoon')}</span>
                  <span className="home-filter-count">{closingCount}</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeFilterTab === 'highValue'}
                  className={`home-filter-pill ${activeFilterTab === 'highValue' ? 'active' : ''}`}
                  onClick={() => setActiveFilterTab('highValue')}
                >
                  <span>{L('tabFilterHighValue')}</span>
                  <span className="home-filter-count">{highValueCount}</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeFilterTab === 'aiData'}
                  className={`home-filter-pill ${activeFilterTab === 'aiData' ? 'active' : ''}`}
                  onClick={() => setActiveFilterTab('aiData')}
                >
                  <span>{L('tabFilterAiData')}</span>
                  <span className="home-filter-count">{aiDataCount}</span>
                </button>
              </div>

              <button
                type="button"
                className="home-view-all-btn"
                onClick={handleViewAll}
                title={L('viewAllOpportunitiesBtn')}
              >
                <span>
                  {language === 'th'
                    ? `ดูทั้งหมด ${filteredProjects.length} โครงการ (฿${(filteredBudget / 1_000_000).toFixed(0)}M) →`
                    : `View all ${filteredProjects.length} tenders (฿${(filteredBudget / 1_000_000).toFixed(0)}M) →`}
                </span>
              </button>
            </div>
          </div>

          {/* Carousel rendering the top 8 filtered items */}
          <div className="anim-fade-up anim-delay-3" style={{ marginBottom: 48 }}>
            <ProjectCarousel projects={carouselProjects} />
          </div>

          {/* "How TORBIDD Works" 3-Step Journey Banner */}
          <HomeWorkflowSection />

          {/* Upgraded Website Maker Contact & Affiliation Footer */}
          <footer className="home-footer anim-fade-up anim-delay-3" id="contact-footer">
            <div className="footer-direct-wrapper">
              <div className="footer-nav-row">
                <div className="footer-brand-title">TORBIDD</div>
                <div className="footer-quick-links">
                  <Link href="/" className="footer-link">
                    {L('navHome')}
                  </Link>
                  <Link href="/opportunities" className="footer-link">
                    {L('navDashboard')}
                  </Link>
                  <Link href="/historical" className="footer-link">
                    {L('navHistorical')}
                  </Link>
                  <Link href="/saved" className="footer-link">
                    {L('navSaved')}
                  </Link>
                </div>
              </div>
              </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
