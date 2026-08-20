'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Project } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { ProjectCard } from '@/components/ui/ProjectCard';
import { isClosingSoon } from '@/lib/utils';

// Static fallback data so the page renders even before MongoDB is connected
import { INITIAL_PROJECTS } from '@/lib/initialData';

export default function HomePage() {
  const router = useRouter();
  const { language, L } = useLanguage();
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [searchVal, setSearchVal] = useState('');

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setProjects(json.data);
        }
      })
      .catch(() => {
        // Use fallback projects if API isn't populated yet
      });
  }, []);

  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const closingCount = projects.filter((p) => isClosingSoon(p.deadline)).length;
  const recentProjects = projects.slice(0, 4);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      router.push(`/opportunities?search=${encodeURIComponent(searchVal.trim())}`);
    } else {
      router.push('/opportunities');
    }
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

            <div className="hero-stat-chip accent" onClick={() => router.push('/opportunities')} role="button" tabIndex={0}>
              <span className="hero-stat-num">{closingCount}</span>
              <span className="hero-stat-label">
                {language === 'th' ? 'ใกล้ปิดรับ 7 วัน' : 'Closing in 7 days'}
              </span>
            </div>
          </div>

          {/* Core Capabilities */}
          <div className="section-header hero-inner-divider anim-fade-up anim-delay-2">
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

            <div className="landing-card" onClick={() => router.push('/opportunities/1')} role="button" tabIndex={0}>
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

      {/* Recent Tenders Section */}
      <div className="home-bottom-section">
        <div className="home-bottom-content">
          <div className="home-section-header anim-fade-up anim-delay-3">
            <h2 className="home-section-title">{L('recentOpps')}</h2>
            <Link href="/opportunities" className="home-section-link">
              {L('viewAll')} ({projects.length}) →
            </Link>
          </div>

          <div className="recent-projects-list anim-fade-up anim-delay-3">
            {recentProjects.map((p) => (
              <ProjectCard key={p.externalId} project={p} />
            ))}
          </div>

          {/* Footer */}
          <div className="home-footer anim-fade-up anim-delay-3">
            <span className="analysis-disclaimer">{L('disclaimer')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
