import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Download, Upload, Music, 
  Trash2, X, Plus, Disc3, Lock, LogOut, FileArchive, 
  Loader2, AlignLeft, Share2, Check, Heart, Headphones, BookOpen, PenTool, Video
} from 'lucide-react';

import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CONFIGURATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.error("Supabase initialization error. Check your .env file.");
}

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [files, setFiles] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeLyrics, setActiveLyrics] = useState(null); 
  const [activeDiary, setActiveDiary] = useState(null); 
  const [toastMessage, setToastMessage] = useState(''); 
  const [activeTab, setActiveTab] = useState('music'); // 'music' or 'diary'
  
  // Local storage for likes so fans can't spam the like button
  const [likedItems, setLikedItems] = useState([]);

  const audioRef = useRef(null);

  useEffect(() => {
    // Load liked items from local storage on boot
    const savedLikes = localStorage.getItem('praiz_likes');
    if (savedLikes) {
      try { setLikedItems(JSON.parse(savedLikes)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (msg) => setToastMessage(msg);

  const handleShare = async (item, type = 'Track') => {
    const shareData = {
      title: `${item.title} on Praiz Hub`,
      text: `Check out this ${type}: "${item.title}" on Praiz Hub! 🔥`,
      url: window.location.origin,
    };

    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        showToast("Link copied to clipboard!");
      } catch (err) {
        showToast("Failed to copy link.");
      }
    }
  };

  const fetchFiles = async () => {
    if (!supabase) return setIsLoading(false);
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .order('uploadDate', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // --- AUDIO LOGIC ---
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(err => {
        console.error("Playback failed:", err);
        setIsPlaying(false);
      });
    } else if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying, currentAudio]);

  const handleTimeUpdate = () => { if (audioRef.current) setProgress(audioRef.current.currentTime); };
  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration); };
  const handleEnded = () => handleNextAudio();
  const handleSeek = (e) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayTrack = async (file) => {
    if (!file.isAudio) return; 

    if (currentAudio?.id === file.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentAudio(file);
      setIsPlaying(true);
      
      // Increment Plays in Database!
      if (supabase) {
        const newPlays = (file.plays || 0) + 1;
        // Optimistic UI update
        setFiles(files.map(f => f.id === file.id ? { ...f, plays: newPlays } : f));
        // Background DB update
        await supabase.from('files').update({ plays: newPlays }).eq('id', file.id);
      }
    }
  };

  const handleLike = async (file) => {
    if (likedItems.includes(file.id)) {
      showToast("You already liked this!");
      return;
    }

    const newLikes = (file.likes || 0) + 1;
    const newLikedItems = [...likedItems, file.id];
    
    setLikedItems(newLikedItems);
    localStorage.setItem('praiz_likes', JSON.stringify(newLikedItems));
    setFiles(files.map(f => f.id === file.id ? { ...f, likes: newLikes } : f));
    
    if (supabase) {
      await supabase.from('files').update({ likes: newLikes }).eq('id', file.id);
    }
    showToast("Liked! ❤️");
  };

  // --- FILTERING ---
  const featuredVideo = files.find(f => f.isFeaturedVideo);
  const regularFiles = files.filter(f => !f.isFeaturedVideo && !f.isDiary);
  const audioFiles = regularFiles.filter(f => f.isAudio);
  const diaryEntries = files.filter(f => f.isDiary);

  const handleNextAudio = () => {
    if (!currentAudio || audioFiles.length <= 1) return;
    const currentIndex = audioFiles.findIndex(s => s.id === currentAudio.id);
    const nextIndex = (currentIndex + 1) % audioFiles.length;
    handlePlayTrack(audioFiles[nextIndex]);
  };

  const handlePrevAudio = () => {
    if (!currentAudio || audioFiles.length <= 1) return;
    const currentIndex = audioFiles.findIndex(s => s.id === currentAudio.id);
    const prevIndex = (currentIndex - 1 + audioFiles.length) % audioFiles.length;
    handlePlayTrack(audioFiles[prevIndex]);
  };

  const deleteFile = async (file) => {
    if (!window.confirm(`Are you sure you want to delete "${file.title}"?`)) return;
    try {
      if (file.storagePath) {
        const { error: storageError } = await supabase.storage.from('uploads').remove([file.storagePath]);
        if (storageError) throw storageError;
      }
      const { error: dbError } = await supabase.from('files').delete().eq('id', file.id);
      if (dbError) throw dbError;

      setFiles(files.filter(f => f.id !== file.id));
      if (currentAudio?.id === file.id) {
        setCurrentAudio(null);
        setIsPlaying(false);
      }
      showToast("Deleted successfully.");
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Failed to delete.");
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'Ebenezer1210') {
      setIsAdmin(true);
      setShowLogin(false);
      setPassword('');
      setLoginError('');
      showToast("Welcome back, Praiz.");
    } else {
      setLoginError('Incorrect password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 font-sans pb-32 selection:bg-purple-500/30">
      {currentAudio && (
        <audio ref={audioRef} src={currentAudio.url} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleEnded} />
      )}

      {/* Premium Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/20">
              <Disc3 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Praiz<span className="text-purple-500 font-light">Hub</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            {isAdmin ? (
              <>
                <button onClick={() => setIsUploadModalOpen(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-full font-medium transition-all shadow-lg shadow-purple-900/20 text-sm">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Create / Upload</span>
                </button>
                <button onClick={() => setIsAdmin(false)} className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Logout">
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium">
                <Lock className="w-4 h-4" />
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12">
        
        {/* Dynamic Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-neutral-900/50 border border-white/5 mb-12 flex flex-col md:flex-row">
          {/* Left Side: Cinematic Video OR Purple Graphic */}
          <div className="w-full md:w-1/2 aspect-video md:aspect-auto bg-black relative shrink-0 overflow-hidden">
            {featuredVideo ? (
              <video 
                src={featuredVideo.url} 
                controls 
                className="w-full h-full object-cover md:absolute inset-0"
                controlsList="nodownload"
              />
            ) : (
              <div className="w-full h-full md:absolute inset-0 bg-gradient-to-br from-purple-900/40 to-indigo-900/40 flex items-center justify-center">
                <Music className="w-24 h-24 text-purple-500/20" />
              </div>
            )}
            
            {/* Admin Delete Video Button */}
            {isAdmin && featuredVideo && (
              <button onClick={() => deleteFile(featuredVideo)} className="absolute top-4 right-4 bg-black/60 backdrop-blur p-2 rounded-full text-red-400 hover:text-red-300 transition z-10">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right Side: Welcome Text */}
          <div className="p-8 md:p-12 flex flex-col justify-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold tracking-wider uppercase mb-4 w-fit border border-purple-500/20">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
              {isAdmin ? 'Admin Dashboard' : 'Official Platform'}
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight text-white">
              Welcome to the <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Praiz Hub</span>
            </h2>
            <p className="text-neutral-400 text-lg leading-relaxed max-w-md">
              Stream my latest tracks, download exclusive files, and dive into my personal diaries and thoughts.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-6 border-b border-white/5 mb-8">
          <button 
            onClick={() => setActiveTab('music')}
            className={`pb-4 text-sm font-semibold tracking-wide uppercase transition-colors relative ${activeTab === 'music' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Tracks & Files
            {activeTab === 'music' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t-full"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('diary')}
            className={`pb-4 text-sm font-semibold tracking-wide uppercase transition-colors relative ${activeTab === 'diary' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Praiz Diaries
            {activeTab === 'diary' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t-full"></div>}
          </button>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex justify-center items-center py-32">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : activeTab === 'music' ? (
          /* MUSIC & FILES TAB */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {regularFiles.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-3xl p-16 flex flex-col items-center justify-center text-center bg-white/[0.02]">
                <Music className="w-12 h-12 text-neutral-600 mb-4" />
                <h3 className="text-xl font-bold mb-2 text-white">No tracks available</h3>
                <p className="text-neutral-500 max-w-sm">There are no downloadable tracks or files uploaded yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {regularFiles.map((file) => {
                  const isThisPlaying = currentAudio?.id === file.id && isPlaying;
                  const downloadUrl = file.url + '?download=' + encodeURIComponent(file.fileName);

                  return (
                    <div key={file.id} className={`group flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${currentAudio?.id === file.id ? 'bg-purple-900/10 border-purple-500/20' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'}`}>
                      
                      {/* Left: Play Button & Details */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 shrink-0">
                          {file.isAudio ? (
                            <button onClick={() => handlePlayTrack(file)} className={`w-full h-full flex items-center justify-center rounded-xl transition-all shadow-lg ${isThisPlaying ? 'bg-purple-500 text-white shadow-purple-500/20' : 'bg-neutral-800 text-neutral-300 group-hover:bg-white group-hover:text-black'}`}>
                              {isThisPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                            </button>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center rounded-xl bg-neutral-800 text-neutral-400">
                              <FileArchive className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-lg truncate ${currentAudio?.id === file.id ? 'text-purple-400' : 'text-neutral-100'}`}>
                            {file.title}
                          </p>
                          <div className="flex items-center gap-4 text-xs font-medium text-neutral-500 mt-1">
                            {file.isAudio && (
                              <span className="flex items-center gap-1.5"><Headphones className="w-3.5 h-3.5" /> {file.plays || 0}</span>
                            )}
                            <span className="flex items-center gap-1.5"><Heart className={`w-3.5 h-3.5 ${likedItems.includes(file.id) ? 'fill-purple-500 text-purple-500' : ''}`} /> {file.likes || 0}</span>
                            <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                            {file.lyrics && (
                              <button onClick={() => setActiveLyrics(file)} className="text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-500/10 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border border-purple-500/20">
                                Lyrics
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 justify-end sm:ml-4 border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
                        <button onClick={() => handleLike(file)} className={`p-2.5 rounded-full transition-colors ${likedItems.includes(file.id) ? 'text-purple-500 bg-purple-500/10' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`} title="Like">
                          <Heart className={`w-4 h-4 ${likedItems.includes(file.id) ? 'fill-current' : ''}`} />
                        </button>
                        <button onClick={() => handleShare(file, 'Track')} className="p-2.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Share">
                          <Share2 className="w-4 h-4" />
                        </button>
                        <a href={downloadUrl} download className="flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-neutral-200 rounded-full transition-all text-sm font-bold w-full sm:w-auto justify-center shadow-lg">
                          <Download className="w-4 h-4" /> <span className="sm:hidden lg:inline">Download</span>
                        </a>
                        {isAdmin && (
                          <button onClick={() => deleteFile(file)} className="p-2.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors ml-1" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* DIARIES TAB */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {diaryEntries.length === 0 ? (
               <div className="border border-dashed border-white/10 rounded-3xl p-16 flex flex-col items-center justify-center text-center bg-white/[0.02]">
                 <BookOpen className="w-12 h-12 text-neutral-600 mb-4" />
                 <h3 className="text-xl font-bold mb-2 text-white">No entries yet</h3>
                 <p className="text-neutral-500 max-w-sm">Praiz hasn't written any diaries yet. Check back soon for personal updates.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {diaryEntries.map(entry => (
                  <div key={entry.id} className="bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-3xl p-6 transition-all duration-300 flex flex-col hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-900/10 cursor-pointer" onClick={() => setActiveDiary(entry)}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/20">
                        {new Date(entry.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-3 text-neutral-500">
                        <button onClick={(e) => { e.stopPropagation(); handleLike(entry); }} className={`hover:text-purple-400 transition-colors flex items-center gap-1 text-xs font-medium ${likedItems.includes(entry.id) ? 'text-purple-500' : ''}`}>
                          <Heart className={`w-3.5 h-3.5 ${likedItems.includes(entry.id) ? 'fill-current' : ''}`} /> {entry.likes || 0}
                        </button>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 line-clamp-2 leading-tight">{entry.title}</h3>
                    <p className="text-neutral-400 text-sm line-clamp-3 mb-6 flex-1">{entry.content}</p>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                      <span className="text-sm font-bold text-white flex items-center gap-1 group-hover:text-purple-400 transition-colors">
                        Read Entry <SkipForward className="w-3 h-3" />
                      </span>
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleShare(entry, 'Diary'); }} className="p-2 text-neutral-500 hover:text-white rounded-full transition-colors">
                          <Share2 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button onClick={(e) => { e.stopPropagation(); deleteFile(entry); }} className="p-2 text-neutral-500 hover:text-red-400 rounded-full transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Reader Modals (Lyrics & Diaries) */}
      {(activeLyrics || activeDiary) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] border border-white/10 sm:rounded-3xl rounded-t-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
              <div>
                <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">{activeLyrics ? 'Lyrics' : 'Praiz Diary'}</p>
                <h2 className="text-2xl font-extrabold text-white">{(activeLyrics || activeDiary).title}</h2>
              </div>
              <button onClick={() => { setActiveLyrics(null); setActiveDiary(null); }} className="p-2 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar">
              <p className={`text-neutral-300 whitespace-pre-wrap leading-loose ${activeLyrics ? 'text-lg font-medium text-center' : 'text-base font-normal'}`}>
                {activeLyrics ? activeLyrics.lyrics : activeDiary.content}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl p-8 relative">
            <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center mb-6 mx-auto shadow-lg shadow-purple-900/20">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-6 text-white">Admin Access</h2>
            <form onSubmit={handleLogin}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter secure password" className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 mb-4 transition-colors" autoFocus />
              {loginError && <p className="text-red-400 text-sm mb-4 text-center font-medium">{loginError}</p>}
              <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-neutral-200 transition-colors">Unlock Dashboard</button>
            </form>
          </div>
        </div>
      )}

      {/* Smart Upload/Create Modal */}
      {isUploadModalOpen && isAdmin && (
        <UploadModal 
          onClose={() => setIsUploadModalOpen(false)}
          onUploadSuccess={(newItem) => {
            setFiles([newItem, ...files]);
            showToast("Successfully published!");
          }}
        />
      )}

      {/* Bottom Cinematic Audio Player */}
      <div className={`fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-2xl border-t border-white/10 p-4 transition-transform duration-500 ease-out z-50 shadow-[0_-20px_40px_rgba(0,0,0,0.8)] ${currentAudio ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
          
          <div className="flex items-center gap-4 w-full sm:w-1/3 min-w-0">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-purple-900/40 relative overflow-hidden">
               <div className="absolute inset-0 bg-black/20"></div>
               <Music className={`w-6 h-6 text-white relative z-10 ${isPlaying ? 'animate-pulse' : ''}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white truncate text-base">{currentAudio?.title}</p>
              <div className="flex items-center gap-3 mt-0.5">
                 <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                   {isPlaying && <span className="flex gap-0.5 items-end h-3"><span className="w-0.5 h-full bg-purple-400 animate-[bounce_1s_infinite]"></span><span className="w-0.5 h-2/3 bg-purple-400 animate-[bounce_1s_infinite_0.2s]"></span><span className="w-0.5 h-full bg-purple-400 animate-[bounce_1s_infinite_0.4s]"></span></span>}
                   Now Playing
                 </div>
                 {currentAudio?.lyrics && (
                   <button onClick={() => setActiveLyrics(currentAudio)} className="text-xs font-medium text-neutral-400 hover:text-white transition-colors border border-white/10 rounded px-2 py-0.5 bg-white/5">View Lyrics</button>
                 )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center w-full sm:w-1/3 max-w-md">
            <div className="flex items-center gap-8 mb-3">
              <button onClick={handlePrevAudio} className="text-neutral-400 hover:text-white transition-colors" disabled={audioFiles.length <= 1}>
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
              <button onClick={() => togglePlayPause()} className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-xl shadow-white/10">
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 ml-1 fill-current" />}
              </button>
              <button onClick={handleNextAudio} className="text-neutral-400 hover:text-white transition-colors" disabled={audioFiles.length <= 1}>
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
            </div>
            <div className="flex items-center gap-3 w-full text-xs font-bold text-neutral-500">
              <span className="w-10 text-right font-mono tracking-tighter">{formatTime(progress)}</span>
              <div className="relative flex-1 group flex items-center h-4">
                <input type="range" min={0} max={duration || 100} value={progress} onChange={handleSeek} className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer group-hover:h-2 transition-all outline-none z-10 opacity-0 relative" />
                <div className="absolute left-0 right-0 h-1.5 bg-neutral-800 rounded-full group-hover:h-2 transition-all overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full transition-all" style={{ width: `${(progress / (duration || 1)) * 100}%` }}></div>
                </div>
              </div>
              <span className="w-10 font-mono tracking-tighter">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center justify-end w-1/3 gap-3">
             {currentAudio && (
                <>
                  <button onClick={() => handleLike(currentAudio)} className={`p-3 rounded-full transition-colors ${likedItems.includes(currentAudio.id) ? 'bg-purple-500/10 text-purple-500' : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'}`} title="Like">
                     <Heart className={`w-5 h-5 ${likedItems.includes(currentAudio.id) ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={() => handleShare(currentAudio)} className="p-3 text-neutral-400 bg-white/5 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Share">
                    <Share2 className="w-5 h-5" />
                  </button>
                  <a href={currentAudio.url + '?download=' + encodeURIComponent(currentAudio.fileName)} download className="flex items-center gap-2 text-sm font-bold text-black bg-white hover:bg-neutral-200 px-6 py-3 rounded-full transition-all shadow-lg">
                    <Download className="w-4 h-4" /> Download
                  </a>
                </>
             )}
          </div>
        </div>
      </div>

      {/* Global Toast */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-[#1a1a1a] border border-white/10 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in font-medium">
          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
             <Check className="w-4 h-4 text-green-500" />
          </div>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function UploadModal({ onClose, onUploadSuccess }) {
  const [tab, setTab] = useState('media'); // 'media' or 'diary'
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [lyrics, setLyrics] = useState('');
  const [diaryContent, setDiaryContent] = useState('');
  const [isFeaturedVideo, setIsFeaturedVideo] = useState(false);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      if (selectedFile.type.startsWith('video/')) setIsFeaturedVideo(true);
      else setIsFeaturedVideo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setError('Please provide a title.');
    if (!supabase) return setError('Supabase is not connected.');

    setIsUploading(true);
    setError('');

    try {
      if (tab === 'media') {
        if (!file) throw new Error('Please select a file to upload.');
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${Date.now()}_${safeFileName}`;
        
        const { error: uploadError } = await supabase.storage.from('uploads').upload(storagePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(storagePath);
          
        const isAudio = file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3') || file.name.toLowerCase().endsWith('.wav');

        const fileData = {
          title: title.trim(),
          fileName: file.name,
          fileType: file.type || 'unknown',
          size: file.size,
          url: publicUrl,
          storagePath: storagePath,
          isAudio: isAudio,
          lyrics: lyrics.trim() || null,
          isFeaturedVideo: isFeaturedVideo,
          plays: 0,
          likes: 0
        };

        const { data: insertedData, error: dbError } = await supabase.from('files').insert([fileData]).select().single();
        if (dbError) throw dbError;
        onUploadSuccess(insertedData);

      } else {
        // Diary Upload
        if (!diaryContent.trim()) throw new Error('Diary content cannot be empty.');
        
        const diaryData = {
          title: title.trim(),
          fileName: 'diary_entry',
          url: '',
          storagePath: '',
          isDiary: true,
          content: diaryContent.trim(),
          plays: 0,
          likes: 0
        };

        const { data: insertedData, error: dbError } = await supabase.from('files').insert([diaryData]).select().single();
        if (dbError) throw dbError;
        onUploadSuccess(insertedData);
      }
      
      onClose(); 
    } catch (err) {
      console.error(err);
      setError(err.message || 'Upload failed. Check console.');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
        
        <div className="p-6 border-b border-white/5 flex flex-col shrink-0 gap-4">
          <div className="flex items-center justify-between">
             <h2 className="text-2xl font-bold text-white">Create New</h2>
             {!isUploading && (
               <button onClick={onClose} className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                 <X className="w-5 h-5" />
               </button>
             )}
          </div>
          <div className="flex bg-black p-1 rounded-xl border border-white/5 w-full">
            <button type="button" onClick={() => setTab('media')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'media' ? 'bg-purple-600 text-white' : 'text-neutral-500 hover:text-white'}`}>Upload Media</button>
            <button type="button" onClick={() => setTab('diary')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tab === 'diary' ? 'bg-purple-600 text-white' : 'text-neutral-500 hover:text-white'}`}>Write Diary</button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-neutral-300 mb-2">{tab === 'media' ? 'Track / Video Title' : 'Diary Entry Title'}</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tab === 'media' ? "e.g. Midnight Groove" : "e.g. Thoughts on the new album"} disabled={isUploading} className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 transition-colors" />
            </div>
            
            {tab === 'media' ? (
              <>
                <div>
                  <label className="block text-sm font-bold text-neutral-300 mb-2">Media File</label>
                  <div className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${isUploading ? 'border-white/5 bg-black' : 'border-white/10 hover:border-purple-500/50 cursor-pointer bg-black/50 group'}`}>
                    {!isUploading && <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />}
                    <Upload className={`w-10 h-10 mx-auto mb-4 transition-colors ${isUploading ? 'text-neutral-600' : 'text-neutral-500 group-hover:text-purple-400'}`} />
                    {file ? (
                      <div>
                        <p className="text-white font-bold truncate px-4">{file.name}</p>
                        <p className="text-xs font-medium text-purple-400 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB Ready</p>
                      </div>
                    ) : <p className="text-sm font-bold text-neutral-400">Click to browse or drag file here</p>}
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-black p-4 rounded-xl border border-white/5">
                  <input type="checkbox" id="featuredVideo" checked={isFeaturedVideo} onChange={(e) => setIsFeaturedVideo(e.target.checked)} disabled={isUploading} className="w-5 h-5 accent-purple-500 bg-neutral-800 border-neutral-700 rounded cursor-pointer" />
                  <label htmlFor="featuredVideo" className="text-sm font-bold text-white cursor-pointer flex-1">
                    Set as Hero Section Video
                    <span className="block text-xs text-neutral-500 mt-1 font-medium">This pins the video to the top of the site instead of making it a downloadable file.</span>
                  </label>
                </div>

                {!isFeaturedVideo && (
                  <div>
                    <label className="block text-sm font-bold text-neutral-300 mb-2">Lyrics (Optional)</label>
                    <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="Paste lyrics here..." disabled={isUploading} rows={4} className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 resize-none transition-colors" />
                  </div>
                )}
              </>
            ) : (
              <div>
                <label className="block text-sm font-bold text-neutral-300 mb-2">Diary Content</label>
                <textarea value={diaryContent} onChange={(e) => setDiaryContent(e.target.value)} placeholder="Write your thoughts here..." disabled={isUploading} rows={10} className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 resize-none transition-colors" />
              </div>
            )}

            {error && <p className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>}
          </div>
          
          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-white/5">
            <button type="button" onClick={onClose} disabled={isUploading} className="px-6 py-3 rounded-xl font-bold text-neutral-400 hover:text-white hover:bg-white/5 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isUploading || (tab==='media' && !file)} className="px-8 py-3 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 flex items-center gap-2 transition-all shadow-lg shadow-purple-900/30">
              {isUploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Publishing...</> : <><PenTool className="w-5 h-5" /> Publish</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}