
import React, { useState, useEffect, useCallback } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, onSnapshot, Unsubscribe, deleteDoc, updateDoc, arrayUnion, query, where, getDocs, increment, limit, orderBy, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

import Header from './components/common/Header';
import BottomNavBar from './components/common/BottomNavBar';
import HomePage from './components/pages/HomePage';
import ListingsPage from './components/pages/ListingsPage';
import ListingDetailsPage from './components/pages/ListingDetailsPage';
import VendorDashboard from './components/pages/VendorDashboard';
import VendorProfilePage from './components/pages/VendorProfilePage';
import AuthPage from './components/auth/AuthPage';
import AccountPage from './components/auth/AccountPage';
import SubCategoryPage from './components/pages/SubCategoryPage';
import FavoritesPage from './components/pages/FavoritesPage';
import SavedSearchesPage from './components/pages/SavedSearchesPage';
import EditProfilePage from './components/auth/EditProfilePage';
import SettingsPage from './components/pages/SettingsPage';
import ReferralPage from './components/pages/ReferralPage';
import AdminPanel from './components/admin/AdminPanel';
import ChatPage from './components/pages/ChatPage';
import AddFundsPage from './components/pages/AddFundsPage';
import WalletHistoryPage from './components/pages/WalletHistoryPage';
import NotificationsPage from './components/pages/NotificationsPage'; 
import HelpCenterPage from './components/pages/HelpCenterPage';
import { Listing, User, Category, Transaction, ReferralSettings } from './types';
import { CATEGORIES as DEFAULT_CATEGORIES } from './constants';

type View = 'home' | 'listings' | 'details' | 'vendor-dashboard' | 'auth' | 'account' | 'subcategories' | 'chats' | 'add-listing' | 'my-ads' | 'vendor-analytics' | 'favorites' | 'saved-searches' | 'edit-profile' | 'settings' | 'admin' | 'vendor-profile' | 'promote-business' | 'add-balance' | 'referrals' | 'wallet-history' | 'notifications' | 'help-center';
type NavigatePayload = {
  listing?: Listing;
  category?: Category;
  query?: string;
  targetUser?: { id: string; name: string };
  targetVendorId?: string;
};

