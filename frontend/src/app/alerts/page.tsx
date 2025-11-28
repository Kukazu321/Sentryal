'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Bell,
    Activity,
    Settings,
    Filter,
    Plus,
    Search,
    MoreHorizontal,
    Clock,
    ShieldAlert,
    Zap,
    Download,
    Mail,
    Webhook,
    Smartphone,
    MessageSquare,
    CheckCircle2,
    AlertTriangle,
    ArrowUpRight,
    X,
    ChevronRight,
    ChevronDown,
    Sliders,
    Eye
} from 'lucide-react';

const SlackIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path d="M26.5002 14.9996C27.8808 14.9996 29 13.8804 29 12.4998C29 11.1192 27.8807 10 26.5001 10C25.1194 10 24 11.1193 24 12.5V14.9996H26.5002ZM19.5 14.9996C20.8807 14.9996 22 13.8803 22 12.4996V5.5C22 4.11929 20.8807 3 19.5 3C18.1193 3 17 4.11929 17 5.5V12.4996C17 13.8803 18.1193 14.9996 19.5 14.9996Z" fill="#2EB67D"></path>
            <path d="M5.49979 17.0004C4.11919 17.0004 3 18.1196 3 19.5002C3 20.8808 4.1193 22 5.49989 22C6.8806 22 8 20.8807 8 19.5V17.0004H5.49979ZM12.5 17.0004C11.1193 17.0004 10 18.1197 10 19.5004V26.5C10 27.8807 11.1193 29 12.5 29C13.8807 29 15 27.8807 15 26.5V19.5004C15 18.1197 13.8807 17.0004 12.5 17.0004Z" fill="#E01E5A"></path>
            <path d="M17.0004 26.5002C17.0004 27.8808 18.1196 29 19.5002 29C20.8808 29 22 27.8807 22 26.5001C22 25.1194 20.8807 24 19.5 24L17.0004 24L17.0004 26.5002ZM17.0004 19.5C17.0004 20.8807 18.1197 22 19.5004 22L26.5 22C27.8807 22 29 20.8807 29 19.5C29 18.1193 27.8807 17 26.5 17L19.5004 17C18.1197 17 17.0004 18.1193 17.0004 19.5Z" fill="#ECB22E"></path>
            <path d="M14.9996 5.49979C14.9996 4.11919 13.8804 3 12.4998 3C11.1192 3 10 4.1193 10 5.49989C10 6.88061 11.1193 8 12.5 8L14.9996 8L14.9996 5.49979ZM14.9996 12.5C14.9996 11.1193 13.8803 10 12.4996 10L5.5 10C4.11929 10 3 11.1193 3 12.5C3 13.8807 4.11929 15 5.5 15L12.4996 15C13.8803 15 14.9996 13.8807 14.9996 12.5Z" fill="#36C5F0"></path>
        </g>
    </svg>
);

// --- Mock Data ---

const MOCK_ALERTS = [
    {
        id: 'ALT-2938',
        title: 'Displacement Threshold Exceeded',
        description: 'Vertical displacement of +18.2mm detected on Pylon 3 (Pont de Normandie).',
        severity: 'critical',
        status: 'active',
        timestamp: '10m ago',
        infra: 'Pont de Normandie',
        metric: '+18.2mm',
        assignee: 'C. Dupont'
    },
    {
        id: 'ALT-2937',
        title: 'Coherence Degradation',
        description: 'Sector B coherence dropped below 0.35 threshold during last pass.',
        severity: 'warning',
        status: 'investigating',
        timestamp: '2h ago',
        infra: 'Viaduc de Millau',
        metric: '0.24',
        assignee: 'System'
    },
    {
        id: 'ALT-2936',
        title: 'Ingestion Complete',
        description: 'Sentinel-1A [Track 147] processed successfully. 4GB data added.',
        severity: 'info',
        status: 'resolved',
        timestamp: '5h ago',
        infra: 'System',
        metric: '100%',
        assignee: '-'
    },
    {
        id: 'ALT-2935',
        title: 'Velocity Anomaly',
        description: 'Sudden acceleration detected on slope monitoring points.',
        severity: 'high',
        status: 'active',
        timestamp: '1d ago',
        infra: 'Barrage de Serre-Ponçon',
        metric: '+4.5mm/y',
        assignee: 'M. Martin'
    },
    {
        id: 'ALT-2934',
        title: 'Sensor Offline',
        description: 'Ground station connection lost for > 5 minutes.',
        severity: 'critical',
        status: 'resolved',
        timestamp: '1d ago',
        infra: 'Network',
        metric: 'N/A',
        assignee: 'Auto-Fix'
    },
    {
        id: 'ALT-2933',
        title: 'Maintenance Required',
        description: 'Scheduled maintenance for database optimization.',
        severity: 'info',
        status: 'scheduled',
        timestamp: '2d ago',
        infra: 'Database',
        metric: '-',
        assignee: 'DevOps'
    }
];

