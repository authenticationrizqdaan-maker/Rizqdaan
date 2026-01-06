
import React, { useState, useEffect, useMemo } from 'react';
import { Listing, User, Review } from '../../types';
import { db } from '../../firebaseConfig';
import { doc, updateDoc, arrayUnion, arrayRemove, increment, getDoc, setDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
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
    
    // Carousel State
    const images = useMemo(() => listing.images && listing.images.length > 0 ? listing.images : [listing.imageUrl], [listing]);
    const [activeIndex, setActiveIndex] = useState(0);
    
    const [isFavorite, setIsFavorite] = useState(false);

    // Related Listings Logic
    const relatedListings = useMemo(() => {
        return listings
            .filter(l => l.category === listing.category && l.id !== listing.id)
            .sort(() => 0.5 - Math.random()) 
            .slice(0, 4);
    }, [listings, listing.id, listing.category]);

    useEffect(() => {
        setReviews(listing.reviews || []);
        setActiveIndex(0);
        window.scrollTo(0, 0);
    }, [listing.id]);

    useEffect(() => {
        if (user && user.favorites) setIsFavorite(user.favorites.includes(listing.id));
    }, [user, listing.id]);

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

    const handleReportSubmit = async () => {
        if (!user) { alert("Please login to report a listing."); return; }
        if (!reportReason) { alert("Please select a reason."); return; }
        
        setIsSubmittingReport(true);
        try {
            if (db) {
                // Check for existing report
                const q = query(collection(db, 'reports'), 
                    where('listingId', '==', listing.id), 
                    where('reporterId', '==', user.id)
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    alert("You have already reported this listing.");
                    setIsReportModalOpen(false);
                    return;
                }

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

                alert("Thank you. Your report has been submitted to the admin for review.");
                setIsReportModalOpen(false);
                setReportReason('');
                setReportDesc('');
            }
        } catch (e: any) {
            alert("Error submitting report: " + e.message);
        } finally {
            setIsSubmittingReport(false);
        }
    };

    const handleReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newRating === 0 || !newComment.trim() || !user) return;
        setIsSubmittingReview(true);
        const newReview: Review = { 
            id: `r-${Date.now()}`, 
            author: user.name, 
            rating: newRating, 
            comment: newComment.trim(), 
            date: new Date().toISOString().split('T')[0] 
        };
        
        try {
            if(db) {
                const listingRef = doc(db, 'listings', listing.id);
                const allReviews = [...reviews, newReview];
                const avg = allReviews.reduce((a, b) => a + b.rating, 0) / allReviews.length;
                
                await updateDoc(listingRef, { 
                    reviews: arrayUnion(newReview),
                    rating: Number(avg.toFixed(1))
                });
                setReviews(allReviews);
                setNewComment('');
                setNewRating(0);
                setIsReviewFormOpen(false);
            }
        } catch (e) {
            alert("Error submitting review.");
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const discountPercent = listing.originalPrice ? Math.round(((listing.originalPrice - listing.price) / listing.originalPrice) * 100) : 0;

  return (
    <div className="bg-gray-50 dark:bg-black min-h-screen pb-10 animate-fade-in relative">
      {/* 📸 GALLERY SECTION */}
      <div className="w-full bg-black relative aspect-[4/3] md:aspect-[16/7] overflow-hidden group shadow-lg">
          <img src={images[activeIndex]} alt={listing.title} className="w-full h-full object-contain transition-all duration-300" />
          
          {images.length > 1 && (
              <>
                <button 
                    onClick={() => setActiveIndex(prev => (prev === 0 ? images.length - 1 : prev - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-3 bg-black/40 text-white rounded-full backdrop-blur-md z-20 active:scale-90 transition-transform"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button 
                    onClick={() => setActiveIndex(prev => (prev === images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-black/40 text-white rounded-full backdrop-blur-md z-20 active:scale-90 transition-transform"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </button>
              </>
          )}

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

          {images.length > 1 && (
            <div className="absolute bottom-4 right-4 bg-black/50 text-white text-[10px] font-black px-3 py-1 rounded-full backdrop-blur-md select-none border border-white/10 z-20">
                {activeIndex + 1} / {images.length}
            </div>
          )}
      </div>

      {images.length > 1 && (
          <div className="bg-white dark:bg-dark-surface p-3 flex gap-2.5 overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-gray-800">
              {images.map((img, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setActiveIndex(idx)}
                    className={`relative min-w-[70px] h-[70px] rounded-xl overflow-hidden border-2 transition-all ${activeIndex === idx ? 'border-primary ring-2 ring-primary/20 scale-105 shadow-md' : 'border-transparent opacity-50'}`}
                  >
                      <img src={img} className="w-full h-full object-cover" alt="" />
                  </button>
              ))}
          </div>
      )}

      {/* 💎 PRIMARY INFO & PRICE */}
      <SectionWrapper className="!pb-2">
          <div className="flex justify-between items-start mb-4">
              <div className="flex-1 pr-4">
                  <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight mb-2 tracking-tight">{listing.title}</h1>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold">
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="truncate">{listing.location}</span>
                  </div>
              </div>
              <div className="text-right">
                  <div className="text-3xl font-black text-primary dark:text-white mb-0.5 whitespace-nowrap">Rs. {listing.price.toLocaleString()}</div>
                  {listing.originalPrice && <p className="text-sm text-red-500 line-through font-bold opacity-80">Rs. {listing.originalPrice.toLocaleString()}</p>}
                  {discountPercent > 0 && <span className="inline-block mt-1 bg-accent-yellow text-primary text-[10px] font-black px-2 py-1 rounded-md shadow-sm uppercase">{discountPercent}% OFF</span>}
              </div>
          </div>
          <div className="flex items-center justify-between pt-5 border-t border-gray-50 dark:border-gray-800">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border dark:border-gray-700">
                  <div className="flex text-accent-yellow text-xs gap-0.5">
                      {[...Array(5)].map((_, i) => (
                          <span key={i}>{i < Math.floor(listing.rating) ? '★' : '☆'}</span>
                      ))}
                  </div>
                  <span className="text-[11px] font-black text-gray-500 dark:text-gray-400">{listing.rating} ({reviews.length})</span>
              </div>
              <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{listing.createdAt ? new Date(listing.createdAt).toLocaleDateString() : 'New Entry'}</span>
          </div>
      </SectionWrapper>

      {/* 🚀 CALL TO ACTION SECTION - HIGH VISIBILITY POSITION */}
      <SectionWrapper className="!bg-primary/5 dark:!bg-primary/10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button 
                onClick={() => { if (!user) { alert("Please login to chat."); return; } onNavigate('chats', { targetUser: { id: listing.vendorId, name: vendorData?.shopName || listing.vendorName } }); }} 
                className="flex items-center justify-center gap-3 h-14 bg-white dark:bg-dark-surface text-primary dark:text-white font-black rounded-2xl active:scale-95 transition-all border-2 border-primary shadow-sm"
              >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  <span className="text-xs uppercase tracking-widest">CHAT NOW</span>
              </button>

              <a 
                href={`https://wa.me/${(vendorData?.phone || listing.contact.whatsapp).replace(/[^0-9]/g, '')}`} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-3 h-14 bg-green-600 text-white font-black rounded-2xl active:scale-95 transition-all shadow-lg shadow-green-600/30"
              >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.407 3.481 2.239 2.24 3.477 5.23 3.475 8.411-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.394 1.664zm6.222-3.528c1.552.92 3.51 1.405 5.621 1.406 5.543 0 10.054-4.51 10.057-10.055.002-2.686-1.047-5.212-2.952-7.118-1.904-1.905-4.432-2.952-7.118-2.952-5.544 0-10.054 4.51-10.057 10.055-.001 2.112.553 4.17 1.602 5.962l-.999 3.649 3.846-.947zm11.387-5.477c-.31-.156-1.834-.905-2.113-1.006-.279-.101-.482-.151-.684.151-.202.302-.782 1.006-.958 1.207-.176.202-.352.227-.662.071-.31-.156-1.311-.484-2.498-1.543-.923-.824-1.547-1.841-1.728-2.143-.181-.303-.019-.466.136-.621.14-.14.31-.362.466-.543.156-.181.208-.31.31-.517.103-.207.052-.387-.026-.543-.078-.156-.684-1.649-.938-2.261-.247-.597-.499-.516-.684-.525-.176-.008-.378-.009-.58-.009s-.53.076-.807.378c-.278.302-1.061 1.037-1.061 2.531s1.087 2.946 1.239 3.148c.152.202 2.139 3.267 5.182 4.581.724.312 1.288.499 1.728.639.728.231 1.389.198 1.912.12.583-.087 1.834-.751 2.09-1.477.256-.725.256-1.348.179-1.477-.076-.128-.278-.204-.588-.36z"/></svg>
                  <span className="text-xs uppercase tracking-widest">WHATSAPP</span>
              </a>

              <a 
                href={`tel:${vendorData?.phone || listing.contact.phone}`} 
                className="flex items-center justify-center gap-3 h-14 bg-primary text-white font-black rounded-2xl active:scale-95 transition-all shadow-lg shadow-primary/30"
              >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <span className="text-xs uppercase tracking-widest">CALL SELLER</span>
              </a>
          </div>
      </SectionWrapper>

      <SectionWrapper title="About This Item">
          <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line font-medium opacity-90">{listing.description}</p>
      </SectionWrapper>

      <SectionWrapper title="Sold By">
          <div className="flex items-center gap-4 cursor-pointer p-4 rounded-3xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 hover:border-primary/40 transition-all active:scale-[0.98]" onClick={() => onNavigate('vendor-profile', { targetVendorId: listing.vendorId })}>
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 bg-primary/5 flex items-center justify-center shadow-inner">
                  {vendorData?.profilePictureUrl ? (
                      <img src={vendorData.profilePictureUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                      <span className="text-2xl font-black text-primary">{(vendorData?.shopName || listing.vendorName).charAt(0)}</span>
                  )}
              </div>
              <div className="flex-grow min-w-0">
                  <h4 className="text-lg font-black text-gray-900 dark:text-white truncate">{vendorData?.shopName || listing.vendorName}</h4>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-tight">Verified Merchant • Joined {vendorData?.memberSince || '2026'}</p>
                  <div className="text-[10px] text-primary font-black uppercase mt-1.5 flex items-center gap-1 group">
                      Visit Storefront 
                      <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                  </div>
              </div>
          </div>
      </SectionWrapper>

      {/* 🌟 PROFESSIONAL REVIEWS SECTION */}
      <SectionWrapper title="Customer Feedback">
          <div className="flex justify-between items-center mb-8 px-1">
              <div className="text-sm font-bold dark:text-white flex items-center gap-2">
                  <span className="text-2xl">{listing.rating}</span>
                  <div className="flex text-accent-yellow text-xs">
                    {[...Array(5)].map((_, i) => <span key={i}>{i < Math.floor(listing.rating) ? '★' : '☆'}</span>)}
                  </div>
              </div>
              {user && user.id !== listing.vendorId && !isReviewFormOpen && (
                  <button onClick={() => setIsReviewFormOpen(true)} className="text-[11px] font-black text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10 active:scale-90 transition-transform">WRITE REVIEW</button>
              )}
          </div>

          {isReviewFormOpen && (
              <div className="mb-10 p-6 bg-white dark:bg-gray-800 rounded-3xl animate-pop-in border-2 border-primary/10 shadow-2xl">
                  <h4 className="font-black text-lg mb-2 dark:text-white text-center">How was your experience?</h4>
                  <div className="flex justify-center gap-3 mb-6">
                      {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} onClick={() => setNewRating(star)} className={`text-4xl transition-all transform active:scale-150 ${newRating >= star ? 'text-accent-yellow scale-110 drop-shadow-sm' : 'text-gray-200'}`}>
                              ★
                          </button>
                      ))}
                  </div>
                  <textarea 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Tell other buyers what you liked about this item..."
                    className="w-full p-4 text-sm border-2 border-gray-100 rounded-2xl dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:border-primary transition-all placeholder:text-gray-400"
                    rows={4}
                  />
                  <div className="flex gap-3 mt-6">
                      <button 
                        onClick={handleReviewSubmit}
                        disabled={isSubmittingReview || newRating === 0}
                        className="flex-[2] py-4 bg-primary text-white font-black rounded-2xl shadow-xl disabled:opacity-50 transition-all active:scale-95"
                      >
                          {isSubmittingReview ? 'SENDING...' : 'POST REVIEW'}
                      </button>
                      <button onClick={() => setIsReviewFormOpen(false)} className="flex-1 py-4 text-gray-500 font-bold bg-gray-50 dark:bg-gray-700 rounded-2xl active:scale-95 transition-all">CANCEL</button>
                  </div>
              </div>
          )}

          <div className="space-y-6">
              {reviews.length > 0 ? (
                  <div className="space-y-4">
                      {reviews.map((review, idx) => (
                          <div key={idx} className="flex gap-4 p-5 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-700">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center font-black text-primary text-sm shadow-inner">
                                  {review.author.charAt(0)}
                              </div>
                              <div className="flex-grow min-w-0">
                                  <div className="flex justify-between items-start mb-1">
                                      <span className="font-black text-gray-900 dark:text-white text-sm truncate">{review.author}</span>
                                      <span className="text-[9px] text-gray-400 font-bold uppercase">{review.date}</span>
                                  </div>
                                  <div className="flex text-accent-yellow text-[10px] mb-2 gap-0.5">
                                      {[...Array(5)].map((_, i) => <span key={i}>{i < review.rating ? '★' : '☆'}</span>)}
                                  </div>
                                  <p className="text-gray-700 dark:text-gray-400 text-sm leading-relaxed italic font-medium">"{review.comment}"</p>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="text-center py-16 bg-gray-50/50 dark:bg-gray-900/40 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                      <div className="text-4xl mb-3 opacity-30">✨</div>
                      <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">No reviews yet. Be the first to share!</p>
                  </div>
              )}
          </div>
      </SectionWrapper>

      {/* 🧩 RECOMMENDED LISTINGS SECTION */}
      {relatedListings.length > 0 && (
          <SectionWrapper title="You Might Also Like" noBorder>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {relatedListings.map(l => (
                      <ListingCard key={l.id} listing={l} onViewDetails={(item) => onNavigate('details', { listing: item })} />
                  ))}
              </div>
          </SectionWrapper>
      )}

      {/* --- REPORT MODAL --- */}
      {isReportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 animate-pop-in">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Report Listing</h3>
                  <p className="text-sm text-gray-500 mb-6">Your report helps us keep the RizqDaan community safe.</p>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Reason for reporting</label>
                          <select 
                            value={reportReason} 
                            onChange={(e) => setReportReason(e.target.value)}
                            className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-primary/30 rounded-xl outline-none dark:text-white transition-all text-sm font-medium"
                          >
                              <option value="">Select a reason...</option>
                              <option value="Fake or misleading listing">Fake or misleading listing</option>
                              <option value="Scam or fraud">Scam or fraud</option>
                              <option value="Inappropriate content">Inappropriate content</option>
                              <option value="Duplicate listing">Duplicate listing</option>
                              <option value="Other">Other</option>
                          </select>
                      </div>

                      <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Additional details (Optional)</label>
                          <textarea 
                            value={reportDesc}
                            onChange={(e) => setReportDesc(e.target.value)}
                            placeholder="Tell us more (max 250 chars)..."
                            maxLength={250}
                            rows={3}
                            className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-primary/30 rounded-xl outline-none dark:text-white transition-all text-sm font-medium resize-none"
                          />
                      </div>
                  </div>

                  <div className="flex gap-3 mt-8">
                      <button 
                        onClick={() => setIsReportModalOpen(false)}
                        className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-500 font-bold rounded-xl active:scale-95 transition-all text-xs uppercase tracking-widest"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={handleReportSubmit}
                        disabled={isSubmittingReport || !reportReason}
                        className="flex-[2] py-3.5 bg-red-600 text-white font-black rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 text-xs uppercase tracking-widest"
                      >
                          {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ListingDetailsPage;
