
import React, { useState, useEffect, useMemo } from 'react';
import { User, Listing } from '../../types';
import { db } from '../../firebaseConfig';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, collection, query, where } from 'firebase/firestore';
import ListingCard from '../common/ListingCard';

interface VendorProfilePageProps {
  vendorId: string;
  currentUser: User | null;
  listings: Listing[];
  onNavigate: (view: string, payload?: any) => void;
}

const VendorProfilePage: React.FC<VendorProfilePageProps> = ({ vendorId, currentUser, onNavigate }) => {
  const [vendor, setVendor] = useState<User | null>(null);
  const [vendorListings, setVendorListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'listings' | 'about'>('listings');
  const [followLoading, setFollowLoading] = useState(false);

  // --- FIX: Reliable Listing Fetching ---
  useEffect(() => {
    if (!vendorId || !db) return;

    // We query by vendorId only to avoid needing complex composite indices in Firestore
    const q = query(
        collection(db, 'listings'), 
        where('vendorId', '==', vendorId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
        // Filter for active items only (or items without a status field yet)
        const activeItems = items.filter(item => !item.status || item.status === 'active');
        
        // Sort by date newest first
        activeItems.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        
        setVendorListings(activeItems);
        setLoading(false);
    }, (err) => {
        console.error("Profile listings error:", err.message);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [vendorId]);

  const averageRating = useMemo(() => {
    const rated = vendorListings.filter(l => l.rating > 0);
    if (rated.length === 0) return 0;
    return rated.reduce((acc, curr) => acc + curr.rating, 0) / rated.length;
  }, [vendorListings]);

  useEffect(() => {
    if (!vendorId || !db) return;
    
    const docRef = doc(db, 'users', vendorId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            setVendor({ id: docSnap.id, ...docSnap.data() } as User);
        } else {
            setVendor(null);
        }
    });

    return () => unsubscribe();
  }, [vendorId]);

  const isFollowing = useMemo(() => {
      if (!currentUser || !vendor || !vendor.followers) return false;
      return vendor.followers.includes(currentUser.id);
  }, [currentUser, vendor]);

  const handleFollowToggle = async () => {
    if (!currentUser) { alert("Please login to follow vendors."); return; }
    if (!db || !vendor) return;

    setFollowLoading(true);
    const vendorRef = doc(db, 'users', vendor.id);
    try {
      if (isFollowing) await updateDoc(vendorRef, { followers: arrayRemove(currentUser.id) });
      else await updateDoc(vendorRef, { followers: arrayUnion(currentUser.id) });
    } catch (e) {} finally { setFollowLoading(false); }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="p-20 text-center">
          <h3 className="text-xl font-bold dark:text-white">Profile Not Found</h3>
          <button onClick={() => onNavigate('home')} className="mt-4 text-primary font-bold">Return Home</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in -mx-4 sm:mx-0 pb-20">
      <div className="bg-white dark:bg-dark-surface shadow-sm mb-4">
        <div className="h-44 md:h-60 w-full bg-gray-200 dark:bg-gray-800 relative">
          {vendor.coverPictureUrl ? (
            <img src={vendor.coverPictureUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary opacity-90"></div>
          )}
          <button onClick={() => onNavigate('home')} className="absolute top-4 left-4 p-2 bg-black/30 rounded-full text-white backdrop-blur-md">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>

        <div className="px-4 relative pb-6">
            <div className="flex flex-col items-start -mt-16 mb-4 relative z-20">
                <div className="h-32 w-32 rounded-full border-4 border-white dark:border-dark-surface bg-white shadow-xl overflow-hidden">
                    {vendor.profilePictureUrl ? (
                        <img src={vendor.profilePictureUrl} alt={vendor.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-4xl font-bold uppercase">
                            {(vendor.shopName || vendor.name || 'V').charAt(0)}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-2 space-y-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white">{vendor.shopName}</h1>
                        {vendor.isVerified && <svg className="w-5 h-5 text-blue-500 fill-current" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>}
                    </div>
                    <p className="text-sm font-bold text-gray-500">@{vendor.name}</p>
                </div>

                <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                         <span>{vendor.shopAddress || "Location Private"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                         <span>Joined {vendor.memberSince || '2026'}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={handleFollowToggle}
                        disabled={followLoading}
                        className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${isFollowing ? 'bg-gray-100 text-gray-800 border' : 'bg-primary text-white shadow-lg'}`}
                    >
                        {isFollowing ? 'Following' : 'Follow'}
                    </button>
                    <button 
                        onClick={() => {
                            if (!currentUser) return alert("Login to message");
                            onNavigate('chats', { targetUser: { id: vendor.id, name: vendor.shopName || vendor.name } });
                        }}
                        className="flex-1 py-3 bg-accent-blue text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        Message
                    </button>
                </div>
            </div>
        </div>
      </div>

      <div className="px-4 mb-6">
          <div className="grid grid-cols-3 gap-3 bg-white dark:bg-dark-surface p-4 rounded-2xl border dark:border-gray-800 shadow-sm text-center">
                <div>
                    <span className="block text-xl font-black text-gray-900 dark:text-white">{vendor.followers?.length || 0}</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Followers</span>
                </div>
                <div>
                    <span className="block text-xl font-black text-gray-900 dark:text-white">{vendorListings.length}</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Items</span>
                </div>
                <div>
                    <span className="block text-xl font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                        {averageRating.toFixed(1)} <span className="text-accent-yellow">★</span>
                    </span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rating</span>
                </div>
          </div>
      </div>

      <div className="px-4">
          <div className="flex border-b border-gray-100 dark:border-gray-800 mb-6">
                <button 
                    onClick={() => setActiveTab('listings')}
                    className={`py-3 px-1 mr-8 font-black text-xs uppercase tracking-widest border-b-4 transition-all ${activeTab === 'listings' ? 'border-primary text-primary dark:text-white' : 'border-transparent text-gray-400'}`}
                >
                    Products & Services
                </button>
                <button 
                    onClick={() => setActiveTab('about')}
                    className={`py-3 px-1 font-black text-xs uppercase tracking-widest border-b-4 transition-all ${activeTab === 'about' ? 'border-primary text-primary dark:text-white' : 'border-transparent text-gray-400'}`}
                >
                    About & Reviews
                </button>
          </div>

          {activeTab === 'listings' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {vendorListings.length > 0 ? (
                      vendorListings.map(listing => (
                          <ListingCard key={listing.id} listing={listing} onViewDetails={(l) => onNavigate('details', { listing: l })} />
                      ))
                  ) : (
                      <div className="col-span-full py-20 text-center bg-white dark:bg-dark-surface rounded-3xl border-2 border-dashed dark:border-gray-800">
                          <p className="text-gray-400 font-bold">No active listings yet.</p>
                      </div>
                  )}
              </div>
          ) : (
              <div className="space-y-6">
                   <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl border dark:border-gray-800 shadow-sm">
                        <h3 className="font-black text-sm uppercase tracking-widest text-gray-400 mb-4">Bio</h3>
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                            {vendor.bio || "Welcome to our shop! We take pride in offering high-quality items to our customers."}
                        </p>
                   </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default VendorProfilePage;
