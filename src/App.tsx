import { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  MapPin, 
  PhoneCall, 
  Mail, 
  Clock, 
  Menu, 
  X, 
  ShieldCheck, 
  ThumbsUp, 
  Star, 
  Users, 
  MessageSquareText,
  BookmarkCheck,
  Award,
  Heart,
  CheckCircle2
} from "lucide-react";
import WorkGallery from "./components/WorkGallery";
import ServicesDetail from "./components/ServicesDetail";
import BookingForm from "./components/BookingForm";
import AdminPortal from "./components/AdminPortal";

export default function App() {
  const [selectedTab, setSelectedTab] = useState<"home" | "services" | "book" | "owner">("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [passedService, setPassedService] = useState<string>("");

  // Secure manual hash routing for owner portal
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === "#owner-portal") {
        setSelectedTab("owner");
      } else if (hash === "#services") {
        setSelectedTab("services");
      } else if (hash === "#book") {
        setSelectedTab("book");
      } else {
        setSelectedTab("home");
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const scrollToBookingAndSelect = (serviceName: string) => {
    setPassedService(serviceName);
    setSelectedTab("book");
    window.location.hash = "#book";
    setMobileMenuOpen(false);
    
    setTimeout(() => {
      const element = document.getElementById("booking_section_view");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }, 120);
  };

  const isOwner = selectedTab === "owner";

  return (
    <div className="min-h-screen font-sans antialiased bg-[#fffdfb] text-[#2e261f] selection:bg-amber-100 selection:text-amber-900 pb-24 md:pb-0">
      
      {/* Subtle organic texture or fine decorative lines for the public site */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
        style={{
          backgroundImage: `radial-gradient(#2e261f 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }} 
      />



      {/* TOP HEADER / MOBILE COMPATIBLE NAVBAR */}
      <header className="sticky top-0 z-40 backdrop-blur-md border-b bg-[#fffdfb]/90 border-[#e6dccf] text-[#2a221a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo Brand Frame */}
          <div 
            id="brand_logo_link"
            onClick={() => { setSelectedTab("home"); window.location.hash = ""; }} 
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-14 h-14 flex items-center justify-center border-2 bg-white border-[#2e261f] group-hover:border-[#b45309] overflow-hidden p-1"
              style={{ borderRadius: "14px 2px 14px 2px" }}
            >
              <img 
                src="/North_CObb_Detailing.PNG" 
                alt="North Cobb Detailing Logo" 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-sm font-serif font-black tracking-widest text-[#2e261f]">
                NORTH COBB <span className="text-[#b45309]">DETAIL</span>
              </h1>
              <span className="text-[9px] tracking-widest block uppercase font-mono font-bold text-zinc-500">
                [ Driveway Handcrafted Care ]
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links (Elegant physical tabs style) */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              id="nav_link_home"
              onClick={() => { setSelectedTab("home"); setPassedService(""); window.location.hash = ""; }}
              className={`text-xs font-bold uppercase tracking-widest px-3 py-2 cursor-pointer transition-colors relative ${
                selectedTab === "home" 
                  ? "text-[#b45309] border-b-2 border-[#b45309]" 
                  : "text-zinc-650 hover:text-zinc-900"
              }`}
            >
              Overview
            </button>
            <button
              id="nav_link_services"
              onClick={() => { setSelectedTab("services"); window.location.hash = "#services"; }}
              className={`text-xs font-bold uppercase tracking-widest px-3 py-2 cursor-pointer transition-colors relative ${
                selectedTab === "services" 
                  ? "text-[#b45309] border-b-2 border-[#b45309]" 
                  : "text-zinc-650 hover:text-zinc-900"
              }`}
            >
              Our Services
            </button>
            <button
              id="nav_link_book"
              onClick={() => { setSelectedTab("book"); setPassedService(""); window.location.hash = "#book"; }}
              className={`text-xs font-bold uppercase tracking-widest px-3.5 py-2 cursor-pointer transition-colors relative ${
                selectedTab === "book" 
                  ? "text-[#b45309] border-[#b45309]" 
                  : "text-zinc-650 hover:text-zinc-900"
              }`}
              style={{
                border: selectedTab === "book" ? "2px solid #b45309" : "2px dashed #e6dccf",
                borderRadius: "6px 2px 6px 2px"
              }}
            >
              Request Detail
            </button>
          </nav>

          {/* Mobile Quick Action & Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <a
              id="mobile_quick_call_btn"
              href="tel:+12087707517"
              className="p-2 border-2 border-[#e6dccf] text-[#b45309] hover:bg-[#fff9e6] rounded-md active:scale-95 transition-all flex items-center justify-center bg-white shadow-sm"
              title="Call Detailing Crew"
            >
              <PhoneCall className="w-4 h-4" />
            </a>
            
            <button
              id="mobile_hamburger_btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md focus:outline-none transition-colors border-2 text-zinc-700 hover:text-zinc-900 hover:bg-[#faf5f0] border-[#e6dccf] bg-white flex items-center justify-center"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b py-4 px-6 space-y-3 animate-in fade-in slide-in-from-top-3 duration-150 bg-[#fffdfb] border-[#e6dccf]">
            <button
              id="mob_nav_link_home"
              onClick={() => { setSelectedTab("home"); setMobileMenuOpen(false); setPassedService(""); window.location.hash = ""; }}
              className={`w-full text-left font-bold text-xs uppercase tracking-wider block py-2 px-3 rounded ${
                selectedTab === "home" ? "bg-amber-50 text-amber-900 font-extrabold" : "text-zinc-600"
              }`}
            >
              Overview
            </button>
            <button
              id="mob_nav_link_services"
              onClick={() => { setSelectedTab("services"); setMobileMenuOpen(false); window.location.hash = "#services"; }}
              className={`w-full text-left font-bold text-xs uppercase tracking-wider block py-2 px-3 rounded ${
                selectedTab === "services" ? "bg-amber-50 text-amber-900 font-extrabold" : "text-zinc-600"
              }`}
            >
              Our Services
            </button>
            <button
              id="mob_nav_link_book"
              onClick={() => { setSelectedTab("book"); setMobileMenuOpen(false); setPassedService(""); window.location.hash = "#book"; }}
              className={`w-full text-left font-bold text-xs uppercase tracking-wider block py-2 px-3 rounded ${
                selectedTab === "book" ? "bg-[#b45309] text-white font-extrabold" : "text-zinc-650 border border-dashed border-[#e6dccf]"
              }`}
            >
              Request Detail
            </button>
          </div>
        )}
      </header>

      {/* CORE FRAME LAYOUT VIEWS */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative">
        
        {/* TAB 1: OVERVIEW & HOME LANDING */}
        {selectedTab === "home" && (
          <div className="space-y-16 animate-in fade-in duration-300">
            
            {/* HERO MODULE SECTION (Artisan / Minimal Boutique Framing) */}
            <section className="flex flex-col lg:flex-row items-stretch gap-12 pt-4">
              <div className="flex-1 flex flex-col justify-center space-y-6 text-center lg:text-left">
                
                {/* Visual Accent Title Subheading */}
                <span className="text-[11px] font-sans font-extrabold tracking-widest uppercase text-[#b45309] block self-center lg:self-start">
                  Cobb County • Arthur & Carson's Detail Crew
                </span>

                <h2 className="text-5xl sm:text-7xl font-serif font-black tracking-tight text-[#2e261f] leading-none">
                  There’s nothing like <br />
                  <span className="bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 bg-clip-text text-transparent">
                    a clean car.
                  </span>
                </h2>

                <p className="text-[#5c544a] text-sm sm:text-base max-w-xl mx-auto lg:mx-0 leading-relaxed font-serif italic">
                  Showroom hand-detailing right in your driveway. Done on-site by our expert 2-man crew—Arthur and Carson. No heavy machines or destructive spinning buffers, just precise hand restoration.
                </p>

                {/* Direct Action Catalogs */}
                <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 pt-2 font-sans">
                  <button
                    id="hero_cta_book_now"
                    onClick={() => {
                      setSelectedTab("book");
                      window.location.hash = "#book";
                    }}
                    className="px-8 py-4 bg-[#b45309] hover:bg-[#9a3412] text-white font-black text-xs tracking-widest uppercase transition-all duration-200 cursor-pointer"
                    style={{ borderRadius: "8px 2px 8px 2px" }}
                  >
                    Request Driveway Spot
                  </button>
                  <button
                    id="hero_cta_see_pricing"
                    onClick={() => { setSelectedTab("services"); window.location.hash = "#services"; }}
                    className="px-8 py-4 bg-white border-2 border-[#2e261f] hover:bg-zinc-50 text-[#2e261f] font-bold text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer"
                    style={{ borderRadius: "8px 2px 8px 2px" }}
                  >
                    Browse Our Services
                  </button>
                </div>

                {/* Minimalist Grid Credibility Stamp */}
                <div className="grid grid-cols-3 gap-6 pt-6 text-center lg:text-left max-w-md mx-auto lg:mx-0 border-t border-[#e6dccf] mt-10">
                  <div>
                    <span className="text-xl font-serif font-black text-[#2e261f] block">2 Men</span>
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider font-bold">Per Detailing Job</span>
                  </div>
                  <div className="border-x border-[#e6dccf] px-2">
                    <span className="text-xl font-serif font-black text-[#2e261f] block">1 - 3 Hrs</span>
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider font-bold">Fast Turnaround</span>
                  </div>
                  <div>
                    <span className="text-xl font-serif font-black text-[#2e261f] block">$45 - $100</span>
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider font-bold">Estimated Base Rates</span>
                  </div>
                </div>

              </div>

              {/* HERO RIGHT COLUMN: SHOWCASE BRAND PHOTOGRAPHY */}
              <div className="flex-1 flex items-center justify-center relative animate-in zoom-in-95 duration-350">
                <div className="relative w-full max-w-lg bg-white border-2 border-[#2e261f] p-3 shadow-md"
                  style={{ borderRadius: "24px 2px 24px 2px" }}
                >
                  <div className="absolute -top-3.5 -right-3 px-3.5 py-1 bg-amber-100 text-[#b45309] font-sans text-[10px] font-bold tracking-wider border-2 border-[#2e261f] rounded-lg shadow uppercase">
                    Our Handiwork
                  </div>
                  
                  <div className="overflow-hidden border border-[#e6dccf]"
                    style={{ borderRadius: "18px 2px 18px 2px" }}
                  >
                    <img 
                      src="/impala close up cinematic front.jpeg" 
                      alt="Arthur and Carson's handiwork" 
                      className="w-full h-auto object-cover max-h-[380px] hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  <div className="p-4 text-center mt-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#b45309] font-black block">Featured Restorative Work</span>
                    <p className="text-xs text-[#5c544a] italic mt-1 font-serif">Mirror reflection hand-polish completed on a client's sedan.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ARTISAN PLEDGE & CLEAN SERVICE STANDARDS */}
            <section className="bg-[#faf8f5] border-2 border-[#e6dccf] p-6 sm:p-8 rounded-2xl flex flex-col md:flex-row gap-6 items-center">
              <div className="flex items-center gap-4 shrink-0">
                <div className="w-14 h-14 rounded-full bg-[#b45309] flex items-center justify-center font-bold text-sm text-white shadow-sm font-serif">
                  A&C
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-bold text-[#2e261f] uppercase tracking-wider">Arthur & Carson</h4>
                  <span className="text-[11px] text-amber-800 font-semibold font-sans tracking-wide block uppercase mt-0.5">Mobile Hand Care Specialists</span>
                </div>
              </div>
              <div className="flex-1 text-left border-t md:border-t-0 md:border-l border-[#e6dccf] pt-4 md:pt-0 md:pl-6">
                <p className="text-xs text-[#5c544a] leading-relaxed font-serif italic">
                  "We run North Cobb Detailing as a clean and respectful driveway service. We don't bring heavy, noisy generators or block your street. We connect simply and cleanly to your residential water and outdoor electrical line—completing every job with hand care, checking the results together before we request a single dollar."
                </p>
                
                <div className="mt-4 flex flex-col sm:flex-row gap-3 text-xs font-sans font-semibold text-zinc-700">
                  <span className="flex items-center gap-1.5 text-zinc-700 bg-amber-50/50 border border-amber-200/30 px-3 py-1.5 rounded-xl">
                    <span className="text-[#b45309] font-bold">✓</span> Just 1 Standard Garden Spigot
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-700 bg-amber-50/50 border border-amber-200/30 px-3 py-1.5 rounded-xl">
                    <span className="text-[#b45309] font-bold">✓</span> Just 1 Outdoor Electrical Plug
                  </span>
                </div>
              </div>
            </section>
            {/* PACKAGES PREVIEW SECTION */}
            <section className="space-y-8">
              <div className="text-center max-w-xl mx-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/60 rounded-full text-[10px] font-bold text-[#b45309] uppercase tracking-wider font-sans">
                  Detailing Packages
                </span>
                <h3 className="text-3xl sm:text-4xl font-serif font-black text-[#2e261f] mt-2 tracking-tight">Our Services</h3>
                <p className="text-zinc-650 text-xs sm:text-sm mt-1">Select from our transparent pricing structures below. Estimates vary based on vehicle size and dirtiness with zero hidden surprise extras.</p>
              </div>
              <ServicesDetail onSelectService={scrollToBookingAndSelect} />
            </section>

            {/* REAL PORTFOLIO WORK SHOWCASE GALLERY */}
            <section className="py-6 border-b border-[#e6dccf]">
              <WorkGallery />
            </section>

            {/* HIGH-CONVERSION TESTIMONIALS SECTION (Vintage Journal Style Columns) */}
            <section className="space-y-8 py-4">
              <div className="text-center max-w-xl mx-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/60 rounded-full text-[10px] font-bold text-[#b45309] uppercase tracking-wider font-sans">
                  Customer Testimonials
                </span>
                <h3 className="text-3xl font-serif font-black text-[#2e261f] mt-1 tracking-tight">Cobb County Driveway Reviews</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white border-2 border-[#e6dccf] p-6 sm:p-7 space-y-4 hover:shadow-sm" style={{ borderRadius: "20px 2px 20px 2px" }}>
                  <div className="flex gap-1 text-amber-600">
                    {[1,2,3,4,5].map((s) => <Star key={s} className="w-3.5 h-3.5 fill-current stroke-none" />)}
                  </div>
                  <p className="text-zinc-700 text-xs sm:text-sm leading-relaxed italic">
                    "Called the team for an Exterior Detail because of baking-hot tree sap on my sedan in Acworth. They arrived right on schedule and completely restored the clear coat's mirror look. Excellent neighborly service!"
                  </p>
                  <div className="pt-3 border-t border-dashed border-[#e6dccf] flex justify-between items-center text-xs">
                    <span className="font-bold text-[#2e261f] font-sans tracking-wide">Michael R.</span>
                    <span className="text-zinc-500 font-sans font-medium">Acworth Resident</span>
                  </div>
                </div>

                <div className="bg-white border-2 border-[#e6dccf] p-6 sm:p-7 space-y-4 hover:shadow-sm" style={{ borderRadius: "20px 2px 20px 2px" }}>
                  <div className="flex gap-1 text-amber-600">
                    {[1,2,3,4,5].map((s) => <Star key={s} className="w-3.5 h-3.5 fill-current stroke-none" />)}
                  </div>
                  <p className="text-zinc-700 text-xs sm:text-sm leading-relaxed italic">
                    "The Interior Detail is a complete life saver with toddlers. All the embedded sand and accidental spills are entirely gone. The cabin space feels so refreshed and sanitized!"
                  </p>
                  <div className="pt-3 border-t border-dashed border-[#e6dccf] flex justify-between items-center text-xs">
                    <span className="font-bold text-[#2e261f] font-sans tracking-wide">Jessica T.</span>
                    <span className="text-zinc-500 font-sans font-medium">Kennesaw, GA</span>
                  </div>
                </div>

                <div className="bg-white border-2 border-[#e6dccf] p-6 sm:p-7 space-y-4 hover:shadow-sm" style={{ borderRadius: "20px 2px 20px 2px" }}>
                  <div className="flex gap-1 text-amber-600">
                    {[1,2,3,4,5].map((s) => <Star key={s} className="w-3.5 h-3.5 fill-current stroke-none" />)}
                  </div>
                  <p className="text-zinc-700 text-xs sm:text-sm leading-relaxed italic">
                    "Super straightforward self-sufficient car care. The carnauba dressing leaves a beautiful glass shine and water beads right off. Best of all, I inspected my paint together with the crew before paying."
                  </p>
                  <div className="pt-3 border-t border-dashed border-[#e6dccf] flex justify-between items-center text-xs">
                    <span className="font-bold text-[#2e261f] font-sans tracking-wide">David H.</span>
                    <span className="text-zinc-500 font-sans font-medium">Marietta Resident</span>
                  </div>
                </div>
              </div>
            </section>

          </div>
        )}
        {/* TAB 2: DETAILED SERVICES */}
        {selectedTab === "services" && (
          <div className="space-y-10 animate-in fade-in duration-300">
            <div className="text-center max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/60 rounded-full text-[10px] font-bold text-[#b45309] uppercase tracking-wider font-sans">
                Full Checklist Index
              </span>
              <h3 className="text-4xl font-serif font-black text-[#2e261f] mt-2 tracking-tight">Our Services</h3>
              <p className="text-zinc-655 text-xs sm:text-sm mt-1">We maintain honest, transparent pricing estimates. Read carefully what each driveway service includes, then reserve your favorite slot.</p>
            </div>
            
            <ServicesDetail onSelectService={scrollToBookingAndSelect} />

            {/* FAQ Area (Elegant styled letterpress segment) */}
            <div className="max-w-3xl mx-auto mt-16 bg-[#faf8f5] border-2 border-[#e6dccf] p-6 sm:p-10 space-y-8"
              style={{ borderRadius: "24px 2px 24px 2px" }}
            >
              <h4 className="text-lg font-serif font-black text-[#2e261f] tracking-tight text-center flex items-center justify-center gap-2">
                Common Detailing Questions
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-dashed border-[#e6dccf] text-xs sm:text-sm">
                <div className="space-y-1.5">
                  <strong className="text-[#2e261f] font-bold block font-serif text-sm">Do you require water or electricity?</strong>
                  <p className="text-[#5c544a] leading-relaxed text-xs">Yes, to provide our quiet driveway service we connect cleanly to exactly one standard residential water spigot / line and one standard outdoor electrical plug.</p>
                </div>
                <div className="space-y-1.5">
                  <strong className="text-[#2e261f] font-bold block font-serif text-sm">How long does each detailing session take?</strong>
                  <p className="text-[#5c544a] leading-relaxed text-xs">An Exterior Detail takes about 1 hour, a standalone Interior Detail takes 1.5 hours, and our Full Detail takes just under 3 hours of precise driveway work by our 2-man crew (Arthur & Carson).</p>
                </div>
                <div className="space-y-1.5">
                  <strong className="text-[#2e261f] font-bold block font-serif text-sm">How far in advance should I reserve a date?</strong>
                  <p className="text-[#5c544a] leading-relaxed text-xs">Reservations must be requested at least 24 hours in advance to secure driveway space. Slots are available daily from 9:00 AM to 6:00 PM.</p>
                </div>
                <div className="space-y-1.5">
                  <strong className="text-[#2e261f] font-bold block font-serif text-sm">Are your formula products safe?</strong>
                  <p className="text-[#5c544a] leading-relaxed text-xs">Yes. We use premium, high-tech pH-balanced formulas that are completely safe for child contact and pet paws once dry. We maintain honesty: we utilize professional-grade, pH-balanced formulas rather than "all-natural" mixtures, because actual all-natural products are ineffective for lifting heavy driveway grit and restoring paint oxidation.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RESERVATION BOOKINGS */}
        {selectedTab === "book" && (
          <div id="booking_section_view" className="space-y-10 animate-in fade-in duration-300">
            <div className="text-center max-w-xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/60 rounded-full text-[10px] font-bold text-[#b45309] uppercase tracking-wider font-sans">
                Driveway Booking Portal
              </span>
              <h3 className="text-3xl font-serif font-black text-[#2e261f] mt-2 tracking-tight">Request Detailing Session</h3>
              <p className="text-zinc-655 text-xs sm:text-sm mt-1">Submit your detailing request. We review pending local slots daily and dispatch immediate confirmation notices.</p>
            </div>

            <BookingForm initialService={passedService} />
          </div>
        )}

        {/* TAB 4: PRIVATE OWNER PORTAL */}
        {selectedTab === "owner" && (
          <div className="space-y-6 animate-in fade-in duration-300 pb-10">
            <div className="bg-[#faf8f5] border-2 border-[#e6dccf] p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
              style={{ borderRadius: "24px 4px 24px 4px" }}
            >
              <div className="flex items-center gap-3.5 text-left">
                <div className="bg-zinc-100 border border-zinc-200 text-zinc-650 px-3 py-1 bg-amber-50/50 border border-amber-200/30 rounded-lg text-xs font-bold font-sans tracking-wide">
                  🔒 Crew Dashboard
                </div>
                <div>
                  <h4 className="text-sm font-serif font-black text-[#2e261f]">Private Dashboard Area</h4>
                  <p className="text-xs text-zinc-500">Strictly hidden from index crawlers. Safe management of local driveway requested spots.</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedTab("home"); window.location.hash = ""; }}
                className="px-5 py-2.5 bg-[#2e261f] text-[#fffdfb] hover:bg-black font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer"
                style={{ borderRadius: "8px 2px 8px 2px" }}
              >
                Return to Public Website
              </button>
            </div>
            <AdminPortal />
          </div>
        )}

      </main>

      {/* COMPACT FOOTER */}
      <footer className="border-t border-[#e6dccf] bg-[#faf5f0] text-[#5c544a] mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-8 text-xs">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left">
            <img 
              src="https://north-cobb-detailing-139121508979.us-west1.run.app/North_CObb_Detailing.PNG" 
              alt="North Cobb Detailing Logo" 
              className="w-14 h-14 shrink-0 object-contain bg-white border border-[#e6dccf] shadow-sm transform hover:scale-105 transition-transform duration-200" 
              style={{ borderRadius: "12px 3px 12px 3px" }}
              referrerPolicy="no-referrer"
            />
            <div className="space-y-1">
              <p className="font-serif font-black text-sm tracking-wide text-[#2e261f]">
                NORTH COBB MOBILE AUTO DETAIL
              </p>
              <p className="font-mono text-[10px] text-zinc-500">© {new Date().getFullYear()} North Cobb Detailing. All Rights Reserved.</p>
              <p className="text-[10px] font-mono text-zinc-450">
                Website designed & crafted by <span className="text-amber-900 font-bold border-b border-amber-900/20 hover:border-amber-900/50 transition-all font-sans">Neil Mendpara</span>
              </p>
              <p className="text-[11px] leading-relaxed max-w-sm text-zinc-500 pt-1">
                Top-rated professional parent & pet friendly local microdetailing across Kennesaw, Acworth, Marietta, and Cobb County, Georgia.
              </p>
            </div>
          </div>
          
          {/* Facebook Link & Navigation */}
          <div className="flex flex-col items-center md:items-end gap-3 text-xs">
            <div className="flex flex-wrap justify-center gap-3.5 font-bold text-[11px] tracking-wider uppercase">
              <button onClick={() => { setSelectedTab("home"); window.location.hash = ""; }} className="hover:text-amber-800 transition-colors cursor-pointer">Overview</button>
              <span>•</span>
              <button onClick={() => { setSelectedTab("services"); window.location.hash = "#services"; }} className="hover:text-amber-800 transition-colors cursor-pointer">Our Services</button>
              <span>•</span>
              <button onClick={() => { setSelectedTab("book"); window.location.hash = "#book"; }} className="hover:text-amber-800 transition-colors cursor-pointer">Request Detail</button>
              <span>•</span>
              <a 
                href="https://www.facebook.com/people/North-Cobb-Detailing/pfbid02hkyF1tuWGoGWDAVMadwH6xTU6RRLdENWVMiLiqQqpBsDzhbiS7h363i8QmHEyd3el/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-amber-800 hover:text-amber-900 transition-all hover:underline"
              >
                <span>Facebook</span>
                <span className="text-[10px] bg-amber-100 px-2 py-0.5 rounded text-amber-900 border border-amber-200">LIKE US</span>
              </a>
            </div>
            
            <span className="text-[10px] text-zinc-500 block text-center md:text-right font-sans font-medium tracking-wide">
              Quiet Residential Driveway Detailing • Hand-Washed Customer Respect
            </span>
          </div>
        </div>
      </footer>

      {/* HIGH-CONVERSION MOBILE FLOATING STICKY ACTION BAR */}
      {!isOwner && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t-2 border-[#e6dccf] p-3 flex gap-3 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] animate-in slide-in-from-bottom duration-300">
          <a 
            href="tel:+12087707517"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#fbf8f4] hover:bg-[#faf5f0] border-2 border-[#2e261f] text-[#2e261f] font-sans font-black text-xs uppercase tracking-widest transition-all duration-150 shadow-sm shadow-[#2e261f]/10 shrink-0"
            style={{ borderRadius: "10px 2px 10px 2px" }}
          >
            <PhoneCall className="w-4 h-4 text-[#b45309]" />
            Call / Text Us
          </a>
          <button
            onClick={() => {
              setSelectedTab("book");
              window.location.hash = "#book";
              setTimeout(() => {
                const el = document.getElementById("booking_section_view");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }, 120);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#b45309] hover:bg-[#9a3412] text-white font-sans font-black text-xs uppercase tracking-widest transition-all duration-150 shadow-sm shadow-[#b45309]/20 cursor-pointer"
            style={{ borderRadius: "10px 2px 10px 2px" }}
          >
            <Sparkles className="w-4 h-4 text-white" />
            Request Detail
          </button>
        </div>
      )}

    </div>
  );
}
