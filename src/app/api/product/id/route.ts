import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const token = process.env.TMAPI_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'API token not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`http://api.tmapi.top/1688/item_detail?apiToken=${token}&item_id=${id}&language=zh`, {
      method: 'GET',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
