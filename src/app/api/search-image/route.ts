import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imgUrl = searchParams.get('img_url');
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('page_size') || '20';

  if (!imgUrl) {
    return NextResponse.json({ error: 'img_url is required' }, { status: 400 });
  }

  const token = process.env.TMAPI_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'TMAPI token not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`http://api.tmapi.top/1688/search/image?apiToken=${token}&img_url=${encodeURIComponent(imgUrl)}&page=${page}&page_size=${pageSize}`, {
      method: 'GET',
    });
    const data = await res.json();

    if (data.code !== 200) {
      return NextResponse.json({ error: data.msg || 'API Error', details: data }, { status: data.code || 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching image search from TMAPI:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