const MOCK_RULES = [
    { id: 'R-01', name: 'Structural Safety Net', condition: 'Displacement > 15mm', target: 'All Bridges', status: 'active', description: 'Critical safety threshold for all bridge infrastructures.' },
    { id: 'R-02', name: 'Landslide Warning', condition: 'Velocity > 50mm/y', target: 'Mountain Zones', status: 'active', description: 'Early warning system for slope instability.' },
    { id: 'R-03', name: 'Data Quality', condition: 'Coherence < 0.3', target: 'Global', status: 'paused', description: 'Filters out low-quality interferograms.' },
];

export default function AlertsPage() {
    const [activeTab, setActiveTab] = useState('feed');
    const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

    // New Rule Form State
    const [ruleName, setRuleName] = useState('');
    const [ruleTarget, setRuleTarget] = useState('All Infrastructures');
    const [ruleMetric, setRuleMetric] = useState('Displacement');
    const [ruleOperator, setRuleOperator] = useState('>');
    const [ruleThreshold, setRuleThreshold] = useState('10');
    const [ruleSeverity, setRuleSeverity] = useState('critical');

    const toggleSelectAll = () => {
        if (selectedAlerts.length === MOCK_ALERTS.length) {
            setSelectedAlerts([]);
        } else {
            setSelectedAlerts(MOCK_ALERTS.map(a => a.id));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedAlerts.includes(id)) {
            setSelectedAlerts(selectedAlerts.filter(a => a !== id));
        } else {
            setSelectedAlerts([...selectedAlerts, id]);
        }
    };

    return (
        <div className="min-h-screen bg-white text-neutral-900 font-sans relative">
            {/* Top Navigation / Header */}
            <header className="border-b border-neutral-100 bg-white sticky top-0 z-10">
                <div className="max-w-[1800px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-semibold tracking-tight">Alerts & Incidents</h1>
                        <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium border border-neutral-200">
                            Beta
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="pl-9 pr-4 py-1.5 text-sm border border-neutral-200 rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-neutral-900/5 focus:border-neutral-300 transition-all"
                            />
                        </div>
                        <div className="h-4 w-px bg-neutral-200 mx-1" />
                        <button className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-md transition-colors">
                            <Settings className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsRuleModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition-colors shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            New Rule
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1800px] mx-auto px-6 py-8 space-y-8">

                {/* KPI Section - Minimalist */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                        { label: 'Active Incidents', value: '3', change: '+1', trend: 'up', icon: ShieldAlert },
                        { label: 'Mean Time to Resolve', value: '14m', change: '-2m', trend: 'down', icon: Clock },
                        { label: 'System Health', value: '99.9%', change: 'Stable', trend: 'neutral', icon: Activity },
                        { label: 'Total Alerts (24h)', value: '142', change: '+12%', trend: 'up', icon: Bell },
                    ].map((stat, i) => (
                        <div key={i} className="group p-4 rounded-lg border border-neutral-100 bg-white hover:border-neutral-200 transition-all">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{stat.label}</span>
                                <stat.icon className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                            </div>
                            <div className="flex items-baseline gap-3">
                                <span className="text-2xl font-semibold tracking-tight text-neutral-900">{stat.value}</span>
                                <span className={`text-xs font-medium ${stat.trend === 'up' && stat.label !== 'System Health' ? 'text-red-600' :
                                    stat.trend === 'down' && stat.label === 'Mean Time to Resolve' ? 'text-emerald-600' :
                                        'text-neutral-500'
                                    }`}>
                                    {stat.change}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <Tabs defaultValue="feed" className="space-y-6" onValueChange={setActiveTab}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <TabsList className="bg-neutral-100/50 p-1 rounded-lg border border-neutral-200/50 inline-flex h-auto">
                            <TabsTrigger
                                value="feed"
                                className="px-4 py-1.5 text-sm font-medium text-neutral-600 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm rounded-md transition-all"
                            >
                                Live Feed
                            </TabsTrigger>
                            <TabsTrigger
                                value="rules"
                                className="px-4 py-1.5 text-sm font-medium text-neutral-600 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm rounded-md transition-all"
                            >
                                Rules Engine
                            </TabsTrigger>
                            <TabsTrigger
                                value="channels"
                                className="px-4 py-1.5 text-sm font-medium text-neutral-600 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm rounded-md transition-all"
                            >
                                Channels
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-2">
                            <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors">
                                <Filter className="w-3.5 h-3.5" />
                                Filter
                            </button>
                            <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors">
                                <Download className="w-3.5 h-3.5" />
                                Export
                            </button>
                        </div>
                    </div>

                    <TabsContent value="feed" className="space-y-4">
                        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-neutral-50 border-b border-neutral-200">
                                        <tr>
                                            <th className="w-10 p-4">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                                                    checked={selectedAlerts.length === MOCK_ALERTS.length}
                                                    onChange={toggleSelectAll}
                                                />
                                            </th>
                                            <th className="px-4 py-3 font-medium text-neutral-500">Status</th>
                                            <th className="px-4 py-3 font-medium text-neutral-500">Severity</th>
                                            <th className="px-4 py-3 font-medium text-neutral-500">Alert Details</th>
                                            <th className="px-4 py-3 font-medium text-neutral-500">Infrastructure</th>
                                            <th className="px-4 py-3 font-medium text-neutral-500">Metric</th>
                                            <th className="px-4 py-3 font-medium text-neutral-500">Time</th>
                                            <th className="px-4 py-3 font-medium text-neutral-500 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {MOCK_ALERTS.map((alert) => (
                                            <tr key={alert.id} className="group hover:bg-neutral-50/80 transition-colors">
                                                <td className="p-4">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                                                        checked={selectedAlerts.includes(alert.id)}
                                                        onChange={() => toggleSelect(alert.id)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {alert.status === 'active' ? (
                                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-neutral-200 shadow-sm">
                                                                <span className="relative flex h-2 w-2">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                                </span>
                                                                <span className="text-xs font-medium text-neutral-700">Active</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-medium text-neutral-500 capitalize">{alert.status}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${alert.severity === 'critical' ? 'bg-red-600' :
                                                            alert.severity === 'high' ? 'bg-orange-500' :
                                                                alert.severity === 'warning' ? 'bg-amber-500' :
                                                                    'bg-blue-500'
                                                            }`} />
                                                        <span className={`text-xs font-medium ${alert.severity === 'critical' ? 'text-red-700' : 'text-neutral-600'
                                                            } capitalize`}>
                                                            {alert.severity}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div>
                                                        <div className="font-medium text-neutral-900">{alert.title}</div>
                                                        <div className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{alert.description}</div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5 text-neutral-700">
                                                        <Activity className="w-3.5 h-3.5 text-neutral-400" />
                                                        <span className="text-xs font-medium">{alert.infra}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-xs text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                                                        {alert.metric}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                                                    {alert.timestamp}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
                                <span className="text-xs text-neutral-500">Showing 6 of 142 alerts</span>
                                <div className="flex gap-1">
                                    <button className="px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-white hover:shadow-sm rounded transition-all disabled:opacity-50">Previous</button>
                                    <button className="px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-white hover:shadow-sm rounded transition-all">Next</button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="rules">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {MOCK_RULES.map((rule) => (
                                <div key={rule.id} className="p-4 rounded-lg border border-neutral-200 bg-white hover:border-neutral-300 transition-all group">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-2 bg-neutral-50 rounded-md group-hover:bg-neutral-100 transition-colors">
                                            <Zap className="w-4 h-4 text-neutral-600" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${rule.status === 'active' ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                                            <span className="text-xs text-neutral-500 capitalize">{rule.status}</span>
                                        </div>
                                    </div>
                                    <h3 className="font-medium text-neutral-900 mb-1">{rule.name}</h3>
                                    <p className="text-xs text-neutral-500 mb-4">Target: {rule.target}</p>
                                    <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                                        <code className="text-xs font-mono text-neutral-600 bg-neutral-50 px-1.5 py-0.5 rounded">{rule.condition}</code>
                                        <button className="text-xs font-medium text-neutral-900 hover:underline">Edit</button>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => setIsRuleModalOpen(true)}
                                className="p-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100 transition-all flex flex-col items-center justify-center gap-2 text-neutral-500 hover:text-neutral-900"
                            >
                                <Plus className="w-5 h-5" />
                                <span className="text-sm font-medium">Create New Rule</span>
                            </button>
                        </div>
                    </TabsContent>

                    <TabsContent value="channels">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="border-neutral-200 shadow-none">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Mail className="w-4 h-4" />
                                        Email Notifications
                                    </CardTitle>
                                    <CardDescription>Receive alerts directly in your inbox.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                                            <span className="text-sm font-medium">admin@sentryal.com</span>
                                        </div>
                                        <button className="text-xs font-medium text-neutral-500 hover:text-black">Edit</button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-neutral-200 shadow-none">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <SlackIcon className="w-4 h-4" />
                                        Slack Integration
                                    </CardTitle>
                                    <CardDescription>Post alerts to a dedicated Slack channel.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col items-center justify-center py-6 text-center">
                                        <div className="p-3 bg-neutral-100 rounded-full mb-3">
                                            <SlackIcon className="w-6 h-6" />
                                        </div>
                                        <p className="text-sm text-neutral-500 mb-4">Not connected yet</p>
                                        <button className="px-4 py-2 bg-[#4A154B] text-white text-sm font-medium rounded-lg hover:bg-[#3b113c] transition-colors flex items-center gap-2">
                                            Connect Slack
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </main>

            {/* --- NEW RULE MODAL --- */}
            {isRuleModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div>
                                <h2 className="text-lg font-semibold text-neutral-900">Create Detection Rule</h2>
                                <p className="text-sm text-neutral-500">Configure automated monitoring logic.</p>
                            </div>
                            <button
                                onClick={() => setIsRuleModalOpen(false)}
                                className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-8">

                            {/* Section 1: General Info */}
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-neutral-900">Rule Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Critical Bridge Displacement"
                                    className="w-full px-4 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/5 focus:border-neutral-300 transition-all placeholder:text-neutral-400"
                                    value={ruleName}
                                    onChange={(e) => setRuleName(e.target.value)}
                                />
                            </div>

                            {/* Section 2: Logic Builder (Refined) */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-neutral-900 flex items-center gap-2">
                                        <Sliders className="w-4 h-4" />
                                        Trigger Logic
                                    </label>
                                </div>

                                <div className="bg-neutral-50 rounded-xl border border-neutral-200 overflow-hidden">
                                    <div className="p-4 border-b border-neutral-200/50 grid grid-cols-[120px_1fr] gap-4 items-center">
                                        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider text-right">When</span>
                                        <select
                                            className="bg-white border border-neutral-200 rounded-md px-3 py-2 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5 w-full"
                                            value={ruleTarget}
                                            onChange={(e) => setRuleTarget(e.target.value)}
                                        >
                                            <option>All Infrastructures</option>
                                            <option>Bridges Only</option>
                                            <option>Dams Only</option>
                                            <option>Specific Tag...</option>
                                        </select>
                                    </div>
                                    <div className="p-4 border-b border-neutral-200/50 grid grid-cols-[120px_1fr] gap-4 items-center">
                                        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider text-right">If Metric</span>
                                        <div className="flex gap-2">
                                            <select
                                                className="bg-white border border-neutral-200 rounded-md px-3 py-2 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5 flex-1"
                                                value={ruleMetric}
                                                onChange={(e) => setRuleMetric(e.target.value)}
                                            >
                                                <option>Displacement</option>
                                                <option>Velocity</option>
                                                <option>Coherence</option>
                                                <option>Acceleration</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="p-4 grid grid-cols-[120px_1fr] gap-4 items-center">
                                        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider text-right">Is Greater Than</span>
                                        <div className="flex items-center gap-3">
                                            <select
                                                className="w-20 bg-white border border-neutral-200 rounded-md px-3 py-2 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5"
                                                value={ruleOperator}
                                                onChange={(e) => setRuleOperator(e.target.value)}
                                            >
                                                <option>{'>'}</option>
                                                <option>{'<'}</option>
                                                <option>{'>='}</option>
                                                <option>{'<='}</option>
                                            </select>
                                            <div className="relative flex-1">
                                                <input
                                                    type="number"
                                                    className="w-full bg-white border border-neutral-200 rounded-md pl-3 pr-8 py-2 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5"
                                                    value={ruleThreshold}
                                                    onChange={(e) => setRuleThreshold(e.target.value)}
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-medium">mm</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Severity (Segmented Control) */}
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-neutral-900">Severity Level</label>
                                <div className="relative flex bg-neutral-100 p-1 rounded-lg border border-neutral-200">
                                    <div
                                        className="absolute top-1 bottom-1 rounded-md bg-white shadow-sm border border-neutral-200 transition-all duration-300 ease-out"
                                        style={{
                                            left: ruleSeverity === 'info' ? '4px' : ruleSeverity === 'warning' ? '33.33%' : '66.66%',
                                            width: 'calc(33.33% - 4px)',
                                            transform: ruleSeverity === 'info' ? 'translateX(0)' : ruleSeverity === 'warning' ? 'translateX(2px)' : 'translateX(-2px)'
                                        }}
                                    />
                                    {['info', 'warning', 'critical'].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => setRuleSeverity(level)}
                                            className={`relative flex-1 py-1.5 text-sm font-medium capitalize transition-colors z-10 ${ruleSeverity === level ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
                                                }`}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Section 4: Notification Channels */}
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-neutral-900">Notification Channels</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors group">
                                        <div className="flex items-center justify-center w-5 h-5 rounded border border-neutral-300 bg-white group-hover:border-neutral-400 transition-colors">
                                            <input type="checkbox" className="opacity-0 absolute" defaultChecked />
                                            <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900 opacity-0 check-icon" />
                                            {/* Note: In a real app, use controlled checkbox state for the icon visibility */}
                                            <div className="w-2.5 h-2.5 bg-neutral-900 rounded-sm hidden" />
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-neutral-700 font-medium">
                                            <Mail className="w-4 h-4 text-neutral-400" />
                                            <span>Email Team</span>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors group">
                                        <div className="flex items-center justify-center w-5 h-5 rounded border border-neutral-300 bg-white group-hover:border-neutral-400 transition-colors">
                                            <input type="checkbox" className="opacity-0 absolute" />
                                            <div className="w-2.5 h-2.5 bg-neutral-900 rounded-sm hidden" />
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-neutral-700 font-medium">
                                            <SlackIcon className="w-4 h-4" />
                                            <span>Slack Channel</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setIsRuleModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setIsRuleModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm transition-all flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Create Rule
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
