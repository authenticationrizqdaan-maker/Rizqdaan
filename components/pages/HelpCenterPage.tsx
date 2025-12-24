
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { HelpCategory, HelpTopic } from '../../types';

interface HelpCenterPageProps {
  onNavigate: () => void;
}

const HelpCenterPage: React.FC<HelpCenterPageProps> = ({ onNavigate }) => {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null);
  const [topics, setTopics] = useState<HelpTopic[]>([]);
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // --- FETCH LEVEL 1: CATEGORIES ---
  useEffect(() => {
    if (!db) return;
    // Simplified query to avoid composite index requirement
    const q = query(collection(db, 'help_categories'));
    
    const unsub = onSnapshot(q, (snap) => {
      const allCats = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpCategory));
      
      // Filter and Sort Client-Side to avoid "Missing Index" error
      const activeSorted = allCats
        .filter(c => c.isActive === true)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
        
      setCategories(activeSorted);
      setLoading(false);
    }, (err) => {
        console.error("Categories fetch error:", err.message);
        setLoading(false);
    });
    return () => unsub();
  }, []);

  // --- FETCH LEVEL 2 & 3: TOPICS ---
  useEffect(() => {
    if (!db || !selectedCategory) {
        setTopics([]);
        return;
    }
    setLoading(true);
    // Simplified query to avoid composite index requirement
    const q = query(collection(db, 'help_topics'));

    const unsub = onSnapshot(q, (snap) => {
      const allTopics = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpTopic));
      
      // Filter and Sort Client-Side
      const filteredSorted = allTopics
        .filter(t => t.categoryId === selectedCategory.id && t.isActive === true)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      setTopics(filteredSorted);
      setLoading(false);
    }, (err) => {
        console.error("Topics fetch error:", err.message);
        setLoading(false);
    });
    return () => unsub();
  }, [selectedCategory]);

  return (
    <div className="animate-fade-in pb-20 max-w-3xl mx-auto min-h-[60vh]">
      <header className="flex items-center mb-8">
        <button 
            onClick={() => selectedCategory ? setSelectedCategory(null) : onNavigate()} 
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-2xl font-bold ml-4 text-gray-800 dark:text-white">
            {selectedCategory ? selectedCategory.title : 'Help Center'}
        </h1>
      </header>

      {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
              <p className="text-gray-500">Loading help articles...</p>
          </div>
      ) : !selectedCategory ? (
          /* LEVEL 1: GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-1">
              {categories.length > 0 ? categories.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat)}
                    className="flex items-center p-6 bg-white dark:bg-dark-surface rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all text-left group"
                  >
                      <div className="w-12 h-12 bg-primary/5 dark:bg-primary/10 rounded-xl flex items-center justify-center text-3xl mr-4 group-hover:scale-110 transition-transform">
                          {cat.icon || '❓'}
                      </div>
                      <div className="flex-grow">
                          <h3 className="font-bold text-gray-800 dark:text-white group-hover:text-primary transition-colors">{cat.title}</h3>
                          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold">Articles Available</p>
                      </div>
                      <svg className="w-5 h-5 text-gray-300 group-hover:text-primary transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
              )) : (
                  <div className="col-span-full text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                      <div className="text-4xl mb-4 text-gray-300">📖</div>
                      <h3 className="text-gray-600 dark:text-gray-400 font-bold">Help content will be available soon</h3>
                  </div>
              )}
          </div>
      ) : (
          /* LEVEL 2 & 3: ACCORDION VIEW */
          <div className="space-y-3 px-1 animate-fade-in">
              {topics.length > 0 ? topics.map(topic => (
                  <div key={topic.id} className="bg-white dark:bg-dark-surface rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                      <button 
                        onClick={() => setOpenTopicId(openTopicId === topic.id ? null : topic.id)}
                        className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 group"
                      >
                          <span className={`font-semibold transition-colors ${openTopicId === topic.id ? 'text-primary dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{topic.title}</span>
                          <svg className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${openTopicId === topic.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      <div className={`transition-all duration-300 ease-in-out ${openTopicId === topic.id ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                          <div className="p-5 pt-0 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-50 dark:border-gray-800 leading-relaxed whitespace-pre-line">
                              {topic.content}
                          </div>
                      </div>
                  </div>
              )) : (
                  <div className="text-center py-20 text-gray-500 bg-white dark:bg-dark-surface rounded-2xl border">
                      <p>No specific articles found in this category.</p>
                      <button onClick={() => setSelectedCategory(null)} className="text-primary font-bold mt-4">Go Back</button>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default HelpCenterPage;
