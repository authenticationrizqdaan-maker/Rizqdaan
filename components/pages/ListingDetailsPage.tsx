
import React, { useState, useEffect } from 'react';
import { Listing, User, Review } from '../../types';
import { db } from '../../firebaseConfig';
import { doc, updateDoc, arrayUnion, arrayRemove, increment, getDoc, getDocs, query, collection, where, setDoc } from 'firebase/firestore';
import ListingCard from '../common/ListingCard';

interface ListingDetailsPageProps {
  listing: Listing;
  listings: Listing[];
  user: User | null;
  onNavigate: (view: 'listings' | 'details' | 'chats' | 'vendor-profile', payload?: { listing?: Listing, targetUser?: { id: string, name: string }, targetVendorId?: string }) => void;
}

const SectionWrapper = ({ children, className = "" }: { children?: React.ReactNode, className?: string }) => (
    <section className={`w-full bg-white dark:bg-dark-surface border-b border-gray-100 dark:border-gray-800 p-4 md:px-8 ${className}`}>
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
    const [vendorStats, setVendorStats] = useState({ rating: 0, reviewCount: 0 });
    const images = listing.images && listing.images.length > 0 ? listing.images : [listing.imageUrl];
    const [activeImage, setActiveImage] = useState(images[0]);
    const [isFavorite, setIsFavorite] = useState(false);
    const [contactPopup, setContactPopup] = useState<{ isOpen: boolean; type: 'call' | 'whatsapp'; number: string } | null>(null);

    useEffect(() => {
        setReviews(listing.reviews || []);
        setActiveImage(images[0]);
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

    const handleReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newRating === 0 || !newComment.trim() || !user) return;
        setIsSubmittingReview(true);
        const newReview: Review = { id: `r-${Date.now()}`, author: user.name, rating: newRating, comment: newComment.trim(), date: new Date().toISOString().split('T')[0] };
        
        try {
            if(db) {
                const listingRef = doc(db, 'listings', listing.id);
                // Calculate new overall rating
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
    <div className="bg-gray-50 dark:bg-black min-h-screen pb-32">
      <div className="w-full bg-black relative aspect-[4/3] md:aspect-[16/7] overflow-hidden">
          <img src={activeImage} alt={listing.title} className="w-full h-full object-contain" />
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent z-10">
              <button onClick={() => onNavigate('listings')} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button onClick={handleToggleFavorite} className={`p-2 bg-white/20 backdrop-blur-md rounded-full ${isFavorite ? 'text-red-500' : 'text-white'}`}>
                  <svg className="w-6 h-6" fill={isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </button>
          </div>
          <div className="absolute bottom-4 left-4 flex gap-2">
              {listing.isPromoted && <span className="bg-accent-yellow text-primary text-[10px] font-black px-3 py-1 rounded shadow-lg uppercase">Featured</span>}
              {discountPercent > 0 && <span className="bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded shadow-lg">-{discountPercent}% OFF</span>}
          </div>
      </div>

      <SectionWrapper>
          <div className="flex justify-between items-end mb-2">
              <div>
                  <h2 className="text-3xl font-black text-primary dark:text-white leading-tight">Rs. {listing.price.toLocaleString()}</h2>
                  {listing.originalPrice && <p className="text-sm text-gray-400 line-through">Rs. {listing.originalPrice.toLocaleString()}</p>}
              </div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">ID: {listing.id.substring(0, 8)}</div>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">{listing.title}</h1>
          <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-800">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span className="font-medium">{listing.location}</span>
              </div>
              <span className="text-[10px] text-gray-400 font-bold">{listing.createdAt ? new Date(listing.createdAt).toLocaleDateString() : 'Just now'}</span>
          </div>
      </SectionWrapper>

      <SectionWrapper>
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Description</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{listing.description}</p>
      </SectionWrapper>

      <SectionWrapper>
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Seller Information</h3>
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => onNavigate('vendor-profile', { targetVendorId: listing.vendorId })}>
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 bg-primary/5 flex items-center justify-center">
                  {vendorData?.profilePictureUrl ? (
                      <img src={vendorData.profilePictureUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                      <span className="text-2xl font-black text-primary">{(vendorData?.shopName || listing.vendorName).charAt(0)}</span>
                  )}
              </div>
              <div className="flex-grow">
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">{vendorData?.shopName || listing.vendorName}</h4>
                  <p className="text-xs text-gray-500">Member since {vendorData?.memberSince || '2026'}</p>
                  <div className="text-[10px] text-primary font-bold uppercase mt-1">View Profile →</div>
              </div>
          </div>
      </SectionWrapper>

      {/* --- ADDED: REVIEWS SECTION --- */}
      <SectionWrapper>
          <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Reviews & Ratings</h3>
              {user && user.id !== listing.vendorId && !isReviewFormOpen && (
                  <button 
                    onClick={() => setIsReviewFormOpen(true)}
                    className="text-xs font-black text-primary underline"
                  >
                      Write a Review
                  </button>
              )}
          </div>

          {isReviewFormOpen && (
              <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl animate-fade-in border border-gray-100 dark:border-gray-700">
                  <h4 className="font-bold text-sm mb-4 dark:text-white">What is your rating?</h4>
                  <div className="flex gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} onClick={() => setNewRating(star)} className="text-2xl transition-transform active:scale-125">
                              {newRating >= star ? '⭐' : '☆'}
                          </button>
                      ))}
                  </div>
                  <textarea 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your experience with this item..."
                    className="w-full p-4 text-sm border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                  />
                  <div className="flex gap-2 mt-4">
                      <button 
                        onClick={handleReviewSubmit}
                        disabled={isSubmittingReview || newRating === 0}
                        className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg disabled:opacity-50"
                      >
                          {isSubmittingReview ? 'Submitting...' : 'Post Review'}
                      </button>
                      <button onClick={() => setIsReviewFormOpen(false)} className="px-6 py-3 text-gray-500 font-bold">Cancel</button>
                  </div>
              </div>
          )}

          <div className="space-y-4">
              {reviews.length > 0 ? reviews.map((review, idx) => (
                  <div key={idx} className="p-4 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-50 dark:border-gray-800">
                      <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-sm dark:text-white">{review.author}</span>
                          <div className="flex text-xs">
                              {[...Array(5)].map((_, i) => (
                                  <span key={i} className={i < review.rating ? 'text-accent-yellow' : 'text-gray-200'}>★</span>
                              ))}
                          </div>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-sm italic">"{review.comment}"</p>
                      <p className="text-[10px] text-gray-400 mt-2 font-bold">{review.date}</p>
                  </div>
              )) : (
                  <div className="text-center py-10 text-gray-400 text-sm italic">
                      No reviews yet. Be the first to buy and share your experience!
                  </div>
              )}
          </div>
      </SectionWrapper>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-dark-surface border-t border-gray-200 dark:border-gray-800 p-4 md:hidden z-50 flex gap-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
          <button 
            onClick={() => { if (!user) { alert("Please login to chat."); return; } onNavigate('chats', { targetUser: { id: listing.vendorId, name: vendorData?.shopName || listing.vendorName } }); }} 
            className="flex-1 py-3.5 bg-white dark:bg-gray-800 border-2 border-primary text-primary font-black rounded-xl text-sm"
          >
              CHAT
          </button>
          <button 
            onClick={() => setContactPopup({ isOpen: true, type: 'call', number: vendorData?.phone || listing.contact.phone })} 
            className="flex-1 py-3.5 bg-primary text-white font-black rounded-xl text-sm text-center shadow-lg shadow-primary/30"
          >
              CALL
          </button>
      </div>

      {contactPopup?.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setContactPopup(null)}>
              <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden transform animate-pop-in" onClick={e => e.stopPropagation()}>
                  <div className="p-6 text-center bg-primary text-white">
                      <h4 className="text-lg font-bold">Contact Seller</h4>
                  </div>
                  <div className="p-6 text-center">
                      <p className="text-gray-500 text-xs uppercase font-bold tracking-widest mb-2">Number</p>
                      <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6 select-all">{contactPopup.number}</h2>
                      <div className="space-y-3">
                          <a href={`tel:${contactPopup.number}`} className="block w-full py-3.5 rounded-xl font-bold text-white bg-primary shadow-lg">Call Now</a>
                          <button onClick={() => setContactPopup(null)} className="block w-full py-3 text-gray-500 font-bold">Close</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ListingDetailsPage;
