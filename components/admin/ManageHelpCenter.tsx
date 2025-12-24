
import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { HelpCategory, HelpTopic } from '../../types';

const ManageHelpCenter: React.FC = () => {
    const [view, setView] = useState<'categories' | 'topics'>('categories');
    const [categories, setCategories] = useState<HelpCategory[]>([]);
    const [topics, setTopics] = useState<HelpTopic[]>([]);
    const [selectedCat, setSelectedCat] = useState<HelpCategory | null>(null);
    
    // Forms
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [catForm, setCatForm] = useState({ title: '', icon: '❓', order: 1, isActive: true });
    const [topicForm, setTopicForm] = useState({ title: '', content: '', order: 1, isActive: true });
    const [isSaving, setIsSaving] = useState(false);

    // Fetch Level 1: Categories
    useEffect(() => {
        if (!db) return;
        const unsub = onSnapshot(query(collection(db, 'help_categories')), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpCategory));
            data.sort((a, b) => (a.order || 0) - (b.order || 0));
            setCategories(data);
        });
        return () => unsub();
    }, []);

    // Fetch Level 2 & 3: Topics
    useEffect(() => {
        if (!db || !selectedCat) return;
        const unsub = onSnapshot(query(collection(db, 'help_topics')), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpTopic));
            const filteredSorted = data
                .filter(t => t.categoryId === selectedCat.id)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            setTopics(filteredSorted);
        });
        return () => unsub();
    }, [selectedCat]);

    const handleSaveCat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db) return;
        setIsSaving(true);
        try {
            if (isEditing) {
                await updateDoc(doc(db, 'help_categories', isEditing), catForm);
            } else {
                await addDoc(collection(db, 'help_categories'), catForm);
            }
            setIsEditing(null);
            setCatForm({ title: '', icon: '❓', order: 1, isActive: true });
        } catch (e: any) { alert(e.message); }
        finally { setIsSaving(false); }
    };

    const handleSaveTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCat || !db) return;
        setIsSaving(true);
        const payload = { ...topicForm, categoryId: selectedCat.id };
        try {
            if (isEditing) {
                await updateDoc(doc(db, 'help_topics', isEditing), payload);
            } else {
                await addDoc(collection(db, 'help_topics'), payload);
            }
            setIsEditing(null);
            setTopicForm({ title: '', content: '', order: 1, isActive: true });
        } catch (e: any) { alert(e.message); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Help Center Manager</h2>
                    <p className="text-sm text-gray-500">{view === 'categories' ? 'Manage Levels 1 (Categories)' : `Manage Topics for ${selectedCat?.title}`}</p>
                </div>
                
                {view === 'topics' && (
                    <button 
                        onClick={() => { setView('categories'); setSelectedCat(null); setIsEditing(null); }} 
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg font-bold text-sm hover:bg-gray-200 transition-all flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7 7-7" /></svg>
                        Back to Categories
                    </button>
                )}
            </div>

            {view === 'categories' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg h-fit sticky top-6">
                        <h3 className="font-bold text-lg mb-6">{isEditing ? '✏️ Edit Category' : '➕ Add Main Category'}</h3>
                        <form onSubmit={handleSaveCat} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Title</label>
                                <input className="w-full p-3 border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={catForm.title} onChange={e => setCatForm({...catForm, title: e.target.value})} required placeholder="e.g. Account Help" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Icon (Emoji)</label>
                                    <input className="w-full p-3 border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white text-center text-xl" value={catForm.icon} onChange={e => setCatForm({...catForm, icon: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Priority (1-10)</label>
                                    <input className="w-full p-3 border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white" type="number" value={catForm.order} onChange={e => setCatForm({...catForm, order: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="catActive" checked={catForm.isActive} onChange={e => setCatForm({...catForm, isActive: e.target.checked})} className="w-5 h-5 rounded" />
                                <label htmlFor="catActive" className="text-sm dark:text-gray-300">Category is Live</label>
                            </div>
                            <button type="submit" disabled={isSaving} className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-all">
                                {isSaving ? 'Saving...' : (isEditing ? 'Update Category' : 'Save Main Category')}
                            </button>
                        </form>
                    </div>

                    <div className="space-y-3">
                        {categories.map(c => (
                            <div key={c.id} className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-2xl">{c.icon}</div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 dark:text-white">{c.title}</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] uppercase font-bold text-gray-400">Order: {c.order}</span>
                                            <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setSelectedCat(c); setView('topics'); setIsEditing(null); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg font-bold text-xs uppercase tracking-tighter">Topics</button>
                                    <button onClick={() => { setIsEditing(c.id); setCatForm({ title: c.title, icon: c.icon, order: c.order, isActive: c.isActive }); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg></button>
                                    <button onClick={() => deleteDoc(doc(db, 'help_categories', c.id))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg h-fit sticky top-6">
                        <h3 className="font-bold text-lg mb-6">Editing Topics for: <span className="text-primary">{selectedCat?.title}</span></h3>
                        <form onSubmit={handleSaveTopic} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Sub-point Title (Level 2)</label>
                                <input className="w-full p-3 border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={topicForm.title} onChange={e => setTopicForm({...topicForm, title: e.target.value})} required placeholder="How to..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Detailed Content (Level 3)</label>
                                <textarea className="w-full p-3 border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white h-48 resize-none" value={topicForm.content} onChange={e => setTopicForm({...topicForm, content: e.target.value})} required placeholder="The full help text goes here..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Display Order</label>
                                    <input className="w-full p-3 border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-white" type="number" value={topicForm.order} onChange={e => setTopicForm({...topicForm, order: Number(e.target.value)})} />
                                </div>
                                <div className="flex items-center gap-2 pt-5">
                                    <input type="checkbox" id="topicActive" checked={topicForm.isActive} onChange={e => setTopicForm({...topicForm, isActive: e.target.checked})} className="w-5 h-5" />
                                    <label htmlFor="topicActive" className="text-sm dark:text-gray-300">Active</label>
                                </div>
                            </div>
                            <button type="submit" disabled={isSaving} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all">
                                {isSaving ? 'Saving...' : (isEditing ? 'Update Topic' : 'Add Topic')}
                            </button>
                        </form>
                    </div>

                    <div className="space-y-4">
                        {topics.map(t => (
                            <div key={t.id} className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm group relative">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-gray-800 dark:text-white">{t.title}</h4>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setIsEditing(t.id); setTopicForm({ title: t.title, content: t.content, order: t.order, isActive: t.isActive }); }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg></button>
                                        <button onClick={() => deleteDoc(doc(db, 'help_topics', t.id))} className="p-2 text-red-400 hover:bg-red-50 p-1.5 rounded"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed border-t dark:border-gray-700 pt-2">{t.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageHelpCenter;
