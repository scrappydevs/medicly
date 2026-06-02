'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Home,
  Calendar,
  User,
  Settings,
  Activity,
  FileText,
  Users,
  Stethoscope,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useSidebar } from '@/contexts/sidebar-context'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

export function Sidebar() {
  const { isAuthenticated, user, logout } = useAuth()
  const { isCollapsed, toggleSidebar } = useSidebar()
  const pathname = usePathname()
  const router = useRouter()

  const isActivePath = (path: string) => {
    const dashboardBase = user?.role === 'doctor' ? '/dashboard/doctor' : '/dashboard/patient'
    
    if (path === dashboardBase || path === '/') {
      return pathname === dashboardBase || pathname === '/'
    }
    return pathname.startsWith(path)
  }

  const getNavigationItems = () => {
    const baseRoute = user?.role === 'doctor' ? '/dashboard/doctor' : '/dashboard/patient'
    
    const items = [
      { href: baseRoute, label: 'Dashboard', icon: Home },
      ...(user?.role === 'doctor' ? [
        { href: '/dashboard/doctor/patients', label: 'Patients', icon: Users }
      ] : []),
      { href: `${baseRoute}/settings`, label: 'Settings', icon: Settings }
    ]

    return items
  }

  const navigationItems = getNavigationItems()

  if (!isAuthenticated) return null

  return (
    <div style={{ 
      position: 'fixed', // Changed from relative positioning to fixed
      top: 0, // Align with top of page
      left: 0, // Align with left edge
      bottom: 0, // Extend to bottom of viewport
      width: isCollapsed ? '80px' : '280px',
      backgroundColor: 'hsl(var(--card))',
      borderRight: '1px solid hsl(var(--border))',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s ease-in-out',
      flexShrink: 0,
      zIndex: 40 // Ensure it stays above content but below modals
    }}>
      {/* Collapse Toggle Arrow on Border */}
      <button
        onClick={toggleSidebar}
        style={{
          position: 'absolute',
          top: '50%',
          right: '-16px', // Position on the border
          transform: 'translateY(-50%)',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          cursor: 'pointer',
          color: 'hsl(var(--muted-foreground))',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}
        className="hover:bg-accent/50 hover:text-foreground"
      >
        {isCollapsed ? (
          <ChevronRight style={{ width: '16px', height: '16px' }} />
        ) : (
          <ChevronLeft style={{ width: '16px', height: '16px' }} />
        )}
      </button>

      {/* Logo and Brand Section */}
      <div style={{ 
        marginBottom: '32px',
        paddingBottom: '20px',
        borderBottom: '1px solid hsl(var(--border))'
      }}>
        {/* Logo with medicly */}
        <Link href={user?.role === 'doctor' ? '/dashboard/doctor' : '/dashboard/patient'} style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: isCollapsed ? '0' : '12px',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          marginBottom: '16px',
          textDecoration: 'none'
        }}>
          <div style={{ 
            width: isCollapsed ? '40px' : '32px', 
            height: isCollapsed ? '40px' : '32px', 
            position: 'relative',
            flexShrink: 0
          }}>
            <Image
              src="/mediclylogoblack.png"
              alt="Medicly Logo"
              width={isCollapsed ? 40 : 32}
              height={isCollapsed ? 40 : 32}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              priority
            />
          </div>
          {!isCollapsed && (
            <h1 style={{ 
              fontSize: '2rem', 
              fontWeight: '600', 
              color: 'hsl(var(--foreground))',
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              medicly
            </h1>
          )}
        </Link>

        {/* Tagline - Only show when expanded */}
        {!isCollapsed && (
          <div style={{ 
            textAlign: 'center',
            marginTop: '16px'
          }}>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = isActivePath(item.href)
          
          return (
            <Link key={item.href} href={item.href}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: isCollapsed ? '0' : '12px',
                padding: isCollapsed ? '8px' : '8px 12px',
                borderRadius: '8px',
                backgroundColor: isActive ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                fontWeight: isActive ? '600' : '500',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                border: isActive ? '2px solid hsl(var(--primary) / 0.2)' : '2px solid transparent'
              }}
              className="hover:bg-accent/50 hover:text-foreground"
              title={isCollapsed ? item.label : undefined}
              >
                <Icon style={{ 
                  width: isCollapsed ? '24px' : '20px', 
                  height: isCollapsed ? '24px' : '20px' 
                }} />
                {!isCollapsed && (
                  <span style={{ 
                    opacity: isCollapsed ? 0 : 1,
                    transition: 'opacity 0.3s ease-in-out',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.label}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* User Info at Bottom - Only show when expanded */}
      {!isCollapsed && (
        <div style={{ 
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: 'hsl(var(--accent) / 0.4)',
          opacity: isCollapsed ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
          marginTop: 'auto',
          border: '1px solid hsl(var(--border))'
        }}>
          <p style={{ 
            fontSize: '1rem', 
            fontWeight: '600', 
            color: 'hsl(var(--foreground))',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '4px'
          }}>
            {user?.name}
          </p>
          <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '8px' }}>
            {user?.role === 'doctor' ? 'Healthcare Provider' : 'Patient'}
          </p>
          <button
            onClick={async () => {
              console.log('Sidebar logout clicked')
              
              try {
                await logout()
                console.log('Logout completed, redirecting to home...')
                router.push('/')
              } catch (error) {
                console.error('Logout failed:', error)
                // Fallback redirect to home
                router.push('/')
              }
            }}
            style={{
              width: '100%',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'transparent',
              color: 'hsl(var(--muted-foreground))',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            className="hover:bg-accent/50 hover:text-foreground"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
} 