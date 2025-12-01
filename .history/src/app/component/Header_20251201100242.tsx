'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import AuthModal from './AuthModal';
import { getCartCount } from '../utils/cart';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode] = useState<'login' | 'register'>('login');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('customer');
  const [cartCount, setCartCount] = useState(0);

  // Debug: Log state changes
  useEffect(() => {
    console.log('🎯 Header State Updated:', {
      isLoggedIn,
      userName,
      userEmail,
      userRole
    });
  }, [isLoggedIn, userName, userEmail, userRole]);

  // Update cart count from backend API
  useEffect(() => {
    const updateCartCount = async () => {
      try {
        const count = await getCartCount();
        setCartCount(count);
      } catch (error) {
        console.error('Error loading cart count:', error);
        setCartCount(0);
      }
    };

    updateCartCount();
    
    // Listen for cart updates
    window.addEventListener('cartUpdated', updateCartCount);
    window.addEventListener('storage', updateCartCount);
    
    return () => {
      window.removeEventListener('cartUpdated', updateCartCount);
      window.removeEventListener('storage', updateCartCount);
    };
  }, []);

  // Reusable checker để dùng ở nhiều nơi
  const checkLoginStatus = useCallback(() => {
    const token = localStorage.getItem('token');
    let name = localStorage.getItem('userName') || '';
    const email = localStorage.getItem('userEmail') || '';
    const role = localStorage.getItem('userRole') || 'customer';

    // Chuẩn hóa tên nếu rỗng hoặc 'undefined' hoặc 'null'
    if (!name || name === 'undefined' || name === 'null' || name.trim() === '') {
      name = email ? email.split('@')[0] : '';
    }

    console.log('🔍 Header - Checking localStorage:', {
      hasToken: !!token,
      userName: name,
      userEmail: email,
      userRole: role
    });

    if (token && email) {
      setIsLoggedIn(true);
      setUserEmail(email);
      setUserName(name);
      setUserRole(role);
      console.log('✅ User logged in:', { name, email, role });
    } else {
      setIsLoggedIn(false);
      setUserName('');
      setUserEmail('');
      setUserRole('customer');
      console.log('❌ Not logged in - missing token or email');
    }
  }, []);

  // Check login status khi component mount và lắng nghe sự kiện
  useEffect(() => {
    // Check ngay khi mount
    checkLoginStatus();

    // Listen cho storage changes (từ tab khác hoặc sau khi login)
    window.addEventListener('storage', checkLoginStatus);
    
    // Listen cho custom event (khi login trong cùng tab)
    const handleLoginSuccess = () => {
      console.log('🔄 Received login event, updating header...');
      setTimeout(() => {
        checkLoginStatus();
      }, 100);
    };
    window.addEventListener('loginSuccess', handleLoginSuccess);

    // Cập nhật khi quay lại tab hoặc cửa sổ lấy focus
    const handleFocus = () => checkLoginStatus();
    const handleVisibility = () => { if (document.visibilityState === 'visible') checkLoginStatus(); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Interval check để đảm bảo sync (check mỗi 2 giây)
    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('token');
      const currentEmail = localStorage.getItem('userEmail');
      
      // Chỉ update nếu có thay đổi
      if (currentToken && currentEmail && !isLoggedIn) {
        console.log('🔄 Detected login change via interval check');
        checkLoginStatus();
      } else if (!currentToken && isLoggedIn) {
        console.log('🔄 Detected logout change via interval check');
        checkLoginStatus();
      }
    }, 2000);

    return () => {
      window.removeEventListener('storage', checkLoginStatus);
      window.removeEventListener('loginSuccess', handleLoginSuccess);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [checkLoginStatus, isLoggedIn]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-dropdown')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    console.log('🚪 Logging out...');
    
    // Clear all localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    
    // Update state immediately
    setIsLoggedIn(false);
    setUserName('');
    setUserEmail('');
    setUserRole('customer');
    setShowDropdown(false);
    
    console.log('✅ Đăng xuất thành công - localStorage đã được xóa');
    
    // Dispatch event để SocketContext tự động ngắt kết nối
    // SocketContext đã lắng nghe storage event và sẽ tự động ngắt kết nối khi token bị xóa
    try { 
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('logout'));
    } catch {}
    
    alert('Đăng xuất thành công!');
    
    // Redirect về trang chủ
    window.location.href = '/';
  };

  return (
    <header 
      className="bg-white"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        transition: 'all 0.3s ease',
        boxShadow: scrolled ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
        padding: scrolled ? '0.5rem 0' : '1rem 0',
      }}
    >
      <nav className="navbar navbar-expand-lg navbar-light py-0">
        <div className="container">
          {/* Logo */}
          <Link href="/" className="navbar-brand d-flex align-items-center">
            <div 
              className="position-relative" 
              style={{ 
                width: scrolled ? '70px' : '100px',
                height: scrolled ? '70px' : '70px',
                transition: 'all 0.3s ease',
              }}
            >
              <Image 
                src="/logo/logo.jpg" 
                alt="Logo" 
                fill
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </Link>

          {/* Mobile Toggle Button */}
          <button 
            className="navbar-toggler" 
            type="button" 
            data-bs-toggle="collapse" 
            data-bs-target="#navbarNav"
            aria-controls="navbarNav" 
            aria-expanded="false" 
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          {/* Navigation Menu */}
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto align-items-center gap-1">
              <li className="nav-item d-flex align-items-center">
                <Link 
                  href="/" 
                  className="nav-link position-relative" 
                  style={{ 
                    color: '#FFC107',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    height: '40px',
                    padding: '0 20px',
                    borderRadius: '24px',
                    fontSize: '15px',
                    fontWeight: '500',
                    backgroundColor: 'rgba(255, 193, 7, 0.08)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.15)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 193, 7, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.08)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Trang chủ
                </Link>
              </li>
              <li className="nav-item d-flex align-items-center">
                <Link 
                  href="/introduction" 
                  className="nav-link position-relative"
                  style={{ 
                    color: '#333',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    height: '40px',
                    padding: '0 20px',
                    borderRadius: '24px',
                    fontSize: '15px',
                    fontWeight: '500',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#FFC107';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#333';
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Giới thiệu
                </Link>
              </li>
              <li className="nav-item d-flex align-items-center">
                <Link 
                  href="/products" 
                  className="nav-link"
                  style={{ 
                    color: '#333',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    height: '40px',
                    padding: '0 20px',
                    borderRadius: '24px',
                    fontSize: '15px',
                    fontWeight: '500',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#FFC107';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#333';
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Sản Phẩm
                </Link>
              </li>
              <li className="nav-item d-flex align-items-center">
                {/* <Link 
                  href="/construction" 
                  className="nav-link text-dark"
                  style={{ 
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    height: '46px',
                    padding: '0 16px',
                    borderRadius: '999px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#FFC107';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#333';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Thi công
                </Link> */}
              </li>
              <li className="nav-item d-flex align-items-center">
                {/* <Link 
                  href="/portfolio" 
                  className="nav-link text-dark"
                  style={{ 
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    height: '46px',
                    padding: '0 16px',
                    borderRadius: '999px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#FFC107';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#333';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Portfolio
                </Link> */}
              </li>
              <li className="nav-item d-flex align-items-center">
                <Link 
                  href="/news" 
                  className="nav-link"
                  style={{ 
                    color: '#333',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    height: '40px',
                    padding: '0 20px',
                    borderRadius: '24px',
                    fontSize: '15px',
                    fontWeight: '500',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#FFC107';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#333';
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Tin tức
                </Link>
              </li>
              <li className="nav-item d-flex align-items-center">
                <Link 
                  href="/recruitment" 
                  className="nav-link"
                  style={{ 
                    color: '#333',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    height: '40px',
                    padding: '0 20px',
                    borderRadius: '24px',
                    fontSize: '15px',
                    fontWeight: '500',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#FFC107';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#333';
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Tuyển dụng
                </Link>
              </li>
              <li className="nav-item d-flex align-items-center">
                <Link 
                  href="/contact" 
                  className="nav-link"
                  style={{ 
                    color: '#333',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    height: '40px',
                    padding: '0 20px',
                    borderRadius: '24px',
                    fontSize: '15px',
                    fontWeight: '500',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#FFC107';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#333';
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Liên hệ
                </Link>
              </li>
              
              {/* Cart Icon */}
              <li className="nav-item d-flex align-items-center">
                <Link
                  href="/cart"
                  className="nav-link position-relative"
                  style={{
                    color: '#333',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '40px',
                    width: '40px',
                    borderRadius: '24px',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#FFC107';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#333';
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <i className="bi bi-cart3" style={{ fontSize: '20px' }}></i>
                  {cartCount > 0 && (
                    <span
                      className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                      style={{
                        fontSize: '10px',
                        padding: '4px 6px',
                        minWidth: '20px'
                      }}
                    >
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Link>
              </li>
              
              {/* Divider */}
              <li className="nav-item d-flex align-items-center">
                <div style={{
                  width: '1px',
                  height: '24px',
                  backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  margin: '0 8px'
                }}></div>
              </li>
              
              {/* User Dropdown */}
              <li className="nav-item position-relative user-dropdown d-flex align-items-center">
                {isLoggedIn ? (
                  <button
                    onClick={() => {
                      const next = !showDropdown;
                      
                      if (next) {
                        // FORCE CHECK localStorage mỗi lần mở dropdown
                        console.log(' Opening dropdown - Force checking localStorage...');
                        const token = localStorage.getItem('token');
                        const email = localStorage.getItem('userEmail');
                        const name = localStorage.getItem('userName');
                        const role = localStorage.getItem('userRole');
                        
                        console.log(' Current localStorage:', { token: !!token, email, name, role });
                        
                        if (token && email) {
                          setIsLoggedIn(true);
                          setUserEmail(email);
                          setUserName(name || email.split('@')[0]);
                          setUserRole(role || 'customer');
                          console.log(' Force updated state - User is logged in!');
                        } else {
                          console.log(' No token or email found');
                        }
                      }
                      
                      setShowDropdown(next);
                    }}
                    className="btn btn-link p-0 d-flex align-items-center gap-2"
                    style={{
                      color: '#FFC107',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      textDecoration: 'none',
                      padding: '0 20px',
                      height: '40px',
                      borderRadius: '24px',
                      fontSize: '15px',
                      fontWeight: '500',
                      backgroundColor: 'rgba(255, 193, 7, 0.08)',
                      border: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.backgroundColor = 'rgba(255,193,7,0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.08)';
                    }}
                  >
                    <i 
                      className="bi bi-person-circle-fill"
                      style={{ fontSize: '20px' }}
                    ></i>
                    <span
                      className="d-none d-lg-inline"
                      style={{
                        fontSize: '15px',
                        fontWeight: '500',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {userName || 'Tài khoản'}
                    </span>
                  </button>
                ) : (
                  <Link
                    href="/auth"
                    className="btn btn-link p-0 d-flex align-items-center gap-2"
                    style={{
                      color: '#333',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      textDecoration: 'none',
                      padding: '0 20px',
                      height: '40px',
                      borderRadius: '24px',
                      fontSize: '15px',
                      fontWeight: '500',
                      backgroundColor: 'transparent',
                      border: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.backgroundColor = 'rgba(255,193,7,0.12)';
                      e.currentTarget.style.color = '#FFC107';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#333';
                    }}
                  >
                    <i 
                      className="bi bi-person-circle"
                      style={{ fontSize: '20px' }}
                    ></i>
                    <span
                      className="d-none d-lg-inline"
                      style={{
                        fontSize: '15px',
                        fontWeight: '500',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      Tài khoản
                    </span>
                  </Link>
                )}

                {/* Dropdown Menu */}
                {showDropdown && (
                  <div
                    className="position-absolute bg-white shadow-lg rounded-3 overflow-hidden"
                    style={{
                      top: '100%',
                      right: 0,
                      marginTop: '12px',
                      minWidth: '260px',
                      zIndex: 1000,
                      animation: 'dropdownSlide 0.2s ease-out',
                      border: '1px solid rgba(0,0,0,0.08)',
                    }}
                  >
                    {isLoggedIn ? (
                      <>
                        {/* User Info Header */}
                        <div className="p-3 border-bottom" style={{ 
                          background: 'linear-gradient(135deg, #FFF8E1 0%, #FFF3CD 100%)'
                        }}>
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="d-flex align-items-center gap-2">
                              <div 
                                className="rounded-circle bg-warning d-flex align-items-center justify-content-center"
                                style={{ width: '40px', height: '40px' }}
                              >
                                <i className="bi bi-person-fill text-white" style={{ fontSize: '20px' }}></i>
                              </div>
                              <div>
                                <p className="mb-0 fw-bold" style={{ color: '#333', fontSize: '15px' }}>
                                  {userName || 'User'}
                                </p>
                                {userRole === 'admin' && (
                                  <span 
                                    className="badge" 
                                    style={{ 
                                      fontSize: '9px',
                                      backgroundColor: '#dc3545',
                                      padding: '2px 6px',
                                      marginTop: '2px'
                                    }}
                                  >
                                    ADMIN
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="mb-0 text-muted" style={{ fontSize: '12px', paddingLeft: '48px' }}>
                            <i className="bi bi-envelope me-1" style={{ fontSize: '11px' }}></i>
                            {userEmail}
                          </p>
                        </div>

                        {/* Main Menu Items */}
                        <div className="py-1">
                          <Link
                            href="/profile"
                            className="d-flex align-items-center px-3 py-2 text-decoration-none text-dark"
                            style={{ transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#FFF8E1';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={() => setShowDropdown(false)}
                          >
                            <i className="bi bi-person-circle me-2" style={{ fontSize: '18px', color: '#FFC107' }}></i>
                            <span style={{ fontSize: '14px' }}>Tài khoản của tôi</span>
                          </Link>
                          
                          <Link
                            href="/orders"
                            className="d-flex align-items-center px-3 py-2 text-decoration-none text-dark"
                            style={{ transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#FFF8E1';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={() => setShowDropdown(false)}
                          >
                            <i className="bi bi-bag-check me-2" style={{ fontSize: '18px', color: '#FFC107' }}></i>
                            <span style={{ fontSize: '14px' }}>Đơn hàng của tôi</span>
                          </Link>

                          <Link
                            href="/wishlist"
                            className="d-flex align-items-center px-3 py-2 text-decoration-none text-dark"
                            style={{ transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#FFF8E1';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={() => setShowDropdown(false)}
                          >
                            <i className="bi bi-heart me-2" style={{ fontSize: '18px', color: '#FFC107' }}></i>
                            <span style={{ fontSize: '14px' }}>Sản phẩm yêu thích</span>
                          </Link>

                          <Link
                            href="/addresses"
                            className="d-flex align-items-center px-3 py-2 text-decoration-none text-dark"
                            style={{ transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#FFF8E1';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={() => setShowDropdown(false)}
                          >
                            <i className="bi bi-geo-alt me-2" style={{ fontSize: '18px', color: '#FFC107' }}></i>
                            <span style={{ fontSize: '14px' }}>Địa chỉ của tôi</span>
                          </Link>

                          <Link
                            href="/notifications"
                            className="d-flex align-items-center px-3 py-2 text-decoration-none text-dark"
                            style={{ transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#FFF8E1';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={() => setShowDropdown(false)}
                          >
                            <i className="bi bi-bell me-2" style={{ fontSize: '18px', color: '#FFC107' }}></i>
                            <span style={{ fontSize: '14px' }}>Thông báo</span>
                          </Link>
                        </div>

                        {/* Admin Section */}
                        {userRole === 'admin' && (
                          <>
                            <div className="border-top my-1"></div>
                            <div className="py-1">
                              <div className="px-3 py-1">
                                <small className="text-muted fw-semibold" style={{ fontSize: '11px' }}>
                                  QUẢN TRỊ
                                </small>
                              </div>
                              <Link
                                href="/admin/dashboard"
                                className="d-flex align-items-center px-3 py-2 text-decoration-none text-dark"
                                style={{ transition: 'all 0.2s ease' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#FFE8E8';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                onClick={() => setShowDropdown(false)}
                              >
                                <i className="bi bi-speedometer2 me-2" style={{ fontSize: '18px', color: '#dc3545' }}></i>
                                <span style={{ fontSize: '14px' }}>Bảng điều khiển</span>
                              </Link>
                              
                              <Link
                                href="/admin/products"
                                className="d-flex align-items-center px-3 py-2 text-decoration-none text-dark"
                                style={{ transition: 'all 0.2s ease' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#FFE8E8';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                onClick={() => setShowDropdown(false)}
                              >
                                <i className="bi bi-box-seam me-2" style={{ fontSize: '18px', color: '#dc3545' }}></i>
                                <span style={{ fontSize: '14px' }}>Quản lý sản phẩm</span>
                              </Link>

                              <Link
                                href="/admin/users"
                                className="d-flex align-items-center px-3 py-2 text-decoration-none text-dark"
                                style={{ transition: 'all 0.2s ease' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#FFE8E8';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                onClick={() => setShowDropdown(false)}
                              >
                                <i className="bi bi-people me-2" style={{ fontSize: '18px', color: '#dc3545' }}></i>
                                <span style={{ fontSize: '14px' }}>Quản lý người dùng</span>
                              </Link>
                            </div>
                          </>
                        )}

                        {/* Logout Button */}
                        <div className="border-top mt-1"></div>
                        <button
                          onClick={handleLogout}
                          className="w-100 d-flex align-items-center justify-content-center px-3 py-3 border-0 bg-transparent text-dark"
                          style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#FFE8E8';
                            e.currentTarget.style.color = '#dc3545';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#333';
                          }}
                        >
                          <i className="bi bi-box-arrow-right me-2" style={{ fontSize: '18px' }}></i>
                          <span className="fw-semibold" style={{ fontSize: '14px' }}>Đăng xuất</span>
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Not logged in menu */}
                        <div className="p-2">
                          <Link
                            href="/auth"
                            className="d-flex align-items-center justify-content-center px-3 py-3 text-decoration-none text-white fw-semibold rounded-3 mb-2"
                            style={{ 
                              transition: 'all 0.2s ease',
                              backgroundColor: '#FFC107'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#FFB000';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,193,7,0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#FFC107';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                            onClick={() => setShowDropdown(false)}
                          >
                            <i className="bi bi-box-arrow-in-right me-2"></i>
                            Đăng nhập 
                          </Link>
                          <Link
                            href="/auth"
                            className="d-flex align-items-center justify-content-center px-3 py-3 text-decoration-none fw-semibold rounded-3"
                            style={{ 
                              transition: 'all 0.2s ease',
                              backgroundColor: 'transparent',
                              border: '2px solid #FFC107',
                              color: '#FFC107'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#FFF8E1';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            onClick={() => setShowDropdown(false)}
                          >
                            <i className="bi bi-person-plus me-2"></i>
                            Đăng ký
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Dropdown Animation */}
                <style jsx global>{`
                  @keyframes dropdownSlide {
                    from {
                      opacity: 0;
                      transform: translateY(-10px);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }
                  
                  /* Force Bootstrap Icons to work */
                  .bi::before {
                    display: inline-block;
                    font-family: "bootstrap-icons" !important;
                    font-style: normal;
                    font-weight: normal !important;
                    font-variant: normal;
                    text-transform: none;
                    line-height: 1;
                    vertical-align: -0.125em;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                  }
                `}</style>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
        onLoginSuccess={() => setIsLoggedIn(true)}
      />
    </header>
  );
}
