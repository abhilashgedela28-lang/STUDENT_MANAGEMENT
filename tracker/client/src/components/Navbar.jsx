import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Code2, 
  LayoutDashboard, 
  CheckCircle2, 
  User, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X 
} from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Practice', path: '/practice', icon: CheckCircle2 },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  if (user && user.role === 'ADMIN') {
    navItems.push({ name: 'Admin', path: '/admin', icon: ShieldCheck });
  }

  return (
    <nav style={{
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.85rem 1.25rem',
      }}>
        {/* Brand Logo */}
        <Link to={user ? '/dashboard' : '/'} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 800,
          fontSize: '1.25rem',
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            padding: '7px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(59, 130, 246, 0.4)',
          }}>
            <Code2 size={22} color="#ffffff" />
          </div>
          <span>Code<span style={{ color: 'var(--accent-blue)' }}>Track</span></span>
        </Link>

        {/* Desktop Navigation Links */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="desktop-links">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 500,
                    fontSize: '0.92rem',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={17} color={isActive ? 'var(--accent-blue)' : 'currentColor'} />
                  {item.name}
                </Link>
              );
            })}

            {/* User Badge & Logout */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginLeft: '12px',
              paddingLeft: '14px',
              borderLeft: '1px solid var(--border-color)',
            }}>
              <span style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}>
                {user.name} {user.role === 'ADMIN' && <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.4)' }}>Admin</span>}
              </span>
              <button
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                title="Logout"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/login" className="btn btn-secondary" style={{ padding: '7px 16px' }}>Login</Link>
            <Link to="/signup" className="btn btn-primary" style={{ padding: '7px 16px' }}>Sign Up</Link>
          </div>
        )}

        {/* Mobile menu trigger */}
        {user && (
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'transparent',
              color: 'var(--text-primary)',
              display: 'none',
              padding: '6px',
            }}
            className="mobile-toggle"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        )}
      </div>

      {/* Mobile Drawer */}
      {user && mobileMenuOpen && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                }}
              >
                <Icon size={18} />
                {item.name}
              </Link>
            );
          })}
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '10px' }}>
            <button
              onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
              className="btn btn-danger"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <LogOut size={16} /> Logout ({user.name})
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-links { display: none !important; }
          .mobile-toggle { display: block !important; }
        }
      `}</style>
    </nav>
  );
}
