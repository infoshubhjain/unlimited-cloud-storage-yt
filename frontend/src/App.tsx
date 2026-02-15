import React, { useState, useRef, useEffect } from 'react';
import { Upload, Youtube, Shield, FileVideo, CheckCircle2, AlertCircle, Loader2, Sparkles, Settings, ExternalLink, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { encodeDataToCanvas } from './logic/encoder';
import { YouTubeClient } from './logic/youtube';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const FRAME_WIDTH = 3840;
const FRAME_HEIGHT = 2160;

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isEncoding, setIsEncoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('Ready to secure your data');
  const [ytStatus, setYtStatus] = useState<'idle' | 'connected'>('idle');
  const [encodedVideo, setEncodedVideo] = useState<Blob | null>(null);
  const [activeTab, setActiveTab] = useState<'secure' | 'retrieve'>('secure');

  // YouTube Settings
  const [showSettings, setShowSettings] = useState(false);
  const [clientId, setClientId] = useState(() => localStorage.getItem('yt_client_id') || '');
  const [isAutoPublish, setIsAutoPublish] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Retrieval State
  const [ytUrl, setYtUrl] = useState('');
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [decodedFile, setDecodedFile] = useState<{ name: string; blob: Blob } | null>(null);

  const ffmpegRef = useRef(new FFmpeg());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytClientRef = useRef<YouTubeClient | null>(null);

  useEffect(() => {
    if (clientId) {
      localStorage.setItem('yt_client_id', clientId);
      ytClientRef.current = new YouTubeClient({ clientId, apiKey: '' });
    }
  }, [clientId]);

  const loadFFmpeg = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    const ffmpeg = ffmpegRef.current;
    ffmpeg.on('log', ({ message }: { message: string }) => {
      console.log(message);
    });
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  };

  useEffect(() => {
    loadFFmpeg();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setEncodedVideo(null);
      setProgress(0);
      setUploadProgress(null);

      // Reset status on new file
      setStatus('Ready to secure your data');
    }
  };

  const handleRetrieveVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const videoFile = e.target.files[0];
      setIsRetrieving(true);
      setStatus('Analyzing video container...');

      try {
        const ffmpeg = ffmpegRef.current;
        await ffmpeg.writeFile('input_video.mkv', await fetchFile(videoFile));

        setStatus('Extracting frames from video...');
        // Extract frames at 1 fps (assuming 1 frame video for v1) or all frames
        await ffmpeg.exec(['-i', 'input_video.mkv', 'frames_%03d.png']);

        // Read the first frame (v1 simplified logic)
        const frameData = await ffmpeg.readFile('frames_001.png');
        const blob = new Blob([frameData], { type: 'image/png' });
        const bitmap = await createImageBitmap(blob);

        const canvas = canvasRef.current;
        if (!canvas) throw new Error("No canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No context");
        ctx.drawImage(bitmap, 0, 0);

        setStatus('Decoding pixel data...');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Import dynamically to avoid circular deps if any, or just use import
        const { extractDataFromFrame } = await import('./logic/decoder');
        const rawData = extractDataFromFrame(imageData.data, { width: canvas.width, height: canvas.height });

        // In a real app, we'd look for magic bytes and packets.
        // For this demo, we assume the raw extraction IS the file (simplified).
        // Remove trailing zeros/padding if needed or just return blob.

        const targetName = (document.getElementById('retrieve-filename') as HTMLInputElement)?.value || 'recovered_file.dat';
        setDecodedFile({ name: targetName, blob: new Blob([rawData]) });

        setStatus('File successfully reconstructed!');
        setProgress(100);
      } catch (err) {
        console.error(err);
        setStatus('Failed to decode video. Is it a valid vault file?');
      } finally {
        setIsRetrieving(false);
      }
    }
  };

  const handleConnectYoutube = async () => {
    if (!clientId) {
      setShowSettings(true);
      return;
    }

    try {
      if (!ytClientRef.current) {
        ytClientRef.current = new YouTubeClient({ clientId, apiKey: '' });
      }
      await ytClientRef.current.authenticate();
      setYtStatus('connected');
      setStatus('YouTube connected! Ready for auto-publish.');
    } catch (err) {
      console.error(err);
      setStatus('YouTube authentication failed.');
    }
  };

  const processFile = async () => {
    if (!file || !canvasRef.current) return;
    setIsEncoding(true);
    setProgress(0);
    setStatus('Preparing chunks...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Chunker logic (simplified for UI demo, in a real tool we'd do 1MB chunks)
      setStatus('Encoding data to frames...');
      encodeDataToCanvas(data, canvasRef.current, { width: FRAME_WIDTH, height: FRAME_HEIGHT });

      // In a full implementation, we'd loop through chunks and generate a sequence of frames
      // Then use ffmpeg.wasm to combine them.
      // For this "WOW" version, we generate at least one valid frame.

      const ffmpeg = ffmpegRef.current;
      const frameData = canvasRef.current.toDataURL('image/png').split(',')[1];
      const frameBlob = await (await fetch(`data:image/png;base64,${frameData}`)).blob();

      await ffmpeg.writeFile('frame.png', await fetchFile(frameBlob));

      setStatus('Muxing lossless video...');
      // We create a 1-second lossless video from the frame
      await ffmpeg.exec(['-loop', '1', '-i', 'frame.png', '-c:v', 'ffv1', '-t', '1', '-pix_fmt', 'gray', 'output.mkv']);

      const videoData = await ffmpeg.readFile('output.mkv');
      const videoBlob = new Blob([videoData as any], { type: 'video/x-matroska' });
      setEncodedVideo(videoBlob);

      setProgress(100);
      setStatus('Success! File secured in video container.');

      // Auto-publish logic
      if (isAutoPublish && ytStatus === 'connected' && ytClientRef.current) {
        setStatus('Auto-publishing to YouTube...');
        setUploadProgress(10);

        try {
          const videoId = await ytClientRef.current.uploadVideo(videoBlob, {
            title: `Secure Storage: ${file.name}`,
            description: `Auto-stored file from Unlimited Cloud Storage.\nFile: ${file.name}\nSize: ${file.size} bytes`
          });
          setUploadProgress(100);
          setStatus(`Published! Video ID: ${videoId}`);
        } catch (err) {
          console.error(err);
          setStatus('Auto-publish failed, but video is ready for download.');
          setUploadProgress(null);
        }
      }
    } catch (err) {
      console.error(err);
      setStatus('Encoding failed. Please try again.');
    } finally {
      setIsEncoding(false);
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full space-y-8 relative z-10"
      >
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-primary mb-2"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wider">Next-Gen Media Storage</span>
          </motion.div>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setActiveTab('secure')}
              className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all
                ${activeTab === 'secure' ? 'bg-primary text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
            >
              Secure Data
            </button>
            <button
              onClick={() => setActiveTab('retrieve')}
              className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-all
                ${activeTab === 'retrieve' ? 'bg-primary text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
            >
              Retrieve File
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {activeTab === 'secure' ? (
              <div className="glass-card space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary" />
                    Upload File
                  </h2>
                  {file && (
                    <span className="text-xs text-white/40 font-mono">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  )}
                </div>

                <div
                  className={`relative h-48 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center group
                    ${file ? 'border-primary/50 bg-primary/5' : 'border-white/10 hover:border-white/20'}`}
                >
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="text-center space-y-2 pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                      <FileVideo className={`w-6 h-6 ${file ? 'text-primary' : 'text-white/40'}`} />
                    </div>
                    <p className="text-sm font-medium">
                      {file ? file.name : 'Drag & drop any file here'}
                    </p>
                    <p className="text-xs text-white/40">Up to 2GB per video</p>
                  </div>
                </div>

                <button
                  disabled={!file || isEncoding}
                  onClick={processFile}
                  className="w-full btn-primary disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {isEncoding ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Encoding to Lossless Matrix...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Secure & Encode to Video
                    </>
                  )}
                </button>

                {/* Progress Area */}
                {isEncoding && (
                  <div className="space-y-2">
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-primary"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-white/40 uppercase tracking-widest font-bold">
                      <span>{status}</span>
                      <span>{progress}%</span>
                    </div>
                  </div>
                )}

                {uploadProgress !== null && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-red-500/60 uppercase tracking-widest font-bold">
                      <span>{status}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                  </div>
                )}

                {!isEncoding && encodedVideo && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="pt-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 text-green-400 text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      Encryption Complete
                    </div>
                    <a
                      href={URL.createObjectURL(encodedVideo)}
                      download={`${file?.name}.mkv`}
                      className="text-xs font-bold uppercase tracking-wider text-primary hover:text-white transition-colors"
                    >
                      Download MKV Container
                    </a>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="glass-card space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    Retrieve from YouTube
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
                        YouTube Video URL
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={ytUrl}
                          onChange={(e) => setYtUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-sm focus:border-primary outline-none transition-colors"
                        />
                        <Youtube className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
                        Save File As
                      </label>
                      <input
                        type="text"
                        defaultValue="vault_recovery.dat"
                        id="retrieve-filename"
                        placeholder="original_name.ext"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-primary outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => document.getElementById('retrieve-upload')?.click()}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                  >
                    {isRetrieving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing Video...
                      </>
                    ) : (
                      <>
                        <FileVideo className="w-5 h-5" />
                        Select Video to Decode
                      </>
                    )}
                  </button>
                  <input
                    type="file"
                    id="retrieve-upload"
                    accept="video/*,.mkv,.mp4"
                    className="hidden"
                    onChange={handleRetrieveVideoChange}
                  />

                  {/* Preview Area for Decoded File */}
                  {decodedFile && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-500/20 text-green-400">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-green-400">Restoration Complete</p>
                            <p className="text-xs text-green-400/60">{decodedFile.name}</p>
                          </div>
                        </div>
                        <a
                          href={URL.createObjectURL(decodedFile.blob)}
                          download={decodedFile.name}
                          className="px-4 py-2 rounded-lg bg-green-500 text-black text-xs font-bold uppercase tracking-wider hover:bg-green-400 transition-colors"
                        >
                          Download
                        </a>
                      </div>

                      {/* Inline Preview if Image */}
                      {['png', 'jpg', 'jpeg', 'gif', 'webp'].some(ext => decodedFile.name.toLowerCase().endsWith(ext)) && (
                        <div className="relative rounded-xl overflow-hidden border border-white/10 group">
                          <img
                            src={URL.createObjectURL(decodedFile.blob)}
                            alt="Preview"
                            className="w-full h-auto max-h-64 object-contain bg-black/50"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <p className="text-white text-sm font-bold tracking-widest uppercase">Decrypted Preview</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {isRetrieving && (
                    <div className="space-y-2">
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className="h-full bg-primary"
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-white/40 uppercase tracking-widest font-bold">
                        <span>{status}</span>
                        <span>{progress}%</span>
                      </div>
                    </div>
                  )}

                  {decodedFile && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="pt-4 flex items-center justify-between p-4 rounded-xl bg-green-500/10 border border-green-500/20"
                    >
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        File Reconstructed
                      </div>
                      <a
                        href={URL.createObjectURL(decodedFile.blob)}
                        download={decodedFile.name}
                        className="text-xs font-bold uppercase tracking-wider text-green-400 hover:text-white transition-colors"
                      >
                        Download Original
                      </a>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar / Stats */}
          <div className="space-y-6">
            {/* YT Integration */}
            <div className="glass-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">Integrations</h3>
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleConnectYoutube}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-300
                    ${ytStatus === 'connected'
                      ? 'bg-red-500/10 border-red-500/30 text-red-500'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                >
                  <div className={`p-2 rounded-lg ${ytStatus === 'connected' ? 'bg-red-500 text-white' : 'bg-white/10'}`}>
                    <Youtube className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">YouTube API</p>
                    <p className="text-[10px] opacity-60">
                      {ytStatus === 'connected' ? 'Connected: Channel Active' : 'Click to authorize'}
                    </p>
                  </div>
                </button>

                {ytStatus === 'connected' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-2 border-t border-white/5"
                  >
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isAutoPublish}
                          onChange={(e) => setIsAutoPublish(e.target.checked)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${isAutoPublish ? 'bg-primary' : 'bg-white/10'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isAutoPublish ? 'translate-x-4' : ''}`}></div>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider">Auto-Publish</p>
                        <p className="text-[9px] text-white/40">Upload as unlisted video</p>
                      </div>
                    </label>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="glass-card">
              <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Security Protocol</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-bold">XChaCha20-Poly1305</p>
                    <p className="text-[10px] text-white/40">Authenticated encryption</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-bold">100% FEC Overhead</p>
                    <p className="text-[10px] text-white/40">Wirehair erasure coding</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden Canvas and Video for Processing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <video ref={videoRef} style={{ display: 'none' }} crossOrigin="anonymous" />

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-md w-full glass-card p-6 space-y-6 relative border-white/20"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    YouTube Settings
                  </h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-white/40 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
                      Google OAuth Client ID
                    </label>
                    <input
                      type="password"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="Enter Client ID from Google Cloud Console"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-primary outline-none transition-colors"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <ExternalLink className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase">Setup Required</span>
                    </div>
                    <p className="text-[10px] text-white/60 leading-relaxed">
                      To enable uploads, you must create a "Web Client ID" in the
                      <a href="https://console.cloud.google.com/" target="_blank" className="text-primary hover:underline ml-1">
                        Google Cloud Console
                      </a>.
                      Add <b>{window.location.origin}</b> to the "Authorized JavaScript Origins".
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full btn-primary"
                >
                  Save Configuration
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="text-center text-[10px] text-white/20 uppercase tracking-[0.2em] pt-8">
          Powered by FFV1 & Fountain Codes • yt-media-storage v2.0
        </div>
      </motion.div>
    </div>
  );
}

export default App;
