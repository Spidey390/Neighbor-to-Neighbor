import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import {
  Shield,
  Users,
  Flag as FlagIcon,
  FileText,
  Trash2,
  Search } from
"lucide-react";

export default function AdminConsole({ user }) {
  const { t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState("verifications");

  const [selectedUserForReview, setSelectedUserForReview] = useState(null);

  const [pendingUsers, setPendingUsers] = useState([]);
  const [flagsList, setFlagsList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [allUsersList, setAllUsersList] = useState([]);
  const [stats, setStats] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [erasureSearch, setErasureSearch] = useState("");
  const [erasureTargetUser, setErasureTargetUser] = useState(null);

  const SLA_LIMIT_HOURS = 24;

  // Load functions
  const loadPendingUsers = async () => {
    try {
      const res = await fetch("/api/admin/pending-users", {
        headers: { Authorization: `Bearer mock-${user.id}` }
      });
      const data = await res.json();
      if (res.ok) setPendingUsers(data.users || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadFlags = async () => {
    try {
      const res = await fetch("/api/admin/flags", {
        headers: { Authorization: `Bearer mock-${user.id}` }
      });
      const data = await res.json();
      if (res.ok) setFlagsList(data.flags || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAuditLogs = async (search = "") => {
    try {
      const res = await fetch(`/api/admin/audit-log?search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer mock-${user.id}` }
      });
      const data = await res.json();
      if (res.ok) setAuditLogs(data.auditLogs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAllUsers = async () => {
    try {
      const resUsers = await fetch("/api/auth/demo-users", {
        headers: { Authorization: `Bearer mock-${user.id}` }
      });
      const dataUsers = await resUsers.json();
      if (resUsers.ok) setAllUsersList(dataUsers.users || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer mock-${user.id}` }
      });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadPendingUsers();
    loadFlags();
    loadAllUsers();
    loadStats();
    if (activeSubTab === "audit") {
      loadAuditLogs(searchQuery);
    }
  }, [activeSubTab, searchQuery]);

  const handleVerifyUser = async (targetId, decision) => {
    try {
      const res = await fetch(`/api/admin/users/${targetId}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer mock-${user.id}`
        },
        body: JSON.stringify({ decision })
      });
      if (res.ok) {
        alert(`User successfully ${decision}.`);
        setSelectedUserForReview(null);
        loadPendingUsers();
        loadAllUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignFlag = async (flagId) => {
    try {
      const res = await fetch(`/api/admin/flags/${flagId}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer mock-${user.id}`
        },
        body: JSON.stringify({ adminOwnerId: user.id })
      });
      if (res.ok) {
        alert("Assigned yourself as owner successfully.");
        loadFlags();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveFlag = async (flagId) => {
    try {
      const res = await fetch(`/api/admin/flags/${flagId}/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer mock-${user.id}` }
      });
      if (res.ok) {
        alert("Flag resolved successfully.");
        loadFlags();
        loadAllUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // GDPR/DPDP Act Erasure
  const handleLookupErasure = async (e) => {
    e.preventDefault();
    if (!erasureSearch.trim()) return;

    try {
      const match = allUsersList.find(
        (u) => u.phoneNumber.toLowerCase() === erasureSearch.toLowerCase() || u.id === erasureSearch
      );

      if (match) {
        setErasureTargetUser(match);
      } else {
        alert("No active user found with that phone number or ID.");
        setErasureTargetUser(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerErasure = async () => {
    if (!erasureTargetUser) return;
    const confirmText = `ERASE ${erasureTargetUser.name.toUpperCase()}`;
    const typed = window.prompt(
      `CRITICAL DELETION (DPDP Act 2023 Compliance):\nThis will completely erase/anonymize all personal identity columns (Name, Phone Number, Locations) for this user.\n\nType "${confirmText}" to confirm:`
    );

    if (typed !== confirmText) {
      alert("Verification failed. Erasure cancelled.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${erasureTargetUser.id}/erasure`, {
        method: "POST",
        headers: { Authorization: `Bearer mock-${user.id}` }
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        setErasureTargetUser(null);
        setErasureSearch("");
        loadAllUsers();
      } else {
        alert("Failed to complete data erasure.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="text-gray-900 font-sans" id="admin-console">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black font-sans tracking-tight text-gray-950 mb-1">
            Admin Console
          </h2>
          <p className="text-gray-600 font-medium text-lg">
            Safety and operational monitoring oversight.
          </p>
        </div>
        <button className="bg-[#4338ca] hover:bg-indigo-800 text-white font-bold py-2.5 px-5 rounded-xl shadow-md flex items-center gap-2 transition-colors cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          Export System Report
        </button>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
           <h3 className="text-sm font-bold text-gray-600 mb-2">Pending Verifications</h3>
           <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-gray-950">
                {stats ? stats.pendingVerifications : pendingUsers.length}
              </span>
              {stats && stats.pendingVerifications > 0 && (
                <span className="text-sm font-bold text-red-600 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-0.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                  Needs action
                </span>
              )}
           </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
           <h3 className="text-sm font-bold text-gray-600 mb-2">Active Disputes</h3>
           <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-gray-950">
                {stats != null
                  ? (stats.activeDisputes < 10 ? `0${stats.activeDisputes}` : stats.activeDisputes)
                  : (flagsList.length < 10 ? `0${flagsList.length}` : flagsList.length)}
              </span>
              {stats && stats.activeDisputes === 0 && (
                <span className="text-sm font-bold text-emerald-600">Clear</span>
              )}
           </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
           <h3 className="text-sm font-bold text-gray-600 mb-2">Audit Events (24h)</h3>
           <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-gray-950">
                {stats != null ? stats.auditEvents24h.toLocaleString() : auditLogs.length.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-gray-500">
                {stats && stats.auditEvents24h === 0 ? "Quiet" : "Normal"}
              </span>
           </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
           <h3 className="text-sm font-bold text-gray-600 mb-2">GDPR Requests</h3>
           <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-gray-950">
                {stats != null
                  ? (stats.gdprRequests < 10 ? `0${stats.gdprRequests}` : stats.gdprRequests)
                  : "00"}
              </span>
              {stats && stats.gdprRequests > 0 && (
                <span className="bg-amber-700 text-amber-50 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">CRITICAL</span>
              )}
              {stats && stats.gdprRequests === 0 && (
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">CLEAR</span>
              )}
           </div>
        </div>
      </div>

      {/* 3. Panel Area - Tabs Container */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Admin Tabs Grid */}
        <div className="flex flex-wrap border-b border-gray-200 bg-gray-50/50 px-2 pt-2 gap-1">
          <button
            onClick={() => setActiveSubTab("verifications")}
            className={`py-3 px-4 font-bold text-sm border-b-[3px] transition-all flex items-center gap-2 ${
            activeSubTab === "verifications" ?
            "border-indigo-600 text-indigo-700 bg-white rounded-t-lg" :
            "border-transparent text-gray-600 hover:text-gray-900"}`
            }>
            <Shield size={16} />
            <span>Pending Verifications</span>
          </button>
          <button
            onClick={() => setActiveSubTab("flags")}
            className={`py-3 px-4 font-bold text-sm border-b-[3px] transition-all flex items-center gap-2 ${
            activeSubTab === "flags" ?
            "border-indigo-600 text-indigo-700 bg-white rounded-t-lg" :
            "border-transparent text-gray-600 hover:text-gray-900"}`
            }>
            <FlagIcon size={16} />
            <span>Moderation & Disputes</span>
          </button>
          <button
            onClick={() => setActiveSubTab("audit")}
            className={`py-3 px-4 font-bold text-sm border-b-[3px] transition-all flex items-center gap-2 ${
            activeSubTab === "audit" ?
            "border-indigo-600 text-indigo-700 bg-white rounded-t-lg" :
            "border-transparent text-gray-600 hover:text-gray-900"}`
            }>
            <FileText size={16} />
            <span>Audit Logs</span>
          </button>
          <button
            onClick={() => setActiveSubTab("erasure")}
            className={`py-3 px-4 font-bold text-sm border-b-[3px] transition-all flex items-center gap-2 ${
            activeSubTab === "erasure" ?
            "border-indigo-600 text-indigo-700 bg-white rounded-t-lg" :
            "border-transparent text-gray-600 hover:text-gray-900"}`
            }>
            <Shield size={16} />
            <span>Compliance Lookup</span>
          </button>
        </div>

        <div className="p-6 md:p-8">
          {/* SUB TAB: VERIFICATIONS */}
          {activeSubTab === "verifications" &&
          <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
                <h3 className="text-[22px] font-black tracking-tight text-gray-900">Verification Queue</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input
                  type="text"
                  className="bg-white border border-gray-300 text-sm text-gray-900 rounded-lg pl-9 pr-4 py-2 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                  placeholder="Search applicants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>

              {pendingUsers.length === 0 ?
              <div className="text-center py-12 text-gray-500 text-base font-medium">
                  No users currently pending verification. Good job, team!
              </div> :
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="text-[11px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="py-3 px-4 rounded-tl-lg">APPLICANT</th>
                        <th className="py-3 px-4">ROLE</th>
                        <th className="py-3 px-4">SUBMISSION DATE</th>
                        <th className="py-3 px-4">SLA STATUS</th>
                        <th className="py-3 px-4 text-right rounded-tr-lg">ACTIONS</th>
                      </tr>
                    </thead>
                    <div className="h-2"></div>
                    <tbody className="divide-y divide-gray-100">
                      {pendingUsers.map((u, index) => {
                        const ageMs = Date.now() - new Date(u.createdAt).getTime();
                        const isBreached = ageMs > SLA_LIMIT_HOURS * 60 * 60 * 1000;
                        const isWarning = ageMs > (SLA_LIMIT_HOURS - 4) * 60 * 60 * 1000 && !isBreached;
                        const avatarColors = ["bg-indigo-600", "bg-[#34d399] text-white", "bg-amber-700"];
                        const avatarColor = avatarColors[index % avatarColors.length];
                        
                        return (
                          <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="py-4 px-4 flex items-center gap-4 border-b border-gray-100">
                               <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0 uppercase ${avatarColor}`}>
                                 {u.name.split(' ').map(n=>n[0]).join('').substring(0,2)}
                               </div>
                               <div>
                                 <div className="font-black text-gray-900 text-sm">{u.name}</div>
                                 <div className="font-medium text-[11px] text-gray-500">{u.phoneNumber || u.email}</div>
                               </div>
                            </td>
                            <td className="py-4 px-4 border-b border-gray-100">
                              <span className="px-3 py-1 rounded-full text-[11px] font-black bg-[#e0e7ff] text-[#4f46e5] capitalize inline-block">
                                {u.role}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-[13px] font-bold text-gray-600 border-b border-gray-100">
                              {new Date(u.createdAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})} | {new Date(u.createdAt).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: false})}
                            </td>
                            <td className="py-4 px-4 border-b border-gray-100">
                              {isBreached ?
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-[#dc2626]"></div>
                                  <span className="text-[#dc2626] text-[11px] font-black uppercase tracking-wider">SLA BREACH (-4h)</span>
                                </div> :
                                isWarning ?
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-[#b45309]"></div>
                                  <span className="text-[#b45309] text-[11px] font-black uppercase tracking-wider">Warning (2h left)</span>
                                </div> :
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-[#059669]"></div>
                                  <span className="text-[#059669] text-[11px] font-black uppercase tracking-wider">On Track</span>
                                </div>
                              }
                            </td>
                            <td className="py-4 px-4 text-right border-b border-gray-100">
                              <button
                                onClick={() => setSelectedUserForReview(u)}
                                className="bg-[#4338ca] hover:bg-indigo-800 text-white font-bold text-[11px] rounded py-1.5 px-4 transition-colors cursor-pointer">
                                Review
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }

          {/* SUB TAB: FLAGS (DISPUTES) */}
          {activeSubTab === "flags" &&
          <div className="space-y-6">
              <h3 className="text-[22px] font-black tracking-tight text-gray-900 border-b border-gray-200 pb-6">Active Moderation Disputes</h3>

              {flagsList.length === 0 ?
            <div className="text-center py-12 text-gray-500 text-base font-medium">
                  No disputes flagged currently. Our community is harmonious!
                </div> :

            <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="text-[11px] font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="py-3.5 px-4 rounded-tl-lg">Reporter</th>
                        <th className="py-3.5 px-4">Target Type</th>
                        <th className="py-3.5 px-4">Target ID</th>
                        <th className="py-3.5 px-4">Reason</th>
                        <th className="py-3.5 px-4">48h SLA Breach</th>
                        <th className="py-3.5 px-4">Assigned Owner</th>
                        <th className="py-3.5 px-4 rounded-tr-lg text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {flagsList.map((f) => {
                    const isBreached = Date.now() - new Date(f.flag.createdAt).getTime() > 48 * 60 * 60 * 1000;
                    return (
                      <tr key={f.flag.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-4 font-bold text-gray-900">
                              {f.reporterName || f.flag.reporterId}
                            </td>
                            <td className="py-3 px-4 uppercase font-bold text-xs">{f.flag.targetType}</td>
                            <td className="py-3 px-4 font-mono text-xs text-gray-500">{f.flag.targetId}</td>
                            <td className="py-3 px-4 text-gray-600 italic">"{f.flag.reason}"</td>
                            <td className="py-3 px-4">
                              {isBreached && f.flag.status === "pending" ?
                          <span className="bg-red-100 text-red-700 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase">
                                  🚨 SLA Warn (&gt;48h)
                                </span> :
                          <span className="text-emerald-600 text-xs font-bold">Within SLA</span>
                          }
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold text-gray-700">
                              {f.flag.adminOwnerId ? `Admin ID: ${f.flag.adminOwnerId}` : "Unassigned"}
                            </td>
                            <td className="py-3 px-4 text-right flex justify-end gap-2">
                              {f.flag.status === "pending" &&
                          <>
                                  {!f.flag.adminOwnerId &&
                            <button
                              onClick={() => handleAssignFlag(f.flag.id)}
                              className="bg-[#4338ca] hover:bg-indigo-800 text-white font-bold text-xs rounded py-1 px-2.5 transition-colors cursor-pointer">
                                      Assign Me
                                    </button>
                            }
                                  <button
                              onClick={() => handleResolveFlag(f.flag.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded py-1 px-2.5 transition-colors cursor-pointer">
                                    Resolve
                                  </button>
                                </>
                          }
                              {f.flag.status === "resolved" &&
                          <span className="text-emerald-600 text-xs font-bold">Resolved ✅</span>
                          }
                            </td>
                          </tr>);
                  })}
                    </tbody>
                  </table>
                </div>
            }
            </div>
          }

          {/* SUB TAB: AUDIT LOGS */}
          {activeSubTab === "audit" &&
          <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
                <h3 className="text-[22px] font-black tracking-tight text-gray-900">Searchable Core State Audit Trail</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                  <input
                  type="text"
                  className="bg-white border border-gray-300 text-sm text-gray-900 rounded-lg pl-9 pr-4 py-2 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  placeholder="Filter logs by actor, state..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {auditLogs.length === 0 ?
              <div className="text-center py-12 text-gray-500 text-base font-medium">
                    No matching logs found in system audit trail.
                  </div> :

              auditLogs.map((item) =>
              <div
                key={item.log.id}
                className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 text-sm shadow-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#e0e7ff] text-[#4338ca] font-bold px-2 py-0.5 rounded text-[11px] uppercase tracking-wide">
                            {item.log.entityType}
                          </span>
                          <span className="text-gray-500 font-mono text-xs">Entity ID: {item.log.entityId}</span>
                        </div>
                        <p className="text-gray-700">
                          Transitioned from{" "}
                          <strong className="text-red-600">"{item.log.oldState || "NULL"}"</strong> to{" "}
                          <strong className="text-emerald-600">"{item.log.newState}"</strong>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="block text-xs font-bold text-gray-900">
                          Actor: {item.actorName || "System Cron/Job"}
                        </span>
                        <span className="block text-[11px] font-mono text-gray-500 mt-0.5">
                          {new Date(item.log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
              )
              }
              </div>

              <p className="text-xs text-gray-500 leading-normal bg-gray-50 p-3 rounded-lg border border-gray-200">
                ℹ️ DATA RETENTION POLICY: Audit logs are retained for <strong>12 months</strong> as per standard compliance guidelines, after which they are archived/purged automatically. Intent aligns with the India DPDP Act 2023.
              </p>
            </div>
          }

          {/* SUB TAB: GDPR/DPDP ERASURE COMPLIANCE */}
          {activeSubTab === "erasure" &&
          <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-red-600 tracking-tight">DPDP Act 2023 Compliance & Data Erasure</h3>
                <p className="text-sm text-gray-600 font-medium">
                  Senior citizens or volunteers have the legal right to request the complete erasure of their personal
                  identity records (Name, Phone Number, Locations) from our platform.
                </p>
              </div>

              <form
              onSubmit={handleLookupErasure}
              className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex gap-2 shadow-sm">
                <input
                type="tel"
                className="bg-white border border-gray-300 text-sm text-gray-900 rounded-lg px-4 py-2.5 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter user phone number to lookup..."
                value={erasureSearch}
                onChange={(e) => setErasureSearch(e.target.value)} />
                <button
                type="submit"
                className="bg-[#4338ca] hover:bg-indigo-800 text-white font-bold text-sm rounded-lg px-5 py-2.5 cursor-pointer shadow-sm">
                  Lookup User
                </button>
              </form>

              {erasureTargetUser &&
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 space-y-4 animate-fade-in shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="bg-red-100 text-red-700 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                        Target Identified
                      </span>
                      <h4 className="text-xl font-black text-gray-900">{erasureTargetUser.name}</h4>
                      <p className="text-sm text-gray-700 font-medium">Phone: {erasureTargetUser.phoneNumber}</p>
                      <p className="text-sm text-gray-700 font-medium">User ID: {erasureTargetUser.id}</p>
                      <p className="text-sm text-gray-700 font-medium">Account Status: {erasureTargetUser.verificationStatus}</p>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-red-200 shadow-sm">
                    <p className="text-xs text-red-700 leading-normal font-medium">
                      ⚠️ CRITICAL IMPACT: Executing erasure will permanently cascade delete all stored locations tied to
                      this user, and permanently scramble the Name and Phone Number strings in PostgreSQL. This action is{" "}
                      <strong>100% irreversible</strong>.
                    </p>
                  </div>

                  <button
                type="button"
                onClick={handleTriggerErasure}
                className="bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded-xl py-3 px-6 shadow transition-all flex items-center justify-center gap-2 cursor-pointer w-full md:w-auto">
                    <Trash2 size={18} />
                    <span>PERMANENTLY ERASE & ANONYMIZE MEMBER PROFILE</span>
                  </button>
                </div>
            }
            </div>
          }
        </div>
      </div>
      {/* Review Modal */}
      {selectedUserForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between z-10">
              <h3 className="text-xl font-black text-gray-900">Review Application</h3>
              <button 
                onClick={() => setSelectedUserForReview(null)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-8">
              {/* Profile Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Profile Information</h4>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div>
                      <span className="block text-[11px] font-bold text-gray-400 uppercase">Full Name</span>
                      <span className="text-sm font-black text-gray-900">{selectedUserForReview.name}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-gray-400 uppercase">Phone Number</span>
                      <span className="text-sm font-bold text-gray-700">{selectedUserForReview.phoneNumber}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-gray-400 uppercase">Role</span>
                      <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-emerald-800 capitalize mt-0.5">
                        {selectedUserForReview.role}
                      </span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const pd = selectedUserForReview.personalDetails || {};
                  const ageVal = pd.age || selectedUserForReview.age || "N/A";
                  const mobileVal = pd.mobileNumber || selectedUserForReview.mobileNumber || selectedUserForReview.phoneNumber || "N/A";
                  const addressVal = pd.address || selectedUserForReview.address || "N/A";
                  const cityVal = pd.city || selectedUserForReview.city || "";
                  const postalVal = pd.postalCode || selectedUserForReview.postalCode || "";
                  const emergencyName = pd.emergencyContactName || selectedUserForReview.emergencyContactName;
                  const emergencyPhone = pd.emergencyContactPhone || selectedUserForReview.emergencyContactPhone;

                  return (
                    <div>
                      <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Personal Details</h4>
                      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="block text-[11px] font-bold text-gray-400 uppercase">Age</span>
                            <span className="text-sm font-bold text-gray-700">{ageVal}</span>
                          </div>
                          <div>
                            <span className="block text-[11px] font-bold text-gray-400 uppercase">Mobile</span>
                            <span className="text-sm font-bold text-gray-700">{mobileVal}</span>
                          </div>
                        </div>
                        <div>
                          <span className="block text-[11px] font-bold text-gray-400 uppercase">Address</span>
                          <span className="text-sm font-bold text-gray-700 block">{addressVal}</span>
                          {(cityVal || postalVal) && (
                            <span className="text-sm font-bold text-gray-700 block">{cityVal}{cityVal && postalVal ? ", " : ""}{postalVal}</span>
                          )}
                        </div>
                        {emergencyName && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <span className="block text-[11px] font-bold text-red-600 uppercase">Emergency Contact</span>
                            <span className="text-sm font-bold text-gray-700">
                              {emergencyName} {emergencyPhone ? `(${emergencyPhone})` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Identity Proof */}
              {(() => {
                const pd = selectedUserForReview.personalDetails || {};
                const idProof = selectedUserForReview.identityProof || {};
                const docType = pd.identityProofType || selectedUserForReview.identityProofType || idProof.fileName || "Identity Proof Document";
                const docPath = idProof.relativePath || idProof.fullPath || selectedUserForReview.identityProofPath || selectedUserForReview.identityProofUrl;

                return (
                  <div>
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Identity Verification</h4>
                    <div className="border border-gray-200 rounded-xl p-5 flex flex-col items-center justify-center bg-gray-50 space-y-4">
                      <div className="flex items-center gap-2">
                        <FileText className="text-[#263c2e]" size={24} />
                        <span className="font-bold text-gray-900">{docType}</span>
                      </div>
                      
                      {docPath ? (
                        <a 
                          href={docPath.startsWith('gs://') 
                            ? `https://storage.googleapis.com/${docPath.replace('gs://', '')}` 
                            : docPath.startsWith('http') || docPath.startsWith('/') ? docPath : `/private-uploads/id-proofs/${docPath}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-white border border-gray-300 text-sm font-bold text-[#263c2e] rounded-lg hover:bg-emerald-50 transition-colors shadow-2xs"
                        >
                          View ID Document ↗
                        </a>
                      ) : (
                        <span className="text-sm text-red-600 font-bold">No document provided</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3 rounded-b-2xl">
              <button 
                onClick={() => handleVerifyUser(selectedUserForReview.id, "rejected")}
                className="px-5 py-2.5 rounded-xl border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-bold text-sm transition-colors"
              >
                Reject
              </button>
              <button 
                onClick={() => handleVerifyUser(selectedUserForReview.id, "approved")}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-sm transition-colors shadow-sm"
              >
                Approve User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}