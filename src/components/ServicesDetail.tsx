import { useState } from "react";
import { Sparkles, HelpCircle, ArrowRight } from "lucide-react";
import { DetailingService } from "../types";

const SERVICE_TIERS: DetailingService[] = [
  {
    name: "Exterior Detail",
    price: 50,
    duration: "1 hour",
    description: "Full exterior hand wash using professional foam cannon and microfiber mitts. Wheels, tires, and rims thoroughly scrubbed. Vehicle is rinsed and hand-dried with soft microfiber towels. Premium tire and plastic dressing applied for UV protection and a restored shine.",
    features: [
      "Foam cannon pre-soak (helps loosen dirt and grime before contact)",
      "Full hand wash (contact wash with microfiber mitt)",
      "Wheels, tires, and rims deep cleaned",
      "Thorough rinse",
      "Microfiber towel dry",
      "Premium tire and plastic dressing applied to restore trim & rubber"
    ]
  },
  {
    name: "Interior Detail",
    price: 80,
    duration: "1.5 hours",
    description: "Complete interior cleaning including custom vacuuming seats, carpets, and trunk. All surfaces wiped down and detailed (dash, doors, center console). Crevices thoroughly cleared. Weather mat restoration included. All interior glass cleaned for a streak-free finish. Now includes specialized front glass bug cleaner, exterior hand wax, and a complimentary premium air freshener.",
    features: [
      "Full vacuum (seats, carpets, trunk)",
      "Wipe down all surfaces (dash, doors, center console)",
      "Crevices and tight areas detailed (removes built-up dust and debris)",
      "Weather mat restoration & deep scrubbing",
      "Interior glass cleaned (streak-free finish)",
      "Specialized bug cleaner application for windshield & front trim",
      "Protective hand-applied wax for glass & trim gloss",
      "Complementary premium long-lasting air freshener"
    ]
  },
  {
    name: "Full Detail",
    price: 120,
    duration: "Under 3 hours",
    description: "The ultimate bumper-to-bumper reset. Combines both full interior and exterior details. Includes professional bug cleaner treatment, premium protective hand wax, and a complimentary long-lasting premium air freshener of your choice. (Note: prices are estimates and vary depending on vehicle size and dirtiness).",
    features: [
      "Everything in Exterior Detail",
      "Everything in Interior Detail",
      "Specialized front-end bug cleaner treatment (grill, bumpers, side mirrors)",
      "Premium protective hand-applied paste wax coating & high-shine buffing",
      "Complementary choice of premium long-lasting air freshener",
      "Complete inside and out reset for a clean, refreshed, like-new feel"
    ]
  }
];

interface ServicesDetailProps {
  onSelectService: (serviceName: string) => void;
}

