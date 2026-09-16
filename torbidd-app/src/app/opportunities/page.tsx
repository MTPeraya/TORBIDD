'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Project, ProjectCategory } from '@/types/project';
import { useLanguage } from '@/contexts/LanguageContext';
import { ICONS } from '@/components/ui/Icons';
import { StatCard } from '@/components/ui/StatCard';
import { ProjectCard } from '@/components/ui/ProjectCard';
import {
  formatBudget,
  daysUntil,
  isNew,
} from '@/lib/utils';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/labels';
import { INITIAL_PROJECTS } from '@/lib/initialData';

function OpportunitiesContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('search') || '';

  const { language, L, getLocalized } = useLanguage();
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory | ''>('');
  const [selectedBudget, setSelectedBudget] = useState('');
  const [selectedDeadline, setSelectedDeadline] = useState('');

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setProjects(json.data);
        }
      })
      .catch(() => {});
  }, []);

  const departments = useMemo(() => {
    return Array.from(new Set(projects.map((p) => (getLocalized(p.department) as string))));
  }, [projects, getLocalized]);


  const newCount = useMemo(() => {
    return projects.filter((p) => isNew(p.publishDate)).length;
  }, [projects]);

  const totalBudget = useMemo(() => {
    return projects.reduce((sum, p) => sum + p.budget, 0);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const titleStr = `${p.title.th} ${p.title.en}`.toLowerCase();
        const deptStr = `${p.department.th} ${p.department.en}`.toLowerCase();
        const catStr = p.category.toLowerCase();
        return titleStr.includes(q) || deptStr.includes(q) || catStr.includes(q);
      });
    }

    if (selectedDept) {
      result = result.filter(
        (p) => (getLocalized(p.department) as string) === selectedDept || p.department.th === selectedDept
      );
    }

    if (selectedCategory) {
      result = result.filter((p) => p.category === selectedCategory);
    }

    if (selectedBudget) {
      result = result.filter((p) => {
        switch (selectedBudget) {
          case 'under5m': return p.budget < 5_000_000;
          case '5to10': return p.budget >= 5_000_000 && p.budget <= 10_000_000;
          case '10to20': return p.budget >= 10_000_000 && p.budget <= 20_000_000;
          case 'above20m': return p.budget > 20_000_000;
          default: return true;
        }
      });
    }

    if (selectedDeadline) {
      result = result.filter((p) => {
        const d = daysUntil(p.deadline);
        switch (selectedDeadline) {
          case 'within7': return d >= 0 && d <= 7;
          case 'within30': return d >= 0 && d <= 30;
          case 'moreThan30': return d > 30;
          default: return true;
        }
      });
    }

    return result;
  }, [projects, searchQuery, selectedDept, selectedCategory, selectedBudget, selectedDeadline, getLocalized]);

  return (
    <div className="page-content" id="dashboard-page">
      <div className="page-header">
        <h1 className="page-title">{L('dashboardTitle')}</h1>
        <p className="page-subtitle">{L('dashboardSub')}</p>
      </div>

      {/* Stats Cards Row */}
      <div className="stats-row">
        <StatCard
          label={L('totalOpps')}
          value={projects.length}
          change={`+${newCount} ${L('newThisWeek')}`}
          changeType="positive"
          icon={ICONS.target}
          iconColor="blue"
        />

        <StatCard
          label={L('newPublished')}
          value={newCount}
          change={L('inPast3days')}
          changeType="positive"
          icon={ICONS.star}
          iconColor="green"
        />
        <StatCard
          label={L('totalBudget')}
          value={formatBudget(totalBudget, language)}
          change={`${projects.length} ${L('projects')}`}
          changeType="neutral"
          icon={ICONS.dollarSign}
          iconColor="teal"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="search-filter-bar">
        <div className="search-input-wrapper">
          {ICONS.search}
          <input
            type="text"
            className="search-input"
            id="searchInput"
            placeholder={L('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          id="filterDept"
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
        >
          <option value="">{L('allDepts')}</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          id="filterCategory"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as ProjectCategory | '')}
        >
          <option value="">{L('allCategories')}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[language][c]}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          id="filterBudget"
          value={selectedBudget}
          onChange={(e) => setSelectedBudget(e.target.value)}
        >
          <option value="">{L('allBudgets')}</option>
          <option value="under5m">{L('under5m')}</option>
          <option value="5to10">{L('range5to10')}</option>
          <option value="10to20">{L('range10to20')}</option>
          <option value="above20m">{L('above20m')}</option>
        </select>

        <select
          className="filter-select"
          id="filterDeadline"
          value={selectedDeadline}
          onChange={(e) => setSelectedDeadline(e.target.value)}
        >
          <option value="">{L('allDeadlines')}</option>
          <option value="within7">{L('within7days')}</option>
          <option value="within30">{L('within30days')}</option>
          <option value="moreThan30">{L('moreThan30')}</option>
        </select>
      </div>

      {/* Projects Grid or No Results */}
      {filteredProjects.length === 0 ? (
        <div className="no-results">
          {ICONS.search}
          <h3>{L('noResults')}</h3>
          <p>{L('noResultsDesc')}</p>
        </div>
      ) : (
        <div className="projects-grid">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.externalId} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<div className="page-content"><p>Loading opportunities...</p></div>}>
      <OpportunitiesContent />
    </Suspense>
  );
}
