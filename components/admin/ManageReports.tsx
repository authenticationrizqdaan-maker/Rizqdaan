
import React, { useState, useEffect } from 'react';
import { ListingReport } from '../../types';
import { db } from '../../firebaseConfig';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';

const ManageReports: React.FC = () => {
    const [reports, setReports] = useState<ListingReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, 'reports'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ListingReport));
            data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setReports(data);
            setLoading(false);
        }, (err) => {
            console.error("Reports listener error", err.message);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleIgnore = async (reportId: string) => {
        if (!db) return;
        setProcessingId(reportId);
        try {
            await deleteDoc(doc(db, 'reports', reportId));
            alert("Report ignored and removed.");
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleBlockListing = async (report: ListingReport) => {
        if (!db) return;
        if (!window.confirm("Are you sure you want to BLOCK this listing? it will be hidden from all users.")) return;
        
        setProcessingId(report.id);
        try {
            const batch = writeBatch(db);
            const listingRef = doc(db, 'listings', report.listingId);
            const reportRef = doc(db, 'reports', report.id);
            
            batch.update(listingRef, { status: 'blocked' });
            batch.delete(reportRef);
            
            await batch.commit();
            alert("Listing has been BLOCKED and report resolved.");
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeleteListing = async (report: ListingReport) => {
        if (!db) return;
        if (!window.confirm("DANGER: Permanently DELETE this listing? This cannot be undone.")) return;

        setProcessingId(report.id);
        try {
            const batch = writeBatch(db);
            const listingRef = doc(db, 'listings', report.listingId);
            const reportRef = doc(db, 'reports', report.id);
            
            batch.delete(listingRef);
            batch.delete(reportRef);
            
            await batch.commit();
            alert("Listing has been DELETED permanently.");
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Loading flagged ads...</div>;

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Flagged Content</h2>
                <p className="text-gray-500">Monitor and moderate reported listings from users.</p>
            </div>

            {reports.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border-2 border-dashed dark:border-gray-700">
                    <div className="text-6xl mb-4 opacity-30">🛡️</div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Clean Slate!</h3>
                    <p className="text-gray-500">No reported listings currently in queue.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {reports.map(report => (
                        <div key={report.id} className="bg-white dark:bg-dark-surface border border-red-100 dark:border-red-900/30 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6">
                            <div className="w-full md:w-32 h-32 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 relative">
                                <img src={report.listingImageUrl} className="w-full h-full object-cover" alt="" />
                                <span className="absolute bottom-2 left-2 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">FLAGGED</span>
                            </div>
                            
                            <div className="flex-grow">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-lg dark:text-white line-clamp-1">{report.listingTitle}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md">Reason: {report.reason}</span>
                                            <span className="text-[10px] text-gray-400">ID: {report.listingId}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Reported by: {report.reporterName}</p>
                                        <p className="text-[10px] text-gray-400">{new Date(report.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                                
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 mt-2">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">User Message:</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                                        {report.description ? `"${report.description}"` : "No additional description provided."}
                                    </p>
                                </div>
                                
                                <div className="flex flex-wrap gap-2 mt-6">
                                    <button 
                                        onClick={() => handleBlockListing(report)}
                                        disabled={processingId === report.id}
                                        className="px-4 py-2 bg-yellow-500 text-white font-bold text-xs rounded-lg hover:bg-yellow-600 transition-all flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                        Block Listing
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteListing(report)}
                                        disabled={processingId === report.id}
                                        className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-lg hover:bg-red-700 transition-all flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        Delete Forever
                                    </button>
                                    <div className="flex-grow"></div>
                                    <button 
                                        onClick={() => handleIgnore(report.id)}
                                        disabled={processingId === report.id}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 font-bold text-xs rounded-lg hover:bg-gray-200 transition-all"
                                    >
                                        Ignore Report
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ManageReports;
