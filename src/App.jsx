import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Download, Upload, Music, 
  Trash2, X, Plus, Disc3, Lock, LogOut, FileArchive, 
  Loader2, AlignLeft, Share2, Check, Heart, Headphones, BookOpen, PenTool, Video, MessageSquare, Mail, Send, User, Mic, Square, Radio, Speaker
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

  // Data States
  const [files, setFiles] = useState([]);
  const [wallMessages, setWallMessages] = useState([]);
  
  // Audio States
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // UI States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeLyrics, setActiveLyrics] = useState(null); 
  const [activeDiary, setActiveDiary] = useState(null); 
  const [toastMessage, setToastMessage] = useState(''); 
  const [activeTab, setActiveTab] = useState('music'); // 'music', 'diary', 'wall'
  
  // Newsletter & Wall Form States
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [fanName, setFanName] = useState('');
  const [fanMessage, setFanMessage] = useState('');
  const [isPostingMessage, setIsPostingMessage] = useState(false);
  
  const [likedItems, setLikedItems] = useState([]);
  const audioRef = useRef(null);

  useEffect(() => {
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

  const fetchAllData = async () => {
    if (!supabase) return setIsLoading(false);
    try {
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select('*')
        .order('uploadDate', { ascending: false });
      if (filesError) throw filesError;
      setFiles(filesData || []);

      const { data: wallData, error: wallError } = await supabase
        .from('fan_wall')
        .select('*')
        .order('created_at', { ascending: false });
      if (wallError) throw wallError;
      setWallMessages(wallData || []);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
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
      
      if (supabase) {
        const newPlays = (file.plays || 0) + 1;
        setFiles(files.map(f => f.id === file.id ? { ...f, plays: newPlays } : f));
        await supabase.from('files').update({ plays: newPlays }).eq('id', file.id);
      }
    }
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
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

  // --- FAN WALL LOGIC ---
  const handlePostMessage = async (e) => {
    e.preventDefault();
    if (!fanName.trim() || !fanMessage.trim()) {
      showToast("Please fill in both fields!");
      return;
    }
    if (!supabase) return showToast("Database disconnected.");

    setIsPostingMessage(true);
    try {
      const newMessage = { fan_name: fanName.trim(), message: fanMessage.trim() };
      const { data, error } = await supabase.from('fan_wall').insert([newMessage]).select().single();
      if (error) throw error;
      
      setWallMessages([data, ...wallMessages]);
      setFanMessage(''); 
      showToast("Message posted!");
    } catch (err) {
      console.error(err);
      showToast("Failed to post message.");
    } finally {
      setIsPostingMessage(false);
    }
  };

  const deleteWallMessage = async (id) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      const { error } = await supabase.from('fan_wall').delete().eq('id', id);
      if (error) throw error;
      setWallMessages(wallMessages.filter(m => m.id !== id));
      showToast("Message deleted.");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete.");
    }
  };

  // --- NEWSLETTER LOGIC ---
  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      showToast("Please enter a valid email.");
      return;
    }
    if (!supabase) return showToast("Database disconnected.");

    setIsSubscribing(true);
    try {
      const { error } = await supabase.from('subscribers').insert([{ email: email.trim() }]);
      if (error) {
        if (error.code === '23505') throw new Error("You are already subscribed!");
        throw error;
      }
      setEmail('');
      showToast("Subscribed successfully! 🎉");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to subscribe.");
    } finally {
      setIsSubscribing(false);
    }
  };

  // --- FILTERING ---
  const featuredVideo = files.find(f => f.isFeaturedVideo);
  const regularFiles = files.filter(f => !f.isFeaturedVideo && !f.isDiary);
  const diaryEntries = files.filter(f => f.isDiary);
  
  // Dynamic audio queue based on what's playing
  const audioFiles = currentAudio?.isDiary ? diaryEntries.filter(f => f.isAudio) : regularFiles.filter(f => f.isAudio);

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
        <div className="relative overflow-hidden rounded-3xl bg-neutral-900/50 border border-white/5 mb-8 flex flex-col md:flex-row shadow-2xl shadow-purple-900/10">
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
            
            {isAdmin && featuredVideo && (
              <button onClick={() => deleteFile(featuredVideo)} className="absolute top-4 right-4 bg-black/60 backdrop-blur p-2 rounded-full text-red-400 hover:text-red-300 transition z-10">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-8 md:p-12 flex flex-col justify-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold tracking-wider uppercase mb-4 w-fit border border-purple-500/20">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
              {isAdmin ? 'Admin Dashboard' : 'Official Platform'}
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight text-white">
              Welcome to the <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Praiz Hub</span>
            </h2>
            <p className="text-neutral-400 text-lg leading-relaxed max-w-md">
              Stream my latest tracks, download exclusive files, listen to my voice notes, and connect with the community.
            </p>
          </div>
        </div>

        {/* 🚨 COMING SOON BANNER */}
        <div className="mb-12 bg-gradient-to-r from-purple-900/40 via-black to-indigo-900/40 border border-purple-500/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group shadow-2xl shadow-purple-900/20">
          <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors"></div>
          <div className="relative z-10 flex items-center gap-6 w-full md:w-auto">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/50 shrink-0 border border-white/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-black/20"></div>
              <Music className="w-8 h-8 text-white relative z-10" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 text-[10px] font-bold tracking-widest uppercase mb-2 border border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Coming Soon
              </div>
              <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">His Grace</h3>
              <p className="text-neutral-400 text-sm font-medium mt-1">New Music dropping soon. Get ready.</p>
            </div>
          </div>
          <div className="relative z-10 w-full md:w-auto shrink-0">
            <button onClick={() => showToast("Pre-save activated! We'll notify you.")} className="w-full md:w-auto px-8 py-3.5 bg-white text-black font-bold rounded-full hover:bg-neutral-200 transition-all shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_40px_rgba(168,85,247,0.5)] flex items-center justify-center gap-2">
               <Check className="w-5 h-5" /> Pre-Save Now
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-6 border-b border-white/5 mb-8 overflow-x-auto custom-scrollbar pb-1">
          <button 
            onClick={() => setActiveTab('music')}
            className={`pb-4 text-sm font-semibold tracking-wide uppercase transition-colors relative whitespace-nowrap ${activeTab === 'music' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Tracks & Files
            {activeTab === 'music' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t-full"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('diary')}
            className={`pb-4 text-sm font-semibold tracking-wide uppercase transition-colors relative whitespace-nowrap ${activeTab === 'diary' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Praiz Diaries
            {activeTab === 'diary' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t-full"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('wall')}
            className={`pb-4 text-sm font-semibold tracking-wide uppercase transition-colors relative whitespace-nowrap flex items-center gap-2 ${activeTab === 'wall' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Fan Wall <span className="bg-white/10 text-white text-[10px] px-2 py-0.5 rounded-full">{wallMessages.length}</span>
            {activeTab === 'wall' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t-full"></div>}
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
        ) : activeTab === 'diary' ? (
          /* DIARIES TAB */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {diaryEntries.length === 0 ? (
               <div className="border border-dashed border-white/10 rounded-3xl p-16 flex flex-col items-center justify-center text-center bg-white/[0.02]">
                 <BookOpen className="w-12 h-12 text-neutral-600 mb-4" />
                 <h3 className="text-xl font-bold mb-2 text-white">No entries yet</h3>
                 <p className="text-neutral-500 max-w-sm">Praiz hasn't dropped any diaries or voice notes yet.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {diaryEntries.map(entry => (
                  <div key={entry.id} className="bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-3xl p-6 transition-all duration-300 flex flex-col hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-900/10 cursor-pointer group" onClick={() => !entry.isAudio && setActiveDiary(entry)}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/20 flex items-center gap-1.5">
                        {entry.isAudio ? <><Mic className="w-3 h-3"/> Voice Note</> : <><BookOpen className="w-3 h-3"/> Text Entry</>}
                      </span>
                      <span className="text-xs text-neutral-500 font-medium">
                        {new Date(entry.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-3 line-clamp-2 leading-tight">{entry.title}</h3>
                    
                    {/* Render Text or Audio Card */}
                    {entry.isAudio ? (
                      <div className="flex-1 flex flex-col justify-center py-2 mb-4">
                        <div className={`relative p-4 rounded-2xl border transition-all overflow-hidden flex items-center gap-3 ${currentAudio?.id === entry.id ? 'bg-purple-500/10 border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.1)]' : 'bg-black/40 border-white/5 group-hover:border-white/10 group-hover:bg-black/60'}`}>
                          {currentAudio?.id === entry.id && isPlaying && (
                             <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-indigo-500/5 animate-pulse"></div>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handlePlayTrack(entry); }} className="relative z-10 w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center justify-center transition-all shadow-lg shadow-purple-900/50 hover:scale-105">
                            {currentAudio?.id === entry.id && isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-1 fill-current" />}
                          </button>
                          
                          <div className="flex-1 flex items-center gap-[3px] h-10 relative z-10 mx-1">
                            {/* Premium Interactive Waveform */}
                            {[30, 45, 60, 40, 75, 55, 85, 65, 40, 90, 70, 50, 80, 45, 60, 35, 75, 50, 85, 60, 40, 65, 30, 45].map((h, i) => {
                              const isPlayingThis = currentAudio?.id === entry.id;
                              const fillPercentage = isPlayingThis && duration > 0 ? (progress / duration) * 100 : 0;
                              const barPercentage = (i / 24) * 100;
                              const isFilled = isPlayingThis && barPercentage <= fillPercentage;

                              return (
                                <div key={i} className="flex-1 flex items-end h-full justify-center">
                                   <div 
                                     className={`w-full max-w-[4px] rounded-full transition-colors duration-150 ${isFilled ? 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]' : 'bg-white/10 group-hover:bg-white/20'} ${isPlayingThis && isPlaying && isFilled && i % 4 === 0 ? 'animate-pulse' : ''}`} 
                                     style={{ height: `${h}%` }}
                                   ></div>
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="text-xs font-mono font-bold relative z-10 shrink-0 min-w-[36px] text-right text-purple-400">
                             {currentAudio?.id === entry.id ? formatTime(progress) : <span className="text-neutral-500 group-hover:text-purple-400/70 transition-colors">Play</span>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-neutral-400 text-sm line-clamp-3 mb-6 flex-1">{entry.content}</p>
                    )}
                    
                    <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                      <button onClick={(e) => { e.stopPropagation(); handleLike(entry); }} className={`hover:text-purple-400 transition-colors flex items-center gap-1.5 text-sm font-medium ${likedItems.includes(entry.id) ? 'text-purple-500' : 'text-neutral-500'}`}>
                        <Heart className={`w-4 h-4 ${likedItems.includes(entry.id) ? 'fill-current' : ''}`} /> {entry.likes || 0}
                      </button>
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleShare(entry, entry.isAudio ? 'Voice Note' : 'Diary'); }} className="p-2 text-neutral-500 hover:text-white rounded-full transition-colors">
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
        ) : (
          /* FAN WALL TAB */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-3xl mx-auto">
              
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 md:p-8 mb-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-400" /> Leave a Message
                </h3>
                <form onSubmit={handlePostMessage} className="space-y-4">
                  <div>
                    <input 
                      type="text" 
                      placeholder="Your Name / Handle" 
                      value={fanName}
                      onChange={(e) => setFanName(e.target.value)}
                      maxLength={30}
                      disabled={isPostingMessage}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                  <div>
                    <textarea 
                      placeholder="Show some love, ask a question, or drop a vibe..." 
                      value={fanMessage}
                      onChange={(e) => setFanMessage(e.target.value)}
                      maxLength={300}
                      rows={3}
                      disabled={isPostingMessage}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 resize-none transition-colors"
                    />
                    <div className="text-right text-xs text-neutral-500 mt-1">{fanMessage.length}/300</div>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="submit" 
                      disabled={isPostingMessage || !fanName.trim() || !fanMessage.trim()}
                      className="px-6 py-2.5 rounded-full font-bold bg-white text-black hover:bg-neutral-200 disabled:opacity-50 flex items-center gap-2 transition-all shadow-lg"
                    >
                      {isPostingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Post Message</>}
                    </button>
                  </div>
                </form>
              </div>

              <div className="space-y-4">
                {wallMessages.length === 0 ? (
                   <div className="text-center py-12 text-neutral-500">
                     No messages yet. Be the first to post on the wall!
                   </div>
                ) : (
                  wallMessages.map(msg => (
                    <div key={msg.id} className="bg-black/50 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors flex gap-4 group">
                      <div className="w-10 h-10 rounded-full bg-purple-900/40 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-white truncate">{msg.fan_name}</p>
                          <span className="text-xs text-neutral-500 whitespace-nowrap ml-2">
                            {new Date(msg.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                      </div>
                      {isAdmin && (
                        <button onClick={() => deleteWallMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-2 text-neutral-600 hover:text-red-400 transition-all h-fit">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Newsletter Section */}
        <div className="mt-20 border-t border-white/5 pt-16 pb-8">
           <div className="bg-gradient-to-br from-purple-900/10 to-indigo-900/10 border border-purple-500/10 rounded-3xl p-8 md:p-12 text-center max-w-3xl mx-auto shadow-2xl shadow-purple-900/5">
             <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-purple-400" />
             </div>
             <h3 className="text-2xl font-extrabold text-white mb-3">Join the Mailing List</h3>
             <p className="text-neutral-400 mb-8 max-w-md mx-auto">
               Subscribe to get notified first when I drop new tracks, exclusive beat packs, or update my diary.
             </p>
             <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
               <input 
                 type="email" 
                 placeholder="Enter your email address" 
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 disabled={isSubscribing}
                 className="flex-1 bg-black border border-white/10 rounded-full px-6 py-3.5 text-white focus:outline-none focus:border-purple-500 transition-colors"
               />
               <button 
                 type="submit" 
                 disabled={isSubscribing || !email.trim()}
                 className="px-8 py-3.5 rounded-full font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 transition-all shadow-lg whitespace-nowrap flex items-center justify-center min-w-[120px]"
               >
                 {isSubscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Subscribe'}
               </button>
             </form>
           </div>
        </div>

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
               {currentAudio?.isDiary ? <Mic className={`w-6 h-6 text-white relative z-10 ${isPlaying ? 'animate-pulse' : ''}`} /> : <Music className={`w-6 h-6 text-white relative z-10 ${isPlaying ? 'animate-pulse' : ''}`} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white truncate text-base">{currentAudio?.title}</p>
              <div className="flex items-center gap-3 mt-0.5">
                 <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                   {isPlaying && <span className="flex gap-0.5 items-end h-3"><span className="w-0.5 h-full bg-purple-400 animate-[bounce_1s_infinite]"></span><span className="w-0.5 h-2/3 bg-purple-400 animate-[bounce_1s_infinite_0.2s]"></span><span className="w-0.5 h-full bg-purple-400 animate-[bounce_1s_infinite_0.4s]"></span></span>}
                   Now Playing {currentAudio?.isDiary && 'Voice Note'}
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
                  {!currentAudio.isDiary && (
                    <a href={currentAudio.url + '?download=' + encodeURIComponent(currentAudio.fileName)} download className="flex items-center gap-2 text-sm font-bold text-black bg-white hover:bg-neutral-200 px-6 py-3 rounded-full transition-all shadow-lg">
                      <Download className="w-4 h-4" /> Download
                    </a>
                  )}
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
  const [diaryMode, setDiaryMode] = useState('text'); // 'text' or 'voice'
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [lyrics, setLyrics] = useState('');
  const [diaryContent, setDiaryContent] = useState('');
  const [isFeaturedVideo, setIsFeaturedVideo] = useState(false);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Voice Note States
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEffect, setVoiceEffect] = useState('none');
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceUrl, setVoiceUrl] = useState('');
  const audioCtxRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let streamToRecord = stream;

      // Only route through Web Audio API if we are actually using an effect.
      // This bypasses the Safari/Chrome 5-second duration bugs for standard recordings.
      if (voiceEffect !== 'none') {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') await ctx.resume();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const dest = ctx.createMediaStreamDestination();

        // Apply Voice FX
        if (voiceEffect === 'echo') {
          const delay = ctx.createDelay();
          delay.delayTime.value = 0.3;
          const feedback = ctx.createGain();
          feedback.gain.value = 0.4;
          source.connect(delay);
          delay.connect(feedback);
          feedback.connect(delay);
          delay.connect(dest);
          source.connect(dest);
        } else if (voiceEffect === 'radio') {
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.value = 1000;
          source.connect(filter);
          filter.connect(dest);
        } else if (voiceEffect === 'studio') {
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowshelf';
          filter.frequency.value = 200;
          filter.gain.value = 10;
          source.connect(filter);
          filter.connect(dest);
        }
        streamToRecord = dest.stream;
      }

      // Find best supported format for the browser
      const options = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
      }

      const recorder = new MediaRecorder(streamToRecord, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setVoiceBlob(blob);
        setVoiceUrl(URL.createObjectURL(blob));
        // Stop the physical microphone
        stream.getTracks().forEach(t => t.stop());
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
           audioCtxRef.current.close();
        }
      };

      recorder.start(); // Recording in one continuous chunk prevents duration header bugs
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
      setError("Microphone access denied or incompatible browser.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Request remaining data before stopping to prevent 0-byte cuts
      try { mediaRecorderRef.current.requestData(); } catch (e) {}
      setTimeout(() => {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }, 100);
    }
  };

  const clearRecording = () => {
    setVoiceBlob(null);
    setVoiceUrl('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setError('Please provide a title.');
    if (!supabase) return setError('Supabase is not connected.');

    setIsUploading(true);
    setError('');

    try {
      let publicUrl = '';
      let storagePath = '';
      let finalFileSize = 0;
      let finalIsAudio = false;

      // Handle File/Blob Upload to Storage
      if (tab === 'media' || (tab === 'diary' && diaryMode === 'voice')) {
        let uploadFile = tab === 'media' ? file : voiceBlob;
        if (!uploadFile) throw new Error(tab === 'media' ? 'Please select a file.' : 'Please record a voice note.');
        if (uploadFile.size === 0) throw new Error('Recording failed (0 bytes). Try using "Raw" FX or a different browser.');
        
        let mimeType = tab === 'media' ? (file.type || 'audio/mpeg') : (voiceBlob.type || 'audio/webm');
        let ext = tab === 'media' ? file.name.split('.').pop() : (mimeType.includes('mp4') ? 'mp4' : 'webm');
        
        const fileNameBase = tab === 'media' ? file.name : `voicenote.${ext}`;
        const safeFileName = fileNameBase.replace(/[^a-zA-Z0-9.-]/g, '_');
        storagePath = `${tab === 'media' ? 'uploads' : 'voice_notes'}/${Date.now()}_${safeFileName}`;
        
        // Supabase upload works best with native File objects with specific mime types
        if (tab === 'diary') {
          uploadFile = new File([voiceBlob], safeFileName, { type: mimeType });
        }
        
        const { error: uploadError } = await supabase.storage.from('uploads').upload(storagePath, uploadFile, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: false
        });
        
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('uploads').getPublicUrl(storagePath);
        publicUrl = data.publicUrl;
        finalFileSize = uploadFile.size;
        
        if (tab === 'media') {
          finalIsAudio = file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3') || file.name.toLowerCase().endsWith('.wav');
        } else {
          finalIsAudio = true; // Voice notes are always audio
        }
      }

      // Handle Database Insertion
      if (tab === 'media') {
        const fileData = {
          title: title.trim(),
          fileName: file.name,
          fileType: file.type || 'unknown',
          size: finalFileSize,
          url: publicUrl,
          storagePath: storagePath,
          isAudio: finalIsAudio,
          lyrics: lyrics.trim() || null,
          isFeaturedVideo: isFeaturedVideo,
          isDiary: false,
          plays: 0,
          likes: 0
        };

        const { data: insertedData, error: dbError } = await supabase.from('files').insert([fileData]).select().single();
        if (dbError) throw dbError;
        onUploadSuccess(insertedData);

      } else {
        // Diary Upload
        if (diaryMode === 'text' && !diaryContent.trim()) throw new Error('Diary content cannot be empty.');
        
        const diaryData = {
          title: title.trim(),
          fileName: diaryMode === 'voice' ? 'voicenote.webm' : 'diary_entry',
          fileType: diaryMode === 'voice' ? 'audio/webm' : 'text',
          size: diaryMode === 'voice' ? finalFileSize : 0,
          url: diaryMode === 'voice' ? publicUrl : '',
          storagePath: diaryMode === 'voice' ? storagePath : '',
          isAudio: diaryMode === 'voice',
          isDiary: true,
          content: diaryMode === 'text' ? diaryContent.trim() : 'Voice Note Diary',
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
             {!isUploading && !isRecording && (
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
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tab === 'media' ? "e.g. Midnight Groove" : "e.g. Thoughts on the new album"} disabled={isUploading || isRecording} className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 transition-colors" />
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
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <button type="button" onClick={() => setDiaryMode('text')} disabled={isRecording || isUploading} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${diaryMode === 'text' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-black text-neutral-500 hover:text-white border border-white/5'}`}><AlignLeft className="w-4 h-4"/> Text</button>
                  <button type="button" onClick={() => setDiaryMode('voice')} disabled={isRecording || isUploading} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${diaryMode === 'voice' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-black text-neutral-500 hover:text-white border border-white/5'}`}><Mic className="w-4 h-4"/> Voice Note</button>
                </div>

                {diaryMode === 'text' ? (
                  <textarea value={diaryContent} onChange={(e) => setDiaryContent(e.target.value)} placeholder="Write your thoughts here..." disabled={isUploading} rows={8} className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 resize-none transition-colors" />
                ) : (
                  <div className="bg-black border border-white/10 rounded-xl p-6 text-center space-y-6">
                    
                    {!voiceBlob && !isRecording && (
                      <div className="flex flex-col items-center gap-4">
                        <label className="text-sm font-bold text-neutral-400">Select Voice FX</label>
                        <div className="flex gap-2">
                           <button type="button" onClick={() => setVoiceEffect('none')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${voiceEffect === 'none' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white'}`}>Raw</button>
                           <button type="button" onClick={() => setVoiceEffect('studio')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${voiceEffect === 'studio' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white'}`}><Speaker className="w-3.5 h-3.5"/> Studio</button>
                           <button type="button" onClick={() => setVoiceEffect('radio')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${voiceEffect === 'radio' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white'}`}><Radio className="w-3.5 h-3.5"/> Radio</button>
                           <button type="button" onClick={() => setVoiceEffect('echo')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${voiceEffect === 'echo' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-400 hover:text-white'}`}>Echo</button>
                        </div>
                        <button type="button" onClick={startRecording} className="mt-4 w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                           <Mic className="w-6 h-6" />
                        </button>
                        <p className="text-sm text-neutral-500">Tap to start recording</p>
                      </div>
                    )}

                    {isRecording && (
                      <div className="flex flex-col items-center gap-4 py-4">
                        <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.6)]">
                           <Mic className="w-6 h-6" />
                        </div>
                        <p className="text-red-400 font-bold tracking-widest uppercase text-sm flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span> Recording (FX: {voiceEffect})
                        </p>
                        <button type="button" onClick={stopRecording} className="mt-2 px-6 py-2.5 bg-white text-black font-bold rounded-full hover:bg-neutral-200 flex items-center gap-2">
                           <Square className="w-4 h-4 fill-current" /> Stop
                        </button>
                      </div>
                    )}

                    {voiceBlob && !isRecording && (
                      <div className="flex flex-col items-center gap-4 py-2">
                        <div className="w-full bg-gradient-to-r from-purple-900/20 to-indigo-900/20 p-6 rounded-3xl border border-purple-500/20 flex flex-col items-center gap-4 shadow-inner">
                          <div className="w-14 h-14 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 relative overflow-hidden">
                            <div className="absolute inset-0 bg-purple-500/10 animate-pulse"></div>
                            <Mic className="w-6 h-6 relative z-10" />
                          </div>
                          <div className="text-center">
                            <h4 className="font-bold text-white text-base">Voice Note Ready</h4>
                            <p className="text-xs text-purple-400 font-bold uppercase tracking-widest mt-1">FX Applied: {voiceEffect}</p>
                          </div>
                          <div className="w-full bg-black/60 p-3 rounded-2xl border border-white/5 mt-2 shadow-lg">
                            <audio src={voiceUrl} controls className="w-full h-10 outline-none" />
                          </div>
                        </div>
                        <button type="button" onClick={clearRecording} disabled={isUploading} className="text-sm text-red-400 hover:text-red-300 font-bold flex items-center gap-1.5 px-5 py-2.5 rounded-full hover:bg-red-400/10 transition-colors">
                          <Trash2 className="w-4 h-4"/> Trash & Record Again
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-red-400 text-sm font-medium bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>}
          </div>
          
          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-white/5">
            <button type="button" onClick={onClose} disabled={isUploading || isRecording} className="px-6 py-3 rounded-xl font-bold text-neutral-400 hover:text-white hover:bg-white/5 disabled:opacity-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isUploading || isRecording || (tab==='media' && !file) || (tab==='diary' && diaryMode==='voice' && !voiceBlob)} className="px-8 py-3 rounded-xl font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 flex items-center gap-2 transition-all shadow-lg shadow-purple-900/30">
              {isUploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Publishing...</> : <><PenTool className="w-5 h-5" /> Publish</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}