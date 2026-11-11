import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginPage from '../page';
import { LanguageProvider } from '@/contexts/LanguageContext';

// Mock next/navigation
let mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

// Mock AuthContext
const mockLogin = jest.fn();
const mockLogout = jest.fn();
let mockAuthValues = {
  user: null as any,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: false,
  login: mockLogin,
  logout: mockLogout,
  refreshUser: jest.fn(),
  updateProfile: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthValues,
}));

describe('LoginPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockAuthValues = {
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
      login: mockLogin,
      logout: mockLogout,
      refreshUser: jest.fn(),
      updateProfile: jest.fn(),
    };
  });

  const renderLoginPage = () => {
    return render(
      <LanguageProvider>
        <LoginPage />
      </LanguageProvider>,
    );
  };

  it('renders Google sign-in button when user is not authenticated', () => {
    mockAuthValues.isAuthenticated = false;
    mockAuthValues.user = null;

    renderLoginPage();

    expect(screen.getByText('กทม')).toBeInTheDocument();
    const signInBtn = screen.getByRole('button', { name: /Google/i });
    expect(signInBtn).toBeInTheDocument();
    expect(signInBtn).not.toBeDisabled();
  });

  it('calls login handler with returnUrl when Google sign-in button is clicked', () => {
    mockSearchParams = new URLSearchParams({ returnUrl: '/opportunities/123' });
    mockAuthValues.isAuthenticated = false;
    mockAuthValues.user = null;

    renderLoginPage();

    const signInBtn = screen.getByRole('button', { name: /Google/i });
    fireEvent.click(signInBtn);

    expect(mockLogin).toHaveBeenCalledWith('/opportunities/123', false);
  });

  it('renders user session card and logout button when user is authenticated', () => {
    const testUser = {
      id: 'usr_authenticated_1',
      name: 'Somchai Prasert',
      email: 'somchai@bangkok.go.th',
      role: 'BMA Procurement Specialist',
      org: 'สำนักการโยธา',
      picture: '',
    };

    mockAuthValues.isAuthenticated = true;
    mockAuthValues.user = testUser;

    renderLoginPage();

    expect(screen.getByText('Somchai Prasert')).toBeInTheDocument();
    expect(screen.getByText('somchai@bangkok.go.th')).toBeInTheDocument();
    expect(screen.getByText('BMA Procurement Specialist')).toBeInTheDocument();

    const logoutBtn = screen.getByRole('button', { name: /ออกจากระบบ/i });
    expect(logoutBtn).toBeInTheDocument();

    fireEvent.click(logoutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('displays Thai error message when error query param is invalid_state', () => {
    mockSearchParams = new URLSearchParams({ error: 'invalid_state' });
    renderLoginPage();

    expect(
      screen.getByText('การยืนยันตัวตนหมดอายุหรือเกิดข้อผิดพลาดด้านความปลอดภัย กรุณาลองใหม่อีกครั้ง'),
    ).toBeInTheDocument();
  });

  it('displays Thai error message when error query param is token_exchange_failed', () => {
    mockSearchParams = new URLSearchParams({ error: 'token_exchange_failed' });
    renderLoginPage();

    expect(
      screen.getByText('ไม่สามารถแลกเปลี่ยนโทเคนกับ Google ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'),
    ).toBeInTheDocument();
  });

  it('displays Thai error message when error query param is access_denied', () => {
    mockSearchParams = new URLSearchParams({ error: 'access_denied' });
    renderLoginPage();

    expect(screen.getByText('คุณได้ยกเลิกการเข้าสู่ระบบผ่าน Google')).toBeInTheDocument();
  });

  it('displays generic error code message for unexpected error query param', () => {
    mockSearchParams = new URLSearchParams({ error: 'server_timeout_custom' });
    renderLoginPage();

    expect(screen.getByText('เกิดข้อผิดพลาดในการเข้าสู่ระบบ (server_timeout_custom)')).toBeInTheDocument();
  });
});
