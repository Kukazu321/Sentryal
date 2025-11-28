'use client';

import React, { useState } from 'react';
import {
    FileText,
    Plus,
    Download,
    MoreHorizontal,
    Filter,
    Search,
    LayoutTemplate,
    BarChart3,
    Map as MapIcon,
    AlertTriangle,
    CheckCircle2,
    Share2,
    ArrowLeft,
    FileBarChart,
    PieChart,
    Settings2,
    Sparkles,
    Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// --- Mock Data ---

const RECENT_REPORTS = [
    { id: 'RPT-2024-089', name: 'Monthly Structural Health - Oct 2024', type: 'PDF', size: '2.4 MB', date: 'Oct 31, 2024', author: 'System', status: 'ready' },
    { id: 'RPT-2024-088', name: 'Pont de Normandie - Incident Analysis', type: 'Interactive', size: '-', date: 'Oct 28, 2024', author: 'C. Dupont', status: 'ready' },
    { id: 'RPT-2024-087', name: 'Q3 Global Infrastructure Overview', type: 'PDF', size: '15.1 MB', date: 'Oct 15, 2024', author: 'Admin', status: 'ready' },
    { id: 'RPT-2024-086', name: 'Weekly Displacement Log', type: 'CSV', size: '450 KB', date: 'Oct 07, 2024', author: 'System', status: 'ready' },
    { id: 'RPT-2024-085', name: 'Viaduc de Millau - Special Inspection', type: 'PDF', size: '5.8 MB', date: 'Oct 01, 2024', author: 'M. Martin', status: 'archived' },
];

const TEMPLATES = [
    { id: 't1', name: 'Executive Summary', icon: FileText, desc: 'High-level overview of infrastructure health scores and critical alerts.' },
    { id: 't2', name: 'Technical Deep Dive', icon: BarChart3, desc: 'Detailed InSAR analysis, coherence maps, and raw displacement data.' },
    { id: 't3', name: 'Incident Report', icon: AlertTriangle, desc: 'Focused analysis on specific anomalies and resolution tracking.' },
    { id: 't4', name: 'Compliance Audit', icon: CheckCircle2, desc: 'Standardized format for regulatory safety compliance.' },
];

export default function ReportsPage() {
    const [view, setView] = useState<'list' | 'create'>('list');
    const [isGenerating, setIsGenerating] = useState(false);

    // Builder State
    const [reportTitle, setReportTitle] = useState('New Report - ' + new Date().toLocaleDateString());
    const [selectedTemplate, setSelectedTemplate] = useState('t1');
    const [dateRange, setDateRange] = useState('last-30-days');

    // Modules State
    const [modules, setModules] = useState({
        summary: true,
        heatmap: true,
        velocity: true,
        incidents: false,
        recommendations: true
    });

    const handleGenerate = () => {
        setIsGenerating(true);
        // Simulate generation
        setTimeout(() => {
            setIsGenerating(false);
            setView('list');
        }, 2000);
    };

    if (view === 'create') {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col">
                {/* Builder Header */}
                <header className="bg-white border-b border-neutral-200 px-6 h-16 flex items-center justify-between sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setView('list')}
                            className="p-2 hover:bg-neutral-100 rounded-full text-neutral-500 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="h-6 w-px bg-neutral-200" />
                        <div>
                            <h1 className="text-sm font-semibold text-neutral-900">Report Builder</h1>
                            <p className="text-xs text-neutral-500">Drafting mode</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-neutral-500">Auto-saved 2m ago</span>
                        <button className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                            Save Draft
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-70"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    Generate Report
                                </>
                            )}
                        </button>
                    </div>
                </header>

                {/* Builder Content - Split View */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left Panel: Configuration */}
                    <div className="w-[400px] bg-white border-r border-neutral-200 overflow-y-auto p-6 space-y-8 z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">

                        {/* Section: Meta */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                                <Settings2 className="w-3 h-3" />
                                Configuration
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Report Title</label>
                                    <input
                                        type="text"
                                        value={reportTitle}
                                        onChange={(e) => setReportTitle(e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/5 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Date Range</label>
                                    <select
                                        value={dateRange}
                                        onChange={(e) => setDateRange(e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/5 transition-all"
                                    >
                                        <option value="last-7-days">Last 7 Days</option>
                                        <option value="last-30-days">Last 30 Days</option>
                                        <option value="last-quarter">Last Quarter</option>
                                        <option value="ytd">Year to Date</option>
                                        <option value="custom">Custom Range...</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <hr className="border-neutral-100" />

                        {/* Section: Template Selection */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                                <LayoutTemplate className="w-3 h-3" />
                                Template
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                                {TEMPLATES.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedTemplate(t.id)}
                                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${selectedTemplate === t.id
                                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-md'
                                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg ${selectedTemplate === t.id ? 'bg-white/10' : 'bg-neutral-100'}`}>
                                            <t.icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">{t.name}</div>
                                            <div className={`text-xs mt-0.5 ${selectedTemplate === t.id ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                                {t.desc}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <hr className="border-neutral-100" />

                        {/* Section: Content Modules */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                                <FileBarChart className="w-3 h-3" />
                                Content Modules
                            </h3>
                            <div className="space-y-2">
                                {[
                                    { id: 'summary', label: 'AI Executive Summary', icon: Sparkles },
                                    { id: 'heatmap', label: 'Displacement Heatmap', icon: MapIcon },
                                    { id: 'velocity', label: 'Velocity Charts', icon: BarChart3 },
                                    { id: 'incidents', label: 'Incident Log', icon: AlertTriangle },
                                    { id: 'recommendations', label: 'Auto-Recommendations', icon: CheckCircle2 },
                                ].map((mod) => (
                                    <label key={mod.id} className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 cursor-pointer transition-all">
                                        <div className="flex items-center gap-3">
                                            <mod.icon className="w-4 h-4 text-neutral-500" />
                                            <span className="text-sm font-medium text-neutral-700">{mod.label}</span>
                                        </div>
                                        <div className={`w-10 h-5 rounded-full relative transition-colors ${modules[mod.id as keyof typeof modules] ? 'bg-neutral-900' : 'bg-neutral-200'}`}>
                                            <input
                                                type="checkbox"
                                                className="opacity-0 absolute inset-0 cursor-pointer"
                                                checked={modules[mod.id as keyof typeof modules]}
                                                onChange={(e) => setModules({ ...modules, [mod.id]: e.target.checked })}
                                            />
                                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${modules[mod.id as keyof typeof modules] ? 'left-6' : 'left-1'}`} />
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Right Panel: Live Preview */}
                    <div className="flex-1 bg-neutral-100/50 p-8 overflow-y-auto flex justify-center">
                        <div className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-xl rounded-sm p-[20mm] flex flex-col gap-8 transform origin-top scale-[0.85] lg:scale-100 transition-transform">

                            {/* Preview Header */}
                            <div className="flex items-start justify-between border-b border-neutral-900 pb-6">
                                <div>
                                    <div className="text-3xl font-bold text-neutral-900 mb-2">{reportTitle}</div>
                                    <div className="text-sm text-neutral-500 font-medium uppercase tracking-wide">
                                        {dateRange.replace(/-/g, ' ').toUpperCase()} • SENTRYAL ANALYTICS
                                    </div>
                                </div>
                                <div className="w-12 h-12 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                                    S
                                </div>
                            </div>

                            {/* Preview Content */}
                            <div className="space-y-8">

                                {modules.summary && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider border-l-2 border-neutral-900 pl-3">Executive Summary</h4>
                                        <div className="text-sm text-neutral-600 leading-relaxed text-justify">
                                            <span className="bg-neutral-100 text-neutral-800 px-1 rounded">AI Generated:</span> Over the last period, the monitored infrastructure showed stable behavior with <strong>98.5%</strong> of sensors reporting within nominal ranges. However, a localized displacement anomaly was detected in Sector B (Viaduc de Millau) correlating with recent heavy rainfall. Immediate inspection is recommended for Pylon 3.
                                        </div>
                                    </div>
                                )}

                                {modules.heatmap && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                                        <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider border-l-2 border-neutral-900 pl-3">Displacement Heatmap</h4>
                                        <div className="aspect-[2/1] bg-neutral-100 rounded-lg border border-neutral-200 flex items-center justify-center relative overflow-hidden">
                                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_40%,rgba(255,0,0,0.5),transparent_40%),radial-gradient(circle_at_70%_60%,rgba(0,255,0,0.3),transparent_40%)]" />
                                            <span className="text-xs text-neutral-400 font-medium">Interactive Map Visualization Placeholder</span>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-6">
                                    {modules.velocity && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                                            <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider border-l-2 border-neutral-900 pl-3">Velocity Trend</h4>
                                            <div className="aspect-square bg-neutral-50 rounded-lg border border-neutral-200 p-4 flex items-end gap-2">
                                                {[40, 65, 45, 80, 55, 70, 60].map((h, i) => (
                                                    <div key={i} className="flex-1 bg-neutral-900 rounded-t-sm" style={{ height: `${h}%` }} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {modules.incidents && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                                            <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider border-l-2 border-neutral-900 pl-3">Incident Log</h4>
                                            <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-4 space-y-2">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                                    <span className="font-medium">Oct 24:</span> Threshold Exceeded
                                                </div>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                    <span className="font-medium">Oct 12:</span> Sensor Offline
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {modules.recommendations && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
                                        <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider border-l-2 border-neutral-900 pl-3">Recommendations</h4>
                                        <ul className="space-y-2">
                                            <li className="flex items-start gap-3 text-sm text-neutral-700">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                                <span>Schedule visual inspection for Sector B within 48 hours.</span>
                                            </li>
                                            <li className="flex items-start gap-3 text-sm text-neutral-700">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                                <span>Calibrate sensors 142-A and 142-B to reduce noise.</span>
                                            </li>
                                        </ul>
                                    </div>
                                )}

                            </div>

                            {/* Preview Footer */}
                            <div className="mt-auto pt-6 border-t border-neutral-200 flex justify-between items-center text-xs text-neutral-400">
                                <span>Generated by Sentryal AI</span>
                                <span>Page 1 of 1</span>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-neutral-900 font-sans">
            {/* Header */}
            <header className="border-b border-neutral-100 bg-white sticky top-0 z-10">
                <div className="max-w-[1800px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-semibold tracking-tight">Reports Center</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Search reports..."
                                className="pl-9 pr-4 py-1.5 text-sm border border-neutral-200 rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-neutral-900/5 focus:border-neutral-300 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setView('create')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition-colors shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            New Report
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1800px] mx-auto px-6 py-8 space-y-8">

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-neutral-200 shadow-sm bg-neutral-50/50">
                        <CardHeader className="pb-2">
                            <CardDescription>Reports Generated (30d)</CardDescription>
                            <CardTitle className="text-3xl font-bold">24</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                                <ArrowLeft className="w-3 h-3 rotate-45" />
                                +12% vs last month
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-neutral-200 shadow-sm bg-neutral-50/50">
                        <CardHeader className="pb-2">
                            <CardDescription>Scheduled Jobs</CardDescription>
                            <CardTitle className="text-3xl font-bold">8</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                                Next run in 2h 15m
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-neutral-200 shadow-sm bg-neutral-50/50">
                        <CardHeader className="pb-2">
                            <CardDescription>Storage Used</CardDescription>
                            <CardTitle className="text-3xl font-bold">1.2 GB</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="w-full bg-neutral-200 rounded-full h-1.5 mt-1">
                                <div className="bg-neutral-900 h-1.5 rounded-full" style={{ width: '15%' }} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Reports Table */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-neutral-900">Recent Reports</h2>
                        <div className="flex gap-2">
                            <button className="p-2 text-neutral-500 hover:bg-neutral-50 rounded-md border border-transparent hover:border-neutral-200 transition-all">
                                <Filter className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-neutral-500 hover:bg-neutral-50 rounded-md border border-transparent hover:border-neutral-200 transition-all">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-neutral-50 border-b border-neutral-200">
                                <tr>
                                    <th className="px-6 py-3 font-medium text-neutral-500">Report Name</th>
                                    <th className="px-6 py-3 font-medium text-neutral-500">Type</th>
                                    <th className="px-6 py-3 font-medium text-neutral-500">Date Created</th>
                                    <th className="px-6 py-3 font-medium text-neutral-500">Size</th>
                                    <th className="px-6 py-3 font-medium text-neutral-500">Author</th>
                                    <th className="px-6 py-3 font-medium text-neutral-500 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {RECENT_REPORTS.map((report) => (
                                    <tr key={report.id} className="group hover:bg-neutral-50/80 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-neutral-100 rounded-lg text-neutral-600 group-hover:bg-white group-hover:shadow-sm transition-all">
                                                    {report.type === 'PDF' ? <FileText className="w-4 h-4" /> :
                                                        report.type === 'CSV' ? <FileBarChart className="w-4 h-4" /> :
                                                            <PieChart className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-neutral-900">{report.name}</div>
                                                    <div className="text-xs text-neutral-500">{report.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-600">
                                                {report.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-neutral-600">
                                            {report.date}
                                        </td>
                                        <td className="px-6 py-4 text-neutral-600 font-mono text-xs">
                                            {report.size}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-medium text-neutral-600">
                                                    {report.author.charAt(0)}
                                                </div>
                                                <span className="text-neutral-700">{report.author}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors" title="Download">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors" title="Share">
                                                    <Share2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Templates Grid */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-neutral-900">Quick Start Templates</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {TEMPLATES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => {
                                    setSelectedTemplate(t.id);
                                    setView('create');
                                }}
                                className="flex flex-col items-start p-5 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-md transition-all text-left group"
                            >
                                <div className="p-3 rounded-lg bg-neutral-50 text-neutral-600 mb-4 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                                    <t.icon className="w-5 h-5" />
                                </div>
                                <h3 className="font-medium text-neutral-900 mb-1">{t.name}</h3>
                                <p className="text-xs text-neutral-500 line-clamp-2">{t.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

            </main>
        </div>
    );
}
