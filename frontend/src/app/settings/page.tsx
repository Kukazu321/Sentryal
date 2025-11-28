'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useAuthContext } from '../../../context/AuthProvider';
import { supabase as importedSupabase } from '../../../lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Eye, EyeOff, RefreshCcw, Shield, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const supabase: any = importedSupabase as any;

export default function SettingsPage() {
    const { user } = useAuthContext();
    const router = useRouter();

    useEffect(() => {
        router.replace('/settings/profile');
    }, [router]);

    // Profile state
    const [fullName, setFullName] = useState('');
    const [company, setCompany] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [profileMsg, setProfileMsg] = useState<string | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

    // Security state
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [securityMsg, setSecurityMsg] = useState<string | null>(null);
    const [securityLoading, setSecurityLoading] = useState(false);

    // Preferences
    const [language, setLanguage] = useState('en');
    const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
    const [timezone, setTimezone] = useState('UTC');
    const [prefMsg, setPrefMsg] = useState<string | null>(null);

    // Notifications
    const [notifEmail, setNotifEmail] = useState(true);
    const [notifSMS, setNotifSMS] = useState(false);
    const [notifSlack, setNotifSlack] = useState(false);
    const [notifFrequency, setNotifFrequency] = useState<'immediate' | 'daily' | 'weekly'>('immediate');
    const [notifMsg, setNotifMsg] = useState<string | null>(null);

    // API Keys (client-side demo only)
    const existingKey = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('demo_api_key') || '';
    }, []);
    const [apiKey, setApiKey] = useState(existingKey);
    const [showKey, setShowKey] = useState(false);
    const [apiMsg, setApiMsg] = useState<string | null>(null);

    // Organization & Team
    const [orgName, setOrgName] = useState('');
    const [orgDomain, setOrgDomain] = useState('');
    const [orgLogo, setOrgLogo] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'Admin' | 'Editor' | 'Viewer'>('Editor');
    const [team, setTeam] = useState<Array<{ email: string; role: 'Admin' | 'Editor' | 'Viewer' }>>(() => {
        if (typeof window === 'undefined') return [];
        try { return JSON.parse(localStorage.getItem('org_team') || '[]'); } catch { return []; }
    });
    const saveOrg = () => {
        localStorage.setItem('org_name', orgName);
        localStorage.setItem('org_domain', orgDomain);
        localStorage.setItem('org_logo', orgLogo);
    };
    const addMember = () => {
        if (!inviteEmail) return;
        const next = [...team, { email: inviteEmail.trim(), role: inviteRole }];
        setTeam(next);
        localStorage.setItem('org_team', JSON.stringify(next));
        setInviteEmail('');
    };
    const updateMemberRole = (idx: number, role: 'Admin' | 'Editor' | 'Viewer') => {
        const next = team.slice();
        next[idx] = { ...next[idx], role };
        setTeam(next);
        localStorage.setItem('org_team', JSON.stringify(next));
    };
    const removeMember = (idx: number) => {
        const next = team.filter((_, i) => i !== idx);
        setTeam(next);
        localStorage.setItem('org_team', JSON.stringify(next));
    };

    // Billing & Usage
    const [plan, setPlan] = useState<'Starter' | 'Pro' | 'Enterprise'>('Starter');
    const [seatsUsed, setSeatsUsed] = useState(3);
    const [seatsLimit, setSeatsLimit] = useState(5);
    const [usagePoints, setUsagePoints] = useState(32000);
    const [usagePointsLimit, setUsagePointsLimit] = useState(100000);
    const [usageInfras, setUsageInfras] = useState(12);
    const [usageInfrasLimit, setUsageInfrasLimit] = useState(50);

    // Alerts defaults
    const [threshDisp, setThreshDisp] = useState(10);
    const [threshVel, setThreshVel] = useState(5);
    const [threshCoh, setThreshCoh] = useState(0.7);
    const [alertsEmail, setAlertsEmail] = useState(true);
    const [alertsSMS, setAlertsSMS] = useState(false);
    const saveAlertDefaults = () => {
        localStorage.setItem('alert_defaults', JSON.stringify({ threshDisp, threshVel, threshCoh, alertsEmail, alertsSMS }));
    };

    // Integrations (extended)
    const [slackWebhook, setSlackWebhook] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    const testWebhook = async () => {
        setApiMsg('Test sent (demo)');
    };

    // Map defaults
    const [basemap, setBasemap] = useState<'Google 3D' | 'Hybrid' | 'Roadmap'>('Google 3D');
    const [colorCritical, setColorCritical] = useState('#FF3333');
    const [colorHigh, setColorHigh] = useState('#FF9933');
    const [colorMedium, setColorMedium] = useState('#FFCC00');
    const [colorLow, setColorLow] = useState('#33CCFF');
    const [colorStable, setColorStable] = useState('#22C55E');
    const saveMapDefaults = () => {
        localStorage.setItem('map_defaults', JSON.stringify({ basemap, colorCritical, colorHigh, colorMedium, colorLow, colorStable }));
    };

    // Reports & scheduling
    const [weeklyReport, setWeeklyReport] = useState(true);
    const [reportDay, setReportDay] = useState<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'>('Mon');
    const [reportTime, setReportTime] = useState('08:00');
    const [reportRecipients, setReportRecipients] = useState('');
    const saveReports = () => {
        localStorage.setItem('reports_schedule', JSON.stringify({ weeklyReport, reportDay, reportTime, reportRecipients }));
    };

    // Sessions & devices (demo)
    const signOutOthers = async () => {
        setSecurityMsg('Other sessions cleared (demo)');
    };

    // Handlers
    const saveProfile = async () => {
        try {
            setProfileLoading(true);
            setProfileMsg(null);
            // Store profile fields in user metadata
            const { error } = await supabase.auth.updateUser({ data: { full_name: fullName, company, avatar_url: avatarUrl } });
            if (error) throw error;
            setProfileMsg('Profile updated successfully');
        } catch (e: any) {
            setProfileMsg(e?.message || 'Failed to update profile');
        } finally {
            setProfileLoading(false);
        }
    };

    const changePassword = async () => {
        if (newPassword.length < 8) {
            setSecurityMsg('Password must be at least 8 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setSecurityMsg('Passwords do not match');
            return;
        }
        try {
            setSecurityLoading(true);
            setSecurityMsg(null);
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            setSecurityMsg('Password updated successfully');
            setNewPassword('');
            setConfirmPassword('');
        } catch (e: any) {
            setSecurityMsg(e?.message || 'Failed to update password');
        } finally {
            setSecurityLoading(false);
        }
    };

    const savePreferences = async () => {
        try {
            setPrefMsg(null);
            // Persist in localStorage (demo). In prod, send to backend user prefs endpoint.
            localStorage.setItem('prefs_language', language);
            localStorage.setItem('prefs_units', units);
            localStorage.setItem('prefs_timezone', timezone);
            setPrefMsg('Preferences saved');
        } catch {
            setPrefMsg('Failed to save preferences');
        }
    };

    const saveNotifications = async () => {
        try {
            setNotifMsg(null);
            const payload = { notifEmail, notifSMS, notifSlack, notifFrequency };
            localStorage.setItem('prefs_notifications', JSON.stringify(payload));
            setNotifMsg('Notification settings saved');
        } catch {
            setNotifMsg('Failed to save notification settings');
        }
    };

    const copyKey = async () => {
        try {
            await navigator.clipboard.writeText(apiKey || '');
            setApiMsg('API key copied to clipboard');
        } catch {
            setApiMsg('Failed to copy');
        }
    };

    const regenerateKey = () => {
        const newKey = `sk_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
        setApiKey(newKey);
        if (typeof window !== 'undefined') localStorage.setItem('demo_api_key', newKey);
        setApiMsg('New API key generated (demo)');
    };

    const requestAccountDeletion = async () => {
        if (!confirm('Are you sure? This will sign you out and submit a deletion request.')) return;
        // In production: call backend to request deletion, then sign out.
        await supabase.auth.signOut();
        window.location.href = '/auth/login';
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <header className="pt-2">
                <h1 className="text-2xl font-semibold text-neutral-900">Settings</h1>
                <p className="text-sm text-neutral-600 mt-1">Manage your account and workspace</p>
            </header>

            {/* Navigation */}
            <Card>
                <CardHeader>
                    <CardTitle>Navigation</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <a href="#profile" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">Profile</a>
                        <a href="#security" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">Security</a>
                        <a href="#preferences" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">Preferences</a>
                        <a href="#notifications" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">Notifications</a>
                        <a href="#organization" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">Organization & Team</a>
                        <a href="#billing" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">Billing</a>
                        <a href="#usage" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">Usage</a>
                        <a href="#alerts-defaults" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">Alerts Defaults</a>
                        <a href="#integrations" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">Integrations</a>
                        <a href="#map-defaults" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">Map Defaults</a>
                        <a href="#reports" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">Reports</a>
                        <a href="#sessions" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">Sessions</a>
                        <a href="#api" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50">API</a>
                        <a href="#danger" className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-red-600">Danger Zone</a>
                    </div>
                </CardContent>
            </Card>

            {/* Profile */}
            <Card id="profile">
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Full Name</label>
                            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="John Doe" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Email</label>
                            <input value={user?.email || ''} readOnly className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-700" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Company</label>
                            <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="Acme Corp" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Avatar URL</label>
                            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="https://..." />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={saveProfile} disabled={profileLoading}>Save Changes</Button>
                        {profileMsg && <span className="text-sm text-neutral-600">{profileMsg}</span>}
                    </div>
                </CardContent>
            </Card>

            {/* Security */}
            <Card id="security">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">New Password</label>
                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="••••••••" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Confirm Password</label>
                            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="••••••••" />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={changePassword} disabled={securityLoading}>Update Password</Button>
                        </div>
                    </div>
                    <div className="text-sm text-neutral-600">2FA and device management coming soon.</div>
                    {securityMsg && <div className="text-sm text-neutral-700">{securityMsg}</div>}
                </CardContent>
            </Card>

            {/* Preferences */}
            <Card id="preferences">
                <CardHeader>
                    <CardTitle>Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Theme</label>
                            <input value="Light" readOnly className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-700" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Language</label>
                            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm">
                                <option value="en">English</option>
                                <option value="fr">Français</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Units</label>
                            <div className="flex items-center gap-3">
                                <label className="inline-flex items-center gap-2 text-sm">
                                    <input type="radio" name="units" checked={units === 'metric'} onChange={() => setUnits('metric')} /> Metric
                                </label>
                                <label className="inline-flex items-center gap-2 text-sm">
                                    <input type="radio" name="units" checked={units === 'imperial'} onChange={() => setUnits('imperial')} /> Imperial
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Timezone</label>
                            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm">
                                <option value="UTC">UTC</option>
                                <option value="Europe/Paris">Europe/Paris</option>
                                <option value="America/New_York">America/New_York</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={savePreferences}>Save Preferences</Button>
                        {prefMsg && <span className="text-sm text-neutral-600">{prefMsg}</span>}
                    </div>
                </CardContent>
            </Card>

            {/* Notifications */}
            <Card id="notifications">
                <CardHeader>
                    <CardTitle>Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                            <span>Email notifications</span>
                            <input type="checkbox" checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} />
                        </label>
                        <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                            <span>SMS notifications</span>
                            <input type="checkbox" checked={notifSMS} onChange={(e) => setNotifSMS(e.target.checked)} />
                        </label>
                        <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                            <span>Slack notifications</span>
                            <input type="checkbox" checked={notifSlack} onChange={(e) => setNotifSlack(e.target.checked)} />
                        </label>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Frequency</label>
                            <select value={notifFrequency} onChange={(e) => setNotifFrequency(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm">
                                <option value="immediate">Immediate</option>
                                <option value="daily">Daily Digest</option>
                                <option value="weekly">Weekly Digest</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={saveNotifications}>Save Notifications</Button>
                        {notifMsg && <span className="text-sm text-neutral-600">{notifMsg}</span>}
                    </div>
                </CardContent>
            </Card>

            {/* Organization & Team */}
            <Card id="organization">
                <CardHeader>
                    <CardTitle>Organization & Team</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Organization name</label>
                            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="Sentryax" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Domain</label>
                            <input value={orgDomain} onChange={(e) => setOrgDomain(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="sentryax.com" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Logo URL</label>
                            <input value={orgLogo} onChange={(e) => setOrgLogo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="https://.../logo.png" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={saveOrg}>Save Organization</Button>
                    </div>
                    <div className="pt-4 border-t border-neutral-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Invite member by email" className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" />
                            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm">
                                <option>Admin</option>
                                <option>Editor</option>
                                <option>Viewer</option>
                            </select>
                            <Button onClick={addMember}>Invite</Button>
                        </div>
                        <div className="mt-3 border rounded-xl border-neutral-200 overflow-hidden">
                            <div className="grid grid-cols-12 px-4 py-2 text-xs text-neutral-600 bg-neutral-50">
                                <div className="col-span-6">Email</div>
                                <div className="col-span-4">Role</div>
                                <div className="col-span-2 text-right">Action</div>
                            </div>
                            {team.map((m, idx) => (
                                <div key={idx} className="grid grid-cols-12 items-center px-4 py-2 border-t border-neutral-200 text-sm">
                                    <div className="col-span-6 text-neutral-900">{m.email}</div>
                                    <div className="col-span-4">
                                        <select value={m.role} onChange={(e) => updateMemberRole(idx, e.target.value as any)} className="px-2 py-1 rounded-md border border-neutral-200 bg-white text-sm">
                                            <option>Admin</option>
                                            <option>Editor</option>
                                            <option>Viewer</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <Button variant="outline" size="sm" onClick={() => removeMember(idx)}>Remove</Button>
                                    </div>
                                </div>
                            ))}
                            {team.length === 0 && (
                                <div className="px-4 py-6 text-sm text-neutral-500">No team members yet.</div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Billing & Subscription */}
            <Card id="billing">
                <CardHeader>
                    <CardTitle>Billing & Subscription</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Plan</label>
                            <select value={plan} onChange={(e) => setPlan(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm">
                                <option>Starter</option>
                                <option>Pro</option>
                                <option>Enterprise</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Seats</label>
                            <div className="text-sm text-neutral-700">{seatsUsed} / {seatsLimit}</div>
                            <div className="h-2 w-full rounded bg-neutral-100 mt-1">
                                <div className="h-2 rounded bg-black" style={{ width: `${Math.min(100, (seatsUsed / seatsLimit) * 100)}%` }} />
                            </div>
                        </div>
                        <div className="flex items-end">
                            <Button>Upgrade</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Usage & Quotas */}
            <Card id="usage">
                <CardHeader>
                    <CardTitle>Usage & Quotas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <div className="flex items-center justify-between text-sm"><span className="text-neutral-600">Monitoring points</span><span className="text-neutral-900 font-medium">{usagePoints} / {usagePointsLimit}</span></div>
                            <div className="h-2 w-full rounded bg-neutral-100 mt-1">
                                <div className="h-2 rounded bg-black" style={{ width: `${Math.min(100, (usagePoints / usagePointsLimit) * 100)}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between text-sm"><span className="text-neutral-600">Infrastructures</span><span className="text-neutral-900 font-medium">{usageInfras} / {usageInfrasLimit}</span></div>
                            <div className="h-2 w-full rounded bg-neutral-100 mt-1">
                                <div className="h-2 rounded bg-black" style={{ width: `${Math.min(100, (usageInfras / usageInfrasLimit) * 100)}%` }} />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Alerts Defaults */}
            <Card id="alerts-defaults">
                <CardHeader>
                    <CardTitle>Alerts Defaults</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Disp. threshold (mm)</label>
                            <input type="number" value={threshDisp} onChange={(e) => setThreshDisp(parseFloat(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Velocity (mm/yr)</label>
                            <input type="number" value={threshVel} onChange={(e) => setThreshVel(parseFloat(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Coherence ≥</label>
                            <input type="number" step="0.01" value={threshCoh} onChange={(e) => setThreshCoh(parseFloat(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" />
                        </div>
                        <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                            <span>Email</span>
                            <input type="checkbox" checked={alertsEmail} onChange={(e) => setAlertsEmail(e.target.checked)} />
                        </label>
                        <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                            <span>SMS</span>
                            <input type="checkbox" checked={alertsSMS} onChange={(e) => setAlertsSMS(e.target.checked)} />
                        </label>
                    </div>
                    <Button onClick={saveAlertDefaults}>Save Defaults</Button>
                </CardContent>
            </Card>

            {/* Integrations (extended) */}
            <Card id="integrations">
                <CardHeader>
                    <CardTitle>Integrations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Slack Webhook URL</label>
                            <input value={slackWebhook} onChange={(e) => setSlackWebhook(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="https://hooks.slack.com/services/..." />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Webhook URL</label>
                            <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="https://api.yourdomain.com/webhooks/sentryax" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Webhook Secret</label>
                            <input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="whsec_..." />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={testWebhook}>Test</Button>
                        {apiMsg && <span className="text-sm text-neutral-600">{apiMsg}</span>}
                    </div>
                </CardContent>
            </Card>

            {/* Map Defaults */}
            <Card id="map-defaults">
                <CardHeader>
                    <CardTitle>Map Defaults</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Basemap</label>
                            <select value={basemap} onChange={(e) => setBasemap(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm">
                                <option>Google 3D</option>
                                <option>Hybrid</option>
                                <option>Roadmap</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Critical</label>
                            <input type="color" value={colorCritical} onChange={(e) => setColorCritical(e.target.value)} className="w-full h-10 rounded-md border border-neutral-200" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">High</label>
                            <input type="color" value={colorHigh} onChange={(e) => setColorHigh(e.target.value)} className="w-full h-10 rounded-md border border-neutral-200" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Medium</label>
                            <input type="color" value={colorMedium} onChange={(e) => setColorMedium(e.target.value)} className="w-full h-10 rounded-md border border-neutral-200" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Low</label>
                            <input type="color" value={colorLow} onChange={(e) => setColorLow(e.target.value)} className="w-full h-10 rounded-md border border-neutral-200" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Stable</label>
                            <input type="color" value={colorStable} onChange={(e) => setColorStable(e.target.value)} className="w-full h-10 rounded-md border border-neutral-200" />
                        </div>
                    </div>
                    <Button onClick={saveMapDefaults}>Save Map Defaults</Button>
                </CardContent>
            </Card>

            {/* Reports & Scheduling */}
            <Card id="reports">
                <CardHeader>
                    <CardTitle>Reports & Scheduling</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <label className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-white text-sm">
                            <span>Weekly summary</span>
                            <input type="checkbox" checked={weeklyReport} onChange={(e) => setWeeklyReport(e.target.checked)} />
                        </label>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Day</label>
                            <select value={reportDay} onChange={(e) => setReportDay(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm">
                                <option>Mon</option>
                                <option>Tue</option>
                                <option>Wed</option>
                                <option>Thu</option>
                                <option>Fri</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Time</label>
                            <input type="time" value={reportTime} onChange={(e) => setReportTime(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Recipients (comma separated)</label>
                            <input value={reportRecipients} onChange={(e) => setReportRecipients(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm" placeholder="ops@sentryax.com, ceo@sentryax.com" />
                        </div>
                    </div>
                    <Button onClick={saveReports}>Save Schedule</Button>
                </CardContent>
            </Card>

            {/* API & Integrations (Demo) */}
            <Card id="api">
                <CardHeader>
                    <CardTitle>API & Integrations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">API Key</label>
                            <div className="flex items-center gap-2">
                                <input
                                    value={showKey ? apiKey : (apiKey ? mask(apiKey) : '')}
                                    readOnly
                                    placeholder="Generate an API key"
                                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm"
                                />
                                <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)} title={showKey ? 'Hide' : 'Show'}>
                                    {showKey ? <EyeOff /> : <Eye />}
                                </Button>
                                <Button variant="outline" size="icon" onClick={copyKey} title="Copy"><Copy /></Button>
                                <Button variant="outline" size="icon" onClick={regenerateKey} title="Regenerate"><RefreshCcw /></Button>
                            </div>
                            <p className="text-xs text-neutral-500 mt-2">Store securely. This demo stores in localStorage; wire to backend for production.</p>
                        </div>
                    </div>
                    {apiMsg && <div className="text-sm text-neutral-700">{apiMsg}</div>}
                </CardContent>
            </Card>

            {/* Sessions & Devices */}
            <Card id="sessions">
                <CardHeader>
                    <CardTitle>Sessions & Devices</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg border border-neutral-200 overflow-hidden">
                        <div className="grid grid-cols-12 px-4 py-2 text-xs text-neutral-600 bg-neutral-50">
                            <div className="col-span-6">Device</div>
                            <div className="col-span-4">Location</div>
                            <div className="col-span-2 text-right">Active</div>
                        </div>
                        <div className="grid grid-cols-12 px-4 py-2 text-sm border-t border-neutral-200">
                            <div className="col-span-6">This browser</div>
                            <div className="col-span-4">Unknown</div>
                            <div className="col-span-2 text-right">Yes</div>
                        </div>
                    </div>
                    <Button variant="outline" onClick={signOutOthers}>Sign out other sessions</Button>
                    {securityMsg && <div className="text-sm text-neutral-700">{securityMsg}</div>}
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card id="danger">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-4 w-4" /> Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-red-800">Delete account</p>
                                <p className="text-xs text-red-700">Permanently delete your account and all associated data.</p>
                            </div>
                            <Button variant="destructive" onClick={requestAccountDeletion}>Delete</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function mask(input: string) {
    if (!input) return '';
    if (input.length <= 8) return '*'.repeat(input.length);
    return `${input.slice(0, 4)}********${input.slice(-4)}`;
}
