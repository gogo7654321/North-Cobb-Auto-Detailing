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

      {/* Clean Bento Styling grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {galleryItems.map((item) => (
          <div
            key={item.id}
            className="group bg-white border-2 border-[#e6dccf] overflow-hidden flex flex-col"
            style={{ borderRadius: "20px 2px 20px 2px" }}
          >
            {/* Image container frame */}
            <div className="relative aspect-square w-full bg-[#faf5f0] overflow-hidden border-b-2 border-[#e6dccf] transition-all">
              <img
                src={item.src}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                referrerPolicy="no-referrer"
              />

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
                <h4 className="text-base font-serif font-black text-[#2e261f] leading-tight">
                  {item.title}
                </h4>
                <p className="text-xs text-[#5c544a] leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
