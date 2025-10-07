import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Download, X, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

const PhotoSequenceVideo = () => {
  const [photos, setPhotos] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [transitionType, setTransitionType] = useState('dissolve');
  const [photoDuration, setPhotoDuration] = useState(3);
  const [transitionDuration, setTransitionDuration] = useState(1);
  
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (photos.length + files.length > 5) {
      alert('Maximum 5 photos allowed');
      return;
    }
    
    const newPhotos = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      url: URL.createObjectURL(file)
    }));
    
    setPhotos([...photos, ...newPhotos]);
  };

  const removePhoto = (id) => {
    setPhotos(photos.filter(p => p.id !== id));
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
  };

  const movePhoto = (index, direction) => {
    const newPhotos = [...photos];
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < photos.length) {
      [newPhotos[index], newPhotos[newIndex]] = [newPhotos[newIndex], newPhotos[index]];
      setPhotos(newPhotos);
    }
  };

  const loadImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const drawImageCover = (ctx, img, x, y, w, h) => {
    const imgRatio = img.width / img.height;
    const canvasRatio = w / h;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (imgRatio > canvasRatio) {
      drawHeight = h;
      drawWidth = img.width * (h / img.height);
      offsetX = (drawWidth - w) / 2;
      offsetY = 0;
    } else {
      drawWidth = w;
      drawHeight = img.height * (w / img.width);
      offsetX = 0;
      offsetY = (drawHeight - h) / 2;
    }
    
    ctx.drawImage(img, x - offsetX, y - offsetY, drawWidth, drawHeight);
  };

  const applyDissolveTransition = (ctx, img1, img2, progress, canvas) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.globalAlpha = 1 - progress;
    drawImageCover(ctx, img1, 0, 0, canvas.width, canvas.height);
    
    ctx.globalAlpha = progress;
    drawImageCover(ctx, img2, 0, 0, canvas.width, canvas.height);
    
    ctx.globalAlpha = 1;
  };

  const applySlideTransition = (ctx, img1, img2, progress, canvas) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const offset = canvas.width * progress;
    
    ctx.save();
    ctx.translate(-offset, 0);
    drawImageCover(ctx, img1, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    
    ctx.save();
    ctx.translate(canvas.width - offset, 0);
    drawImageCover(ctx, img2, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  const createVideo = async () => {
    if (photos.length < 3) {
      alert('Please select at least 3 photos');
      return;
    }

    setIsCreating(true);
    setProgress(0);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = 1920;
    canvas.height = 1080;

    try {
      const images = await Promise.all(photos.map(p => loadImage(p.url)));
      
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setIsCreating(false);
        setProgress(100);
      };

      mediaRecorder.start();

      const fps = 30;
      const photoFrames = photoDuration * fps;
      const transitionFrames = transitionDuration * fps;
      let currentFrame = 0;
      const totalFrames = (photos.length * photoFrames) + ((photos.length - 1) * transitionFrames);

      const renderFrame = () => {
        if (currentFrame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }

        const photoIndex = Math.floor(currentFrame / (photoFrames + transitionFrames));
        const frameInSegment = currentFrame % (photoFrames + transitionFrames);

        if (frameInSegment < photoFrames) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawImageCover(ctx, images[photoIndex], 0, 0, canvas.width, canvas.height);
        } else if (photoIndex < images.length - 1) {
          const transitionProgress = (frameInSegment - photoFrames) / transitionFrames;
          
          if (transitionType === 'dissolve') {
            applyDissolveTransition(ctx, images[photoIndex], images[photoIndex + 1], transitionProgress, canvas);
          } else {
            applySlideTransition(ctx, images[photoIndex], images[photoIndex + 1], transitionProgress, canvas);
          }
        }

        currentFrame++;
        setProgress(Math.floor((currentFrame / totalFrames) * 100));
        
        requestAnimationFrame(renderFrame);
      };

      renderFrame();
    } catch (error) {
      console.error('Error creating video:', error);
      alert('Error creating video. Please try again.');
      setIsCreating(false);
    }
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `photo-sequence-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
            Photo Sequence Video Creator
          </h1>
          <p className="text-purple-200 text-lg">
            Transform your photos into a stunning video with smooth transitions
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Panel - Upload & Settings */}
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4">Select Photos (3-5)</h2>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={photos.length >= 5}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
              >
                <Upload size={20} />
                {photos.length >= 5 ? 'Maximum Photos Reached' : 'Upload Photos'}
              </button>

              {/* Photo Grid */}
              {photos.length > 0 && (
                <div className="mt-6 space-y-3">
                  {photos.map((photo, index) => (
                    <div key={photo.id} className="bg-white/5 rounded-xl p-3 flex items-center gap-3 border border-white/10">
                      <img src={photo.url} alt={`Photo ${index + 1}`} className="w-20 h-20 object-cover rounded-lg" />
                      <div className="flex-1">
                        <p className="text-white font-medium">Photo {index + 1}</p>
                        <p className="text-purple-200 text-sm">{photo.file.name}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => movePhoto(index, -1)}
                          disabled={index === 0}
                          className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg transition-colors"
                        >
                          <ChevronLeft size={18} className="text-white" />
                        </button>
                        <button
                          onClick={() => movePhoto(index, 1)}
                          disabled={index === photos.length - 1}
                          className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-lg transition-colors"
                        >
                          <ChevronRight size={18} className="text-white" />
                        </button>
                        <button
                          onClick={() => removePhoto(photo.id)}
                          className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
                        >
                          <X size={18} className="text-red-300" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Settings Section */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4">Video Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-purple-200 mb-2">Transition Effect</label>
                  <select
                    value={transitionType}
                    onChange={(e) => setTransitionType(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="dissolve">Dissolve (Fade)</option>
                    <option value="slide">Slide</option>
                  </select>
                </div>

                <div>
                  <label className="block text-purple-200 mb-2">
                    Photo Duration: {photoDuration}s
                  </label>
                  <input
                    type="range"
                    min="2"
                    max="6"
                    step="0.5"
                    value={photoDuration}
                    onChange={(e) => setPhotoDuration(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-purple-200 mb-2">
                    Transition Duration: {transitionDuration}s
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.25"
                    value={transitionDuration}
                    onChange={(e) => setTransitionDuration(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={createVideo}
                disabled={photos.length < 3 || isCreating}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
              >
                <Play size={20} />
                {isCreating ? `Creating Video... ${progress}%` : 'Create Video'}
              </button>

              {videoUrl && (
                <button
                  onClick={downloadVideo}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
                >
                  <Download size={20} />
                  Download Video
                </button>
              )}
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-4">Preview</h2>
            
            <div className="bg-black rounded-xl overflow-hidden aspect-video">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Play size={40} className="text-purple-300" />
                    </div>
                    <p className="text-purple-200">
                      {photos.length < 3 
                        ? 'Upload at least 3 photos to get started'
                        : 'Click "Create Video" to generate your sequence'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {isCreating && (
              <div className="mt-4">
                <div className="bg-white/5 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-purple-200 mt-2 text-sm">
                  Rendering video... This may take a moment
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default PhotoSequenceVideo;
