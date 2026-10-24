import React, { useState } from 'react';
import {
  AnalysisRecord,
  AuthenticatedUser,
  CaseStatus,
  InvestigationCase,
} from '../types/callshield';
import {
  FolderPlus,
  Search,
  Trash2,
  FileText,
  MessageSquarePlus,
  Lock,
  LogIn,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';

interface CaseHistoryViewProps {
  cases: InvestigationCase[];
  analyses: AnalysisRecord[];
  currentUser: AuthenticatedUser | null;
  authToken: string | null;
  onRequestAuth: (mode: 'login' | 'register') => void;
  onCaseCreated: (newCase: InvestigationCase) => void;
  onCaseUpdated: (updated: InvestigationCase) => void;
  onCaseDeleted: (caseId: string) => void;
  onOpenReportForCase: (caseId: string) => void;
}

export const CaseHistoryView: React.FC<CaseHistoryViewProps> = ({
  cases,
  analyses,
  currentUser,
  authToken,
  onRequestAuth,
  onCaseCreated,
  onCaseUpdated,
  onCaseDeleted,
  onOpenReportForCase,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [newTitle, setNewTitle] = useState<string>('');
  const [newPriority, setNewPriority] = useState<InvestigationCase['priority']>('High');
  const [newComplainantRef, setNewComplainantRef] = useState<string>('CITIZEN-2026-771');
  const [newSummary, setNewSummary] = useState<string>('');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>(
    analyses[0]?.id || ''
  );
  const [formError, setFormError] = useState<string>('');

  const [activeNoteCaseId, setActiveNoteCaseId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  // Enforce strict authentication gate for sensitive investigation cases
  if (!currentUser || !authToken) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-2">
          <h1 className="text-xl font-bold font-display text-white">
            Cybercrime Investigation Case Management
          </h1>
          <p className="text-xs text-neutral-400">
            Access to sensitive investigation case records, complainant identifiers, and
            chain-of-custody notes is restricted to authenticated personnel via HS256 JWT.
          </p>
        </div>

        <div
          role="region"
          aria-label="Authentication Required for Investigation Cases"
          className="rounded-xl bg-[#10131D] border border-red-500/50 p-10 text-center space-y-5 max-w-2xl mx-auto"
        >
          <div className="w-12 h-12 rounded-xl bg-red-950/50 border border-red-600/60 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-red-400" />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono text-red-400">
              HTTP 401 Protection Active · Bearer JWT Required
            </div>
            <h2 className="text-xl font-bold font-display text-white">
              Investigator Authentication Required
            </h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Sensitive cybercrime investigation cases and chain-of-custody logs are
              protected from unauthorized access. Sign in with an existing investigator
              account or register a new credential to view, create, or modify case files.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onRequestAuth('login')}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Investigator Account</span>
            </button>
            <button
              type="button"
              onClick={() => onRequestAuth('register')}
              className="px-5 py-2.5 text-xs font-medium text-neutral-200 bg-[#151926] hover:bg-neutral-800 border border-neutral-700 rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register New Account</span>
            </button>
          </div>

          <div className="text-xs font-mono text-neutral-400 pt-4 border-t border-neutral-800">
            Default Demo Account: <code className="text-neutral-200">deshmukh@cybercell.gov.in</code> · Password:{' '}
            <code className="text-neutral-200">CyberShield#2026</code>
          </div>
        </div>
      </div>
    );
  }

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError('Case title is required before creating an investigation record.');
      return;
    }
    setFormError('');

    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: newTitle.trim(),
        priority: newPriority,
        leadInvestigator: `${currentUser.name} (${currentUser.role})`,
        complainantRef: newComplainantRef.trim() || 'CITIZEN-REF',
        summary:
          newSummary.trim() ||
          'Preliminary acoustic and conversational fraud investigation file.',
        analysisIds: selectedAnalysisId ? [selectedAnalysisId] : [],
      }),
    });
    const data = await res.json();
    if (res.ok && data.caseRecord) {
      onCaseCreated(data.caseRecord);
      setNewTitle('');
      setNewSummary('');
    } else {
      setFormError(data.error || 'Failed to create case.');
    }
  };

  const handleStatusChange = async (caseId: string, nextStatus: CaseStatus) => {
    const res = await fetch(`/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json();
    if (res.ok && data.caseRecord) {
      onCaseUpdated(data.caseRecord);
    }
  };

  const handleAddNote = async (caseId: string) => {
    if (!noteDraft.trim()) return;
    const res = await fetch(`/api/cases/${caseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        noteContent: noteDraft.trim(),
        noteAuthor: `${currentUser.name} (${currentUser.role})`,
      }),
    });
    const data = await res.json();
    if (res.ok && data.caseRecord) {
      onCaseUpdated(data.caseRecord);
      setNoteDraft('');
      setActiveNoteCaseId(null);
    }
  };

  const handleDelete = async (caseId: string) => {
    const res = await fetch(`/api/cases/${caseId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (res.ok) {
      onCaseDeleted(caseId);
    }
  };

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      !searchQuery.trim() ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.leadInvestigator.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority =
      priorityFilter === 'ALL' || c.priority === priorityFilter;
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;

    return matchesSearch && matchesPriority && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Header with Authenticated Investigator Session Banner */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold font-display text-white">
            Cybercrime Investigation Case Management
          </h1>
          <p className="text-xs text-neutral-400">
            Authenticated chain-of-custody workspace. All case actions are cryptographically
            attributed to your active JWT session.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-[#090A0F] border border-neutral-800 px-3.5 py-2 rounded-lg shrink-0">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>
            Verified: {currentUser.name} · {currentUser.role}
            {currentUser.badgeNumber ? ` (${currentUser.badgeNumber})` : ''}
          </span>
        </div>
      </div>

      {/* Create New Case Form */}
      <form
        onSubmit={handleCreateCase}
        className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            Open New Investigation Case File
          </h2>
          <span className="text-xs font-mono text-neutral-400">
            Auto-assigns CS-2026-XXXX Reference
          </span>
        </div>

        {formError && (
          <div className="p-3 rounded bg-red-950/40 border border-red-600/70 text-xs text-red-200">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2 space-y-1">
            <label
              htmlFor="case-title-input"
              className="block text-xs font-medium text-neutral-300"
            >
              Case Title (Required)
            </label>
            <input
              id="case-title-input"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Narcotics Parcel & Digital Arrest Extortion Inquiry"
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="case-priority-select"
              className="block text-xs font-medium text-neutral-300"
            >
              Risk / Priority Level
            </label>
            <select
              id="case-priority-select"
              value={newPriority}
              onChange={(e) =>
                setNewPriority(e.target.value as InvestigationCase['priority'])
              }
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white"
            >
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="case-attach-analysis"
              className="block text-xs font-medium text-neutral-300"
            >
              Attach Forensic Audio Analysis
            </label>
            <select
              id="case-attach-analysis"
              value={selectedAnalysisId}
              onChange={(e) => setSelectedAnalysisId(e.target.value)}
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white"
            >
              <option value="">— No Initial Analysis Attached —</option>
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.fraudAssessment.riskScore ?? 'N/A'}/100)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label
              htmlFor="case-complainant-input"
              className="block text-xs font-medium text-neutral-300"
            >
              Complainant / Citizen Reference (Pseudonymized)
            </label>
            <input
              id="case-complainant-input"
              type="text"
              value={newComplainantRef}
              onChange={(e) => setNewComplainantRef(e.target.value)}
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="case-summary-input"
              className="block text-xs font-medium text-neutral-300"
            >
              Initial Case Summary
            </label>
            <input
              id="case-summary-input"
              type="text"
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder="Brief summary of incident..."
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-2 cursor-pointer"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Create Investigation Case</span>
        </button>
      </form>

      {/* Search & Filter Toolbar */}
      <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            aria-label="Search investigation cases"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by CS-2026 ref, title, or investigator..."
            className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            aria-label="Filter by Priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-neutral-200"
          >
            <option value="ALL">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            aria-label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-neutral-200"
          >
            <option value="ALL">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Under Investigation">Under Investigation</option>
            <option value="Escalated">Escalated</option>
            <option value="Closed — Verified Scam">Closed — Verified Scam</option>
            <option value="Closed — Benign">Closed — Benign</option>
          </select>
        </div>
      </div>

      {/* Case Files List */}
      <div className="space-y-4">
        {filteredCases.length === 0 ? (
          <div className="rounded-xl bg-[#10131D] border border-neutral-800 p-10 text-center text-xs text-neutral-400">
            No investigation cases match the current search or filter criteria.
          </div>
        ) : (
          filteredCases.map((c) => {
            const linkedAnalyses = analyses.filter((a) =>
              c.analysisIds.includes(a.id)
            );

            return (
              <div
                key={c.id}
                className="rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-neutral-400">
                      <span className="text-red-400 font-semibold">
                        {c.caseReference}
                      </span>
                      <span>·</span>
                      <span>Priority: {c.priority}</span>
                      <span>·</span>
                      <span>Complainant: {c.complainantRef}</span>
                      <span>·</span>
                      <span>Lead: {c.leadInvestigator}</span>
                    </div>
                    <h3 className="text-base font-bold text-white">{c.title}</h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <select
                      aria-label={`Status for case ${c.caseReference}`}
                      value={c.status}
                      onChange={(e) =>
                        handleStatusChange(c.id, e.target.value as CaseStatus)
                      }
                      className="rounded-lg bg-[#090A0F] border border-neutral-700 px-3 py-1.5 text-xs text-white"
                    >
                      <option value="Open">Open</option>
                      <option value="Under Investigation">Under Investigation</option>
                      <option value="Escalated">Escalated</option>
                      <option value="Closed — Verified Scam">
                        Closed — Verified Scam
                      </option>
                      <option value="Closed — Benign">Closed — Benign</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => onOpenReportForCase(c.id)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Forensic Report</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveNoteCaseId(
                          activeNoteCaseId === c.id ? null : c.id
                        )
                      }
                      className="px-3 py-1.5 text-xs font-medium text-neutral-200 bg-[#151926] hover:bg-neutral-800 border border-neutral-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span>Add Note</span>
                    </button>

                    <button
                      type="button"
                      aria-label={`Delete case ${c.caseReference}`}
                      onClick={() => handleDelete(c.id)}
                      className="px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 bg-neutral-900 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed">{c.summary}</p>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-neutral-400">
                    Attached Acoustic Evidence ({linkedAnalyses.length}):
                  </div>
                  {linkedAnalyses.length === 0 ? (
                    <div className="text-xs text-neutral-400 font-mono">
                      No audio analyses attached yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {linkedAnalyses.map((anl) => (
                        <div
                          key={anl.id}
                          className="p-3 rounded-lg bg-[#090A0F] border border-neutral-800 text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-white">{anl.title}</div>
                            <div className="text-neutral-400 font-mono text-[11px]">
                              {anl.fileName} · {anl.fraudAssessment.matchedRules.length}{' '}
                              matched rule(s)
                            </div>
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <span className="text-red-400 font-bold">
                              {anl.fraudAssessment.riskScore ?? 'N/A'}/100
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {activeNoteCaseId === c.id && (
                  <div className="p-3 rounded-lg bg-[#090A0F] border border-neutral-800 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      aria-label="New investigator note"
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Enter reviewer forensic observation..."
                      className="flex-1 rounded bg-[#10131D] border border-neutral-700 px-3 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddNote(c.id)}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded cursor-pointer"
                    >
                      Save Reviewer Note
                    </button>
                  </div>
                )}

                {c.notes.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-neutral-800">
                    <div className="text-xs font-medium text-neutral-400">
                      Investigator Notes ({c.notes.length}):
                    </div>
                    {c.notes.map((n) => (
                      <div
                        key={n.id}
                        className="text-xs text-neutral-300 bg-[#090A0F] p-2.5 rounded border border-neutral-800/80"
                      >
                        <span className="font-mono text-neutral-400">
                          [{new Date(n.createdAt).toLocaleString()} · {n.author}]:
                        </span>{' '}
                        {n.content}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