export default function ServicesDetail({ onSelectService }: ServicesDetailProps) {
  const [activeMobileTab, setActiveMobileTab] = useState<number>(2); // Default to best-value (Full Detail)

  return (
    <div className="py-2 font-sans selection:bg-amber-150 selection:text-amber-900">
      
      {/* Mobile-Only Package Selector Segment */}
      <div className="lg:hidden max-w-sm mx-auto mb-8 bg-[#f5efe8]/60 p-1.5 border-2 border-[#e6dccf] flex gap-1 shadow-inner"
        style={{ borderRadius: "16px 4px 16px 4px" }}
      >
        {SERVICE_TIERS.map((service, index) => {
          const isActive = activeMobileTab === index;
          return (
            <button
              key={service.name}
              type="button"
              onClick={() => setActiveMobileTab(index)}
              className={`flex-1 text-center py-3 text-[10px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-[#b45309] text-white shadow-md font-black"
                  : "text-[#5c544a] hover:text-[#2e261f]"
              }`}
              style={{ borderRadius: "12px 2px 12px 2px" }}
            >
              <div className="block font-mono text-[8px] opacity-75">${service.price}</div>
              <span className="block">{service.name.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {SERVICE_TIERS.map((service, index) => {
          const isFullDetail = service.name === "Full Detail";
          const isInterior = service.name === "Interior Detail";
          const isActiveOnMobile = activeMobileTab === index;
          
          return (
            <div
              id={`service_tier_card_${index}`}
              key={service.name}
              className={`relative flex flex-col justify-between overflow-hidden bg-[#faf8f5] border-2 border-[#e6dccf] transition-all duration-300 hover:scale-[1.01] ${
                isActiveOnMobile
                  ? "flex animate-in fade-in slide-in-from-bottom-3 duration-300"
                  : "hidden lg:flex"
              } ${
                isFullDetail
                  ? "ring-4 ring-[#b45309]/10 bg-[#fffdfb] !border-[#b45309]"
                  : ""
              }`}
              style={{
                borderRadius: "24px 4px 24px 4px",
                boxShadow: isFullDetail ? "0 12px 24px -10px rgba(180, 83, 9, 0.12)" : "none"
              }}
            >
              {/* Decorative Corner Stamp */}
              <div className="absolute top-0 right-0 bg-[#e6dccf]/40 text-[#5c544a] text-[10px] font-bold px-3 py-1 font-mono uppercase tracking-widest border-l border-b border-[#e6dccf] rounded-bl-lg">
                EST. TIME: {service.duration}
              </div>

              {/* Service Content Container */}
              <div className="p-6 sm:p-8 pt-10">
                {/* Visual Accent Sticker for Best Value */}
                {isFullDetail && (
                  <div className="inline-block mb-3 bg-[#fef3c7] text-[#92400e] text-[10px] font-black tracking-widest px-3 py-1 uppercase rounded border border-[#f59e0b]/30">
                    Best Value & Care
                  </div>
                )}
                {isInterior && (
                  <div className="inline-block mb-3 bg-[#eff6ff] text-[#1e40af] text-[10px] font-black tracking-widest px-3 py-1 uppercase rounded border border-[#3b82f6]/20">
                    Thorough Hand Cleanse
                  </div>
                )}

                <h4 className="text-3xl font-serif font-black text-[#2e261f] tracking-tight mb-2">
                  {service.name}
                </h4>
                
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-serif font-black text-[#b45309]">
                    From ${service.price}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-800 font-bold block">
                    *Varies by vehicle size & condition
                  </span>
                </div>

                {/* Micro-Divider */}
                <div className="h-[2px] bg-gradient-to-r from-[#e6dccf] via-[#e6dccf]/30 to-transparent my-4" />

                {/* Exact user-written description */}
                <p className="text-[#4a423a] text-sm leading-relaxed font-medium mb-6">
                  {service.description}
                </p>

                {/* Hand-lettered style custom bullet-point section */}
                <div className="space-y-4">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-amber-900/60 font-black block">
                    PACKAGE SPECIFICATION
                  </span>
                  <ul className="space-y-3.5">
                    {service.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-2.5">
                        <span className="text-[#b45309] text-sm leading-none select-none mt-0.5">—</span>
                        <span className="text-[#3d3731] text-xs sm:text-sm font-medium leading-relaxed">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Card Footer Button Container with physical separation line */}
              <div className="p-6 bg-[#f5efeb]/60 border-t border-[#e6dccf] mt-auto">
                <button
                  id={`book_button_${service.name.toLowerCase().replace(" ", "_")}`}
                  onClick={() => onSelectService(service.name)}
                  className={`w-full py-3.5 px-4 font-black text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 rounded-lg cursor-pointer ${
                    isFullDetail
                      ? "bg-[#b45309] text-white hover:bg-[#9a3412] hover:shadow-lg hover:shadow-amber-900/15"
                      : "bg-[#2e261f] text-[#faf8f5] hover:bg-black"
                  }`}
                  style={{ borderRadius: "8px 2px 8px 2px" }}
                >
                  Request Driveway {service.name}
                  <ArrowRight className="w-3.5 h-3.5 font-bold" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Driveway Utility Requirements Section */}
      <div className="mt-12 bg-[#faf8f5] border-2 border-[#e6dccf] p-8 rounded-2xl relative overflow-hidden">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/60 rounded-full text-[10px] font-bold text-[#b45309] uppercase tracking-wider font-sans">
            On-Site Setup Requirements
          </span>
          <h5 className="text-[#2e261f] font-black text-lg font-serif">A Quick Note for Neighbors</h5>
          <p className="text-xs sm:text-sm text-[#5c544a] leading-relaxed max-w-xl mx-auto font-medium">
            To deliver our signature driveway wash and hand restoration, Arthur and Carson just require access to exactly <strong className="text-[#b45309]">one standard water line / garden spigot</strong> and <strong className="text-[#b45309]">one standard outdoor electrical outlet</strong>. 
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-4 text-xs font-sans font-semibold text-zinc-700">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#e6dccf] rounded-lg shadow-sm">
              <span className="text-[#b45309]">✓</span> Clean & Quiet Service
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#e6dccf] rounded-lg shadow-sm">
              <span className="text-[#b45309]">✓</span> No Noisy Generators on Grass
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#e6dccf] rounded-lg shadow-sm">
              <span className="text-[#b45309]">✓</span> Flexible Digital Payments
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#e6dccf] rounded-lg shadow-sm">
              <span className="text-[#b45309]">✓</span> Cobb County Local Pride
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
