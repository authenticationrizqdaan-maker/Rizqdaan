
import React, { useState, useEffect } from 'react';
import { User, Listing, AdCampaign, Transaction } from '../../types';
import { db } from '../../firebaseConfig';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import { PAKISTAN_LOCATIONS } from '../../constants';

interface VendorPromotionsProps {
  user: User | null;
  initialListingId?: string;
  onNavigate?: (view: 'add-balance') => void;
}

/**
 * Prevents circular reference errors in stringify
 */
const safeStringify = (obj: any): string => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) return;
            if (value.constructor.name === 'DocumentReference' || value.constructor.name === 'Query' || value.constructor.name === 'Firestore') return "[FirestoreObject]";
            cache.add(value);
        }
        return value;
    });
};

const VendorPromotions: React.FC<VendorPromotionsProps> = ({ user, initialListingId, onNavigate }) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'create' | 'history'>('dashboard');
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<AdCampaign>>>({});
  const [adRates, setAdRates] = useState({ featured_listing: 100, banner_ad: 500, social_boost: 300 });

  useEffect(() => {
      if (initialListingId) setActiveView('create');
  }, [initialListingId]);

  useEffect(() => {
      if (!user) return;
      if (!db) { setLoading(false); return; }

      const qListings = query(collection(db, 'listings'), where('vendorId', '==', user.id));
      const unsubListings = onSnapshot(qListings, (snap) => {
          setListings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Listing)).filter(l => l.status === 'active'));
      });

      const qCampaigns = query(collection(db, 'campaigns'), where('vendorId', '==', user.id));
      const unsubCampaigns = onSnapshot(qCampaigns, (snap) => {
          setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdCampaign)));
          setLoading(false);
      });

      const loadLocalData = () => {
          const lr = localStorage.getItem('ad_pricing');
          if (lr) try { setAdRates(JSON.parse(lr)); } catch(e){}
          const so = localStorage.getItem('admin_campaign_overrides');
          if (so) try { setLocalOverrides(JSON.parse(so)); } catch(e){}
      };
      loadLocalData();
      window.addEventListener('campaigns_updated', loadLocalData);
      window.addEventListener('ad_pricing_updated', loadLocalData);
      return () => { unsubListings(); unsubCampaigns(); window.removeEventListener('campaigns_updated', loadLocalData); window.removeEventListener('ad_pricing_updated', loadLocalData); };
  }, [user]);

  const displayCampaigns = campaigns.map(c => localOverrides[c.id] ? { ...c, ...localOverrides[c.id] } : c);

  return (
    <div className="animate-fade-in min-h-[600px]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div><h2 className="text-2xl font-bold text-gray-800 dark:text-white">🚀 Ads Manager</h2><p className="text-sm text-gray-500">Create and track promotions.</p></div>
        <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-xl border shadow-sm">
            <button onClick={() => setActiveView('dashboard')} className={`px-4 py-2 text-sm rounded-lg transition-all ${activeView === 'dashboard' ? 'bg-gray-100' : ''}`}>Dashboard</button>
            <button onClick={() => setActiveView('create')} className={`px-4 py-2 text-sm rounded-lg transition-all ${activeView === 'create' ? 'bg-primary text-white shadow-md' : ''}`}>+ Create</button>
            <button onClick={() => setActiveView('history')} className={`px-4 py-2 text-sm rounded-lg transition-all ${activeView === 'history' ? 'bg-gray-100' : ''}`}>History</button>
        </div>
      </div>
      {activeView === 'dashboard' && <DashboardView campaigns={displayCampaigns} user={user} onCreateClick={() => setActiveView('create')} onAddFundsClick={() => onNavigate && onNavigate('add-balance')} />}
      {activeView === 'create' && <CreateCampaignWizard user={user} listings={listings} adRates={adRates} onCancel={() => setActiveView('dashboard')} onSuccess={() => setActiveView('dashboard')} initialListingId={initialListingId} />}
      {activeView === 'history' && <HistoryView campaigns={displayCampaigns} />}
    </div>
  );
};

