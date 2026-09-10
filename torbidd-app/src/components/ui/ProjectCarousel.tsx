'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Project } from '@/types/project';
import { ProjectCard } from '@/components/ui/ProjectCard';
import { ICONS } from '@/components/ui/Icons';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProjectCarouselProps {
  projects: Project[];
}

export function ProjectCarousel({ projects }: ProjectCarouselProps) {
  const { language } = useLanguage();
  const [itemsPerPage, setItemsPerPage] = useState<number>(2);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  // Responsive items per page detection
  useEffect(() => {
    const updateItemsPerPage = () => {
      if (typeof window !== 'undefined') {
        setItemsPerPage(window.innerWidth < 900 ? 1 : 2);
      }
    };

    updateItemsPerPage();
    window.addEventListener('resize', updateItemsPerPage);
    return () => window.removeEventListener('resize', updateItemsPerPage);
  }, []);

  // Chunk projects into pages based on itemsPerPage
  const pages = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    const chunks: Project[][] = [];
    for (let i = 0; i < projects.length; i += itemsPerPage) {
      chunks.push(projects.slice(i, i + itemsPerPage));
    }
    return chunks;
  }, [projects, itemsPerPage]);

  const totalPages = pages.length;

  // Keep currentIndex bounded when pages change
  if (currentIndex >= totalPages && totalPages > 0) {
    setCurrentIndex(totalPages - 1);
  }

  const goToNext = useCallback(() => {
    if (totalPages <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % totalPages);
  }, [totalPages]);

  const goToPrev = useCallback(() => {
    if (totalPages <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  }, [totalPages]);

  const goToPage = (idx: number) => {
    setCurrentIndex(idx);
  };

  // Autoplay (cycles every 5 seconds, pauses when hovered/touched)
  useEffect(() => {
    if (totalPages <= 1 || isPaused) return;
    const timer = setInterval(() => {
      goToNext();
    }, 5000);
    return () => clearInterval(timer);
  }, [totalPages, isPaused, goToNext]);

  // Touch Swipe Handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;
    const minSwipeDistance = 45;
    if (distance > minSwipeDistance) {
      goToNext();
    } else if (distance < -minSwipeDistance) {
      goToPrev();
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      goToPrev();
    } else if (e.key === 'ArrowRight') {
      goToNext();
    }
  };

  if (!projects || projects.length === 0) {
    return (
      <div className="carousel-empty-state">
        {language === 'th' ? 'ไม่มีรายการประกาศในขณะนี้' : 'No opportunities available at this time.'}
      </div>
    );
  }

  return (
    <div
      className="project-carousel-wrapper"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={language === 'th' ? 'แถบเลื่อนประกาศจัดซื้อจัดจ้าง' : 'Procurement Opportunities Carousel'}
    >
      <div className="carousel-main-area">
        {/* Floating Left Side Arrow Button */}
        {totalPages > 1 && (
          <button
            type="button"
            className="carousel-side-arrow prev"
            onClick={goToPrev}
            aria-label={language === 'th' ? 'หน้าที่แล้ว' : 'Previous Slide'}
          >
            {ICONS.chevronLeft}
          </button>
        )}

        {/* Sliding Viewport */}
        <div
          className="carousel-viewport"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="carousel-track"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {pages.map((pageProjects, pageIdx) => (
              <div
                key={pageIdx}
                className="carousel-page"
                aria-hidden={pageIdx !== currentIndex}
              >
                {pageProjects.map((p) => (
                  <div key={p.externalId} className="carousel-card-wrapper">
                    <ProjectCard project={p} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Floating Right Side Arrow Button */}
        {totalPages > 1 && (
          <button
            type="button"
            className="carousel-side-arrow next"
            onClick={goToNext}
            aria-label={language === 'th' ? 'หน้าถัดไป' : 'Next Slide'}
          >
            {ICONS.chevronRight}
          </button>
        )}
      </div>

      {/* Bottom Controls Bar (Pagination Dots + Page Badge) */}
      {totalPages > 1 && (
        <div className="carousel-bottom-bar">
          <div className="carousel-dots-container" role="tablist" aria-label="Carousel pagination">
            {pages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`carousel-dot ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => goToPage(idx)}
                aria-selected={idx === currentIndex}
                role="tab"
                aria-label={`${language === 'th' ? 'หน้า' : 'Page'} ${idx + 1}`}
              />
            ))}
          </div>

          <div className="carousel-status-indicator">
            <span className="carousel-page-badge">
              {currentIndex + 1} / {totalPages}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
