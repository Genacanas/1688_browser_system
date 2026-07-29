'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Package, Image as ImageIcon, ExternalLink, DollarSign, Store, UploadCloud, ChevronDown } from 'lucide-react';

const MAX_HISTORY_ITEMS = 25;

export default function Home() {
  
  const [activeTab, setActiveTab] = useState<'id' | 'image'>('id');
  const [imageSearchResults, setImageSearchResults] = useState<any[]>([]);
  const [imageSearchPage, setImageSearchPage] = useState(1);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [imageSearchError, setImageSearchError] = useState<string | null>(null);
  const [currentAliUrl, setCurrentAliUrl] = useState('');
  const [hasMoreImages, setHasMoreImages] = useState(true);

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

  
  const performIdSearch = async (rawQ: string | number) => {
    const q = String(rawQ);
    setLoading(true);
    setError(null);
    try {
      const isUrl = q.startsWith('http') || q.includes('1688.com');
      let res;
      if (isUrl) {
        res = await fetch('/api/product/url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: q }) });
      } else {
        res = await fetch(`/api/product/id?id=${encodeURIComponent(q)}`);
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch product data');
      if (json.code !== 200 || !json.data) throw new Error(json.msg || 'Invalid product data returned from API');

      const newData = json.data;
      const existingIndex = searchHistory.findIndex(item => item.item_id === newData.item_id);
      let newHistory = [...searchHistory];
      if (existingIndex !== -1) newHistory.splice(existingIndex, 1);
      newHistory.unshift(newData);
      if (newHistory.length > MAX_HISTORY_ITEMS) newHistory = newHistory.slice(0, MAX_HISTORY_ITEMS);
      
      setSearchHistory(newHistory);
      setQuery('');
      setTimeout(() => scrollToItem(newData.item_id), 100);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (!q.startsWith('http') && !q.includes('1688.com')) {
       const existingIndex = searchHistory.findIndex(item => item.item_id === q);
       if (existingIndex !== -1) {
           const item = searchHistory[existingIndex];
           const newHistory = [item, ...searchHistory.filter((_, i) => i !== existingIndex)];
           setSearchHistory(newHistory);
           setQuery('');
           setTimeout(() => scrollToItem(item.item_id), 100);
           return;
       }
    }
    await performIdSearch(q);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageSearchLoading(true);
    setImageSearchError(null);
    setImageSearchPage(1);
    setImageSearchResults([]);
    setHasMoreImages(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload-image', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload image');
      
      const aliUrl = uploadData.ali_image_url;
      setCurrentAliUrl(aliUrl);
      await fetchImagePage(aliUrl, 1);
    } catch (err: any) {
      setImageSearchError(err.message);
      setImageSearchLoading(false);
    }
  };

  const fetchImagePage = async (aliUrl: string, page: number) => {
    try {
      setImageSearchLoading(true);
      const res = await fetch(`/api/search-image?img_url=${encodeURIComponent(aliUrl)}&page=${page}&page_size=20`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      
      const items = data.data?.items || [];
      setImageSearchResults(prev => page === 1 ? items : [...prev, ...items]);
      
      if (!data.data?.has_next_page || items.length === 0) {
        setHasMoreImages(false);
      }
    } catch (err: any) {
      setImageSearchError(err.message);
    } finally {
      setImageSearchLoading(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = imageSearchPage + 1;
    setImageSearchPage(nextPage);
    fetchImagePage(currentAliUrl, nextPage);
  };

  const handleImageResultClick = (itemId: string | number) => {
    const idStr = String(itemId);
    setActiveTab('id');
    setQuery(idStr);
    
    // Check if it's already in history
    const existingIndex = searchHistory.findIndex(item => String(item.item_id) === idStr);
    if (existingIndex !== -1) {
        const item = searchHistory[existingIndex];
        const newHistory = [item, ...searchHistory.filter((_, i) => i !== existingIndex)];
        setSearchHistory(newHistory);
        setTimeout(() => scrollToItem(item.item_id), 100);
        return;
    }
    
    // If not in history, fetch from API
    performIdSearch(idStr);
  };


  if (!isLoaded) return null;

  return (
    <main style={{ minHeight: '100vh', padding: '3rem 2rem', maxWidth: '1400px', width: '100%', margin: '0 auto', display: 'block' }}>
      
      <div className="flex flex-col items-center" style={{ marginBottom: '2rem' }}>
        <h1 className="text-5xl font-bold mb-4 flex items-center gap-4 text-primary">
          <Package size={48} /> 1688 Browser System
        </h1>
        
        {/* TABS */}
        <div className="flex justify-center mt-6 mb-14 gap-8 w-full max-w-2xl">
          <button 
            onClick={() => setActiveTab('id')}
            className={`flex-1 py-4 rounded-2xl font-bold transition-all duration-300 text-lg border-2 ${
              activeTab === 'id' 
                ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_25px_rgba(37,99,235,0.5)] scale-105' 
                : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:border-blue-500/50 hover:text-blue-300'
            }`}
          >
            Search by ID / URL
          </button>
          <button 
            onClick={() => setActiveTab('image')}
            className={`flex-1 py-4 rounded-2xl font-bold transition-all duration-300 text-lg border-2 flex items-center justify-center gap-3 ${
              activeTab === 'image' 
                ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_25px_rgba(16,185,129,0.5)] scale-105' 
                : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-300'
            }`}
          >
            <UploadCloud size={24}/> Search by Image
          </button>
        </div>
      </div>

      {activeTab === 'id' ? (
        <>

        <div className="flex flex-col items-center" style={{ marginBottom: '5rem' }}>
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
              disabled={loading || (!query.trim() && !loading)}
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
                className={`bg-slate-900/50 border rounded-[2rem] transition-colors duration-500 scroll-mt-10 ${
                  activeItemId === productData.item_id ? 'border-slate-500 shadow-xl' : 'border-slate-700'
                }`}
                style={{ padding: '1.5rem' }}
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
                    <div className="bg-slate-800/60 rounded-xl border border-slate-700" style={{ padding: '2rem', marginBottom: '2rem' }}>
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
                    <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '2rem' }}>
                      <div className="bg-slate-800/40 rounded-xl border border-slate-700/50" style={{ padding: '1.5rem' }}>
                        <div className="text-sm text-slate-400 mb-2 font-medium">Total Sales (90 days)</div>
                        <div className="text-3xl font-bold text-white">{productData.sale_info?.sale_quantity_90days || 0}</div>
                      </div>
                      <div className="bg-slate-800/40 rounded-xl border border-slate-700/50" style={{ padding: '1.5rem' }}>
                        <div className="text-sm text-slate-400 mb-2 font-medium">Available Stock</div>
                        <div className="text-3xl font-bold text-white">{productData.stock || 0}</div>
                      </div>
                    </div>

                    {productData.shop_info && (
                      <div className="mt-auto pt-6 border-t border-slate-800">
                        <div className="text-sm text-slate-400 mb-3 font-medium">Supplier</div>
                        <div className="flex items-center justify-between bg-slate-800/30 rounded-xl border border-slate-700/30" style={{ padding: '1.25rem 1.5rem' }}>
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
                    <h3 className="text-3xl font-bold text-white mb-10 border-l-4 border-blue-500 pl-5"> Product Details</h3>
                    
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                      {/* Props */}
                      {productData.product_props && productData.product_props.length > 0 && (
                        <div>
                          <h4 className="text-lg font-bold text-slate-400 mb-6 uppercase tracking-wider"> Specifications</h4>
                          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                            {productData.product_props.map((prop: any, i: number) => {
                              const key = Object.keys(prop)[0];
                              const val = typeof prop[key] === 'string' ? prop[key].replace(/;/g, '; ') : prop[key];
                              return (
                                <div key={i} className={`flex border-b border-slate-700/30 last:border-0 ${i % 2 === 0 ? 'bg-slate-800/40' : 'bg-transparent'}`}>
                                  <div className="w-1/3 text-sm font-semibold text-slate-400 border-r border-slate-700/30" style={{ padding: '1rem 1.5rem', wordBreak: 'break-word' }}>{key}</div>
                                  <div className="w-2/3 text-sm font-medium text-slate-200" style={{ padding: '1rem 1.5rem', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{val}</div>
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
                              <div key={i} className="bg-slate-800/20 rounded-xl border border-slate-700/30" style={{ padding: '1.5rem' }}>
                                <div className="text-lg font-semibold text-slate-300 mb-5">{sp.prop_name}:</div>
                                <div className="flex flex-wrap gap-3">
                                  {sp.values.map((v: any, j: number) => (
                                    <div key={j} className="flex items-center gap-3 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-2xl text-sm text-slate-200 shadow-sm transition-colors" style={{ padding: '0.75rem 1.25rem' }}>
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
    
        </>
      ) : (
        <div className="flex flex-col items-center w-full">
          
          <div className="w-full max-w-3xl bg-slate-900/50 border border-slate-700 rounded-3xl p-10 flex flex-col items-center justify-center text-center mb-12">
            <input type="file" id="image-upload" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-4 group">
              <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary text-slate-400 border-2 border-dashed border-slate-600 group-hover:border-primary transition-all">
                {imageSearchLoading && imageSearchResults.length === 0 ? (
                   <div className="loader border-primary border-t-transparent w-10 h-10"></div>
                ) : (
                   <UploadCloud size={40} />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Upload an Image</h3>
                <p className="text-slate-400">Click to browse your computer for an image to search.</p>
              </div>
            </label>
            {imageSearchError && (
              <div className="mt-6 bg-red-500/10 text-red-400 p-4 rounded-xl text-sm border border-red-500/30">
                {imageSearchError}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Global Image Grid (Persists across tabs) */}
      {imageSearchResults.length > 0 && (
        <div className="w-full mt-16 pt-12 border-t border-slate-800">
          <h2 className="text-2xl font-bold text-white mb-8 border-l-4 border-blue-500 pl-4">Image Search Results</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {imageSearchResults.map((item, idx) => (
                  <div 
                    key={item.item_id + idx} 
                    onClick={() => handleImageResultClick(item.item_id)}
                    className="bg-slate-900/80 border border-slate-700 rounded-2xl overflow-hidden cursor-pointer hover:border-primary hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col"
                  >
                    <div className="w-full aspect-square relative bg-slate-800 overflow-hidden flex-shrink-0">
                      <img src={item.img} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      {item.sale_info?.sale_quantity > 0 && (
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-xs font-bold text-white px-2 py-1 rounded-lg">
                          {item.sale_info.sale_quantity}+ sold
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="text-xl font-bold text-green-400 mb-2">¥{item.price}</div>
                      <div className="text-sm font-medium text-slate-300 line-clamp-2 mb-3 flex-1" title={item.title}>{item.title}</div>
                      {item.shop_info && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 truncate mt-auto">
                          <Store size={12}/> {item.shop_info.company_name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {hasMoreImages && (
                <div className="mt-12 flex justify-center">
                  <button 
                    onClick={handleLoadMore}
                    disabled={imageSearchLoading}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-10 rounded-xl border border-slate-600 transition-colors flex items-center gap-3 disabled:opacity-50"
                  >
                    {imageSearchLoading ? <div className="loader border-white border-t-transparent w-5 h-5"></div> : <ChevronDown size={20}/>}
                    {imageSearchLoading ? 'Loading more...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          )}

    </main>
  );
}
