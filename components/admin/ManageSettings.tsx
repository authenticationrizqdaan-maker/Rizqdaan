
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { AppSettings } from '../../types';

const ManageSettings: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings>({
        appName: 'RizqDaan',
        supportWhatsapp: '923265520658',
        supportEmail: 'support@rizqdaan.com',
        maintenanceMode: false,
        facebookUrl: '',
        instagramUrl: '',
        maintenanceMessage: 'We are performing routine maintenance. Please check back later.'
    });
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!db) return;
        const unsub = onSnapshot(doc(db, 'settings', 'system'), (snap) => {
            if (snap.exists()) {
                setSettings(snap.data() as AppSettings);
            }
            setLoading(false);
        }, (err) => {
            console.error("Settings load error:", err.message);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'system'), settings, { merge: true });
            alert("✅ System settings updated successfully!");
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-10 text-center text-gray-500">Loading configurations...</div>;
    }

    return (
        <div className="animate-fade-in max-w-4xl">
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">System Configuration</h2>
                <p className="text-gray-500">Manage global app behavior and contact information.</p>
            </header>

            <form onSubmit={handleSave} className="space-y-8">
                {/* GENERAL SECTION */}
                <section className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white">
                        <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">🏢</span>
                        General Branding
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">App Name</label>
                            <input 
                                className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                value={settings.appName} 
                                onChange={e => setSettings({...settings, appName: e.target.value})} 
                                required
                            />
                        </div>
                    </div>
                </section>

                {/* CONTACT SECTION */}
                <section className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white">
                        <span className="p-1.5 bg-green-100 text-green-600 rounded-lg">📞</span>
                        Support & Socials
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">WhatsApp Support (No spaces/plus)</label>
                            <input 
                                className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                value={settings.supportWhatsapp} 
                                onChange={e => setSettings({...settings, supportWhatsapp: e.target.value})} 
                                placeholder="923xxxxxxxxx"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">This number appears on the Help Center contact button.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Official Email</label>
                            <input 
                                className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                value={settings.supportEmail} 
                                onChange={e => setSettings({...settings, supportEmail: e.target.value})} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Facebook URL</label>
                            <input 
                                className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                value={settings.facebookUrl} 
                                onChange={e => setSettings({...settings, facebookUrl: e.target.value})} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Instagram URL</label>
                            <input 
                                className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                value={settings.instagramUrl} 
                                onChange={e => setSettings({...settings, instagramUrl: e.target.value})} 
                            />
                        </div>
                    </div>
                </section>

                {/* SYSTEM SECTION */}
                <section className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white">
                        <span className="p-1.5 bg-red-100 text-red-600 rounded-lg">🛡️</span>
                        System Controls
                    </h3>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div>
                                <h4 className="font-bold dark:text-white">Maintenance Mode</h4>
                                <p className="text-xs text-gray-500">Temporarily block access for all users except admins.</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setSettings({...settings, maintenanceMode: !settings.maintenanceMode})}
                                className={`w-14 h-8 rounded-full transition-colors relative ${settings.maintenanceMode ? 'bg-red-500' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${settings.maintenanceMode ? 'right-1' : 'left-1'}`}></div>
                            </button>
                        </div>
                        {settings.maintenanceMode && (
                            <div className="animate-fade-in">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Display Message</label>
                                <textarea 
                                    className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                    rows={3}
                                    value={settings.maintenanceMessage}
                                    onChange={e => setSettings({...settings, maintenanceMessage: e.target.value})}
                                />
                            </div>
                        )}
                    </div>
                </section>

                <div className="flex justify-end">
                    <button 
                        type="submit" 
                        disabled={saving}
                        className="px-12 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-dark transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        {saving ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span> : 'Save Global Config'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ManageSettings;
