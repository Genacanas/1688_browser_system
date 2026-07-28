'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Package, Image as ImageIcon, ExternalLink, DollarSign, Store } from 'lucide-react';

const MAX_HISTORY_ITEMS = 25;

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  // Map of item_id -> currently selected main image URL
  const [selectedImgs, setSelectedImgs] = useState<{ [key: string]: string }>({});

  const rightColumnRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  // Ref to track programmatic scrolling to avoid IntersectionObserver firing incorrectly
  const isProgrammaticScroll = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('1688_search_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSearchHistory(parsed);
        if (parsed.length > 0) {
          setActiveItemId(parsed[0].item_id);
        }
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when history changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('1688_search_history', JSON.stringify(searchHistory));
    }
  }, [searchHistory, isLoaded]);

  // IntersectionObserver for synchronized scrolling
  useEffect(() => {
    if (!isLoaded || searchHistory.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScroll.current) return; // Skip if we are scrolling via click
        
        // Find the entry that is intersecting
        // We only care about the first one that is highly visible near the top
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-id');
            if (id) setActiveItemId(id);
          }
        });
      },
      {
        root: null, // viewport
        rootMargin: '-10% 0px -70% 0px', // Trigger when item enters the top 10%-30% of the screen
        threshold: 0,
      }
    );

    Object.values(itemRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [searchHistory, isLoaded]);

  const scrollToItem = (id: string) => {
    setActiveItemId(id);
    const element = itemRefs.current[id];
    if (element) {
      isProgrammaticScroll.current = true;
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Reset programmatic flag after smooth scroll is likely done
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 800);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    // Check if the input is just an ID and it's already in history
    if (!q.startsWith('http') && !q.includes('1688.com')) {
       const existingIndex = searchHistory.findIndex(item => item.item_id === q);
       if (existingIndex !== -1) {
           // Move to top
           const item = searchHistory[existingIndex];
           const newHistory = [item, ...searchHistory.filter((_, i) => i !== existingIndex)];
           setSearchHistory(newHistory);
           setQuery('');
           setTimeout(() => scrollToItem(item.item_id), 100);
           return;
       }
    }

    setLoading(true);
    setError(null);

    const isUrl = q.startsWith('http') || q.includes('1688.com');

    try {
      let res;
      if (isUrl) {
        res = await fetch('/api/product/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: q })
        });
      } else {
        res = await fetch(`/api/product/id?id=${encodeURIComponent(q)}`);
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch product data');
      }
      
      if (json.code !== 200 || !json.data) {
        throw new Error(json.msg || 'Invalid product data returned from API');
      }

      const newData = json.data;
      
      // Deduplicate by item_id (in case they searched by URL and we already have the ID)
      const existingIndex = searchHistory.findIndex(item => item.item_id === newData.item_id);
      
      let newHistory = [...searchHistory];
      if (existingIndex !== -1) {
        newHistory.splice(existingIndex, 1);
      }
      
      newHistory.unshift(newData);
      
      if (newHistory.length > MAX_HISTORY_ITEMS) {
         newHistory = newHistory.slice(0, MAX_HISTORY_ITEMS);
      }

      setSearchHistory(newHistory);
      setQuery('');
      
      setTimeout(() => scrollToItem(newData.item_id), 100);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <main style={{ minHeight: '100vh', padding: '3rem 2rem', maxWidth: '1400px', width: '100%', margin: '0 auto', display: 'block' }}>
      <div className="flex flex-col items-center" style={{ marginBottom: '10rem' }}>
        <h1 className="text-5xl font-bold mb-4 flex items-center gap-4 text-primary">
          <Package size={48} /> 1688 Browser System
        </h1>
        <p className="text-lg text-text-secondary text-center max-w-2xl mb-10">
          Enter a 1688 product URL or a product ID to quickly fetch its details, images, pricing, and SKUs.
        </p>

        <form onSubmit={handleSearch} className="w-full max-w-3xl relative">
          <input
            type="text"
            placeholder="Paste URL or Item ID here..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-8 py-5 text-lg rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-all pr-40"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-3 top-3 bottom-3 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 rounded-xl font-bold text-lg flex items-center gap-3 transition-colors"
          >
            {loading ? <div className="loader border-white border-t-transparent w-5 h-5"></div> : <Search size={22} />}
            {loading ? 'Searching' : 'Search'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-5 rounded-2xl mb-10 flex items-start gap-3 max-w-3xl mx-auto text-lg">
          <strong className="font-semibold">Error:</strong> {error}
        </div>
      )}

      {searchHistory.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          
          {/* Left Column: History List (Sticky) */}
          <div className="w-full lg:w-1/3 xl:w-1/4 flex-shrink-0 sticky top-8 flex flex-col gap-4 max-h-[90vh] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-lg font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-2">Search History</h3>
            {searchHistory.map((item) => (
              <div 
                key={item.item_id}
                onClick={() => scrollToItem(item.item_id)}
                className={`flex gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${
                  activeItemId === item.item_id 
                    ? 'bg-slate-800 border-blue-500 shadow-lg shadow-blue-500/10 scale-[1.02]' 
                    : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
                  {item.main_imgs && item.main_imgs.length > 0 ? (
                    <img src={item.main_imgs[0]} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500"><ImageIcon size={20}/></div>
                  )}
                </div>
                <div className="flex flex-col justify-center overflow-hidden">
                  <div className="text-sm font-semibold text-white truncate w-full" title={item.title}>{item.title}</div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5"><Package size={12}/> ID: {item.item_id}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Scrollable Details */}
          <div className="flex-1 flex flex-col gap-12 w-full" ref={rightColumnRef}>
            {searchHistory.map((productData) => (
              <div 
                key={productData.item_id} 
                data-id={productData.item_id}
                ref={(el) => {
                  itemRefs.current[productData.item_id] = el;
                }}
                className={`bg-slate-900/50 border rounded-[2rem] p-12 lg:p-14 transition-colors duration-500 scroll-mt-10 ${
                  activeItemId === productData.item_id ? 'border-slate-500 shadow-xl' : 'border-slate-700'
                }`}
              >
                <div className="flex flex-col xl:flex-row gap-14">
                  
                  {/* Image Gallery */}
                  <div className="w-full xl:w-2/5 flex-shrink-0">
                    {productData.main_imgs && productData.main_imgs.length > 0 ? (
                      <div className="flex flex-col gap-4">
                        <img 
                          src={selectedImgs[productData.item_id] ?? productData.main_imgs[0]} 
                          alt="Main Product Image" 
                          referrerPolicy="no-referrer"
                          className="w-full aspect-square object-cover rounded-2xl border border-slate-700 shadow-lg transition-all duration-300"
                        />
                        <div className="grid grid-cols-5 gap-2">
                          {productData.main_imgs.slice(0, 5).map((img: string, i: number) => {
                            const isSelected = (selectedImgs[productData.item_id] ?? productData.main_imgs[0]) === img;
                            return (
                              <img 
                                key={i} 
                                src={img} 
                                alt={`Thumbnail ${i+1}`} 
                                referrerPolicy="no-referrer"
                                onClick={() => setSelectedImgs(prev => ({ ...prev, [productData.item_id]: img }))}
                                className={`w-full aspect-square object-cover rounded-lg border cursor-pointer transition-all duration-200 ${
                                  isSelected
                                    ? 'border-blue-500 opacity-100 ring-2 ring-blue-500/50 scale-105'
                                    : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-2xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center text-slate-500">
                        <ImageIcon size={64} className="mb-4 opacity-50" />
                        <span className="text-xl">No Images</span>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 flex flex-col">
                    <h2 className="text-3xl font-bold text-white mb-5 leading-snug">
                      {productData.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-base text-slate-400 mb-8">
                      <span className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">ID: <strong className="text-slate-200">{productData.item_id}</strong></span>
                      {productData.product_url && (
                        <a href={productData.product_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-semibold shadow-md shadow-blue-900/20 transition-colors">
                          <ExternalLink size={18} /> Open in 1688
                        </a>
                      )}
                    </div>

                    {/* Pricing Block */}
                    <div className="bg-slate-800/60 rounded-xl p-8 mb-8 border border-slate-700">
                      <div className="text-base text-slate-400 mb-2 font-medium">Price ({productData.currency})</div>
                      <div className="text-5xl font-bold text-green-400 flex items-center gap-1">
                        <DollarSign size={40} />
                        {productData.price_info?.price_min === productData.price_info?.price_max 
                          ? productData.price_info?.price_min 
                          : `${productData.price_info?.price_min} - ${productData.price_info?.price_max}`
                        }
                      </div>
                      
                      {productData.tiered_price_info?.prices && productData.tiered_price_info.prices.length > 0 && (
                        <div className="mt-8 pt-8 border-t border-slate-700/80">
                          <div className="text-sm text-slate-400 mb-4 uppercase font-bold tracking-wider">Wholesale Tiers</div>
                          <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                            {productData.tiered_price_info.prices.map((tier: any, i: number) => (
                              <div key={i} className="bg-slate-900/80 rounded-xl border border-slate-700 p-4 min-w-[130px] text-center shadow-inner">
                                <div className="text-sm text-slate-400 mb-2">≥ {tier.beginAmount} {productData.offer_unit}</div>
                                <div className="text-xl font-bold text-green-400">¥{tier.price}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Shop Info & Stats */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                      <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
                        <div className="text-sm text-slate-400 mb-2 font-medium">Total Sales (90 days)</div>
                        <div className="text-3xl font-bold text-white">{productData.sale_info?.sale_quantity_90days || 0}</div>
                      </div>
                      <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50">
                        <div className="text-sm text-slate-400 mb-2 font-medium">Available Stock</div>
                        <div className="text-3xl font-bold text-white">{productData.stock || 0}</div>
                      </div>
                    </div>

                    {productData.shop_info && (
                      <div className="mt-auto pt-6 border-t border-slate-800">
                        <div className="text-sm text-slate-400 mb-3 font-medium">Supplier</div>
                        <div className="flex items-center justify-between bg-slate-800/30 p-5 rounded-xl border border-slate-700/30">
                          <span className="text-lg font-semibold text-slate-200 flex items-center gap-3">
                            <Store size={22} className="text-slate-400"/>
                            {productData.shop_info.shop_name}
                          </span>
                          {productData.shop_info.shop_url && (
                            <a href={productData.shop_info.shop_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-blue-900/20 transition-colors text-sm">
                              Visit Store <ExternalLink size={16} />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* SKUs and Properties Tabs (Simplified) */}
                {(productData.sku_props || productData.product_props) && (
                  <div className="mt-16 pt-10 border-t border-slate-800">
                    <h3 className="text-3xl font-bold text-white mb-10 border-l-4 border-blue-500 pl-5">Product Details</h3>
                    
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                      {/* Props */}
                      {productData.product_props && productData.product_props.length > 0 && (
                        <div>
                          <h4 className="text-lg font-bold text-slate-400 mb-6 uppercase tracking-wider">Specifications</h4>
                          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                            {productData.product_props.map((prop: any, i: number) => {
                              const key = Object.keys(prop)[0];
                              const val = prop[key];
                              return (
                                <div key={i} className={`flex border-b border-slate-700/30 last:border-0 ${i % 2 === 0 ? 'bg-slate-800/40' : 'bg-transparent'}`}>
                                  <div className="w-1/3 p-5 px-7 text-sm font-semibold text-slate-400 border-r border-slate-700/30">{key}</div>
                                  <div className="w-2/3 p-5 px-7 text-sm font-medium text-slate-200">{val}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* SKUs */}
                      {productData.sku_props && productData.sku_props.length > 0 && (
                        <div>
                          <h4 className="text-lg font-bold text-slate-400 mb-6 uppercase tracking-wider">Variations</h4>
                          <div className="flex flex-col gap-8">
                            {productData.sku_props.map((sp: any, i: number) => (
                              <div key={i} className="bg-slate-800/20 p-6 rounded-xl border border-slate-700/30">
                                <div className="text-lg font-semibold text-slate-300 mb-5">{sp.prop_name}:</div>
                                <div className="flex flex-wrap gap-3">
                                  {sp.values.map((v: any, j: number) => (
                                    <div key={j} className="flex items-center gap-3 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-2xl p-2.5 pr-5 text-sm text-slate-200 shadow-sm transition-colors">
                                      {v.imageUrl ? (
                                        <img src={v.imageUrl} alt={v.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-xl object-cover" />
                                      ) : (
                                        <div className="w-10 h-10 rounded-xl bg-slate-700"></div>
                                      )}
                                      <span className="font-semibold">{v.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
