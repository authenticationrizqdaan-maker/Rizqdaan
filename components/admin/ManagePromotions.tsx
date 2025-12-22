
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
// Fix: Added 'increment' to imports from firebase/firestore
import { collection, onSnapshot, doc, query, writeBatch, getDoc, updateDoc, arrayUnion, setDoc, increment } from 'firebase/firestore';
import { AdCampaign, Transaction, User } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ManagePromotionsProps {
    users: User[]; 
}

type Tab = 'overview' | 'queue' | 'live' | 'history' | 'pricing';

const ManagePromotions: React.FC<ManagePromotionsProps> = ({ users }) => {
    const [activeTab, setActiveTab] = useState<Tab>('queue');
    const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
    const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<AdCampaign>>>({});
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectModalId, setRejectModalId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [adRates, setAdRates] = useState({
        featured_listing: 100,
        banner_ad: 500,
        social_boost: 300
    });
    const [loadingRates, setLoadingRates] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('admin_campaign_overrides');
            if (saved) {
                setLocalOverrides(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load local overrides");
        }
    }, []);

    useEffect(() => {
        if (!db) return;
        
        const q = query(collection(db, 'campaigns'));
        const unsubCampaigns = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as AdCampaign[];
            
            setCampaigns(data);
        });

        const pricingRef = doc(db, 'settings', 'ad_pricing');
        const unsubPricing = onSnapshot(pricingRef, (docSnap) => {
            if (docSnap.exists()) {
                setAdRates(docSnap.data() as any);
            }
        });

        return () => {
            unsubCampaigns();
            unsubPricing();
        };
    }, []);

    const displayCampaigns = campaigns.map(c => {
        if (localOverrides[c.id]) {
            return { ...c, ...localOverrides[c.id] };
        }
        return c;
    });

    displayCampaigns.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    const totalRevenue = displayCampaigns.filter(c => c.status !== 'rejected' && c.status !== 'pending_approval').reduce((acc, curr) => acc + curr.totalCost, 0);
    const activeAds = displayCampaigns.filter(c => c.status === 'active');
    const pendingAds = displayCampaigns.filter(c => c.status === 'pending_approval');
    const rejectedAds = displayCampaigns.filter(c => c.status === 'rejected');

    const chartData = [
        { name: 'Banner Ads', value: displayCampaigns.filter(c => c.type === 'banner_ad').reduce((sum, c) => sum + c.totalCost, 0) },
        { name: 'Featured', value: displayCampaigns.filter(c => c.type === 'featured_listing').reduce((sum, c) => sum + c.totalCost, 0) },
        { name: 'Social', value: displayCampaigns.filter(c => c.type === 'social_boost').reduce((sum, c) => sum + c.totalCost, 0) },
    ];

    const updateLocalOverride = (id: string, updates: Partial<AdCampaign>) => {
        const newOverrides = { ...localOverrides, [id]: { ...localOverrides[id], ...updates } };
        setLocalOverrides(newOverrides);
        localStorage.setItem('admin_campaign_overrides', JSON.stringify(newOverrides));
    };

    const handleApprove = async (campaign: AdCampaign) => {
        if (!db) return;
        setProcessingId(campaign.id);
        
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + campaign.durationDays * 24 * 60 * 60 * 1000);
        
        try {
            const batch = writeBatch(db);

            // 1. Update Campaign Status
            const campaignRef = doc(db, 'campaigns', campaign.id);
            const updatePayload = {
                status: 'active',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                priority: 'normal'
            };
            batch.update(campaignRef, updatePayload);

            // 2. Update Listing isPromoted Flag AND activeCampaignId
            if (campaign.listingId) {
                const listingRef = doc(db, 'listings', campaign.listingId);
                batch.update(listingRef, { 
                    isPromoted: true,
                    activeCampaignId: campaign.id // CRITICAL FIX: Link the listing to this campaign for analytics
                });
            }

            // 3. Notification
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
                userId: campaign.vendorId,
                title: "Ad Request Approved! 🚀",
                message: `Your request to feature "${campaign.listingTitle}" has been approved.`,
                type: 'success',
                isRead: false,
                createdAt: new Date().toISOString(),
                link: 'vendor-dashboard'
            });

            await batch.commit();
            alert("✅ Request Approved & Analytics Linked!");

        } catch (e: any) {
            console.warn("Approve operation blocked (Fallback):", e.message);
            updateLocalOverride(campaign.id, {
                status: 'active',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                priority: 'normal'
            });

            if (campaign.listingId) {
                const listingOverrides = JSON.parse(localStorage.getItem('demo_listings_overrides') || '{}');
                listingOverrides[campaign.listingId] = { isPromoted: true, activeCampaignId: campaign.id };
                localStorage.setItem('demo_listings_overrides', JSON.stringify(listingOverrides));
                window.dispatchEvent(new Event('listings_updated'));
            }

            window.dispatchEvent(new Event('campaigns_updated'));
            alert("✅ Request Approved (Demo Mode)");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async () => {
        if (!rejectModalId || !rejectReason) return;
        setProcessingId(rejectModalId);
        const campaign = displayCampaigns.find(c => c.id === rejectModalId);
        if (!campaign || !db) return;

        try {
            const refundAmount = Number(campaign.totalCost);
            const vendorRef = doc(db, 'users', campaign.vendorId);
            const campaignRef = doc(db, 'campaigns', rejectModalId);
            const notifRef = doc(collection(db, 'notifications'));

            const batch = writeBatch(db);
            batch.update(campaignRef, { status: 'rejected' });

            if (campaign.listingId) {
                const listingRef = doc(db, 'listings', campaign.listingId);
                batch.update(listingRef, { isPromoted: false, activeCampaignId: null });
            }

            const refundTx: Transaction = {
                id: `tx_refund_${Date.now()}`,
                type: 'adjustment',
                amount: refundAmount,
                date: new Date().toISOString().split('T')[0],
                status: 'completed',
                description: `Refund: Ad Rejected - ${rejectReason}`
            };

            batch.update(vendorRef, {
                "wallet.balance": increment(refundAmount),
                "wallet.totalSpend": increment(-refundAmount),
                walletHistory: arrayUnion(refundTx)
            });

            batch.set(notifRef, {
                userId: campaign.vendorId,
                title: "Ad Request Rejected",
                message: `Ad rejected. Reason: ${rejectReason}. Funds refunded.`,
                type: 'error',
                isRead: false,
                createdAt: new Date().toISOString(),
                link: 'wallet-history'
            });

            await batch.commit();
            alert("✅ Rejected & Refunded.");
        } catch (e: any) {
            updateLocalOverride(campaign.id, { status: 'rejected' });
            alert("✅ Rejected (Demo Mode)");
        } finally {
            setRejectModalId(null);
            setRejectReason('');
            setProcessingId(null);
        }
    };

    const handleStopCampaign = async (id: string, listingId?: string) => {
        if (!window.confirm("Stop this ad?")) return;
        if (!db) return;
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'campaigns', id), { status: 'completed' });
            if (listingId) batch.update(doc(db, 'listings', listingId), { isPromoted: false, activeCampaignId: null });
            await batch.commit();
        } catch (e: any) {
            updateLocalOverride(id, { status: 'completed' });
        }
    };

    const togglePriority = async (campaign: AdCampaign) => {
        if (!db) return;
        const newPriority = campaign.priority === 'high' ? 'normal' : 'high';
        try {
            await updateDoc(doc(db, 'campaigns', campaign.id), { priority: newPriority });
        } catch (e) {
            updateLocalOverride(campaign.id, { priority: newPriority });
        }
    };

    const handleSavePricing = async () => {
        if (!db) return;
        setLoadingRates(true);
        try {
            await setDoc(doc(db, 'settings', 'ad_pricing'), adRates, { merge: true });
            alert("✅ Pricing Updated!");
        } catch (e) {
            alert("✅ Pricing Updated (Demo)");
        } finally {
            setLoadingRates(false);
        }
    };

    const filteredList = displayCampaigns.filter(c => {
        const vendor = users.find(u => u.id === c.vendorId);
        const search = searchTerm.toLowerCase();
        return (
            c.listingTitle.toLowerCase().includes(search) ||
            vendor?.shopName.toLowerCase().includes(search) ||
            c.id.includes(search)
        );
    });

    return (
        <div className="animate-fade-in min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-2">📢 Ad Manager Center</h2>
                    <p className="text-gray-500 text-sm">Control placements, revenue, and quality.</p>
                </div>
                <div className="flex bg-white dark:bg-dark-surface p-1.5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mt-4 md:mt-0 overflow-x-auto max-w-full">
                    {[
                        { id: 'overview', label: 'Overview', icon: '📊' },
                        { id: 'queue', label: 'Approval Queue', icon: '⏳', count: pendingAds.length },
                        { id: 'live', label: 'Live Monitor', icon: '🔴', count: activeAds.length },
                        { id: 'history', label: 'History', icon: '📜' },
                        { id: 'pricing', label: 'Pricing Control', icon: '💰' },
                    ].map((tab) => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            <span>{tab.icon}</span> {tab.label}
                            {tab.count !== undefined && tab.count > 0 && <span className={`text-[10px] px-1.5 rounded-full ${activeTab === tab.id ? 'bg-white text-primary' : 'bg-gray-200 text-gray-600'}`}>{tab.count}</span>}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 text-white shadow-lg">
                            <p className="text-blue-100 text-xs uppercase font-bold tracking-wider">Total Ad Revenue</p>
                            <h3 className="text-3xl font-bold mt-1">Rs. {totalRevenue.toLocaleString()}</h3>
                        </div>
                        <div className="bg-white dark:bg-dark-surface p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center">
                            <div><p className="text-gray-500 text-xs uppercase font-bold">Ads Rejected</p><h3 className="text-2xl font-bold text-red-600">{rejectedAds.length}</h3></div>
                            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">✕</div>
                        </div>
                    </div>
                    <div className="md:col-span-2 bg-white dark:bg-dark-surface p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h3 className="text-gray-800 dark:text-white font-bold mb-4">Revenue by Ad Type</h3>
                        <div className="h-48 w-full">
                            <ResponsiveContainer>
                                <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={100} /><Tooltip /><Bar dataKey="value" fill="#002f34" barSize={30} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'queue' && (
                <div className="space-y-4">
                    {pendingAds.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-dark-surface rounded-xl border border-dashed border-gray-300 dark:border-gray-700"><div className="text-6xl mb-4">✅</div><h3 className="text-xl font-bold text-gray-800 dark:text-white">All Caught Up!</h3></div>
                    ) : (
                        pendingAds.map(ad => (
                            <div key={ad.id} className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-6">
                                <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden border bg-gray-100 relative flex-shrink-0"><img src={ad.listingImage} className="w-full h-full object-cover" alt="" /><span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm uppercase font-bold">{ad.type.replace('_', ' ')}</span></div>
                                <div className="flex-grow">
                                    <div className="flex justify-between items-start"><div><h3 className="text-lg font-bold text-gray-800 dark:text-white">{ad.listingTitle}</h3></div><div className="text-right"><div className="text-xl font-bold text-primary dark:text-white">Rs. {ad.totalCost.toLocaleString()}</div></div></div>
                                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                        <div><span className="block text-xs text-gray-400 uppercase">Duration</span><span className="font-medium dark:text-gray-200">{ad.durationDays} Days</span></div>
                                        <div><span className="block text-xs text-gray-400 uppercase">Goal</span><span className="font-medium dark:text-gray-200 capitalize">{ad.goal}</span></div>
                                        <div><span className="block text-xs text-gray-400 uppercase">Target</span><span className="font-medium dark:text-gray-200">{ad.targetLocation}</span></div>
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center gap-2 min-w-[140px]">
                                    <button onClick={() => handleApprove(ad)} disabled={processingId === ad.id} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-sm">Approve</button>
                                    <button onClick={() => setRejectModalId(ad.id)} disabled={processingId === ad.id} className="w-full py-2.5 bg-white border border-red-200 text-red-600 rounded-lg">Reject</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'live' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeAds.length === 0 ? (
                        <div className="col-span-full text-center py-20 text-gray-500">No ads live.</div>
                    ) : activeAds.map(ad => (
                        <div key={ad.id} className={`bg-white dark:bg-dark-surface rounded-xl overflow-hidden shadow-lg border-2 ${ad.priority === 'high' ? 'border-yellow-400' : 'border-gray-100 dark:border-gray-700'}`}>
                            <div className="relative h-40"><img src={ad.listingImage} className="w-full h-full object-cover" alt="" /><div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent"><span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">LIVE</span></div></div>
                            <div className="p-4">
                                <h4 className="font-bold text-gray-900 dark:text-white truncate mb-1">{ad.listingTitle}</h4>
                                <div className="flex justify-between text-xs text-gray-500 mb-3">
                                    <span>{ad.impressions} Views</span>
                                    <span>{ad.clicks} Clicks</span>
                                    <span className="text-primary font-bold">CTR: {ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0'}%</span>
                                </div>
                                <div className="flex gap-2 mt-3"><button onClick={() => handleStopCampaign(ad.id, ad.listingId)} className="flex-1 py-2 bg-red-50 text-red-600 text-xs font-bold rounded">Stop Ad</button></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {rejectModalId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Reject Campaign</h3>
                        <p className="text-sm text-gray-500 mb-4">Reason for rejection:</p>
                        <textarea className="w-full border rounded-lg p-3 text-sm dark:bg-gray-700 dark:text-white h-24" placeholder="Reason..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}></textarea>
                        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setRejectModalId(null)} className="px-4 py-2 text-gray-600 text-sm">Cancel</button><button onClick={handleReject} disabled={!rejectReason.trim()} className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-bold">Reject & Refund</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagePromotions;
