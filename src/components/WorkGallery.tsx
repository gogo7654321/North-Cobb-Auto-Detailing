import { useState } from "react";
import { Sparkles, Eye, X, Check, ArrowRight } from "lucide-react";

interface GalleryItem {
  id: string;
  src: string;
  title: string;
  category: "Exterior" | "Interior" | "Full Detailing";
  vehicle: string;
  description: string;
  highlights: string[];
}

export default function WorkGallery() {
  const [activeItem, setActiveItem] = useState<GalleryItem | null>(null);

  const galleryItems: GalleryItem[] = [
    {
      id: "exterior_impala_front",
      src: "/impala exterior front view.jpeg",
      title: "Showroom Mirror Hand-Glaze Finish",
      category: "Exterior",
      vehicle: "Chevrolet Impala (Satin Silver)",
      description: "A showcase of our multi-stage exterior hand cleanse, gentle chemical paint decontamination, and premium sealant glaze. Notice the cloud reflections on the front hood and polished panel rims.",
      highlights: [
        "Premium dual-bucket hand wash & gentle clay bar decontamination",
        "Baked-on tree sap, water spot, and environmental film removal",
        "Front grille micro-brush sanitation and high-line polish",
        "Protected with high-gloss, ultra-UV paint preservation sealant"
      ]
    },
    {
      id: "exterior_impala_side",
      src: "/impala another exterior side.jpeg",
      title: "Left-Flank Panel Reflection Depth",
      category: "Exterior",
      vehicle: "Chevrolet Impala (Satin Silver)",
      description: "Inspecting the deep, fluid-like reflection across the side panels under clear sky. Pure hand microfiber treatment ensures no swirl marks or paint distress.",
      highlights: [
        "Swirl-free manual micro-fiber paint rubdown and glazing",
        "Deep door jamb flush and residual grime sweep",
        "Clean mirror reflections along entire left lateral profile",
        "Treated back to factory standard clearcoat shine"
      ]
    },
    {
      id: "exterior_impala_wheels",
      src: "/impala shined wheels.jpeg",
      title: "Wheel Ceramic Finish & Brake Dust Extraction",
      category: "Exterior",
      vehicle: "Chevrolet Impala (Chrome Alloys)",
      description: "Complete decontamination of the alloy face, wheel barrels, and & brake calipers. Styled with non-splat, anti-static tire dressing for a rich, deep-black satin look.",
      highlights: [
        "Full chemical brake dust extraction & wheel well flush",
        "Intricate alloy face detail wash with ultra-soft wool brushes",
        "Anti-sling, non-sticky polymer tire dressing coat",
        "Long-lasting protective shield against aggressive road salts"
      ]
    },
    {
      id: "interior_impala_console",
      src: "/impala center console.jpeg",
      title: "Piano-Black & Center Console Restored",
      category: "Interior",
      vehicle: "Chevrolet Impala (Charcoal Black)",
      description: "Focusing heavily on electronic interfaces and touch surfaces. Piano-black trim, shift controls, dial gaps, and screens are hand-cleansed to an immaculate matte finish.",
      highlights: [
        "Streak-free polishing of piano-black and metallic trims",
        "Tactile steering wheel seam cleaning & instrument panel dusting",
        "Cup holder enzyme scrub and sticky beverage residue extraction",
        "All vent ducts brushed and cabin air freshened with clean cedar"
      ]
    },
    {
      id: "interior_impala_back_seat",
      src: "/impala back seat.jpeg",
      title: "Prestige Leather Cabin Revitalization",
      category: "Interior",
      vehicle: "Chevrolet Impala (Luxury Jet Black)",
      description: "Thorough deep-vacuuming, extraction, and nutrient conditioning of the leather. Our pH-balanced aloe treatments prevent premature cracking and preserve soft-touch compliance.",
      highlights: [
        "Complete seam vacuuming and embedded particulate removal",
        "Premium natural-oil leather conditioning and active UV barrier",
        "Rear footwell scrubbing & deep salt extraction with extraction heads",
        "Junction brackets, slider rails, and door pockets detailed"
      ]
    },
    {
      id: "exterior_impala_nose_cinematic",
      src: "/impala close up cinematic front.jpeg",
      title: "Cinematic Nose Refinement",
      category: "Exterior",
      vehicle: "Chevrolet Impala (Satin Silver)",
      description: "Extreme close-up detailing of the intricate mesh grille, headlight lens, and chrome trims. Zero residual compound buildup remains in micro-cracks.",
      highlights: [
        "Intricate honeycomb front grille micro-swab cleaning",
        "Polycarbonate headlight clarity wash & UV protectant sealant",
        "Lower chin spoiler cleaning and textured bumper dressing",
        "Carnauba polymer shielding for extreme bug splatter rejection"
      ]
    }
  ];

  return (
    <section className="space-y-8 py-4 font-sans select-none">
      <div className="text-center max-w-xl mx-auto">
        <span className="text-amber-850 font-bold font-mono text-xs tracking-widest uppercase">
          [ REAL WORK GALLERY ]
        </span>
        <h3 className="text-3xl sm:text-4xl font-serif font-black text-[#2e261f] mt-2 tracking-tight">
          Recent Detailing Proof
        </h3>
        <p className="text-zinc-650 text-xs sm:text-sm mt-1">
          No stock photos, no fancy filters. Just real, honest driveway transformations completed by Arthur & Carson in Cobb County.
        </p>
      </div>

      {/* Interactive Bento Styling grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {galleryItems.map((item) => (
          <div
            key={item.id}
            onClick={() => setActiveItem(item)}
            className="group bg-white border-2 border-[#e6dccf] overflow-hidden cursor-pointer hover:border-[#b45309] hover:shadow-md transition-all duration-300 flex flex-col"
            style={{ borderRadius: "20px 2px 20px 2px" }}
          >
            {/* Image container frame */}
            <div className="relative aspect-square w-full bg-[#faf5f0] overflow-hidden border-b-2 border-[#e6dccf] group-hover:border-[#b45309]/30 transition-all">
              <img
                src={item.src}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              {/* Overlay with subtle instruction hint */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <div className="bg-white/95 text-[#2e261f] text-xs font-black tracking-wider uppercase px-4 py-2 border border-amber-600 flex items-center gap-2"
                  style={{ borderRadius: "6px 2.5px 6px 2.5px" }}
                >
                  <Eye className="w-3.5 h-3.5 text-amber-700" />
                  Inspect Finish Details
                </div>
              </div>

              {/* Tag Overlays */}
              <div className="absolute top-3 left-3 bg-[#fffdfb] border border-[#e6dccf] text-[#b45309] font-mono text-[9px] font-bold px-2 py-0.5 uppercase tracking-wider rounded">
                {item.category}
              </div>
            </div>

            {/* Specs & description previews */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-1.5 text-left">
                <span className="text-[10px] text-amber-800 font-mono font-bold tracking-tight uppercase">
                  {item.vehicle}
                </span>
                <h4 className="text-base font-serif font-black text-[#2e261f] leading-tight group-hover:text-[#b45309] transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs text-[#5c544a] leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              </div>

              <div className="pt-3.5 border-t border-dashed border-[#e1d3c1] flex items-center justify-between text-[11px] font-mono font-bold text-zinc-500">
                <span>Arthur & Carson Crew</span>
                <span className="text-[#b45309] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  View Details <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Details Lightbox Modal */}
      {activeItem && (
        <div 
          onClick={() => setActiveItem(null)}
          className="fixed inset-0 z-50 bg-[#251f1a]/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 cursor-zoom-out animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#fffdfb] max-w-3xl w-full border-4 border-[#2e261f] shadow-2xl relative cursor-default flex flex-col md:flex-row md:items-stretch max-h-[90vh] overflow-y-auto md:overflow-y-visible"
            style={{ borderRadius: "32px 4px 32px 4px" }}
          >
            {/* Close Button badge */}
            <button
              onClick={() => setActiveItem(null)}
              className="absolute top-3 right-3 z-10 w-9 h-9 bg-[#2e261f] text-white flex items-center justify-center border-2 border-white hover:bg-neutral-900 transition-colors cursor-pointer"
              style={{ borderRadius: "10px 2px 10px 2px" }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left Column: Huge High-Quality Image Preview */}
            <div className="relative flex-1 bg-neutral-950 flex items-center justify-center min-h-[200px] md:min-h-full border-b-2 md:border-b-0 md:border-r-2 border-[#2e261f]">
              <img
                src={activeItem.src}
                alt={activeItem.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-4 left-4 bg-black/75 text-white font-mono text-[9px] px-3 py-1 rounded border border-neutral-700 tracking-widest uppercase">
                Original Driveway Finish
              </div>
            </div>

            {/* Right Column: Detailed technical facts / checklists */}
            <div className="p-5 sm:p-8 flex-1 flex flex-col justify-between space-y-6 text-left max-w-none md:max-w-sm">
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="bg-amber-100 text-[#b45309] font-mono font-bold text-[10px] px-2.5 py-0.5 border border-amber-300 uppercase tracking-wider rounded">
                    {activeItem.category} Service
                  </span>
                  <div className="text-[11px] font-mono text-zinc-500 font-bold mt-1 uppercase">
                    Vehicle: {activeItem.vehicle}
                  </div>
                  <h4 className="text-xl font-serif font-black text-[#2e261f] mt-1.5 leading-tight">
                    {activeItem.title}
                  </h4>
                </div>

                <p className="text-xs sm:text-sm text-[#5c544a] leading-relaxed font-medium">
                  {activeItem.description}
                </p>

                {/* Specific restoration checkpoints checklist */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b45309] block">
                    Completed Checkpoints
                  </span>
                  <ul className="space-y-1.5">
                    {activeItem.highlights.map((highlight, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-[#2e261f]">
                        <Check className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <span className="leading-relaxed font-semibold">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
