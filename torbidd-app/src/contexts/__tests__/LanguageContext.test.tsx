import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../LanguageContext';

describe('LanguageContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'torbidd_locale=; max-age=0; path=/;';
    window.history.pushState(null, '', '/');
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LanguageProvider>{children}</LanguageProvider>
  );

  it('defaults to Thai language', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    expect(result.current.language).toBe('th');
  });

  it('switches language and sets cookie and localStorage', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    act(() => {
      result.current.setLanguage('en');
    });
    expect(result.current.language).toBe('en');
    expect(localStorage.getItem('torbidd_lang')).toBe('en');
    expect(document.cookie).toContain('torbidd_locale=en');
  });

  it('getLocalized returns Thai text when language is th', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    const obj = {
      th: 'สำนักสิ่งแวดล้อม',
      en: 'Environment Department',
    };
    expect(result.current.getLocalized(obj)).toBe('สำนักสิ่งแวดล้อม');
  });

  it('getLocalized returns English text when language is en', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    act(() => {
      result.current.setLanguage('en');
    });
    const obj = {
      th: 'สำนักสิ่งแวดล้อม',
      en: 'Environment Department',
    };
    expect(result.current.getLocalized(obj)).toBe('Environment Department');
  });

  it('getLocalized automatically translates Thai department if en is identical to th', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    act(() => {
      result.current.setLanguage('en');
    });
    const obj = {
      th: 'สำนักสิ่งแวดล้อม',
      en: 'สำนักสิ่งแวดล้อม', // untranslated / duplicated Thai
    };
    expect(result.current.getLocalized(obj)).toBe('Environment Department');
  });

  it('getLocalized automatically translates Thai project title if en is identical to th', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    act(() => {
      result.current.setLanguage('en');
    });
    const obj = {
      th: 'โครงการพัฒนาระบบศูนย์สื่อการเรียนรู้ออนไลน์',
      en: 'โครงการพัฒนาระบบศูนย์สื่อการเรียนรู้ออนไลน์',
    };
    expect(result.current.getLocalized(obj)).toBe(
      'BMA Online Learning Management System (LMS) System Development Project',
    );
  });

  it('getLocalized translates plain Thai department string when language is en', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    act(() => {
      result.current.setLanguage('en');
    });
    expect(result.current.getLocalized('สำนักการจราจรและขนส่ง')).toBe(
      'Traffic and Transportation Department',
    );
  });

  it('getLocalized translates plain Thai procurement type string when language is en', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    act(() => {
      result.current.setLanguage('en');
    });
    expect(result.current.getLocalized('วิธีเฉพาะเจาะจง')).toBe('Specific Method');
    expect(result.current.getLocalized('วิธีคัดเลือก')).toBe('Selective Method');
  });
});