const App: React.FC = () => {
  const [theme, setTheme] = useState('light');
  const [view, setView] = useState<View>('home');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  const [listingsDB, setListingsDB] = useState<Listing[]>([]);
  const [lastListingDoc, setLastListingDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [chatTargetUser, setChatTargetUser] = useState<{id: string, name: string} | null>(null);
  const [usersDB, setUsersDB] = useState<User[]>([]);

  const [initialVendorTab, setInitialVendorTab] = useState<'dashboard' | 'my-listings' | 'add-listing' | 'promotions'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const generateReferralCode = (name: string) => {
      const cleanName = name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase();
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      return `${cleanName}-${randomNum}`;
  };

  const mergeLocalUserData = (baseUser: User) => {
      const demoWallets = JSON.parse(localStorage.getItem('demo_user_wallets') || '{}');
      const demoHistory = JSON.parse(localStorage.getItem('demo_user_history') || '{}');
      const demoFavs = JSON.parse(localStorage.getItem('demo_user_favorites') || '{}');
      
      let updatedUser = { ...baseUser };
      if (demoWallets[baseUser.id]) {
          updatedUser.wallet = {
              ...baseUser.wallet,
              balance: demoWallets[baseUser.id].balance,
              totalSpend: demoWallets[baseUser.id].totalSpend ?? (baseUser.wallet?.totalSpend || 0),
              pendingDeposit: demoWallets[baseUser.id].pendingDeposit ?? (baseUser.wallet?.pendingDeposit || 0),
              pendingWithdrawal: demoWallets[baseUser.id].pendingWithdrawal ?? (baseUser.wallet?.pendingWithdrawal || 0)
          };
      }
      if (demoHistory[baseUser.id]) {
          const dbHistory = baseUser.walletHistory || [];
          const localHistory = demoHistory[baseUser.id] as Transaction[];
          const uniqueLocalTx = localHistory.filter(ltx => !dbHistory.some(dtx => dtx.id === ltx.id));
          updatedUser.walletHistory = [...dbHistory, ...uniqueLocalTx];
      }
      if (demoFavs[baseUser.id]) {
          updatedUser.favorites = demoFavs[baseUser.id];
      }
      if (!updatedUser.favorites) updatedUser.favorites = [];
      return updatedUser;
  };

  const mergeLocalListings = (baseListings: Listing[]) => {
      const overrides = JSON.parse(localStorage.getItem('demo_listings_overrides') || '{}');
      return baseListings.map(l => {
          if (overrides[l.id]) return { ...l, ...overrides[l.id] };
          return l;
      });
  };

  useEffect(() => {
    if (!auth) return;
    let userUnsubscribe: Unsubscribe | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (db) {
            try {
                userUnsubscribe = onSnapshot(doc(db, "users", firebaseUser.uid), async (docSnap) => {
                    if (docSnap.exists()) {
                         let userData = docSnap.data() as User;
                         userData = mergeLocalUserData(userData);
                         if (!userData.referralCode) {
                             const newCode = generateReferralCode(userData.name || 'USER');
                             setDoc(doc(db, "users", firebaseUser.uid), { referralCode: newCode }, { merge: true }).catch(() => {});
                             userData.referralCode = newCode;
                         }
                         setUser({ id: firebaseUser.uid, ...userData });
                    } else {
                        const newUser: User = { 
                            id: firebaseUser.uid, email: firebaseUser.email || '', 
                            name: firebaseUser.displayName || 'User', phone: '', shopName: '', shopAddress: '', isVerified: false,
                            referralCode: generateReferralCode(firebaseUser.displayName || 'USER'),
                            favorites: [], referredBy: null,
                            wallet: { balance: 0, totalSpend: 0, pendingDeposit: 0, pendingWithdrawal: 0 },
                            walletHistory: []
                        };
                        await setDoc(doc(db, "users", firebaseUser.uid), newUser);
                        setUser(newUser);
                    }
                });
            } catch (e) {}
        }
      } else {
        if (userUnsubscribe) { userUnsubscribe(); userUnsubscribe = null; }
        setUser(prev => (prev?.id === 'admin-demo' ? prev : null));
      }
    });
    return () => {
        authUnsubscribe();
        if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  useEffect(() => {
      if (!user?.isAdmin || !db) {
          setUsersDB([]);
          return;
      }
      const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
          setUsersDB(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      });
      return () => unsubscribe();
  }, [user?.isAdmin, user?.id]);

  useEffect(() => {
      if (!db) return;
      const q = query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(20));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
          setListingsDB(mergeLocalListings(items));
          setLastListingDoc(snapshot.docs[snapshot.docs.length - 1] || null);
          setHasMoreListings(snapshot.docs.length >= 20);
      });
      return () => unsubscribe();
  }, []);

  const fetchMoreListings = async () => {
      if (!db || loadingData || !hasMoreListings || !lastListingDoc) return;
      setLoadingData(true);
      try {
          const q = query(collection(db, "listings"), orderBy("createdAt", "desc"), startAfter(lastListingDoc), limit(20));
          const snapshot = await getDocs(q);
          const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
          setHasMoreListings(snapshot.docs.length >= 20);
          setLastListingDoc(snapshot.docs[snapshot.docs.length - 1] || null);
          setListingsDB(prev => mergeLocalListings([...prev, ...newItems]));
      } finally {
          setLoadingData(false);
      }
  };

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  const handleNavigate = useCallback((newView: View, payload?: NavigatePayload) => {
    if (newView !== 'details' && newView !== 'subcategories') {
      setSelectedListing(null); setSelectedCategory(null);
    }
    if (newView !== 'listings' && newView !== 'details') setSearchQuery('');
    if (payload?.listing && newView === 'details') setSelectedListing(payload.listing);
    if (payload?.category && newView === 'subcategories') setSelectedCategory(payload.category);
    if (payload?.query !== undefined && newView === 'listings') setSearchQuery(payload.query);
    if (payload?.targetUser && newView === 'chats') setChatTargetUser(payload.targetUser);
    if (payload?.targetVendorId && newView === 'vendor-profile') setSelectedVendorId(payload.targetVendorId);

    if (newView === 'add-listing') { setInitialVendorTab('add-listing'); setView('vendor-dashboard'); }
    else if (newView === 'my-ads') { setInitialVendorTab('my-listings'); setView('vendor-dashboard'); }
    else if (newView === 'vendor-analytics') { setInitialVendorTab('dashboard'); setView('vendor-dashboard'); }
    else if (newView === 'promote-business') { setInitialVendorTab('promotions'); setView('vendor-dashboard'); }
    else setView(newView);
    window.scrollTo(0, 0);
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
        if (email === 'admin@rizqdaan.com' && password === 'admin') {
            const adminUser: User = { id: 'admin-demo', name: 'Admin', email: 'admin@rizqdaan.com', phone: '0000', shopName: 'Admin HQ', shopAddress: 'Cloud', isVerified: true, isAdmin: true };
            setUser(adminUser); setView('admin'); return { success: true, message: 'Logged in as Demo Admin' };
        }
        await signInWithEmailAndPassword(auth, email, password);
        return { success: true, message: 'Login successful!' };
    } catch (error: any) { return { success: false, message: error.message }; }
  };

  const handleSignup = async (userData: any) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password || 'password123');
        const newUserId = userCredential.user.uid;
        const newUserProfile: User = {
            id: newUserId, name: userData.name, email: userData.email, phone: userData.phone,
            shopName: userData.shopName, shopAddress: userData.shopAddress, isVerified: false,
            referralCode: generateReferralCode(userData.name), referredBy: null,
            wallet: { balance: 0, totalSpend: 0, pendingDeposit: 0, pendingWithdrawal: 0 },
            walletHistory: [], favorites: []
        };
        await setDoc(doc(db, "users", newUserId), newUserProfile);
        return { success: true, message: 'Signup successful!', user: newUserProfile };
    } catch (error: any) { return { success: false, message: error.message }; }
  };

  const handleVerifyAndLogin = async (userId: string) => {
      try {
          await updateDoc(doc(db, "users", userId), { isVerified: true });
          setView('account');
      } catch (e) {}
  };

  const handleAdminDeleteListing = async (listingId: string) => {
      await deleteDoc(doc(db, "listings", listingId));
  };

  const renderView = () => {
    switch (view) {
      case 'home': return <HomePage listings={listingsDB} categories={categories} onNavigate={handleNavigate} onSaveSearch={() => {}} />;
      case 'listings': return <ListingsPage listings={listingsDB} onNavigate={handleNavigate} initialSearchTerm={searchQuery} loadMore={fetchMoreListings} hasMore={hasMoreListings} isLoading={loadingData} />;
      case 'details': return selectedListing ? <ListingDetailsPage listing={selectedListing} listings={listingsDB} user={user} onNavigate={handleNavigate} /> : null;
      case 'vendor-dashboard': return <VendorDashboard initialTab={initialVendorTab} listings={listingsDB} user={user} onNavigate={handleNavigate} />;
      case 'vendor-profile': return selectedVendorId ? <VendorProfilePage vendorId={selectedVendorId} currentUser={user} listings={listingsDB} onNavigate={handleNavigate} /> : null;
      case 'auth': return <AuthPage onLogin={handleLogin} onSignup={handleSignup} onVerifyAndLogin={handleVerifyAndLogin} />;
      case 'account': return user ? <AccountPage user={user} listings={listingsDB} onLogout={() => { signOut(auth); setUser(null); setView('home'); }} onNavigate={handleNavigate} /> : <AuthPage onLogin={handleLogin} onSignup={handleSignup} onVerifyAndLogin={handleVerifyAndLogin} />;
      case 'subcategories': return selectedCategory ? <SubCategoryPage category={selectedCategory} onNavigate={() => setView('home')} onListingNavigate={(v, q) => handleNavigate(v, { query: q })} /> : null;
      case 'chats': return user ? <ChatPage currentUser={user} targetUser={chatTargetUser} onNavigate={() => setView('home')} /> : null;
      case 'favorites': return user ? <FavoritesPage user={user} listings={listingsDB} onNavigate={handleNavigate} /> : null;
      case 'saved-searches': return user ? <SavedSearchesPage searches={user.savedSearches || []} onNavigate={handleNavigate} /> : null;
      case 'edit-profile': return user ? <EditProfilePage user={user} onNavigate={handleNavigate} /> : null;
      case 'settings': return user ? <SettingsPage user={user} onNavigate={handleNavigate} currentTheme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} onLogout={() => { signOut(auth); setUser(null); setView('home'); }} /> : null;
      case 'admin': return user?.isAdmin ? <AdminPanel users={usersDB} listings={listingsDB} onUpdateUserVerification={() => {}} onDeleteListing={handleAdminDeleteListing} onImpersonate={(u) => { setUser(u); setView('vendor-dashboard'); }} onNavigate={handleNavigate} /> : null;
      case 'add-balance': return user ? <AddFundsPage user={user} onNavigate={() => setView('account')} /> : null;
      case 'referrals': return user ? <ReferralPage user={user} onNavigate={() => setView('account')} /> : null;
      case 'wallet-history': return user ? <WalletHistoryPage user={user} onNavigate={() => setView('account')} /> : null;
      case 'notifications': return user ? <NotificationsPage user={user} onNavigate={handleNavigate} /> : null;
      case 'help-center': return <HelpCenterPage onNavigate={() => setView('account')} />;
      default: return <HomePage listings={listingsDB} categories={categories} onNavigate={handleNavigate} onSaveSearch={() => {}} />;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'dark bg-dark-bg' : 'bg-primary-light'}`}>
      <Header onNavigate={handleNavigate} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} currentTheme={theme} user={user} />
      <main className={view === 'home' ? "container mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-24" : "container mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24"}>
        {renderView()}
      </main>
      <BottomNavBar onNavigate={handleNavigate} activeView={view} />
    </div>
  );
};

export default App;
