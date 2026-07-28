'use client';

import { useState } from 'react';
import { Search, Package, Image as ImageIcon, Link as LinkIcon, DollarSign, RefreshCw } from 'lucide-react';

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productData, setProductData] = useState<any | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setProductData(null);

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

      setProductData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <div className="flex flex-col items-center mb-12">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3 text-primary">
          <Package size={36} /> 1688 Browser System
        </h1>
        <p className="text-text-secondary text-center max-w-lg mb-8">
          Enter a 1688 product URL or a product ID to quickly fetch its details, images, pricing, and SKUs.
        </p>

        <form onSubmit={handleSearch} className="w-full max-w-2xl relative">
          <input
            type="text"
            placeholder="Paste URL or Item ID here..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-6 py-4 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all pr-32"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-2 bottom-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            {loading ? <div className="loader border-white border-t-transparent w-4 h-4"></div> : <Search size={18} />}
            {loading ? 'Searching' : 'Search'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-8 flex items-start gap-3">
          <strong className="font-semibold">Error:</strong> {error}
        </div>
      )}

      {productData && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-8">
              
              {/* Image Gallery */}
              <div className="w-full md:w-1/3 flex-shrink-0">
                {productData.main_imgs && productData.main_imgs.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    <img 
                      src={productData.main_imgs[0]} 
                      alt="Main Product Image" 
                      className="w-full aspect-square object-cover rounded-xl border border-slate-700 shadow-lg"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      {productData.main_imgs.slice(1, 5).map((img: string, i: number) => (
                        <img 
                          key={i} 
                          src={img} 
                          alt={`Thumbnail ${i+1}`} 
                          className="w-full aspect-square object-cover rounded-md border border-slate-700 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-square rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center text-slate-500">
                    <ImageIcon size={48} className="mb-2 opacity-50" />
                    <span>No Images</span>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="flex-1 flex flex-col">
                <h2 className="text-2xl font-bold text-white mb-2 leading-tight">
                  {productData.title}
                </h2>
                <div className="flex items-center gap-4 text-sm text-slate-400 mb-6">
                  <span>ID: <strong className="text-slate-300">{productData.item_id}</strong></span>
                  {productData.product_url && (
                    <a href={productData.product_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      <LinkIcon size={14} /> Open in 1688
                    </a>
                  )}
                </div>

                {/* Pricing Block */}
                <div className="bg-slate-800/50 rounded-xl p-5 mb-6 border border-slate-700">
                  <div className="text-sm text-slate-400 mb-1">Price ({productData.currency})</div>
                  <div className="text-3xl font-bold text-green-400 flex items-center gap-1">
                    <DollarSign size={28} />
                    {productData.price_info?.price_min === productData.price_info?.price_max 
                      ? productData.price_info?.price_min 
                      : `${productData.price_info?.price_min} - ${productData.price_info?.price_max}`
                    }
                  </div>
                  
                  {productData.tiered_price_info?.prices && productData.tiered_price_info.prices.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                      <div className="text-xs text-slate-500 mb-2 uppercase font-semibold tracking-wider">Wholesale Tiers</div>
                      <div className="flex gap-4 overflow-x-auto pb-2">
                        {productData.tiered_price_info.prices.map((tier: any, i: number) => (
                          <div key={i} className="bg-slate-800/80 rounded border border-slate-700 p-2 min-w-[100px] text-center">
                            <div className="text-xs text-slate-400 mb-1">≥ {tier.beginAmount} {productData.offer_unit}</div>
                            <div className="font-semibold text-green-400">¥{tier.price}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Shop Info & Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                    <div className="text-xs text-slate-500 mb-1">Total Sales (90 days)</div>
                    <div className="text-xl font-semibold text-white">{productData.sale_info?.sale_quantity_90days || 0}</div>
                  </div>
                  <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                    <div className="text-xs text-slate-500 mb-1">Available Stock</div>
                    <div className="text-xl font-semibold text-white">{productData.stock || 0}</div>
                  </div>
                </div>

                {productData.shop_info && (
                  <div className="mt-auto pt-4 border-t border-slate-800">
                    <div className="text-xs text-slate-500 mb-1">Supplier</div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-300">{productData.shop_info.shop_name}</span>
                      {productData.shop_info.shop_url && (
                        <a href={productData.shop_info.shop_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          Visit Store
                        </a>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* SKUs and Properties Tabs (Simplified) */}
            {(productData.sku_props || productData.product_props) && (
              <div className="mt-12">
                <h3 className="text-xl font-semibold text-white mb-6 border-b border-slate-800 pb-2">Product Details</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Props */}
                  {productData.product_props && productData.product_props.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Specifications</h4>
                      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                        {productData.product_props.map((prop: any, i: number) => {
                          const key = Object.keys(prop)[0];
                          const val = prop[key];
                          return (
                            <div key={i} className={`flex border-b border-slate-700/30 last:border-0 ${i % 2 === 0 ? 'bg-slate-800/20' : 'bg-transparent'}`}>
                              <div className="w-1/3 p-3 text-sm text-slate-400 border-r border-slate-700/30">{key}</div>
                              <div className="w-2/3 p-3 text-sm text-slate-300">{val}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SKUs */}
                  {productData.sku_props && productData.sku_props.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Variations</h4>
                      <div className="flex flex-col gap-6">
                        {productData.sku_props.map((sp: any, i: number) => (
                          <div key={i}>
                            <div className="text-sm font-medium text-slate-300 mb-3">{sp.prop_name}:</div>
                            <div className="flex flex-wrap gap-2">
                              {sp.values.map((v: any, j: number) => (
                                <div key={j} className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-lg p-2 pr-3 text-sm text-slate-300">
                                  {v.imageUrl && (
                                    <img src={v.imageUrl} alt={v.name} className="w-6 h-6 rounded object-cover" />
                                  )}
                                  <span>{v.name}</span>
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
        </div>
      )}
    </main>
  );
}
