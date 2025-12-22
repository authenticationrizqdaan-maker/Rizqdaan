
import React, { useState, useEffect } from 'react';
import { User, Listing, AdCampaign, Transaction } from '../../types';
import { db } from '../../firebaseConfig';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, arrayUnion, writeBatch, increment } from 'firebase/firestore';
import { PAKISTAN_LOCATIONS } from '../../constants';

interface VendorPromotionsProps {
  user: User | null;
  initialListingId?: string;
  onNavigate?: (view: 'add-balance') => void;
}

const VendorPromotions: React.FC<VendorPromotionsProps> = ({ user, initialListingId, onNavigate }) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'create' | 'history'>('dashboard');
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [adRates, setAdRates] = useState({
      featured_listing: 100,
      banner_ad: 500,
      social_boost: 300
  });

  useEffect(() => {
      if (initialListingId) setActiveView('create');
  }, [initialListingId]);

  useEffect(() => {
      if (!user || !db) return;

      const qListings = query(collection(db, 'listings'), where('vendorId', '==', user.id));
      const unsubListings = onSnapshot(qListings, (snap) => {
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Listing));
          setListings(data.filter(l => l.status === 'active'));
      });

      const qCampaigns = query(collection(db, 'campaigns'), where('vendorId', '==', user.id));
      const unsubCampaigns = onSnapshot(qCampaigns, (snap) => {
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as AdCampaign));
          setCampaigns(data);
          setLoading(false);
      });

      return () => {
          unsubListings();
          unsubCampaigns();
      };
  }, [user]);

  return (
    <div className="animate-fade-in min-h-[600px]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">🚀 Ads Manager</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Track your featured listings performance.</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <button onClick={() => setActiveView('dashboard')} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeView === 'dashboard' ? 'bg-gray-100 dark:bg-gray-700 dark:text-white shadow-sm' : 'text-gray-500'}`}>Dashboard</button>
            <button onClick={() => setActiveView('create')} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeView === 'create' ? 'bg-primary text-white shadow-md' : 'text-gray-500'}`}>+ New Ad</button>
            <button onClick={() => setActiveView('history')} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeView === 'history' ? 'bg-gray-100 dark:bg-gray-700 dark:text-white shadow-sm' : 'text-gray-500'}`}>History</button>
        </div>
      </div>

      {activeView === 'dashboard' && <DashboardView campaigns={campaigns} user={user} onCreateClick={() => setActiveView('create')} onAddFundsClick={() => onNavigate && onNavigate('add-balance')} />}
      {activeView === 'create' && <CreateCampaignWizard user={user} listings={listings} adRates={adRates} onCancel={() => setActiveView('dashboard')} onSuccess={() => setActiveView('dashboard')} initialListingId={initialListingId} />}
      {activeView === 'history' && <HistoryView campaigns={campaigns} />}
    </div>
  );
};

const DashboardView = ({ campaigns, user, onCreateClick, onAddFundsClick }: { campaigns: AdCampaign[], user: User | null, onCreateClick: () => void, onAddFundsClick: () => void }) => {
    const activeCampaigns = campaigns.filter(c => ['active', 'pending_approval', 'paused'].includes(c.status));
    const totalSpent = campaigns.reduce((acc, curr) => acc + (curr.totalCost || 0), 0);
    const totalImpressions = campaigns.reduce((acc, curr) => acc + (curr.impressions || 0), 0);
    const totalClicks = campaigns.reduce((acc, curr) => acc + (curr.clicks || 0), 0);
    const totalConversions = campaigns.reduce((acc, curr) => acc + (curr.conversions || 0), 0);
    const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

    const handleTogglePause = async (campaign: AdCampaign) => {
        if (!db) return;
        const newStatus = campaign.status === 'active' ? 'paused' : 'active';
        const batch = writeBatch(db);
        batch.update(doc(db, 'campaigns', campaign.id), { status: newStatus });
        if (campaign.listingId) batch.update(doc(db, 'listings', campaign.listingId), { isPromoted: newStatus === 'active' });
        await batch.commit();
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl text-white shadow-lg md:col-span-1">
                    <div className="text-xs opacity-70 uppercase mb-1">Balance</div>
                    <div className="text-2xl font-bold">Rs. {(user?.wallet?.balance || 0).toLocaleString()}</div>
                    <button onClick={onAddFundsClick} className="mt-3 text-xs bg-white/10 px-3 py-1.5 rounded border border-white/20 w-full">+ Add Funds</button>
                </div>
                <div className="p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">Spent</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-white">Rs. {totalSpent.toLocaleString()}</div>
                </div>
                <div className="p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">Views</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-white">{totalImpressions.toLocaleString()}</div>
                </div>
                <div className="p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">CTR</div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-white">{avgCTR}%</div>
                </div>
                <div className="p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">Calls/WA</div>
                    <div className="text-2xl font-bold text-green-600">{totalConversions.toLocaleString()}</div>
                </div>
            </div>

            <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Ad Performance</h3>
                </div>
                {activeCampaigns.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">No active promotions.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800"><tr className="text-left text-xs font-bold text-gray-500 uppercase"><th className="px-6 py-3">Ad</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Metrics</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {activeCampaigns.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                        <td className="px-6 py-4"><div className="flex items-center gap-3"><img src={c.listingImage} className="w-10 h-10 rounded object-cover" /><div className="font-bold text-gray-900 dark:text-white text-sm truncate max-w-[150px]">{c.listingTitle}</div></div></td>
                                        <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.status}</span></td>
                                        <td className="px-6 py-4 text-xs">
                                            <div className="space-x-4 flex">
                                                <span>Views: <b>{c.impressions}</b></span>
                                                <span>Clicks: <b>{c.clicks}</b></span>
                                                <span className="text-primary font-bold">CTR: {c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) : 0}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => handleTogglePause(c)} className="p-2 text-gray-500 hover:text-primary"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d={c.status === 'active' ? "M6 4h4v16H6V4zm8 0h4v16h-4V4z" : "M8 5v14l11-7z"}/></svg></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

const CreateCampaignWizard = ({ user, listings, adRates, onCancel, onSuccess, initialListingId }: { user: User | null, listings: Listing[], adRates: any, onCancel: () => void, onSuccess: () => void, initialListingId?: string }) => {
    const [step, setStep] = useState(initialListingId ? 2 : 1); 
    const [selectedListingId, setSelectedListingId] = useState<string>(initialListingId || '');
    const [campaignType, setCampaignType] = useState<'featured_listing' | 'banner_ad' | 'social_boost'>('featured_listing');
    const [goal, setGoal] = useState<'traffic' | 'calls' | 'awareness'>('traffic');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [duration, setDuration] = useState(7);
    const [locationType, setLocationType] = useState<'broad' | 'specific'>('broad');
    const [selectedProv, setSelectedProv] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)); 
        setDuration(diffDays > 0 ? diffDays : 1);
    }, [startDate, endDate]);

    const selectedListing = listings.find(l => l.id === selectedListingId);
    const totalCost = duration * (adRates[campaignType] || 100);
    const canAfford = (user?.wallet?.balance || 0) >= totalCost;

    const handleSubmit = async () => {
        if (!user || !selectedListing || !db) return;
        setProcessing(true);
        try {
            const campaignData = {
                vendorId: user.id,
                listingId: selectedListing.id,
                listingTitle: selectedListing.title,
                listingImage: selectedListing.imageUrl,
                type: campaignType,
                goal,
                status: 'pending_approval',
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                durationDays: duration,
                totalCost,
                targetLocation: locationType === 'broad' ? 'All Pakistan' : `${selectedCity}, ${selectedProv}`,
                impressions: 0,
                clicks: 0,
                ctr: 0,
                cpc: 0,
                conversions: 0
            };

            const docRef = await addDoc(collection(db, 'campaigns'), campaignData);
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, {
                "wallet.balance": increment(-totalCost),
                "wallet.totalSpend": increment(totalCost),
                walletHistory: arrayUnion({
                    id: `tx_ad_${Date.now()}`,
                    type: 'promotion',
                    amount: totalCost,
                    date: new Date().toISOString().split('T')[0],
                    status: 'completed',
                    description: `Ad Credit: ${campaignType}`
                })
            });
            alert("✅ Submitted for Approval!");
            onSuccess();
        } catch (e) { alert("Failed to create campaign."); }
        finally { setProcessing(false); }
    };

    return (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row min-h-[400px]">
            <div className="w-full md:w-1/3 bg-gray-50 dark:bg-gray-800 p-6 border-r dark:border-gray-700"><h3 className="font-bold mb-6">Create Promotion</h3><div className="space-y-4">{[1,2,3,4].map(s => <div key={s} className={`flex items-center gap-3 ${step === s ? 'text-primary font-bold' : 'text-gray-400'}`}><span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${step === s ? 'border-primary bg-primary text-white' : 'border-gray-300'}`}>{s}</span> Step {s}</div>)}</div></div>
            <div className="w-full md:w-2/3 p-8 flex flex-col">
                {step === 1 && <div className="space-y-4"><div><label className="text-sm font-bold block mb-2">Campaign Goal</label><div className="flex gap-2">{['traffic', 'calls'].map(g => <button key={g} onClick={() => setGoal(g as any)} className={`px-4 py-2 border rounded-lg capitalize ${goal === g ? 'bg-primary text-white' : ''}`}>{g}</button>)}</div></div></div>}
                {step === 2 && <div className="grid grid-cols-2 gap-3">{listings.map(l => <div key={l.id} onClick={() => setSelectedListingId(l.id)} className={`p-2 border rounded-xl cursor-pointer ${selectedListingId === l.id ? 'border-primary ring-1 ring-primary' : ''}`}><img src={l.imageUrl} className="h-20 w-full object-cover rounded-lg" /><p className="text-xs font-bold mt-2 truncate">{l.title}</p></div>)}</div>}
                {step === 3 && <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div><label className="text-xs">Start</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded" /></div><div><label className="text-xs">End</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded" /></div></div><div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg flex justify-between"><span>Budget:</span><b>Rs. {totalCost}</b></div></div>}
                {step === 4 && <div className="text-center py-10"><h4 className="font-bold text-lg">Ready to Launch?</h4><p className="text-sm text-gray-500 mt-2">Rs. {totalCost} will be deducted from your wallet.</p></div>}
                <div className="flex justify-between mt-auto pt-6"><button onClick={step > 1 ? () => setStep(step - 1) : onCancel} className="text-gray-500">Back</button><button onClick={step < 4 ? () => setStep(step + 1) : handleSubmit} disabled={processing || (step === 4 && !canAfford)} className="px-8 py-2 bg-primary text-white rounded-lg font-bold">{step === 4 ? 'Launch' : 'Next'}</button></div>
            </div>
        </div>
    );
};

const HistoryView = ({ campaigns }: { campaigns: AdCampaign[] }) => {
    const past = campaigns.filter(c => ['completed', 'rejected'].includes(c.status));
    return (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full text-left text-sm whitespace-nowrap"><thead className="bg-gray-50 dark:bg-gray-800 text-xs font-bold uppercase"><th className="px-6 py-3">Campaign</th><th className="px-6 py-3">Result</th><th className="px-6 py-3">Spent</th></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{past.map(c => <tr key={c.id} className="opacity-70"><td className="px-6 py-4">{c.listingTitle}</td><td className="px-6 py-4">{c.clicks} clicks / {c.impressions} views</td><td className="px-6 py-4 font-bold">Rs. {c.totalCost}</td></tr>)}</tbody>
            </table>
        </div>
    );
};

export default VendorPromotions;
