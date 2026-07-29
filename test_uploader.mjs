import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const match = envFile.match(/TMAPI_TOKEN=(.*)/);
const API_TOKEN = match ? match[1].trim() : 'MISSING';

const LOCAL_IMAGE_PATH = 'C:\\Users\\genar\\Downloads\\imagen_local.jpg';

async function testHost() {
  try {
    const buffer = fs.readFileSync(LOCAL_IMAGE_PATH);
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('files[]', blob, 'imagen_local.jpg');

    const uploadRes = await fetch('https://uguu.se/upload', {
      method: 'POST',
      body: formData
    });
    const uploadData = await uploadRes.json();
    const publicUrl = uploadData.files[0].url;
    console.log("Uploaded to uguu.se:", publicUrl);

    const convertRes = await fetch(`http://api.tmapi.top/1688/tools/image/convert_url?apiToken=${API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: publicUrl, search_api_endpoint: "/search/image" })
    });
    const convertData = await convertRes.json();
    console.log("TMAPI Convert Response:", convertData);
  } catch (err) {
    console.error(err);
  }
}
testHost();
