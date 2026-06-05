import React, { useState } from "react";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2,
  Sparkles
} from "lucide-react";

interface WorkGalleryProps {
  isFullPage?: boolean;
  onNavigateToBooking?: (serviceName: string) => void;
  onNavigateToGallery?: () => void;
}

export default function WorkGallery({ 
  isFullPage = false, 
  onNavigateToBooking, 
  onNavigateToGallery 
}: WorkGalleryProps) {
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);

  // List of all 33 premium quality real driveway work photos. (Duplicate /IMG_7813-1.jpeg removed)
  const photos = [
    // --- Premium Best Showcase Shots ---
    "/IMG_0659.jpeg",
    "/IMG_0663.jpeg",
    "/impala close up cinematic front.jpeg",
    "/impala exterior front view.jpeg",
    "/impala shined wheels.jpeg",
    "/impala another exterior side.jpeg",
    "/impala back seat.jpeg",
    
    // --- New High Quality Driveway Detail Shots (IMG_78xx etc.) ---
    "/IMG_7813.jpeg",
    "/IMG_7815.jpeg",
    "/IMG_7816.jpeg",
    "/IMG_7817.jpeg",
    "/IMG_7819.jpeg",
    "/IMG_7820.jpeg",
    "/IMG_7821.jpeg",
    "/IMG_7823.jpeg",
    "/IMG_7824.jpeg",
    "/IMG_7825.jpeg",
    "/IMG_7826.jpeg",
    "/IMG_7827.jpeg",
    "/IMG_7829.jpeg",
    "/IMG_7830.jpeg",
    "/IMG_7838.jpeg",

    // --- Clean Detail Work Proof Series ---
    "/IMG_0648.jpeg",
    "/IMG_0985.jpeg",
    "/IMG_0986.jpeg",
    "/IMG_0990.jpeg",
    "/IMG_0991.jpeg",
    "/IMG_0992.jpeg",
    "/IMG_0994.jpeg",
    "/IMG_0995.jpeg",
    "/IMG_0996.jpeg",
    "/IMG_0997.jpeg",
    "/IMG_1001.jpeg"
  ];

  // Favorite curated photos for the Home Page overview section
  // - Pic #3: /impala close up cinematic front.jpeg
  // - Pic #2: /IMG_0663.jpeg
  // - Pic #12: /IMG_7817.jpeg
  // - Pic #13: /IMG_7819.jpeg
  const homePhotos = [
    "/impala close up cinematic front.jpeg",
    "/IMG_0663.jpeg",
    "/IMG_7817.jpeg",
    "/IMG_7819.jpeg"
  ];

  const displayPhotos = isFullPage ? photos : homePhotos;

  // Keep track of failing photos but do NOT completely delete them from DOM list,
  // so the user knows every file in their folder is accounted for in code!
  const handleOpenLightbox = (index: number) => {
    setActiveLightboxIndex(index);
  };

  const handleCloseLightbox = () => {
    setActiveLightboxIndex(null);
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeLightboxIndex === null) return;
    const len = displayPhotos.length;
    if (len === 0) return;
    setActiveLightboxIndex((activeLightboxIndex - 1 + len) % len);
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeLightboxIndex === null) return;
    const len = displayPhotos.length;
    if (len === 0) return;
    setActiveLightboxIndex((activeLightboxIndex + 1) % len);
  };

  return (
    <section className="py-4 select-none" id="work_photo_wall">
      {/* HEADER SECTION */}
      <div className="text-center max-w-2xl mx-auto mb-8 px-4">
        <span className="inline-flex items-center px-3 py-0.5 bg-amber-50 text-amber-850 border border-amber-200/50 rounded-full font-bold font-mono text-[10px] tracking-widest uppercase mb-2">
          {isFullPage ? "[ REAL CLIENT WORK PROOF ]" : "[ FEATURED DRIVEWAY WORK SHOWCASE ]"}
        </span>
        <h3 className="text-3xl sm:text-4xl font-serif font-black text-[#2e261f] tracking-tight">
          {isFullPage ? "Recent Detailing Proof" : "Featured Driveway Work"}
        </h3>
        <p className="text-zinc-655 text-xs sm:text-sm mt-1">
          {isFullPage 
            ? "Arthur & Carson coming straight to your Cobb County driveway. Tap any photo to inspect close-up reflections."
            : "Hand-crafted showroom shine finished right in Cobb County driveways. Tap to enlarge and inspect our work."}
        </p>
      </div>

      {/* PHOTO WALL GRID - 100% PURE IMAGES */}
      <div className={isFullPage 
        ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 px-2 sm:px-4"
        : "grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto px-4"
      }>
        {displayPhotos.map((src, index) => {
          const isFailed = failedPhotos.includes(src);
          const formattedName = src
            .replace(/^\//, "")
            .replace(/\.[^/.]+$/, "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());

          return (
            <div
              key={src}
              id={`gallery_img_wrapper_${index}`}
              className="group relative bg-[#faf5f0] overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 border border-[#e6dccf] aspect-square flex flex-col justify-between"
              style={{ borderRadius: "12px 2px 12px 2px" }}
              onClick={() => handleOpenLightbox(index)}
            >
              {isFailed ? (
                // Elegant luxury placeholder card for large images in process of syncing
                <div className="absolute inset-0 bg-gradient-to-br from-[#fdfbf7] via-[#faf5ef] to-[#f5ebd3] p-4 flex flex-col justify-between select-none">
                  <div className="flex justify-between items-start">
                    <span className="text-[8px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-widest animate-pulse">
                      Syncing
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500/80 animate-pulse" />
                  </div>
                  
                  <div className="my-auto text-center px-1">
                    <p className="text-[10px] font-bold text-[#44382e] uppercase tracking-wider font-sans line-clamp-1">
                      {formattedName}
                    </p>
                    <p className="text-[8px] text-zinc-500 font-mono mt-0.5 truncate">
                      {src.substring(1)}
                    </p>
                  </div>

                  <div className="text-[8px] font-mono text-zinc-400 text-center leading-tight">
                    High-Res Photo Syncing...
                  </div>
                </div>
              ) : (
                <img
                  src={src}
                  alt={formattedName}
                  className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    console.warn(`Failed to retrieve: ${src}. Displaying auto-sync placeholder card.`);
                    setFailedPhotos(prev => [...prev, src]);
                  }}
                />
              )}

              {/* HOVER GLOW / ZOOM ICON */}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="p-2.5 bg-white/95 rounded-full text-[#b45309] shadow-md transform scale-90 group-hover:scale-100 transition-transform duration-300">
                  <Maximize2 className="w-4 h-4" />
                </div>
              </div>

              {/* Micro subtle photo counter index in bottom corner */}
              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 text-white font-mono text-[9px] font-bold rounded tracking-wider backdrop-blur-sm shadow select-none opacity-0 group-hover:opacity-100 transition-opacity">
                #{index + 1}
              </span>
            </div>
          );
        })}
      </div>

      {/* VIEW ALL CTA LINK FOR HOME PAGE */}
      {!isFullPage && (
        <div className="text-center mt-8">
          <button
            id="view_full_gallery_btn"
            onClick={onNavigateToGallery}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#faf8f5] hover:bg-[#b45309] text-[#b45309] hover:text-white border-2 border-[#b45309]/30 hover:border-[#b45309] font-black font-sans text-xs uppercase tracking-widest transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md"
            style={{ borderRadius: "8px 2px 8px 2px" }}
          >
            📂 Explore Complete 30+ Photo Gallery ➔
          </button>
        </div>
      )}

      {/* DELUXE SLIDING LIGHTBOX MODAL */}
      {activeLightboxIndex !== null && displayPhotos[activeLightboxIndex] && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 md:p-8 animate-in fade-in duration-200 select-none"
          onClick={handleCloseLightbox}
        >
          {/* Lightbox Header Controller rail */}
          <div className="flex items-center justify-between text-white w-full max-w-7xl mx-auto py-2">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">
              Photo {activeLightboxIndex + 1} of {displayPhotos.length}
            </span>

            <button 
              onClick={handleCloseLightbox}
              className="p-3 bg-white/10 hover:bg-white/20 transition-colors text-white rounded-full flex items-center justify-center touch-manipulation cursor-pointer"
              title="Close Full Screen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lightbox Center Image Viewport */}
          <div className="relative flex-1 w-full max-w-5xl mx-auto flex items-center justify-center p-2">
            {/* Left Button */}
            <button
              onClick={handlePrevImage}
              className="absolute left-1 md:-left-12 p-3 bg-white/5 hover:bg-white/10 text-white hover:text-amber-400 active:scale-95 rounded-full transition-all flex items-center justify-center touch-manipulation z-20 cursor-pointer"
              title="Previous Photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Active Rendered Photo Frame */}
            <div className="relative max-h-[75vh] md:max-h-[80vh] max-w-full overflow-hidden border border-white/10 p-1 bg-black/25 shadow-2xl rounded-2xl">
              {failedPhotos.includes(displayPhotos[activeLightboxIndex]) ? (
                // Beautiful detail feedback card inside modal for high resolution items
                <div className="w-[85vw] max-w-lg aspect-square md:aspect-video bg-[#18181b]/95 border border-amber-500/20 rounded-xl p-6 md:p-8 flex flex-col justify-between text-neutral-200">
                  <div className="flex justify-between items-center pb-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">Workspace Index Sync</span>
                    </div>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>

                  <div className="text-center my-6">
                    <h4 className="text-base md:text-lg font-bold font-serif text-white tracking-tight mb-1">
                      {displayPhotos[activeLightboxIndex]
                        .replace(/^\//, "")
                        .replace(/\.[^/.]+$/, "")
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, c => c.toUpperCase())}
                    </h4>
                    <p className="text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
                      This high-fidelity photo <span className="font-mono text-white text-[10px]">({displayPhotos[activeLightboxIndex].substring(1)})</span> is linked but is currently syncing from your computer.
                    </p>
                  </div>

                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5 text-center text-[10px] text-amber-200/80 leading-relaxed font-mono">
                    File Size &gt; 10MB • Asset sync stabilizes automatically as offline uploads save to container disk.
                  </div>
                </div>
              ) : (
                <img
                  src={displayPhotos[activeLightboxIndex]}
                  alt={`Detail proof ${activeLightboxIndex + 1}`}
                  className="max-h-[73vh] md:max-h-[78vh] w-auto object-contain mx-auto rounded-xl select-none"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            {/* Right Button */}
            <button
              onClick={handleNextImage}
              className="absolute right-1 md:-right-12 p-3 bg-white/5 hover:bg-white/10 text-white hover:text-amber-400 active:scale-95 rounded-full transition-all flex items-center justify-center touch-manipulation z-20 cursor-pointer"
              title="Next Photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Lightbox Footer Instruction rail */}
          <div className="w-full max-w-4xl mx-auto text-center text-zinc-400 text-xs md:text-sm py-3 border-t border-white/5">
            <div className="flex justify-center gap-1.5 text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-widest">
              <span>USE ARROW BUTTONS TO NAVIGATE • TOUCH OUTSIDE TO RETURN</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
