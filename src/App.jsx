import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Download, Upload, Music, Trash2, X, Plus, Disc3, Lock, LogOut, File, FileText, FileArchive, Image as ImageIcon, Loader2 } from 'lucide-react';

// --- SUPABASE IMPORTS (Commented for Preview Compatibility) ---
// import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CONFIGURATION ---
// IMPORTANT: Before deploying to Vercel, UNCOMMENT the code below and delete the fallback!
// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialize Supabase only if the config exists
let supabase = null;
// if (supabaseUrl && supabaseKey) {
//   supabase = createClient(supabaseUrl, supabaseKey);
// } else {
//   console.error("Supabase initialization error. Did you forget your .env file?");
// }

export default function App() {
  // App State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  // File & Audio State
  const [files, setFiles] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  const audioRef = useRef(null);

  // --- FETCH FILES FROM SUPABASE ---
  const fetchFiles = async () => {
    if (!supabase) {
      setIsLoadingFiles(false);
      return;
    }

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

  // Handle Play/Pause synchronization
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

  const handleTimeUpdate = () => {
    if (audioRef.current) setProgress(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

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

  const audioFiles = files.filter(f => f.isAudio);

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

  // --- DELETE FILE FROM SUPABASE ---
  const deleteFile = async (file) => {
    if (!window.confirm(`Are you sure you want to delete "${file.title}"?`)) return;

    try {
      // 1. Delete from Storage bucket
      const { error: storageError } = await supabase.storage
        .from('uploads')
        .remove([file.storagePath]);

      if (storageError) throw storageError;

      // 2. Delete from Database table
      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      // 3. Update local state immediately
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

  // Admin Login
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-28 selection:bg-purple-500/30">
      {currentAudio && (
        <audio
          ref={audioRef}
          src={currentAudio.url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
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
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full font-medium hover:bg-neutral-200 transition-colors text-sm sm:text-base"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Upload File</span>
                </button>
                <button
                  onClick={() => setIsAdmin(false)}
                  className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium"
              >
                <Lock className="w-4 h-4" />
                Admin Login
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
              {isAdmin 
                ? "Welcome back, Praiz. You can upload tracks, beat packs, stems, and documents here." 
                : "The official hub for all my latest tracks and exclusive files. Listen, vibe, and download directly."}
            </p>
          </div>
        </div>

        {/* Files List */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
            Available Files 
            {!isLoadingFiles && <span className="text-sm font-medium text-neutral-500 bg-neutral-900 px-2 py-1 rounded-full">{files.length}</span>}
          </h3>
          
          {isLoadingFiles ? (
             <div className="flex justify-center items-center py-20">
               <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
             </div>
          ) : files.length === 0 ? (
            <div className="border border-dashed border-neutral-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-neutral-900/20">
              <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mb-4">
                <File className="w-8 h-8 text-neutral-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No files available yet</h3>
              <p className="text-neutral-400 max-w-sm mb-6">
                {isAdmin 
                  ? "Your hub is empty. Upload your first track or file to share it with your fans." 
                  : "Praiz hasn't uploaded any files yet. Check back soon!"}
              </p>
              {isAdmin && (
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-full font-medium hover:bg-purple-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Upload First File
                </button>
              )}
            </div>
          ) : (
            <div className="bg-neutral-900/40 rounded-2xl border border-neutral-800 overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 p-4 text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-800 hidden sm:grid">
                <div className="w-12 text-center">Type</div>
                <div>Name</div>
                <div className="w-24 text-right pr-4">Size</div>
                <div className="w-32 text-center">Actions</div>
              </div>
              
              <div className="divide-y divide-neutral-800/50">
                {files.map((file) => {
                  const isThisPlaying = currentAudio?.id === file.id && isPlaying;
                  return (
                    <div 
                      key={file.id} 
                      className={`group flex items-center gap-3 sm:grid sm:grid-cols-[auto_1fr_auto_auto] sm:gap-4 p-3 sm:p-4 hover:bg-neutral-800/50 transition-colors rounded-lg sm:rounded-none mx-2 sm:mx-0 my-1 sm:my-0 ${currentAudio?.id === file.id ? 'bg-neutral-800/80' : ''}`}
                    >
                      <div className="w-10 sm:w-12 flex items-center justify-center shrink-0">
                        {file.isAudio ? (
                          <button
                            onClick={() => togglePlayPause(file)}
                            className={`w-8 h-8 flex items-center justify-center rounded-full ${isThisPlaying ? 'bg-purple-500 text-white' : 'bg-neutral-800 text-neutral-300 group-hover:bg-white group-hover:text-black transition-all shadow-sm'}`}
                          >
                            {isThisPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </button>
                        ) : (
                          <div className="w-8 h-8 flex items-center justify-center rounded bg-neutral-800 text-neutral-400">
                            {getFileIcon(file.fileType)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className={`font-medium truncate ${currentAudio?.id === file.id ? 'text-purple-400' : 'text-neutral-100'}`}>
                          {file.title}
                        </p>
                        <p className="text-sm text-neutral-500 truncate">
                          {file.isAudio ? 'Audio Track' : file.fileName.split('.').pop().toUpperCase() + ' File'}
                        </p>
                      </div>

                      <div className="w-24 text-right pr-4 text-sm text-neutral-400 hidden sm:flex items-center justify-end">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          download={file.fileName}
                          className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-white hover:text-black text-neutral-300 rounded-full transition-all text-sm font-medium"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">Download</span>
                        </a>
                        {isAdmin && (
                          <button
                            onClick={() => deleteFile(file)}
                            className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors ml-2"
                            title="Delete File"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-6 relative">
            <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4 mx-auto">
              <Lock className="w-6 h-6 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-center mb-2">Admin Access</h2>
            <p className="text-neutral-400 text-sm text-center mb-6">Enter your password to manage files.</p>
            
            <form onSubmit={handleLogin}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 mb-4"
                autoFocus
              />
              {loginError && <p className="text-red-400 text-sm mb-4 text-center">{loginError}</p>}
              <button
                type="submit"
                className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                Unlock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal (Admin Only) */}
      {isUploadModalOpen && isAdmin && (
        <UploadModal 
          onClose={() => setIsUploadModalOpen(false)}
          onUploadSuccess={(newFile) => setFiles([newFile, ...files])}
        />
      )}

      {/* Bottom Audio Player */}
      <div className={`fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 p-4 transition-transform duration-300 ease-in-out z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${currentAudio ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
          
          {/* Now Playing Info */}
          <div className="flex items-center gap-3 w-full sm:w-1/3 min-w-0">
            <div className="w-12 h-12 rounded bg-gradient-to-br from-purple-800 to-indigo-900 flex items-center justify-center shrink-0 shadow-inner">
              <Music className="w-6 h-6 text-purple-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white truncate">{currentAudio?.title || "No song playing"}</p>
              <p className="text-xs text-purple-400 truncate font-medium">Now Playing</p>
            </div>
          </div>

          {/* Controls & Scrubber */}
          <div className="flex flex-col items-center w-full sm:w-1/3 max-w-md">
            <div className="flex items-center gap-4 mb-2">
              <button 
                onClick={handlePrevAudio}
                className="text-neutral-400 hover:text-white transition-colors"
                disabled={audioFiles.length <= 1}
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
              <button 
                onClick={() => togglePlayPause()}
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-1 fill-current" />}
              </button>
              <button 
                onClick={handleNextAudio}
                className="text-neutral-400 hover:text-white transition-colors"
                disabled={audioFiles.length <= 1}
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
            </div>
            
            <div className="flex items-center gap-3 w-full text-xs text-neutral-400 font-medium">
              <span className="w-8 text-right">{formatTime(progress)}</span>
              <div className="relative flex-1 group flex items-center">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={progress}
                  onChange={handleSeek}
                  className="w-full h-1 bg-neutral-700 rounded-full appearance-none cursor-pointer group-hover:h-1.5 transition-all outline-none z-10 opacity-0 relative"
                />
                <div className="absolute left-0 right-0 h-1 bg-neutral-700 rounded-full group-hover:h-1.5 transition-all">
                  <div 
                    className="absolute left-0 top-0 bottom-0 bg-purple-500 rounded-full transition-all"
                    style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                  ></div>
                </div>
              </div>
              <span className="w-8">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Download Button */}
          <div className="hidden sm:flex items-center justify-end w-1/3 gap-3">
             {currentAudio && (
                <a
                  href={currentAudio.url}
                  target="_blank"
                  rel="noreferrer"
                  download={currentAudio.fileName}
                  className="flex items-center gap-2 text-sm text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded-full transition-all"
                >
                  <Download className="w-4 h-4" />
                  Download Track
                </a>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Upload Modal Component
function UploadModal({ onClose, onUploadSuccess }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please select a file to upload.');
    if (!title.trim()) return setError('Please provide a title.');
    if (!supabase) return setError('Supabase is not connected properly.');

    setIsUploading(true);
    setError('');

    try {
      // 1. Upload to Supabase Storage
      // Generate a clean filename to avoid storage path errors
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${Date.now()}_${safeFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(storagePath);
        
      // Determine if audio
      const isAudio = file.type.startsWith('audio/') || 
                      file.name.toLowerCase().endsWith('.mp3') || 
                      file.name.toLowerCase().endsWith('.wav');

      // 3. Save to Supabase Database
      const fileData = {
        title: title.trim(),
        fileName: file.name,
        fileType: file.type || 'unknown',
        size: file.size,
        url: publicUrl,
        storagePath: storagePath,
        isAudio: isAudio
      };

      const { data: insertedData, error: dbError } = await supabase
        .from('files')
        .insert([fileData])
        .select()
        .single();

      if (dbError) throw dbError;

      onUploadSuccess(insertedData);
      setIsUploading(false);
      onClose(); // Close modal on success

    } catch (err) {
      console.error(err);
      setError('An error occurred during upload. Check console for details.');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <h2 className="text-xl font-bold">Upload File</h2>
          {!isUploading && (
            <button onClick={onClose} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">Display Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Midnight Groove"
                disabled={isUploading}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">File to Share</label>
              <div className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isUploading ? 'border-neutral-700 bg-neutral-950/50' : 'border-neutral-700 hover:border-purple-500/50 cursor-pointer bg-neutral-950/50 group'}`}>
                {!isUploading && (
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                )}
                <Upload className={`w-8 h-8 mx-auto mb-3 transition-colors ${isUploading ? 'text-neutral-600' : 'text-neutral-500 group-hover:text-purple-400'}`} />
                {file ? (
                  <div>
                    <p className="text-white font-medium truncate px-4">{file.name}</p>
                    <p className="text-xs text-neutral-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-neutral-300">Click to browse or drag & drop</p>
                  </div>
                )}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
          
          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-5 py-2.5 rounded-full font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="px-6 py-2.5 rounded-full font-medium bg-white text-black hover:bg-neutral-200 disabled:opacity-50 flex items-center gap-2"
            >
              {isUploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload & Share</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}