const DashboardView = ({ campaigns, user, onCreateClick, onAddFundsClick }: { campaigns: AdCampaign[], user: User | null, onCreateClick: () => void, onAddFundsClick: () => void }) => {
    const activeCampaigns = campaigns.filter(c => ['active', 'pending_approval', 'paused'].includes(c.status));
    const handleTogglePause = async (campaign: AdCampaign) => {
        const newStatus = campaign.status === 'active' ? 'paused' : 'active';
        const overrides = JSON.parse(localStorage.getItem('admin_campaign_overrides') || '{}');
        overrides[campaign.id] = { status: newStatus };
        localStorage.setItem('admin_campaign_overrides', safeStringify(overrides));
        if (campaign.listingId) {
            const listOverrides = JSON.parse(localStorage.getItem('demo_listings_overrides') || '{}');
            listOverrides[campaign.listingId] = { isPromoted: newStatus === 'active' };
            localStorage.setItem('demo_listings_overrides', safeStringify(listOverrides));
        }
        window.dispatchEvent(new Event('campaigns_updated'));
        window.dispatchEvent(new Event('listings_updated'));
    };
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 bg-gray-900 rounded-xl text-white shadow-lg">
                    <div className="text-xs opacity-70">Balance</div><div className="text-2xl font-bold">Rs. {(user?.wallet?.balance || 0).toLocaleString()}</div>
                    <button onClick={onAddFundsClick} className="mt-3 text-xs bg-white/10 px-3 py-1 rounded w-full">+ Funds</button>
                </div>
            </div>
            <div className="bg-white dark:bg-dark-surface rounded-xl border shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b font-bold">Active Campaigns</div>
                {activeCampaigns.length === 0 ? <div className="p-10 text-center"><p className="text-gray-500">No active ads.</p></div> : (
                    <div className="overflow-x-auto"><table className="min-w-full divide-y">
                        <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-bold uppercase">Ad</th><th className="px-6 py-3 text-left text-xs font-bold uppercase">Status</th><th className="px-6 py-3 text-right text-xs font-bold uppercase">Action</th></tr></thead>
                        <tbody className="divide-y">{activeCampaigns.map(c => (
                            <tr key={c.id}>
                                <td className="px-6 py-4 flex items-center gap-2"><img src={c.listingImage} className="w-8 h-8 rounded object-cover" /> <div><div className="text-sm font-bold">{c.listingTitle}</div></div></td>
                                <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100'}`}>{c.status}</span></td>
                                <td className="px-6 py-4 text-right"><button onClick={() => handleTogglePause(c)} className="text-xs p-1 px-2 border rounded">{c.status === 'active' ? 'Pause' : 'Resume'}</button></td>
                            </tr>
                        ))}</tbody>
                    </table></div>
                )}
            </div>
        </div>
    );
};

