/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AnalysisRecord,
  AuthenticatedUser,
  InvestigationCase,
  MonitoringStatus,
  PrivacySettings,
  RiskThresholds,
} from './types/callshield';
import { DEFAULT_RISK_THRESHOLDS } from './lib/fraudEngine';
import { LandingView } from './components/LandingView';
import { DashboardView } from './components/DashboardView';
import { LiveMonitoringView } from './components/LiveMonitoringView';
import { RiskAnalysisView } from './components/RiskAnalysisView';
import { AudioRecorderView } from './components/AudioRecorderView';
import { UploadAnalyzeView } from './components/UploadAnalyzeView';
import { TranscriptTimelineView } from './components/TranscriptTimelineView';
import { CaseHistoryView } from './components/CaseHistoryView';
import { InvestigationReportView } from './components/InvestigationReportView';
import { SettingsPrivacyView } from './components/SettingsPrivacyView';
import { AuthModal } from './components/AuthModal';
import {
  LayoutDashboard,
  Radio,
  Scale,
  Mic,
  Upload,
  Activity,
  FolderKanban,
  FileText,
  Settings,
  Home,
  Menu,
  X,
  Lock,
  LogOut,
  UserCheck,
  UserPlus,
} from 'lucide-react';

type PageId =
  | 'landing'
  | 'dashboard'
  | 'live'
  | 'risk'
  | 'recorder'
  | 'upload'
  | 'timeline'
  | 'cases'
  | 'report'
  | 'settings';

const NAV_ITEMS: { id: PageId; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: '01. Dashboard', icon: LayoutDashboard },
  { id: 'live', label: '02. Live Audio Monitoring', icon: Radio },
  { id: 'risk', label: '03. Call Risk Analysis', icon: Scale },
  { id: 'recorder', label: '04. Audio Recorder', icon: Mic },
  { id: 'upload', label: '05. Upload & Analyze', icon: Upload },
  { id: 'timeline', label: '06. Transcript & Timeline', icon: Activity },
  { id: 'cases', label: '07. Case History', icon: FolderKanban },
  { id: 'report', label: '08. Investigation Report', icon: FileText },
  { id: 'settings', label: '09. Settings & Privacy', icon: Settings },
];

const JWT_STORAGE_KEY = 'callshield_jwt';

