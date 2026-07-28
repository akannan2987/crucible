import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  BeakerIcon,
  HomeIcon,
  DocumentPlusIcon,
  EyeIcon,
  Bars3Icon,
  XMarkIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CubeIcon,
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  {
    name: 'Chemicals',
    icon: BeakerIcon,
    children: [
      { name: 'View Chemicals', href: '/chemicals', icon: EyeIcon },
      { name: 'Upload Chemicals (ELN)', href: '/chemicals/upload', icon: DocumentPlusIcon },
    ],
  },
  {
    name: 'Samples',
    icon: CubeIcon,
    children: [
      { name: 'View Samples', href: '/samples', icon: EyeIcon },
      { name: 'Upload Samples (ELN)', href: '/samples/upload', icon: DocumentPlusIcon },
    ],
  },
  {
    name: 'Screening',
    icon: ChartBarIcon,
    children: [
      { name: 'View Screening Data', href: '/screening', icon: EyeIcon },
      { name: 'Upload Screening (ELN)', href: '/screening/upload', icon: DocumentPlusIcon },
    ],
  },
  {
    name: 'Toxicology',
    icon: ExclamationTriangleIcon,
    children: [
      { name: 'View Toxicology Data', href: '/toxicology', icon: EyeIcon },
      { name: 'Upload Toxicology (ELN)', href: '/toxicology/upload', icon: DocumentPlusIcon },
    ],
  },
]

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedMenu, setExpandedMenu] = useState(null)
  const location = useLocation()

  const toggleMenu = (name) => {
    setExpandedMenu(expandedMenu === name ? null : name)
  }

  const isActive = (href) => location.pathname === href

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={classNames(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transform transition-transform duration-300 lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b">
          <div className="flex items-center">
            <BeakerIcon className="h-8 w-8 text-pandora-600" />
            <span className="ml-2 text-xl font-bold text-gray-800">Pandora Toolbox</span>
          </div>
          <button onClick={() => setSidebarOpen(false)}>
            <XMarkIcon className="h-6 w-6 text-gray-500" />
          </button>
        </div>
        <nav className="mt-4 px-2">
          {navigation.map((item) => (
            <div key={item.name}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className="w-full flex items-center justify-between px-3 py-2 text-gray-700 rounded-lg hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      <item.icon className="h-5 w-5 mr-3 text-gray-500" />
                      {item.name}
                    </div>
                    <svg
                      className={classNames(
                        'h-4 w-4 transition-transform',
                        expandedMenu === item.name ? 'rotate-180' : ''
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedMenu === item.name && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          to={child.href}
                          onClick={() => setSidebarOpen(false)}
                          className={classNames(
                            'flex items-center px-3 py-2 text-sm rounded-lg',
                            isActive(child.href)
                              ? 'bg-pandora-50 text-pandora-700'
                              : 'text-gray-600 hover:bg-gray-100'
                          )}
                        >
                          <child.icon className="h-4 w-4 mr-2" />
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={classNames(
                    'flex items-center px-3 py-2 rounded-lg',
                    isActive(item.href)
                      ? 'bg-pandora-50 text-pandora-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <item.icon className="h-5 w-5 mr-3 text-gray-500" />
                  {item.name}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r shadow-sm">
          {/* Logo */}
          <div className="flex h-16 items-center px-4 border-b bg-gradient-to-r from-pandora-600 to-pandora-700">
            <BeakerIcon className="h-8 w-8 text-white" />
            <div className="ml-3">
              <span className="text-lg font-bold text-white">Pandora Toolbox</span>
              <span className="ml-2 text-xs bg-white/20 text-white px-2 py-0.5 rounded">2.0</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center">
                        <item.icon className="h-5 w-5 mr-3 text-gray-500" />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <svg
                        className={classNames(
                          'h-4 w-4 transition-transform duration-200',
                          expandedMenu === item.name ? 'rotate-180' : ''
                        )}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div
                      className={classNames(
                        'overflow-hidden transition-all duration-200',
                        expandedMenu === item.name ? 'max-h-48' : 'max-h-0'
                      )}
                    >
                      <div className="ml-8 mt-1 space-y-1 pb-2">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            to={child.href}
                            className={classNames(
                              'flex items-center px-3 py-2 text-sm rounded-lg transition-colors',
                              isActive(child.href)
                                ? 'bg-pandora-50 text-pandora-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-100'
                            )}
                          >
                            <child.icon className="h-4 w-4 mr-2" />
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <Link
                    to={item.href}
                    className={classNames(
                      'flex items-center px-3 py-2.5 rounded-lg transition-colors',
                      isActive(item.href)
                        ? 'bg-pandora-50 text-pandora-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <item.icon className="h-5 w-5 mr-3 text-gray-500" />
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <div className="text-xs text-gray-500 text-center">
              Chemical & Sample Management System
              <br />
              <span className="text-gray-400">© 2024 NIHS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-16 items-center bg-white border-b shadow-sm px-4 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden -ml-2 p-2 text-gray-500 hover:text-gray-700"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <div className="flex-1 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-800 lg:text-xl">
              Chemical & Sample Management
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Running on port 5942
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
