import React, { useState } from "react";

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  aspectRatio?: string; // Tailwind aspect class (e.g., 'aspect-[4/3]')
  maxHeight?: string; // (e.g. 'max-h-[380px]')
}

export default function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  aspectRatio = "aspect-[4/3]",
  maxHeight = "max-h-[380px]"
}: BeforeAfterSliderProps) {
  const [sliderPos, setSliderPos] = useState<number>(50);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPos(Number(e.target.value));
  };

  return (
    <div 
      className={`relative w-full ${aspectRatio} overflow-hidden bg-zinc-900 border border-[#e6dccf] select-none`}
      style={{ borderRadius: "18px 2px 18px 2px" }}
    >
      {/* 1. BEFORE Image (Bottom / Left side) */}
      <img
        src={beforeUrl}
        alt="Before detailing work"
        className="absolute inset-0 w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />

      {/* BEFORE Label Badge (Top-left) */}
      <div 
        className="absolute top-3.5 left-3.5 px-2.5 py-1 bg-[#1c1917]/75 backdrop-blur-sm text-zinc-100 font-sans text-[10px] font-bold tracking-widest uppercase rounded border border-white/10 z-10 transition-opacity duration-200 pointer-events-none"
        style={{ opacity: sliderPos < 15 ? 0 : 1 }}
      >
        Before
      </div>

      {/* 2. AFTER Image (Clipped top layer / Right side) */}
      <div
        className="absolute inset-0 pointer-events-none select-none"
        style={{
          clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)`
        }}
      >
        <img
          src={afterUrl}
          alt="After detailing work"
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* AFTER Label Badge (Top-right) */}
      <div 
        className="absolute top-3.5 right-3.5 px-2.5 py-1 bg-amber-950/85 backdrop-blur-sm text-amber-100 font-sans text-[10px] font-bold tracking-widest uppercase rounded border border-[#b45309]/30 z-10 transition-opacity duration-200 pointer-events-none"
        style={{ opacity: sliderPos > 85 ? 0 : 1 }}
      >
        After
      </div>

      {/* 3. Slider Line Decorator & Handle */}
      <div
        className="absolute top-0 bottom-0 w-[3px] bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] pointer-events-none z-20"
        style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
      >
        {/* Decorative Circle Slider Thumb */}
        <div 
          className="absolute top-1/2 left-1/2 w-9 h-9 bg-white border-2 border-stone-800 shadow-[0_4px_12px_rgba(0,0,0,0.35)] rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-between px-1.5 transition-colors group-hover:bg-amber-50"
        >
          {/* Arrow Left */}
          <svg className="w-2.5 h-2.5 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {/* Arrow Right */}
          <svg className="w-2.5 h-2.5 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* 4. Invisible range slider overlay acting as the controller */}
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPos}
        onChange={handleSliderChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30 m-0 p-0"
        aria-label="Drag to compare before and after photos"
      />
    </div>
  );
}