const CreateCampaignWizard = ({ user, listings, adRates, onCancel, onSuccess, initialListingId }: { user: User | null, listings: Listing[], adRates: any, onCancel: () => void, onSuccess: () => void, initialListingId?: string }) => {
    const [step, setStep] = useState(1);
    const [selectedListingId, setSelectedListingId] = useState(initialListingId || '');
    const [campaignType, setCampaignType] = useState<'featured_listing' | 'banner_ad' | 'social_boost'>('featured_listing');
    const [duration, setDuration] = useState(7);
    const [processing, setProcessing] = useState(false);

    const totalCost = duration * (adRates[campaignType] || 100);
    const canAfford = (user?.wallet?.balance || 0) >= totalCost;

    const handleSubmit = async () => {
        if (!user || !canAfford || !db) return;
        setProcessing(true);
        const listing = listings.find(l => l.id === selectedListingId);
        try {
            const campData = { vendorId: user.id, listingId: selectedListingId, listingTitle: listing?.title, listingImage: listing?.imageUrl, type: campaignType, goal: 'traffic', status: 'pending_approval', startDate: new Date().toISOString(), endDate: new Date(Date.now() + duration * 86400000).toISOString(), durationDays: duration, totalCost, targetLocation: 'All Pakistan', impressions: 0, clicks: 0, ctr: 0, cpc: 0 };
            await addDoc(collection(db, 'campaigns'), campData);
            const tx: Transaction = { id: `tx_ad_${Date.now()}`, type: 'promotion', amount: totalCost, date: new Date().toISOString().split('T')[0], status: 'completed', description: `Promo: ${campaignType}` };
            await updateDoc(doc(db, 'users', user.id), { "wallet.balance": (user.wallet?.balance || 0) - totalCost, "wallet.totalSpend": (user.wallet?.totalSpend || 0) + totalCost, walletHistory: arrayUnion(tx) });
            alert("✅ Campaign created!");
            onSuccess();
        } catch (e: any) {
            console.warn("Using local storage fallback for demo");
            const dw = JSON.parse(localStorage.getItem('demo_user_wallets') || '{}');
            dw[user.id] = { balance: (user.wallet?.balance || 0) - totalCost, totalSpend: (user.wallet?.totalSpend || 0) + totalCost, lastUpdated: Date.now() };
            localStorage.setItem('demo_user_wallets', safeStringify(dw));
            window.dispatchEvent(new Event('wallet_updated'));
            onSuccess();
        } finally { setProcessing(false); }
    };

    return (
        <div className="bg-white dark:bg-dark-surface p-8 rounded-xl shadow-lg border">
            {step === 1 && <div className="space-y-4">
                <h3 className="font-bold text-lg">Step 1: Choose Type</h3>
                <div className="grid grid-cols-1 gap-3">
                    {['featured_listing', 'banner_ad', 'social_boost'].map(t => (
                        <button key={t} onClick={() => setCampaignType(t as any)} className={`p-4 rounded-lg border-2 text-left ${campaignType === t ? 'border-primary bg-primary/5' : ''}`}>
                            <div className="font-bold capitalize">{t.replace('_', ' ')}</div><div className="text-xs">Rs. {adRates[t]}/day</div>
                        </button>
                    ))}
                </div>
                <button onClick={() => setStep(2)} className="w-full py-3 bg-primary text-white rounded-lg font-bold">Next</button>
            </div>}
            {step === 2 && <div className="space-y-4">
                <h3 className="font-bold text-lg">Step 2: Select Ad Content</h3>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                    {listings.map(l => (
                        <button key={l.id} onClick={() => setSelectedListingId(l.id)} className={`flex p-2 border rounded-lg items-center gap-3 ${selectedListingId === l.id ? 'border-primary bg-primary/5' : ''}`}>
                            <img src={l.imageUrl} className="w-10 h-10 object-cover rounded" /><span className="text-sm font-medium">{l.title}</span>
                        </button>
                    ))}
                </div>
                <div className="flex gap-2"><button onClick={() => setStep(1)} className="flex-1 py-3 bg-gray-100 rounded-lg">Back</button><button onClick={() => setStep(3)} disabled={!selectedListingId} className="flex-1 py-3 bg-primary text-white rounded-lg">Next</button></div>
            </div>}
            {step === 3 && <div className="space-y-6">
                <h3 className="font-bold text-lg">Step 3: Review & Launch</h3>
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex justify-between"><span>Duration:</span> <span>{duration} Days</span></div>
                    <div className="flex justify-between font-bold border-t pt-2"><span>Total Cost:</span> <span className="text-primary">Rs. {totalCost}</span></div>
                </div>
                {!canAfford && <p className="text-red-500 text-xs text-center">Insufficient balance.</p>}
                <div className="flex gap-2"><button onClick={() => setStep(2)} className="flex-1 py-3 bg-gray-100 rounded-lg">Back</button><button onClick={handleSubmit} disabled={!canAfford || processing} className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold">Pay & Launch</button></div>
            </div>}
        </div>
    );
};

const HistoryView = ({ campaigns }: { campaigns: AdCampaign[] }) => (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="min-w-full text-sm text-left"><thead className="bg-gray-50 font-bold"><tr><th className="px-6 py-3">Ad</th><th className="px-6 py-3">Status</th><th className="px-6 py-3 text-right">Cost</th></tr></thead><tbody className="divide-y">
            {campaigns.filter(c => ['completed', 'rejected', 'paused'].includes(c.status)).map(c => (
                <tr key={c.id} className="opacity-70"><td className="px-6 py-4">{c.listingTitle}</td><td className="px-6 py-4"><span className="text-xs px-2 py-0.5 rounded bg-gray-100">{c.status}</span></td><td className="px-6 py-4 text-right">Rs. {c.totalCost}</td></tr>
            ))}
        </tbody></table>
    </div>
);

export default VendorPromotions;
