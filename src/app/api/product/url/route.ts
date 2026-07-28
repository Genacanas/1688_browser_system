import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const token = process.env.TMAPI_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'API token not configured' }, { status: 500 });
    }

    const res = await fetch(`http://api.tmapi.top/1688/item_detail_by_url?apiToken=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, language: 'zh' }),
    });
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
