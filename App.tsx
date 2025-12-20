
import React, { useState, useEffect, useCallback } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, onSnapshot, Unsubscribe, deleteDoc, updateDoc, arrayUnion, query, where, getDocs, increment, limit, orderBy, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebaseConfig';

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
import { Listing, User, Category, Transaction, ReferralSettings } from './types';
import { MOCK_LISTINGS, CATEGORIES as DEFAULT_CATEGORIES } from './constants';

type View = 'home' | 'listings' | 'details' | 'vendor-dashboard' | 'auth' | 'account' | 'subcategories' | 'chats' | 'add-listing' | 'my-ads' | 'vendor-analytics' | 'favorites' | 'saved-searches' | 'edit-profile' | 'settings' | 'admin' | 'vendor-profile' | 'promote-business' | 'add-balance' | 'referrals' | 'wallet-history' | 'notifications';
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
  
  // --- PAGINATED LISTINGS STATE ---
  const [listingsDB, setListingsDB] = useState<Listing[]>([]);
  const [lastListingDoc, setLastListingDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [chatTargetUser, setChatTargetUser] = useState<{id: string, name: string} | null>(null);
  const [usersDB, setUsersDB] = useState<User[]>([]);
  const [walletUpdateVersion, setWalletUpdateVersion] = useState(0);

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

  // --- AUTH LISTENER ---
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
                }, (err) => {
                    if (!err.message.includes('permission')) console.error("Profile listen error", err.message);
                });
            } catch (e) {}
        }
      } else {
        if (userUnsubscribe) { userUnsubscribe(); userUnsubscribe = null; }
        // FIX: Don't clear user if it's the admin-demo session to prevent data loss in Admin view
        setUser(prev => (prev?.id === 'admin-demo' ? prev : null));
      }
    });
    return () => {
        authUnsubscribe();
        if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  // --- ADMIN USERS LISTENER ---
  useEffect(() => {
      // Logic: Only fetch all users if the currently logged in person is an Admin
      if (!user?.isAdmin || !db) {
          setUsersDB([]);
          return;
      }

      // Listen for all users so the admin dashboard counts are correct
      const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
          const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
          setUsersDB(fetchedUsers);
      }, (err) => {
          if (!err.message.includes('permission')) console.error("Admin Users fetch error", err.message);
      });

      return () => unsubscribe();
  }, [user?.isAdmin, user?.id]); // Depend on user ID to restart listener if user profile loads fully

  // --- LOCAL SYNC LISTENERS ---
  useEffect(() => {
      const handleDataUpdate = () => {
          if (user) {
              setUser(prevUser => prevUser ? mergeLocalUserData(prevUser) : null);
          }
          setWalletUpdateVersion(v => v + 1);
      };
      const handleListingsUpdate = () => {
          setListingsDB(prev => mergeLocalListings(prev));
      };
      window.addEventListener('wallet_updated', handleDataUpdate);
      window.addEventListener('favorites_updated', handleDataUpdate);
      window.addEventListener('listings_updated', handleListingsUpdate);
      window.addEventListener('storage', handleDataUpdate);
      return () => {
          window.removeEventListener('wallet_updated', handleDataUpdate);
          window.removeEventListener('favorites_updated', handleDataUpdate);
          window.removeEventListener('listings_updated', handleListingsUpdate);
          window.removeEventListener('storage', handleDataUpdate);
      };
  }, [user?.id]);

  // --- PAGINATED LISTINGS REAL-TIME INITIAL FETCH ---
  useEffect(() => {
      if (!db) return;
      
      const q = query(
          collection(db, "listings"),
          orderBy("createdAt", "desc"),
          limit(20)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
          setListingsDB(mergeLocalListings(items));
          setLastListingDoc(snapshot.docs[snapshot.docs.length - 1] || null);
          if (snapshot.docs.length < 20) setHasMoreListings(false);
          else setHasMoreListings(true);
      }, (err) => {
          console.warn("Initial listings listener error:", err.message);
      });

      return () => unsubscribe();
  }, []);

  // --- LOAD MORE FUNCTION (One-time fetch) ---
  const fetchMoreListings = async () => {
      if (!db || loadingData || !hasMoreListings || !lastListingDoc) return;

      setLoadingData(true);
      try {
          const q = query(
              collection(db, "listings"),
              orderBy("createdAt", "desc"),
              startAfter(lastListingDoc),
              limit(20)
          );

          const snapshot = await getDocs(q);
          const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
          
          if (snapshot.docs.length < 20) {
              setHasMoreListings(false);
          }

          setLastListingDoc(snapshot.docs[snapshot.docs.length - 1] || null);
          setListingsDB(prev => mergeLocalListings([...prev, ...newItems]));
      } catch (error: any) {
          console.error("Fetch More Error:", error.message);
      } finally {
          setLoadingData(false);
      }
  };

  // --- CATEGORIES LISTENER ---
  useEffect(() => {
      if (!db) return;
      const unsubscribe = onSnapshot(collection(db, "categories"), (snapshot) => {
          const dbCategories: Category[] = [];
          snapshot.forEach(doc => {
              dbCategories.push({ id: doc.id, ...doc.data() } as Category);
          });
          if (dbCategories.length > 0) setCategories(dbCategories);
      }, (err) => {
          if (!err.message.includes('permission')) console.error("Categories error", err.message);
      });
      return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  const toggleTheme = () => setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));

  const handleSaveSearch = async (queryStr: string) => {
    if (!queryStr.trim() || !user || !db) return;
    const lowerCaseQuery = queryStr.toLowerCase();
    if (!user.savedSearches?.includes(lowerCaseQuery)) {
        try {
            await setDoc(doc(db, "users", user.id), { savedSearches: arrayUnion(lowerCaseQuery) }, { merge: true });
        } catch(e) {}
    }
  };

  const handleNavigate = useCallback((newView: View, payload?: NavigatePayload) => {
    if (newView !== 'details' && newView !== 'subcategories') {
      setSelectedListing(null); setSelectedCategory(null);
    }
     if (newView !== 'listings' && newView !== 'details') setSearchQuery('');
    if (payload?.listing && newView === 'details') setSelectedListing(payload.listing);
    if (payload?.category && newView === 'subcategories') setSelectedCategory(payload.category);
    if (payload?.query !== undefined && newView === 'listings') setSearchQuery(payload.query);
    if (payload?.targetUser && newView === 'chats') setChatTargetUser(payload.targetUser);
    else if (newView === 'chats') setChatTargetUser(null); 
    if (payload?.targetVendorId && newView === 'vendor-profile') setSelectedVendorId(payload.targetVendorId);

    if (newView === 'add-listing') { setInitialVendorTab('add-listing'); setView('vendor-dashboard'); }
    else if (newView === 'my-ads') { setInitialVendorTab('my-listings'); setView('vendor-dashboard'); }
    else if (newView === 'vendor-analytics') { setInitialVendorTab('dashboard'); setView('vendor-dashboard'); }
    else if (newView === 'promote-business') { setInitialVendorTab('promotions'); setView('vendor-dashboard'); }
    else if (['chats', 'account', 'favorites', 'saved-searches', 'edit-profile', 'settings', 'admin', 'add-balance', 'referrals', 'wallet-history', 'notifications'].includes(newView)) {
        if (user) {
            if (newView === 'admin' && !user.isAdmin) setView('home'); 
            else setView(newView);
        } else setView('auth');
    } else setView(newView);
    window.scrollTo(0, 0);
  }, [user]);
  
  const handleLogin = async (email: string, password: string) => {
    try {
        if (!navigator.onLine) return { success: false, message: 'No internet connection.' };
        if (email === 'admin@rizqdaan.com' && password === 'admin') {
            const adminUser: User = { id: 'admin-demo', name: 'Admin', email: 'admin@rizqdaan.com', phone: '0000', shopName: 'Admin HQ', shopAddress: 'Cloud', isVerified: true, isAdmin: true };
            setUser(adminUser); setView('admin'); return { success: true, message: 'Logged in as Demo Admin' };
        }
        if (!auth) throw new Error("Firebase keys are missing.");
        await signInWithEmailAndPassword(auth, email, password);
        setView('account'); return { success: true, message: 'Login successful!' };
    } catch (error: any) { return { success: false, message: error.message }; }
  };

  const handleSignup = async (userData: Omit<User, 'id' | 'isVerified'> & { referralCodeInput?: string }) => {
    try {
        if (!navigator.onLine) return { success: false, message: 'No internet connection.' };
        if (!auth || !db) throw new Error("Firebase keys are missing.");
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password || 'password123');
        const firebaseUser = userCredential.user;
        const newUserId = firebaseUser.uid;
        const myReferralCode = generateReferralCode(userData.name);
        let inviterReward = 200, inviteeReward = 300;
        try {
            const settingsSnap = await getDoc(doc(db, 'settings', 'referrals'));
            if (settingsSnap.exists()) {
                const settings = settingsSnap.data() as ReferralSettings;
                if (settings.isActive) { inviterReward = settings.inviterBonus; inviteeReward = settings.inviteeBonus; }
                else { inviterReward = 0; inviteeReward = 0; }
            }
        } catch (e) {}
        let referrerId = null, initialBalance = 0;
        const transactions: Transaction[] = [];
        if (userData.referralCodeInput && inviteeReward > 0) {
            const q = query(collection(db, "users"), where("referralCode", "==", userData.referralCodeInput.trim().toUpperCase()));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const referrerDoc = querySnapshot.docs[0];
                referrerId = referrerDoc.id;
                if (inviterReward > 0) {
                    await updateDoc(doc(db, "users", referrerId), {
                        "wallet.balance": increment(inviterReward),
                        "referralStats.totalInvited": increment(1),
                        "referralStats.totalEarned": increment(inviterReward),
                        walletHistory: arrayUnion({ id: `tx_ref_${Date.now()}_R`, type: 'referral_bonus', amount: inviterReward, date: new Date().toISOString().split('T')[0], status: 'completed', description: `Referral Bonus: Invited ${userData.name}` })
                    });
                }
                initialBalance = inviteeReward;
                transactions.push({ id: `tx_ref_${Date.now()}_U`, type: 'referral_bonus', amount: inviteeReward, date: new Date().toISOString().split('T')[0], status: 'completed', description: `Welcome Bonus: Used code ${userData.referralCodeInput}` });
            }
        }
        const newUserProfile: User = {
            id: newUserId, name: userData.name, email: userData.email, phone: userData.phone,
            shopName: userData.shopName, shopAddress: userData.shopAddress, isVerified: false,
            referralCode: myReferralCode, referredBy: referrerId || null,
            referralStats: { totalInvited: 0, totalEarned: 0 },
            wallet: { balance: initialBalance, totalSpend: 0, pendingDeposit: 0, pendingWithdrawal: 0 },
            walletHistory: transactions, favorites: []
        };
        await setDoc(doc(db, "users", newUserId), newUserProfile);
        return { success: true, message: 'Signup successful!', user: newUserProfile };
    } catch (error: any) { return { success: false, message: error.message }; }
  };

  const handleVerifyAndLogin = async (userId: string) => {
      if (!db) return;
      try {
          await setDoc(doc(db, "users", userId), { isVerified: true }, { merge: true });
          setView('account');
      } catch (e) {}
  };

  const handleAdminUpdateUserVerification = (userId: string, isVerified: boolean) => {
    if(db) { setDoc(doc(db, "users", userId), { isVerified }, { merge: true }).catch(() => {}); }
  };
  
  const handleAdminDeleteListing = async (listingId: string) => {
      setListingsDB(prev => prev.filter(l => l.id !== listingId));
      if(db) { try { await deleteDoc(doc(db, "listings", listingId)); } catch(e) {} }
  };

  const handleImpersonate = (targetUser: User) => {
      const demoWallets = JSON.parse(localStorage.getItem('demo_user_wallets') || '{}');
      let finalUser = targetUser;
      if (demoWallets[targetUser.id]) {
          finalUser = {
              ...targetUser,
              wallet: { ...targetUser.wallet, balance: demoWallets[targetUser.id].balance, totalSpend: demoWallets[targetUser.id].totalSpend ?? (targetUser.wallet?.totalSpend || 0), pendingDeposit: demoWallets[targetUser.id].pendingDeposit ?? (targetUser.wallet?.pendingDeposit || 0), pendingWithdrawal: demoWallets[targetUser.id].pendingWithdrawal ?? (targetUser.wallet?.pendingWithdrawal || 0) }
          };
      }
      setUser(finalUser); setInitialVendorTab('dashboard'); setView('vendor-dashboard');
  };

  const mainPaddingClass = view === 'home' ? 'container mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-24' : 'container mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'dark bg-dark-bg' : 'bg-primary-light'}`}>
      <Header onNavigate={handleNavigate} toggleTheme={toggleTheme} currentTheme={theme} user={user} />
      <main className={mainPaddingClass}>
        {view === 'home' && <HomePage listings={listingsDB} onNavigate={handleNavigate} onSaveSearch={handleSaveSearch} />}
        {view === 'listings' && <ListingsPage listings={listingsDB} onNavigate={handleNavigate} initialSearchTerm={searchQuery} loadMore={fetchMoreListings} hasMore={hasMoreListings} isLoading={loadingData} />}
        {view === 'subcategories' && selectedCategory && <SubCategoryPage category={selectedCategory} onNavigate={handleNavigate} onListingNavigate={(v, q) => handleNavigate(v, { query: q })} />}
        {view === 'details' && selectedListing && <ListingDetailsPage listing={selectedListing} listings={listingsDB} user={user} onNavigate={handleNavigate} />}
        {view === 'vendor-dashboard' && <VendorDashboard initialTab={initialVendorTab} listings={listingsDB} user={user} onNavigate={(v, payload) => handleNavigate(v as View, payload)} />}
        {view === 'vendor-profile' && selectedVendorId && <VendorProfilePage vendorId={selectedVendorId} currentUser={user} listings={listingsDB} onNavigate={(v, p) => handleNavigate(v as View, p)} />}
        {view === 'auth' && <AuthPage onLogin={handleLogin} onSignup={handleSignup} onVerifyAndLogin={handleVerifyAndLogin} />}
        {view === 'account' && user && <AccountPage user={user} listings={listingsDB} onLogout={() => { signOut(auth); setUser(null); setView('home'); }} onNavigate={handleNavigate} />}
        {view === 'favorites' && user && <FavoritesPage user={user} listings={listingsDB} onNavigate={handleNavigate} />}
        {view === 'saved-searches' && user && <SavedSearchesPage searches={user.savedSearches || []} onNavigate={handleNavigate} />}
        {view === 'edit-profile' && user && <EditProfilePage user={user} onNavigate={(v, p) => handleNavigate(v as View, p)} />}
        {view === 'settings' && user && <SettingsPage user={user} onNavigate={handleNavigate} currentTheme={theme} toggleTheme={toggleTheme} onLogout={() => { signOut(auth); setUser(null); setView('home'); }} />}
        {view === 'referrals' && user && <ReferralPage user={user} onNavigate={handleNavigate} />}
        {view === 'add-balance' && user && <AddFundsPage user={user} onNavigate={handleNavigate} />}
        {view === 'wallet-history' && user && <WalletHistoryPage user={user} onNavigate={handleNavigate} />}
        {view === 'notifications' && user && <NotificationsPage user={user} onNavigate={(v) => handleNavigate(v as View)} />}
        {view === 'chats' && user && <ChatPage currentUser={user} targetUser={chatTargetUser} onNavigate={handleNavigate} />}
        {view === 'admin' && user?.isAdmin && <AdminPanel users={usersDB} listings={listingsDB} onUpdateUserVerification={handleAdminUpdateUserVerification} onDeleteListing={handleAdminDeleteListing} onImpersonate={handleImpersonate} onNavigate={(v, p) => handleNavigate(v as View, p)} />}
      </main>
      <BottomNavBar onNavigate={handleNavigate} activeView={view} />
    </div>
  );
};

export default App;
