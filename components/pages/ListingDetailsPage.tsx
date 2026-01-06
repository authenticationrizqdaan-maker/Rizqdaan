
import React, { useState, useEffect, useMemo } from 'react';
import { Listing, User, Review } from '../../types';
import { db } from '../../firebaseConfig';
import { doc, updateDoc, arrayUnion, arrayRemove, increment, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import ListingCard from '../common/ListingCard';

interface ListingDetailsPageProps {
  listing: Listing;
  listings: Listing[];
  user: User | null;
  onNavigate: (view: 'listings' | 'details' | 'chats' | 'vendor-profile', payload?: { listing?: Listing, targetUser?: { id: string, name: string }, targetVendorId?: string }) => void;
}

const SectionWrapper = ({ children, title, className = "", noBorder = false }: { children?: React.ReactNode, title?: string, className?: string, noBorder?: boolean }) => (
    <section className={`w-full bg-white dark:bg-dark-surface ${!noBorder ? 'border-b border-gray-100 dark:border-gray-800' : ''} p-5 md:p-8 ${className}`}>
        {title && <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-5">{title}</h3>}
        {children}
    </section>
);

const ListingDetailsPage: React.FC<ListingDetailsPageProps> = ({ listing, listings, user, onNavigate }) => {
    const [reviews, setReviews] = useState<Review[]>(listing.reviews || []);
    const [newRating, setNewRating] = useState(0);
    const [newComment, setNewComment] = useState('');
    const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [vendorData, setVendorData] = useState<User | null>(null);
    
    // Reporting State
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDesc, setReportDesc] = useState('');
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    
    const images = useMemo(() => listing.images && listing.images.length > 0 ? listing.images : [listing.imageUrl], [listing]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isFavorite, setIsFavorite] = useState(false);

    useEffect(() => {
        const fetchVendorInfo = async () => {
            if (!db || !listing.vendorId) return;
            try {
                const userSnap = await getDoc(doc(db, "users", listing.vendorId));
                if (userSnap.exists()) setVendorData(userSnap.data() as User);
            } catch (e) {}
        };
        fetchVendorInfo();
    }, [listing.vendorId]);

    const handleReportSubmit = async () => {
        if (!user) { alert("Please login to report."); return; }
        if (!reportReason) { alert("Please select a reason."); return; }
        
        setIsSubmittingReport(true);
        try {
            if (db) {
                await addDoc(collection(db, 'reports'), {
                    listingId: listing.id,
                    listingTitle: listing.title,
                    listingImageUrl: listing.imageUrl,
                    reporterId: user.id,
                    reporterName: user.name,
                    reason: reportReason,
                    description: reportDesc,
                    createdAt: new Date().toISOString(),
                    status: 'pending'
                });
                alert("Thank you. Admin has been notified.");
                setIsReportModalOpen(false);
                setReportReason('');
                setReportDesc('');
            }
        } catch (e: any) {
            alert("Report failed: " + e.message);
        } finally {
            setIsSubmittingReport(false);
        }
    };

    const handleToggleFavorite = async () => {
        if (!user) { alert("Please login to save favorites."); return; }
        const wasFavorite = isFavorite;
        setIsFavorite(!wasFavorite);
        if (!db) return;
        const userRef = doc(db, 'users', user.id);
        const listingRef = doc(db, 'listings', listing.id);
        try {
            if (wasFavorite) {
                await setDoc(userRef, { favorites: arrayRemove(listing.id) }, { merge: true });
                await updateDoc(listingRef, { likes: increment(-1) }).catch(() => {});
            } else {
                await setDoc(userRef, { favorites: arrayUnion(listing.id) }, { merge: true });
                await updateDoc(listingRef, { likes: increment(1) }).catch(() => {});
            }
        } catch (e) {}
    };

    return (
        <div className="bg-gray-50 dark:bg-black min-h-screen pb-10 animate-fade-in relative">
            {/* Gallery */}
            <div className="w-full bg-black relative aspect-[4/3] md:aspect-[16/7] overflow-hidden group shadow-lg">
                <img src={images[activeIndex]} alt={listing.title} className="w-full h-full object-contain" />
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent z-30">
                    <button onClick={() => onNavigate('listings')} className="p-2 bg-white/20 backdrop-blur-lg rounded-full text-white shadow-xl active:scale-90 transition-transform">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setIsReportModalOpen(true)}
                            className="p-2.5 bg-white/20 backdrop-blur-lg rounded-full text-white shadow-xl active:scale-90"
                            title="Report Listing"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </button>
                        <button onClick={handleToggleFavorite} className={`p-2.5 bg-white/20 backdrop-blur-lg rounded-full shadow-xl active:scale-90 transition-all ${isFavorite ? 'text-red-500' : 'text-white'}`}>
                            <svg className="w-6 h-6" fill={isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Info */}
            <SectionWrapper>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight mb-2 tracking-tight">{listing.title}</h1>
                <div className="text-3xl font-black text-primary dark:text-white mb-0.5 whitespace-nowrap">Rs. {listing.price.toLocaleString()}</div>
            </SectionWrapper>

            <SectionWrapper title="Description">
                <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed font-medium">{listing.description}</p>
            </SectionWrapper>

            {/* Modal */}
            {isReportModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 animate-pop-in">
                        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Report Listing</h3>
                        <p className="text-sm text-gray-500 mb-6">Why are you reporting this?</p>
                        
                        <div className="space-y-4">
                            <select 
                                value={reportReason} 
                                onChange={(e) => setReportReason(e.target.value)}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-primary/30 rounded-xl outline-none dark:text-white transition-all"
                            >
                                <option value="">Select reason...</option>
                                <option value="Fake Listing">Fake Listing</option>
                                <option value="Scam / Fraud">Scam / Fraud</option>
                                <option value="Inappropriate Content">Inappropriate Content</option>
                                <option value="Duplicate Listing">Duplicate Listing</option>
                                <option value="Other">Other</option>
                            </select>
                            <textarea 
                                value={reportDesc}
                                onChange={(e) => setReportDesc(e.target.value)}
                                placeholder="Description (Optional)"
                                rows={3}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-primary/30 rounded-xl outline-none dark:text-white transition-all"
                            />
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setIsReportModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 font-bold rounded-xl">Cancel</button>
                            <button onClick={handleReportSubmit} disabled={isSubmittingReport || !reportReason} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl active:scale-95 disabled:opacity-50">
                                {isSubmittingReport ? 'Reporting...' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ListingDetailsPage;