export default function App() {
  const [activePage, setActivePage] = useState<PageId>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return 'dashboard';
    const pageParam = params.get('page') as PageId | null;
    if (pageParam) return pageParam;
    return 'landing';
  });

  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(JWT_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [authModalState, setAuthModalState] = useState<{
    open: boolean;
    mode: 'login' | 'register';
  }>({ open: false, mode: 'login' });

  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [totalCasesCount, setTotalCasesCount] = useState<number>(0);
  const [settings, setSettings] = useState<PrivacySettings>({
    microphoneConsentGranted: false,
    cloudAsrConsentGranted: true,
    retentionDays: 30,
    storeRawAudioOnBackend: false,
    alertSensitivity: 'balanced',
    thresholds: { ...DEFAULT_RISK_THRESHOLDS },
    environmentMode: 'Demo & Hackathon Prototype',
  });

  const [monitoringStatus, setMonitoringStatus] =
    useState<MonitoringStatus>('Monitoring inactive');
  const [backendConnected, setBackendConnected] = useState<boolean>(true);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalState({ open: true, mode });
  };

  const fetchAllBackendState = async (tokenOverride?: string | null) => {
    const activeToken = tokenOverride !== undefined ? tokenOverride : authToken;
    try {
      const [anlRes, summaryRes, setRes] = await Promise.all([
        fetch('/api/analyses'),
        fetch('/api/cases/summary-count'),
        fetch('/api/settings'),
      ]);

      if (anlRes.ok) {
        const anlData = await anlRes.json();
        const list: AnalysisRecord[] = anlData.analyses || [];
        setAnalyses(list);
        if (list.length > 0 && !selectedAnalysisId) {
          setSelectedAnalysisId(list[0].id);
        }
      }

      if (summaryRes.ok) {
        const sumData = await summaryRes.json();
        setTotalCasesCount(typeof sumData.count === 'number' ? sumData.count : 0);
      }

      if (setRes.ok) {
        const setData = await setRes.json();
        if (setData.settings) {
          setSettings(setData.settings);
        }
      }

      if (activeToken) {
        const [meRes, caseRes] = await Promise.all([
          fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch('/api/cases', {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
        ]);

        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData.user || null);
        } else {
          // Token expired or invalid
          setCurrentUser(null);
          setAuthToken(null);
          setCases([]);
          try {
            localStorage.removeItem(JWT_STORAGE_KEY);
          } catch {
            // ignore
          }
        }

        if (caseRes.ok) {
          const caseData = await caseRes.json();
          const cList: InvestigationCase[] = caseData.cases || [];
          setCases(cList);
          setTotalCasesCount(cList.length);
          if (cList.length > 0 && !selectedCaseId) {
            setSelectedCaseId(cList[0].id);
          }
        } else {
          setCases([]);
        }
      } else {
        setCurrentUser(null);
        setCases([]);
      }

      setBackendConnected(true);
    } catch {
      setBackendConnected(false);
      setMonitoringStatus('Connection error');
    }
  };

  useEffect(() => {
    fetchAllBackendState();
  }, []);

  const handleAuthenticated = async (token: string, user: AuthenticatedUser) => {
    setAuthToken(token);
    setCurrentUser(user);
    try {
      localStorage.setItem(JWT_STORAGE_KEY, token);
    } catch {
      // ignore
    }
    await fetchAllBackendState(token);
  };

  const handleLogout = async () => {
    if (authToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {
        // ignore network error on logout
      }
    }
    setAuthToken(null);
    setCurrentUser(null);
    setCases([]);
    try {
      localStorage.removeItem(JWT_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleNavigate = (page: string) => {
    setActivePage(page as PageId);
    setMobileMenuOpen(false);
    const url = new URL(window.location.href);
    if (page === 'landing') {
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', page);
    }
    window.history.replaceState({}, '', url.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectAnalysis = (analysisId: string, targetPage?: string) => {
    setSelectedAnalysisId(analysisId);
    if (targetPage) {
      handleNavigate(targetPage);
    }
  };

  const handleAnalysisSaved = (record: AnalysisRecord, targetPage?: string) => {
    setAnalyses((prev) => {
      const filtered = prev.filter((item) => item.id !== record.id);
      return [record, ...filtered];
    });
    setSelectedAnalysisId(record.id);
    if (targetPage) {
      handleNavigate(targetPage);
    }
  };

  const handleAttachToNewCase = async (analysisId: string, defaultTitle: string) => {
    if (!authToken || !currentUser) {
      openAuthModal('login');
      return;
    }

    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: defaultTitle,
        priority: 'High',
        leadInvestigator: currentUser.name,
        complainantRef: 'CITIZEN-2026-881',
        summary: 'Attached directly from acoustic forensic analysis workflow.',
        analysisIds: [analysisId],
      }),
    });
    const data = await res.json();
    if (res.ok && data.caseRecord) {
      setCases((prev) => [data.caseRecord, ...prev]);
      setTotalCasesCount((prev) => prev + 1);
      setSelectedCaseId(data.caseRecord.id);
      handleNavigate('cases');
    }
  };

  const handleSaveThresholds = async (nextThresholds: RiskThresholds) => {
    const updated: PrivacySettings = {
      ...settings,
      thresholds: nextThresholds,
    };
    setSettings(updated);
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  };

  const handlePurgeData = async (reseedDemo: boolean) => {
    if (!authToken || !currentUser) {
      openAuthModal('login');
      return;
    }
    await fetch('/api/settings/purge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ reseedDemo }),
    });
    await fetchAllBackendState(authToken);
  };

  if (activePage === 'landing') {
    return (
      <>
        <LandingView
          onNavigate={handleNavigate}
          totalAnalyses={analyses.length}
          totalCases={totalCasesCount}
        />
        <AuthModal
          isOpen={authModalState.open}
          initialMode={authModalState.mode}
          onClose={() => setAuthModalState((prev) => ({ ...prev, open: false }))}
          onAuthenticated={handleAuthenticated}
        />
      </>
    );
  }

  const currentNavLabel =
    NAV_ITEMS.find((n) => n.id === activePage)?.label || 'Console';

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F4F4F6] flex">
      {/* Desktop Sidebar Navigation (264px fixed width) */}
      <aside
        aria-label="Forensic Console Sidebar"
        className="hidden lg:flex flex-col w-[264px] shrink-0 border-r border-neutral-800/90 bg-[#0B0D14] sticky top-0 h-screen"
      >
        <div className="px-6 py-5 border-b border-neutral-800/80 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleNavigate('landing')}
            className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap cursor-pointer"
          >
            CallShield AI
          </button>
          <span className="text-[11px] font-mono text-neutral-400">v2.4</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const isLocked = item.id === 'cases' && !currentUser;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-red-600 text-white font-semibold'
                    : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {isLocked && (
                  <Lock
                    aria-label="Protected by JWT Authentication"
                    className="w-3.5 h-3.5 text-amber-400 shrink-0"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-800/80 space-y-2.5 text-xs text-neutral-400">
          {currentUser ? (
            <div className="p-2.5 rounded-lg bg-[#121520] border border-emerald-900/50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>JWT Verified</span>
                </span>
                <span className="text-[11px] font-mono text-neutral-400 truncate">
                  {currentUser.badgeNumber || 'AUTH'}
                </span>
              </div>
              <div className="text-xs font-semibold text-white truncate">
                {currentUser.name}
              </div>
              <div className="text-[11px] text-neutral-400 truncate">
                {currentUser.role}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-1.5 px-2.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white inline-flex items-center justify-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-[#121520] border border-neutral-800 space-y-2">
              <div className="text-[11px] font-mono text-amber-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Unauthenticated Session</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="py-1.5 px-2 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('register')}
                  className="py-1.5 px-2 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Register
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between font-mono">
            <span>Status</span>
            <span className="text-neutral-200 truncate max-w-[140px]">
              {monitoringStatus}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleNavigate('landing')}
            className="w-full py-2 px-3 rounded-lg bg-[#121520] hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white inline-flex items-center justify-center gap-2 text-xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Landing Page</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Workspace Top Bar Contract: Breadcrumb Trail on left, 1-2 Primary Actions on right */}
        <header className="flex items-center justify-between gap-4 px-6 py-3.5 border-b border-neutral-800/80 bg-[#090A0F]/95 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200 cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>

            <div className="flex items-center gap-2 text-xs text-neutral-400 truncate">
              <button
                type="button"
                onClick={() => handleNavigate('dashboard')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                CallShield Console
              </button>
              <span aria-hidden="true">/</span>
              <span className="text-white font-medium truncate">
                {currentNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 mr-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{currentUser.name}</span>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="px-3 py-1.5 text-xs font-semibold text-neutral-100 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-red-400" />
                  <span>Investigator Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('register')}
                  className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 rounded-lg items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleNavigate('live')}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Live Audio Monitor
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile Navigation"
            className="lg:hidden bg-[#0D0F18] border-b border-neutral-800 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left cursor-pointer ${
                    activePage === item.id
                      ? 'bg-red-600 text-white'
                      : 'text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handleNavigate('landing')}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white cursor-pointer"
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>Landing Page</span>
            </button>
          </nav>
        )}

        {/* Active Page Viewport */}
        <main className="flex-1 p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {activePage === 'dashboard' && (
            <DashboardView
              analyses={analyses}
              cases={cases}
              totalCasesCount={totalCasesCount}
              currentUser={currentUser}
              monitoringStatus={monitoringStatus}
              activeAudioSource="Browser Microphone / Forensic WAV Store"
              backendConnected={backendConnected}
              onStartStopLive={() => handleNavigate('live')}
              onSelectAnalysis={handleSelectAnalysis}
              onNavigate={handleNavigate}
              onRequestAuth={openAuthModal}
            />
          )}

          {activePage === 'live' && (
            <LiveMonitoringView
              monitoringStatus={monitoringStatus}
              setMonitoringStatus={setMonitoringStatus}
              alertSensitivity={settings.alertSensitivity}
              onUpdateSensitivity={(sens) =>
                setSettings((prev) => ({ ...prev, alertSensitivity: sens }))
              }
              onAnalysisSaved={(rec) => handleAnalysisSaved(rec, 'timeline')}
            />
          )}

          {activePage === 'risk' && (
            <RiskAnalysisView
              thresholds={settings.thresholds}
              onSaveThresholds={handleSaveThresholds}
            />
          )}

          {activePage === 'recorder' && (
            <AudioRecorderView
              onAnalysisCreated={(rec, openTimeline) =>
                handleAnalysisSaved(rec, openTimeline ? 'timeline' : undefined)
              }
              onAttachToNewCase={handleAttachToNewCase}
            />
          )}

          {activePage === 'upload' && (
            <UploadAnalyzeView
              onAnalysisCompleted={(rec, navPage) =>
                handleAnalysisSaved(rec, navPage)
              }
            />
          )}

          {activePage === 'timeline' && (
            <TranscriptTimelineView
              analyses={analyses}
              selectedAnalysisId={selectedAnalysisId}
              authToken={authToken}
              onSelectAnalysisId={setSelectedAnalysisId}
              onAnalysisUpdated={(updated) => handleAnalysisSaved(updated)}
              onNavigateToReport={(anlId) => {
                setSelectedAnalysisId(anlId);
                handleNavigate('report');
              }}
              onAttachToCase={handleAttachToNewCase}
              onRequestAuth={openAuthModal}
            />
          )}

          {activePage === 'cases' && (
            <CaseHistoryView
              cases={cases}
              analyses={analyses}
              currentUser={currentUser}
              authToken={authToken}
              onRequestAuth={openAuthModal}
              onCaseCreated={(c) => {
                setCases((prev) => [c, ...prev]);
                setTotalCasesCount((prev) => prev + 1);
                setSelectedCaseId(c.id);
              }}
              onCaseUpdated={(updated) =>
                setCases((prev) =>
                  prev.map((c) => (c.id === updated.id ? updated : c))
                )
              }
              onCaseDeleted={(id) => {
                setCases((prev) => prev.filter((c) => c.id !== id));
                setTotalCasesCount((prev) => Math.max(0, prev - 1));
              }}
              onOpenReportForCase={(caseId) => {
                setSelectedCaseId(caseId);
                handleNavigate('report');
              }}
            />
          )}

          {activePage === 'report' && (
            <InvestigationReportView
              cases={cases}
              analyses={analyses}
              selectedCaseId={selectedCaseId}
              selectedAnalysisId={selectedAnalysisId}
              onSelectCaseId={setSelectedCaseId}
              onSelectAnalysisId={setSelectedAnalysisId}
            />
          )}

          {activePage === 'settings' && (
            <SettingsPrivacyView
              settings={settings}
              onUpdateSettings={setSettings}
              onPurgeData={handlePurgeData}
            />
          )}
        </main>
      </div>

      <AuthModal
        isOpen={authModalState.open}
        initialMode={authModalState.mode}
        onClose={() => setAuthModalState((prev) => ({ ...prev, open: false }))}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}
