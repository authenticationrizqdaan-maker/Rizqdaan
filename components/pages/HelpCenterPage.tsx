
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { HelpCategory, HelpTopic } from '../../types';

interface HelpCenterPageProps {
    onNavigate: () => void;
}

const HelpCenterPage: React.FC<HelpCenterPageProps> = ({ onNavigate }) => {
    const [categories, setCategories] = useState<HelpCategory[]>([]);
    const [topics, setTopics] = useState<HelpTopic[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);

    useEffect(() => {
        if (!db) return;

        const unsubCats = onSnapshot(query(collection(db, 'help_categories'), where('isActive', '==', true)), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpCategory));
            data.sort((a, b) => a.order - b.order);
            setCategories(data);
        });

        const unsubTopics = onSnapshot(query(collection(db, 'help_topics'), where('isActive', '==', true)), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpTopic));
            data.sort((a, b) => a.order - b.order);
            setTopics(data);
            setLoading(false);
        });

        return () => {
            unsubCats();
            unsubTopics();
        };
    }, []);

    const selectedCategory = categories.find(c => c.id === selectedCategoryId);
    const filteredTopics = topics.filter(t => t.categoryId === selectedCategoryId);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-500 dark:text-gray-400 font-medium">Loading Help Center...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto animate-fade-in pb-10">
            <header className="flex items-center mb-8">
                <button 
                    onClick={() => selectedCategoryId ? setSelectedCategoryId(null) : onNavigate()} 
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white ml-4">
                    {selectedCategoryId ? selectedCategory?.title : 'Help Center'}
                </h1>
            </header>

            {!selectedCategoryId ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategoryId(cat.id)}
                            className="flex items-center p-6 bg-white dark:bg-dark-surface border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all text-left group"
                        >
                            <span className="text-4xl mr-4 group-hover:scale-110 transition-transform">{cat.icon}</span>
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-white text-lg">{cat.title}</h3>
                                <p className="text-sm text-gray-500">Click to view articles</p>
                            </div>
                        </button>
                    ))}
                    {categories.length === 0 && (
                        <div className="col-span-full py-20 text-center text-gray-500">
                            Help categories will be available soon.
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredTopics.length > 0 ? filteredTopics.map((topic) => (
                        <div 
                            key={topic.id} 
                            className="bg-white dark:bg-dark-surface border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm"
                        >
                            <button
                                onClick={() => setExpandedTopicId(expandedTopicId === topic.id ? null : topic.id)}
                                className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                <span className="font-bold text-gray-800 dark:text-white">{topic.title}</span>
                                <svg 
                                    className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${expandedTopicId === topic.id ? 'rotate-180' : ''}`} 
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            
                            <div 
                                className={`overflow-hidden transition-all duration-300 ${expandedTopicId === topic.id ? 'max-h-[1000px] border-t border-gray-50 dark:border-gray-800' : 'max-h-0'}`}
                            >
                                <div className="p-5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line bg-gray-50/50 dark:bg-gray-900/30">
                                    {topic.content || "No detailed information available."}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="py-20 text-center text-gray-500 bg-white dark:bg-dark-surface rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                             Help content for this category will be available soon.
                        </div>
                    )}
                </div>
            )}
            
            <div className="mt-12 p-6 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/20 text-center">
                <h4 className="font-bold text-primary dark:text-teal-400">Need more help?</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-4">Our support team is available on WhatsApp</p>
                <a 
                    href="https://wa.me/923265520658" 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-bold rounded-full hover:bg-green-700 transition-all shadow-md"
                >
                    Contact Support
                </a>
            </div>
        </div>
    );
};

export default HelpCenterPage;
