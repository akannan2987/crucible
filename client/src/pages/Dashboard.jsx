import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  BeakerIcon,
  CubeIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { getStats } from '../services/api'

const REFRESH_INTERVAL = 5000 // 5 seconds

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadStats = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true)
    try {
      const response = await getStats()
      setStats(response.data)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadStats()

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => loadStats(false), REFRESH_INTERVAL)

    // Refresh on window focus
    const handleFocus = () => loadStats(true)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadStats])

  const handleManualRefresh = () => {
    loadStats(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pandora-600"></div>
      </div>
    )
  }

  const cards = [
    {
      name: 'Chemicals',
      count: stats?.counts?.chemicals || 0,
      max: null,
      icon: BeakerIcon,
      color: 'bg-blue-500',
      href: '/chemicals',
      uploadHref: '/chemicals/upload',
    },
    {
      name: 'Samples',
      count: stats?.counts?.samples || 0,
      max: null,
      icon: CubeIcon,
      color: 'bg-green-500',
      href: '/samples',
      uploadHref: '/samples/upload',
    },
    {
      name: 'Screening Records',
      count: stats?.counts?.screening || 0,
      max: null,
      icon: ChartBarIcon,
      color: 'bg-purple-500',
      href: '/screening',
      uploadHref: '/screening/upload',
    },
    {
      name: 'Toxicology Records',
      count: stats?.counts?.toxicology || 0,
      max: null,
      icon: ExclamationTriangleIcon,
      color: 'bg-orange-500',
      href: '/toxicology',
      uploadHref: '/toxicology/upload',
    },
  ]

  return (
    <div className="space-y-8 fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-pandora-600 to-pandora-700 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome to Pandora Toolbox 2.0</h1>
            <p className="text-pandora-100 text-lg">
              Chemical & Sample Management System with Electronic Lab Notebook
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <ArrowPathIcon className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            {lastRefresh && (
              <span className="text-sm text-pandora-100">
                Updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            to="/chemicals/upload"
            className="inline-flex items-center px-4 py-2 bg-white text-pandora-700 rounded-lg font-medium hover:bg-pandora-50 transition-colors"
          >
            <BeakerIcon className="h-5 w-5 mr-2" />
            Upload Chemicals
          </Link>
          <Link
            to="/samples/upload"
            className="inline-flex items-center px-4 py-2 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors"
          >
            <CubeIcon className="h-5 w-5 mr-2" />
            Upload Samples
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div key={card.name} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
                {card.max && (
                  <span className="text-sm text-gray-500">
                    {((card.count / card.max) * 100).toFixed(1)}% used
                  </span>
                )}
              </div>
              <h3 className="text-gray-500 text-sm font-medium">{card.name}</h3>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {card.count.toLocaleString()}
                {card.max && (
                  <span className="text-lg text-gray-400 font-normal">
                    /{card.max.toLocaleString()}
                  </span>
                )}
              </p>
              {card.max && (
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${card.color}`}
                    style={{ width: `${Math.min((card.count / card.max) * 100, 100)}%` }}
                  />
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Link
                  to={card.href}
                  className="text-sm text-pandora-600 hover:text-pandora-700 font-medium"
                >
                  View →
                </Link>
                <Link
                  to={card.uploadHref}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Upload
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Capacity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <ArrowTrendingUpIcon className="h-5 w-5 mr-2 text-pandora-600" />
            Capacity Overview
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Chemicals</span>
                <span className="text-sm text-gray-500">
                  {stats?.capacities?.chemicals?.current?.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(stats?.capacities?.chemicals?.percentage || 0, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Samples</span>
                <span className="text-sm text-gray-500">
                  {stats?.capacities?.samples?.current?.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(stats?.capacities?.samples?.percentage || 0, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <ClockIcon className="h-5 w-5 mr-2 text-pandora-600" />
            Recent Activity
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {stats?.recentActivity?.chemicals?.slice(0, 3).map((item) => (
              <div key={item.chemical_id} className="flex items-center p-2 bg-blue-50 rounded-lg">
                <BeakerIcon className="h-5 w-5 text-blue-500 mr-3" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.chemical_id}</p>
                </div>
              </div>
            ))}
            {stats?.recentActivity?.samples?.slice(0, 2).map((item) => (
              <div key={item.sample_id} className="flex items-center p-2 bg-green-50 rounded-lg">
                <CubeIcon className="h-5 w-5 text-green-500 mr-3" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.sample_id}</p>
                </div>
              </div>
            ))}
            {(!stats?.recentActivity?.chemicals?.length && !stats?.recentActivity?.samples?.length) && (
              <p className="text-sm text-gray-500 text-center py-4">
                No recent activity. Start by uploading some data!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions - ELN Upload</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/chemicals/upload"
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <BeakerIcon className="h-8 w-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Upload Chemicals</span>
            <span className="text-xs text-gray-500">SDF Format</span>
          </Link>
          <Link
            to="/samples/upload"
            className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <CubeIcon className="h-8 w-8 text-green-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Upload Samples</span>
            <span className="text-xs text-gray-500">Excel Format</span>
          </Link>
          <Link
            to="/screening/upload"
            className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <ChartBarIcon className="h-8 w-8 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Upload Screening</span>
            <span className="text-xs text-gray-500">Linked to Chemicals</span>
          </Link>
          <Link
            to="/toxicology/upload"
            className="flex flex-col items-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
          >
            <ExclamationTriangleIcon className="h-8 w-8 text-orange-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Upload Toxicology</span>
            <span className="text-xs text-gray-500">Linked to Chemicals</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
