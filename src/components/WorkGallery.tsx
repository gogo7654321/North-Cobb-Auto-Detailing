import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, storage } from "../lib/firebase";
import { ref, listAll, getDownloadURL } from "firebase/storage";
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

interface PhotoItem {
  id: string;
  url: string;
  name: string;
  caption?: string;
  isDynamic?: boolean;
}

export default function WorkGallery({ 
  isFullPage = false, 
  onNavigateToBooking, 
  onNavigateToGallery 
}: WorkGalleryProps) {
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const [dynamicPhotos, setDynamicPhotos] = useState<any[]>([]);

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
  const homePhotos = [
    "/impala close up cinematic front.jpeg",
    "/IMG_0663.jpeg",
    "/IMG_7817.jpeg",
    "/IMG_7819.jpeg"
  ];

  const [storagePhotos, setStoragePhotos] = useState<{name: string, url: string}[]>([]);

  // Scan Firebase Storage bucket under 'gallery' prefix on load
  useEffect(() => {
    const scanStorage = async () => {
      try {
        const storageRef = ref(storage, "gallery");
        const res = await listAll(storageRef);
        const files = await Promise.all(
          res.items.map(async (item) => {
            try {
              const url = await getDownloadURL(item);
              return { name: item.name, url };
            } catch (e) {
              return { name: item.name, url: "" };
            }
          })
        );
        setStoragePhotos(files.filter(f => f.url));
      } catch (err) {
        console.warn("Storage scanning on gallery skipped:", err);
      }
    };
    scanStorage();
  }, []);

  // Fetch custom dynamic uploads via direct live subscription (bypassing Client rules restrictions where possible, else fallback to API)
  useEffect(() => {
    const fetchDynamicPhotos = async () => {
      try {
        const response = await fetch("/api/gallery-images");
        if (response.ok) {
          const data = await response.json();
          setDynamicPhotos(data);
        } else {
          console.error("API error loading dynamic photos:", response.statusText);
        }
      } catch (error) {
        console.error("Failed to load customer dynamic photos via API: ", error);
      }
    };

    // Try client-side direct live subscription first
    const q = query(collection(db, "gallery_images"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      setDynamicPhotos(items);
    }, (err) => {
      console.warn("Client subscription to gallery_images failed, engaging proxy API polling:", err);
      fetchDynamicPhotos();
      const interval = setInterval(fetchDynamicPhotos, 12000);
      return () => clearInterval(interval);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const formatStorageName = (fileName: string) => {
    let clean = fileName;
    if (clean.startsWith("migrated_")) {
      clean = clean.replace(/^migrated_/, "");
    }
    clean = clean.replace(/^\d+_+/, "");
    clean = clean.replace(/\.[^/.]+$/, "");
    clean = clean.replace(/[_-]/g, " ");
    return clean.replace(/\b\w/g, c => c.toUpperCase());
  };

  const resolveFileUrl = (localPath: string) => {
    const cleanName = localPath.replace(/^\//, ""); // e.g. "IMG_0659.jpeg"
    const target = cleanName.toLowerCase();
    const storageMatch = storagePhotos.find((item) => {
      const sName = item.name.toLowerCase();
      return sName === target || sName.endsWith(`_${target}`) || sName.includes(target);
    });
    if (storageMatch) {
      return storageMatch.url;
    }
    // If scanning hasn't finished, or it's not custom, return the original
    return localPath;
  };

  // Map local static photos to consistent PhotoItem objects, resolved dynamically
  const shuffledStaticPhotos = React.useMemo(() => {
    const arr = [...photos];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  const shuffledHomePhotos = React.useMemo(() => {
    const arr = [...homePhotos];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  const staticPhotoItems: PhotoItem[] = React.useMemo(() => {
    return shuffledStaticPhotos.map((src, i) => ({
      id: `static-${i}`,
      url: resolveFileUrl(src),
      name: src
        .replace(/^\//, "")
        .replace(/\.[^/.]+$/, "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase()),
      caption: "Driveway work proof",
      isDynamic: false
    }));
  }, [shuffledStaticPhotos, storagePhotos]);

  const homePhotoItems: PhotoItem[] = React.useMemo(() => {
    return shuffledHomePhotos.map((src, i) => ({
      id: `home-${i}`,
      url: resolveFileUrl(src),
      name: src
        .replace(/^\//, "")
        .replace(/\.[^/.]+$/, "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase()),
      caption: "Featured driveway detail",
      isDynamic: false
    }));
  }, [shuffledHomePhotos, storagePhotos]);

  // Merge Firestore-registered photos and raw Storage files
  const dynamicPhotoItems: PhotoItem[] = React.useMemo(() => {
    const list: PhotoItem[] = dynamicPhotos.map(doc => ({
      id: doc.id,
      url: doc.url,
      name: doc.name || "Custom Detail Photo",
      caption: doc.caption || "Dynamic driveway work",
      isDynamic: true
    }));

    storagePhotos.forEach((sFile) => {
      const formattedName = formatStorageName(sFile.name);
      const alreadyIncluded = list.some(p => 
        p.url === sFile.url || p.name === formattedName
      );

      if (!alreadyIncluded) {
        list.push({
          id: `storage-${sFile.name}`,
          url: sFile.url,
          name: formattedName,
          caption: "Dynamic driveway work",
          isDynamic: true
        });
      }
    });

    return list;
  }, [dynamicPhotos, storagePhotos]);

  // Merge so dynamic uploads appear dynamically, deduplicated and filtered for deleted local assets
  const displayPhotos = React.useMemo(() => {
    const rawList = isFullPage 
      ? [...dynamicPhotoItems, ...staticPhotoItems]
      : [...dynamicPhotoItems, ...homePhotoItems];

    const uniqueList: PhotoItem[] = [];
    const seenUrls = new Set<string>();
    const seenNames = new Set<string>();

    rawList.forEach((item) => {
      const url = (item.url || "").trim();
      const lowercaseName = (item.name || "").toLowerCase().trim();

      // Since all local /public images are deleted, anything still starting with "/" is a dead link
      if (!url || url.startsWith("/")) {
        return;
      }

      if (!seenUrls.has(url) && !seenNames.has(lowercaseName)) {
        seenUrls.add(url);
        seenNames.add(lowercaseName);
        uniqueList.push(item);
      }
    });

    // Strictly randomize the overall deduplicated list of active pics so it is fully shuffled across loads
    const shuffledList = [...uniqueList];
    for (let i = shuffledList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledList[i], shuffledList[j]] = [shuffledList[j], shuffledList[i]];
    }

    return isFullPage ? shuffledList : shuffledList.slice(0, 4);
  }, [dynamicPhotoItems, staticPhotoItems, homePhotoItems, isFullPage]);

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
        <span className="inline-flex items-center px-3 py-0.5 bg-amber-50 text-amber-850 border border-amber-200/50 rounded-full font-bold font-sans text-[10px] tracking-widest uppercase mb-2">
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
        {displayPhotos.map((item, index) => {
          const isFailed = failedPhotos.includes(item.url);
          const formattedName = item.name;
          const src = item.url;

          return (
            <div
              key={item.id}
              id={`gallery_img_wrapper_${index}`}
              className="group relative bg-[#faf5f0] overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 border border-[#e6dccf] aspect-square flex flex-col justify-between"
              style={{ borderRadius: "12px 2px 12px 2px" }}
              onClick={() => handleOpenLightbox(index)}
            >
              {isFailed ? (
                // Elegant luxury placeholder card for large images in process of syncing
                <div className="absolute inset-0 bg-gradient-to-br from-[#fdfbf7] via-[#faf5ef] to-[#f5ebd3] p-4 flex flex-col justify-between select-none">
                  <div className="flex justify-between items-start">
                    <span className="text-[8px] font-sans font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-widest animate-pulse">
                      Syncing
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500/80 animate-pulse" />
                  </div>
                  
                  <div className="my-auto text-center px-1">
                    <p className="text-[10px] font-bold text-[#44382e] uppercase tracking-wider font-sans line-clamp-1">
                      {formattedName}
                    </p>
                    <p className="text-[8px] text-zinc-500 font-sans mt-0.5 truncate">
                      {src.substring(0, 30)}...
                    </p>
                  </div>

                  <div className="text-[8px] font-sans text-zinc-400 text-center leading-tight">
                    High-Res Photo Syncing...
                  </div>
                </div>
              ) : (
                <img
                  src={src}
                  alt={`${formattedName} - North Cobb Detailing - Premium Mobile Car Detailing in Kennesaw & Acworth GA`}
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
              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 text-white font-sans text-[9px] font-bold rounded tracking-wider backdrop-blur-sm shadow select-none opacity-0 group-hover:opacity-100 transition-opacity">
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
            <span className="text-xs font-sans font-bold text-amber-400 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">
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
              {failedPhotos.includes(displayPhotos[activeLightboxIndex].url) ? (
                // Beautiful detail feedback card inside modal for high resolution items
                <div className="w-[85vw] max-w-lg aspect-square md:aspect-video bg-[#18181b]/95 border border-amber-500/20 rounded-xl p-6 md:p-8 flex flex-col justify-between text-neutral-200">
                  <div className="flex justify-between items-center pb-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      <span className="text-[10px] font-sans font-bold text-amber-400 uppercase tracking-widest">Workspace Index Sync</span>
                    </div>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>

                  <div className="text-center my-6">
                    <h4 className="text-base md:text-lg font-bold font-serif text-white tracking-tight mb-1">
                      {displayPhotos[activeLightboxIndex].name}
                    </h4>
                    <p className="text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
                      This photo is currently syncing from cloud server.
                    </p>
                  </div>

                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5 text-center text-[10px] text-amber-200/80 leading-relaxed font-sans">
                    High resolution media loading dynamically.
                  </div>
                </div>
              ) : (
                <img
                  src={displayPhotos[activeLightboxIndex].url}
                  alt={`${displayPhotos[activeLightboxIndex].name} - North Cobb Detailing`}
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
            <div className="flex justify-center gap-1.5 text-[10px] font-sans text-zinc-500 font-bold uppercase tracking-widest">
              <span>USE ARROW BUTTONS TO NAVIGATE • TOUCH OUTSIDE TO RETURN</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
