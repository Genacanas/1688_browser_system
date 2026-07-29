const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf8');

const searchStr = `
          {imageSearchResults.length > 0 && (
            <div className="w-full">
              <h2 className="text-2xl font-bold text-white mb-8 border-l-4 border-blue-500 pl-4">Image Search Results</h2>`;

const replacementStr = `
        </div>
      )}

      {/* Global Image Grid (Persists across tabs) */}
      {imageSearchResults.length > 0 && (
        <div className="w-full mt-16 pt-12 border-t border-slate-800">
          <h2 className="text-2xl font-bold text-white mb-8 border-l-4 border-blue-500 pl-4">Image Search Results</h2>`;

code = code.replace(searchStr, replacementStr);

const searchStrEnd = `
            </div>
          )}

        </div>
      )}

    </main>`;

const replacementStrEnd = `
            </div>
          )}

    </main>`;

code = code.replace(searchStrEnd, replacementStrEnd);

fs.writeFileSync('src/app/page.tsx', code);
