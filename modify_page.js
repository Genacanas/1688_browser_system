const fs = require('fs');

let code = fs.readFileSync('src/app/page.tsx', 'utf8');

// 1. Add states
const statesInjection = `
  const [activeTab, setActiveTab] = useState<'id' | 'image'>('id');
  const [imageSearchResults, setImageSearchResults] = useState<any[]>([]);
  const [imageSearchPage, setImageSearchPage] = useState(1);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [imageSearchError, setImageSearchError] = useState<string | null>(null);
  const [currentAliUrl, setCurrentAliUrl] = useState('');
  const [hasMoreImages, setHasMoreImages] = useState(true);
`;
code = code.replace(/const \[query, setQuery\] = useState\(''\);/, statesInjection + "\n  const [query, setQuery] = useState('');");

// 2. Refactor handleSearch into performIdSearch and add Image Handlers
const idSearchLogic = `
  const performIdSearch = async (q: string) => {
    setLoading(true);
    setError(null);
    const isUrl = q.startsWith('http') || q.includes('1688.com');
    try {
      let res;
      if (isUrl) {
        res = await fetch('/api/product/url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: q }) });
      } else {
        res = await fetch(\`/api/product/id?id=\${encodeURIComponent(q)}\`);
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
      const res = await fetch(\`/api/search-image?img_url=\${encodeURIComponent(aliUrl)}&page=\${page}&page_size=20\`);
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

  const handleImageResultClick = (itemId: string) => {
    setActiveTab('id');
    setQuery(itemId);
    performIdSearch(itemId);
  };
`;

code = code.replace(/const handleSearch = async \(e: React\.FormEvent\) => \{[\s\S]*?catch \(err: any\) \{[\s\S]*?setError\(err\.message\);\n    \} finally \{\n      setLoading\(false\);\n    \}\n  \};/, idSearchLogic);

// 3. Add Tabs to UI
const tabsUI = `
      <div className="flex flex-col items-center" style={{ marginBottom: '2rem' }}>
        <h1 className="text-5xl font-bold mb-4 flex items-center gap-4 text-primary">
          <Package size={48} /> 1688 Browser System
        </h1>
        
        {/* TABS */}
        <div className="flex justify-center mb-8 gap-4 bg-slate-900/50 p-2 rounded-2xl border border-slate-700">
          <button 
            onClick={() => setActiveTab('id')}
            className={\`px-8 py-3 rounded-xl font-bold transition-all \${activeTab === 'id' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}\`}
          >
            Search by ID / URL
          </button>
          <button 
            onClick={() => setActiveTab('image')}
            className={\`px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 \${activeTab === 'image' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}\`}
          >
            <UploadCloud size={20}/> Search by Image
          </button>
        </div>
      </div>

      {activeTab === 'id' ? (
        <>
`;

code = code.replace(/<div className="flex flex-col items-center" style=\{\{ marginBottom: '5rem' \}\}>[\s\S]*?<\/form>\n      <\/div>/, tabsUI + `
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
`);

// 4. Wrap the rest in the ID tab and add Image Tab UI
const imageTabUI = `
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

          {imageSearchResults.length > 0 && (
            <div className="w-full">
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

        </div>
      )}
`;

code = code.replace(/<\/main>/, imageTabUI + "\n    </main>");

fs.writeFileSync('src/app/page.tsx', code);
