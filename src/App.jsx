import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Download, Upload, Music, Trash2, X, Plus, Disc3, Lock, LogOut, File, FileText, FileArchive, Image as ImageIcon, Loader2, AlignLeft, Share2, Check } from 'lucide-react';
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
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  const [files, setFiles] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeLyrics, setActiveLyrics] = useState(null); 
  const [toastMessage, setToastMessage] = useState(''); 
  const [showFeaturedVideo, setShowFeaturedVideo] = useState(true); // Control floating video
  
  const audioRef = useRef(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleShare = async (file) => {
    const shareData = {
      title: `${file.title} on Praiz Hub`,
      text: `Listen to "${file.title}" and download it directly on Praiz Hub! 🎵`,
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        setToastMessage("Link copied to clipboard!");
      } catch (err) {
        console.error("Failed to copy", err);
        setToastMessage("Failed to copy link.");
      }
    }
  };

  const fetchFiles = async () => {
    if (!supabase) return setIsLoadingFiles(false);
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
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

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

  const togglePlayPause = (file = null) => {
    if (file && !file.isAudio) return; 
    if (file) {
      if (currentAudio?.id === file.id) {
        setIsPlaying(!isPlaying);
      } else {
        setCurrentAudio(file);
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // FILTER LOGIC: Separate the featured video from regular downloads
  const regularFiles = files.filter(f => !f.isFeaturedVideo);
  const featuredVideo = files.find(f => f.isFeaturedVideo); // Gets the newest featured video
  const audioFiles = regularFiles.filter(f => f.isAudio);

  const handleNextAudio = () => {
    if (!currentAudio || audioFiles.length <= 1) return;
    const currentIndex = audioFiles.findIndex(s => s.id === currentAudio.id);
    const nextIndex = (currentIndex + 1) % audioFiles.length;
    setCurrentAudio(audioFiles[nextIndex]);
    setIsPlaying(true);
  };

  const handlePrevAudio = () => {
    if (!currentAudio || audioFiles.length <= 1) return;
    const currentIndex = audioFiles.findIndex(s => s.id === currentAudio.id);
    const prevIndex = (currentIndex - 1 + audioFiles.length) % audioFiles.length;
    setCurrentAudio(audioFiles[prevIndex]);
    setIsPlaying(true);
  };

  const deleteFile = async (file) => {
    if (!window.confirm(`Are you sure you want to delete "${file.title}"?`)) return;
    try {
      const { error: storageError } = await supabase.storage.from('uploads').remove([file.storagePath]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from('files').delete().eq('id', file.id);
      if (dbError) throw dbError;

      setFiles(files.filter(f => f.id !== file.id));
      if (currentAudio?.id === file.id) {
        setCurrentAudio(null);
        setIsPlaying(false);
        setProgress(0);
        setDuration(0);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Failed to delete file.");
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'Ebenezer1210') {
      setIsAdmin(true);
      setShowLogin(false);
      setPassword('');
      setLoginError('');
    } else {
      setLoginError('Incorrect password.');
    }
  };

  const getFileIcon = (type) => {
    if (type.includes('image')) return <ImageIcon className="w-5 h-5" />;
    if (type.includes('zip') || type.includes('archive') || type.includes('compressed')) return <FileArchive className="w-5 h-5" />;
    if (type.includes('pdf') || type.includes('text')) return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-32 selection:bg-purple-500/30">
      {currentAudio && (
        <audio ref={audioRef} src={currentAudio.url} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleEnded} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Disc3 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Praiz<span className="text-purple-500">Hub</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            {isAdmin ? (
              <>
                <button onClick={() => setIsUploadModalOpen(true)} className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full font-medium hover:bg-neutral-200 transition-colors text-sm sm:text-base">
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Upload</span>
                </button>
                <button onClick={() => setIsAdmin(false)} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm" title="Logout">
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

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="flex flex-col md:flex-row items-start md:items-end gap-6 mb-12">
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 shadow-2xl flex items-center justify-center shrink-0 shadow-purple-900/20">
            <Music className="w-16 h-16 md:w-24 md:h-24 text-white/50" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-2">
              {isAdmin ? 'Admin Dashboard' : 'Official Hub'}
            </p>
            <h2 className="text-4xl md:text-6xl font-extrabold mb-4 tracking-tighter">Praiz</h2>
            <p className="text-neutral-400 max-w-xl text-lg">
              {isAdmin ? "Manage your tracks, lyrics, beat packs, and featured videos here." : "Listen to my latest tracks, read the lyrics, and download directly."}
            </p>
          </div>
        </div>

        {/* Files List */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
            Available Files 
            {!isLoadingFiles && <span className="text-sm font-medium text-neutral-500 bg-neutral-900 px-2 py-1 rounded-full">{regularFiles.length}</span>}
          </h3>
          
          {isLoadingFiles ? (
             <div className="flex justify-center items-center py-20">
               <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
             </div>
          ) : regularFiles.length === 0 ? (
            <div className="border border-dashed border-neutral-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-neutral-900/20">
              <File className="w-12 h-12 text-neutral-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No files yet</h3>
              <p className="text-neutral-500 max-w-sm mb-6">Praiz hasn't uploaded any downloadable files yet. Check back soon!</p>
            </div>
          ) : (
            <div className="bg-neutral-900/40 rounded-2xl border border-neutral-800 overflow-hidden">
              <div className="divide-y divide-neutral-800/50">
                {regularFiles.map((file) => {
                  const isThisPlaying = currentAudio?.id === file.id && isPlaying;
                  const downloadUrl = file.url + '?download=' + encodeURIComponent(file.fileName);

                  return (
                    <div key={file.id} className={`group flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-neutral-800/50 transition-colors ${currentAudio?.id === file.id ? 'bg-neutral-800/80' : ''}`}>
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 flex items-center justify-center shrink-0">
                          {file.isAudio ? (
                            <button onClick={() => togglePlayPause(file)} className={`w-10 h-10 flex items-center justify-center rounded-full ${isThisPlaying ? 'bg-purple-500 text-white' : 'bg-neutral-800 text-neutral-300 group-hover:bg-white group-hover:text-black transition-all shadow-sm'}`}>
                              {isThisPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                            </button>
                          ) : (
                            <div className="w-10 h-10 flex items-center justify-center rounded bg-neutral-800 text-neutral-400">
                              {getFileIcon(file.fileType)}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-lg truncate ${currentAudio?.id === file.id ? 'text-purple-400' : 'text-neutral-100'}`}>
                            {file.title}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-neutral-500 mt-0.5">
                            <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                            {file.lyrics && (
                              <button onClick={() => setActiveLyrics(file)} className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors">
                                <AlignLeft className="w-3.5 h-3.5" /> Lyrics
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end sm:ml-4 border-t sm:border-t-0 border-neutral-800/50 pt-3 sm:pt-0">
                        <button onClick={() => handleShare(file)} className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-white hover:text-black text-neutral-300 rounded-full transition-all text-sm font-medium w-full sm:w-auto justify-center" title="Share">
                          <Share2 className="w-4 h-4" /> <span className="sm:hidden">Share</span>
                        </button>
                        <a href={downloadUrl} download className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-white hover:text-black text-neutral-300 rounded-full transition-all text-sm font-medium w-full sm:w-auto justify-center">
                          <Download className="w-4 h-4" /> Download
                        </a>
                        {isAdmin && (
                          <button onClick={() => deleteFile(file)} className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors ml-1" title="Delete">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Featured Video Player */}
      {featuredVideo && showFeaturedVideo && (
        <div className="fixed bottom-[104px] right-4 sm:right-8 z-30 w-72 sm:w-80 bg-neutral-900 border border-neutral-800 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
          <div className="flex items-center justify-between p-2.5 bg-neutral-950 border-b border-neutral-800">
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider px-1 truncate pr-2">
              {featuredVideo.title}
            </span>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <button onClick={() => deleteFile(featuredVideo)} className="p-1 text-neutral-500 hover:text-red-400 rounded-md transition-colors" title="Delete Featured Video">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setShowFeaturedVideo(false)} className="p-1 text-neutral-500 hover:text-white rounded-md transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="aspect-video w-full bg-black relative">
            <video 
              src={featuredVideo.url} 
              controls 
              autoPlay 
              muted 
              loop 
              className="w-full h-full object-cover"
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
            />
          </div>
        </div>
      )}

      {/* Lyrics Modal */}
      {activeLyrics && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 sm:rounded-2xl rounded-t-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between sticky top-0 bg-neutral-900/95 backdrop-blur z-10">
              <div>
                <h2 className="text-xl font-bold">{activeLyrics.title}</h2>
                <p className="text-sm text-purple-400 font-medium mt-0.5">Lyrics</p>
              </div>
              <button onClick={() => setActiveLyrics(null)} className="p-2 bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <p className="text-neutral-300 whitespace-pre-wrap leading-relaxed text-lg font-medium">
                {activeLyrics.lyrics}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-6 relative">
            <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4 mx-auto">
              <Lock className="w-6 h-6 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-center mb-6">Admin Access</h2>
            <form onSubmit={handleLogin}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 mb-4" autoFocus />
              {loginError && <p className="text-red-400 text-sm mb-4 text-center">{loginError}</p>}
              <button type="submit" className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-neutral-200 transition-colors">Unlock</button>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && isAdmin && (
        <UploadModal 
          onClose={() => setIsUploadModalOpen(false)}
          onUploadSuccess={(newFile) => setFiles([newFile, ...files])}
        />
      )}

      {/* Bottom Audio Player */}
      <div className={`fixed bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur-lg border-t border-neutral-800 p-4 transition-transform duration-300 ease-in-out z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${currentAudio ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
          <div className="flex items-center gap-3 w-full sm:w-1/3 min-w-0">
            <div className="w-12 h-12 rounded bg-gradient-to-br from-purple-800 to-indigo-900 flex items-center justify-center shrink-0">
              <Music className="w-6 h-6 text-purple-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white truncate">{currentAudio?.title}</p>
              <div className="flex items-center gap-2">
                 <p className="text-xs text-purple-400 truncate font-medium">Now Playing</p>
                 {currentAudio?.lyrics && (
                   <button onClick={() => setActiveLyrics(currentAudio)} className="text-xs text-neutral-400 hover:text-white underline decoration-neutral-600 underline-offset-2">Read Lyrics</button>
                 )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center w-full sm:w-1/3 max-w-md">
            <div className="flex items-center gap-6 mb-2">
              <button onClick={handlePrevAudio} className="text-neutral-400 hover:text-white transition-colors" disabled={audioFiles.length <= 1}>
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
              <button onClick={() => togglePlayPause()} className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 ml-1 fill-current" />}
              </button>
              <button onClick={handleNextAudio} className="text-neutral-400 hover:text-white transition-colors" disabled={audioFiles.length <= 1}>
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
            </div>
            <div className="flex items-center gap-3 w-full text-xs text-neutral-400 font-medium">
              <span className="w-8 text-right">{formatTime(progress)}</span>
              <div className="relative flex-1 group flex items-center">
                <input type="range" min={0} max={duration || 100} value={progress} onChange={handleSeek} className="w-full h-1 bg-neutral-700 rounded-full appearance-none cursor-pointer group-hover:h-1.5 transition-all outline-none z-10 opacity-0 relative" />
                <div className="absolute left-0 right-0 h-1 bg-neutral-700 rounded-full group-hover:h-1.5 transition-all">
                  <div className="absolute left-0 top-0 bottom-0 bg-purple-500 rounded-full transition-all" style={{ width: `${(progress / (duration || 1)) * 100}%` }}></div>
                </div>
              </div>
              <span className="w-8">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center justify-end w-1/3 gap-3">
             {currentAudio && (
                <>
                  <button
                    onClick={() => handleShare(currentAudio)}
                    className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-4 py-2.5 rounded-full transition-all"
                  >
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <a
                    href={currentAudio.url + '?download=' + encodeURIComponent(currentAudio.fileName)}
                    download
                    className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-5 py-2.5 rounded-full transition-all"
                  >
                    <Download className="w-4 h-4" /> Download
                  </a>
                </>
             )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-white text-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4 fade-in font-medium">
          <Check className="w-5 h-5 text-green-500" />
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function UploadModal({ onClose, onUploadSuccess }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [lyrics, setLyrics] = useState('');
  const [isFeaturedVideo, setIsFeaturedVideo] = useState(false); // New state for video toggle
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      
      // Auto-check featured video if it's an MP4
      if (selectedFile.type.startsWith('video/')) {
        setIsFeaturedVideo(true);
      } else {
        setIsFeaturedVideo(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please select a file to upload.');
    if (!title.trim()) return setError('Please provide a title.');
    if (!supabase) return setError('Supabase is not connected.');

    setIsUploading(true);
    setError('');

    try {
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
        isFeaturedVideo: isFeaturedVideo // Save the featured flag
      };

      const { data: insertedData, error: dbError } = await supabase.from('files').insert([fileData]).select().single();
      if (dbError) throw dbError;

      onUploadSuccess(insertedData);
      setIsUploading(false);
      onClose(); 
    } catch (err) {
      console.error(err);
      setError('Upload failed. Check console.');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold">Upload Track or Video</h2>
          {!isUploading && (
            <button onClick={onClose} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Midnight Groove or Studio Session" disabled={isUploading} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">File to Upload</label>
              <div className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isUploading ? 'border-neutral-700 bg-neutral-950/50' : 'border-neutral-700 hover:border-purple-500/50 cursor-pointer bg-neutral-950/50 group'}`}>
                {!isUploading && <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />}
                <Upload className={`w-8 h-8 mx-auto mb-3 transition-colors ${isUploading ? 'text-neutral-600' : 'text-neutral-500 group-hover:text-purple-400'}`} />
                {file ? (
                  <div>
                    <p className="text-white font-medium truncate px-4">{file.name}</p>
                    <p className="text-xs text-neutral-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : <p className="text-sm font-medium text-neutral-300">Click to browse or drag & drop</p>}
              </div>
            </div>

            {/* Featured Video Toggle */}
            <div className="flex items-center gap-3 bg-neutral-950 p-4 rounded-lg border border-neutral-800">
              <input 
                type="checkbox" 
                id="featuredVideo" 
                checked={isFeaturedVideo} 
                onChange={(e) => setIsFeaturedVideo(e.target.checked)}
                disabled={isUploading}
                className="w-4 h-4 accent-purple-500 bg-neutral-800 border-neutral-700 rounded"
              />
              <label htmlFor="featuredVideo" className="text-sm font-medium text-neutral-300 cursor-pointer flex-1">
                Set as Floating Featured Video
                <span className="block text-xs text-neutral-500 mt-0.5 font-normal">Check this to play it in the corner and hide it from downloads.</span>
              </label>
            </div>

            {!isFeaturedVideo && (
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5 flex justify-between">
                  <span>Lyrics (Optional for Tracks)</span>
                </label>
                <textarea 
                  value={lyrics} 
                  onChange={(e) => setLyrics(e.target.value)} 
                  placeholder="Paste song lyrics here..." 
                  disabled={isUploading} 
                  rows={4}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 resize-none" 
                />
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
          
          <div className="mt-8 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isUploading} className="px-5 py-2.5 rounded-full font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isUploading || !file} className="px-6 py-2.5 rounded-full font-medium bg-white text-black hover:bg-neutral-200 disabled:opacity-50 flex items-center gap-2">
              {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}