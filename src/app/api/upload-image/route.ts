import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const token = process.env.TMAPI_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'TMAPI token not configured' }, { status: 500 });
    }

    // 1. Upload to Vercel Blob with random suffix to avoid collisions
    const blob = await put(file.name, file, { access: 'public', addRandomSuffix: true });

    // 2. Convert URL via TMAPI
    const convertRes = await fetch(`http://api.tmapi.top/1688/tools/image/convert_url?apiToken=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: blob.url,
        search_api_endpoint: '/search/image'
      })
    });

    const convertData = await convertRes.json();

    if (convertData.code !== 200) {
      return NextResponse.json({ 
        error: 'Error converting image in TMAPI', 
        details: convertData 
      }, { status: 500 });
    }

    // 3. Delete the temporary blob to save Vercel storage limits
    try {
      await del(blob.url);
    } catch (e) {
      console.error("Failed to delete temp blob:", e);
    }

    return NextResponse.json({ 
      ali_image_url: convertData.data.image_url,
      blob_url: blob.url // Might be useful for UI preview
    });
    
  } catch (error: any) {
    console.error('Error in upload-image API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
