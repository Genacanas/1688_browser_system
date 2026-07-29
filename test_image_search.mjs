import fs from 'fs';
import path from 'path';

// ==========================================
// CONFIGURACIÓN: Ingresa tu token aquí
const API_TOKEN = 'TU_TOKEN_AQUI'; // ¡REEMPLAZAR!
// ==========================================

const LOCAL_IMAGE_PATH = 'C:\\Users\\genar\\Downloads\\imagen_local.jpg';
const ALIBABA_IMAGE_URL = 'https://cbu01.alicdn.com/img/ibank/O1CN01kiGLVt1zrnj4knzgt_!!3666246768-0-cib.310x310.jpg';

async function searchWithTMAPI(imgUrl) {
  console.log(`\n🔍 Buscando productos usando la URL: ${imgUrl}`);
  const searchUrl = `http://api.tmapi.top/1688/search/image?apiToken=${API_TOKEN}&img_url=${encodeURIComponent(imgUrl)}&page=1&page_size=3`;
  
  const response = await fetch(searchUrl);
  const json = await response.json();
  
  if (json.code === 200) {
    console.log(`✅ ¡Búsqueda exitosa! Encontrados ${json.data.total_count} resultados.`);
    console.log(`Mostrando los primeros ${json.data.items.length}:`);
    json.data.items.forEach((item, idx) => {
      console.log(`   ${idx + 1}. [ID: ${item.item_id}] Precio: ¥${item.price} - Ventas: ${item.sale_info?.sale_quantity} - ${item.title.substring(0, 40)}...`);
    });
  } else {
    console.error("❌ Error en la búsqueda:", json);
  }
}

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE BÚSQUEDA POR IMAGEN ===");

  if (API_TOKEN === 'TU_TOKEN_AQUI') {
    console.error("❌ ERROR: Debes poner tu API_TOKEN real en la línea 5 del script.");
    return;
  }

  // PRUEBA 1: Buscar directamente con la imagen de Alibaba (Para probar el endpoint principal)
  console.log("\n--- PRUEBA 1: Usar imagen de Alibaba directa ---");
  await searchWithTMAPI(ALIBABA_IMAGE_URL);

  // PRUEBA 2: Flujo completo (Subir imagen local -> Convertir en TMAPI -> Buscar)
  console.log("\n--- PRUEBA 2: Flujo completo con imagen local ---");
  
  if (!fs.existsSync(LOCAL_IMAGE_PATH)) {
    console.error(`❌ ERROR: No se encontró la imagen local en: ${LOCAL_IMAGE_PATH}`);
    return;
  }

  try {
    // Paso 2.1: Usar una URL pública genérica (Wikipedia) porque tmpfiles rechaza los bots de Alibaba
    console.log("1️⃣ Usando una imagen pública de internet para la prueba (Wikipedia)...");
    const publicUrl = "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png";
    
    // Paso 2.2: Convertir la URL pública en URL de Alibaba usando TMAPI
    console.log("2️⃣ Enviando URL a TMAPI para convertirla a formato Alibaba...");
    const convertRes = await fetch(`http://api.tmapi.top/1688/tools/image/convert_url?apiToken=${API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: publicUrl,
        search_api_endpoint: "/search/image"
      })
    });
    const convertData = await convertRes.json();

    if (convertData.code !== 200) {
      console.error("❌ Error convirtiendo la imagen en TMAPI:", convertData);
      return;
    }

    const aliImageUrl = convertData.data.image_url;
    console.log(`✅ Imagen convertida con éxito por TMAPI. URL de Alibaba: ${aliImageUrl}`);

    // Paso 2.3: Buscar usando la URL convertida
    console.log("3️⃣ Buscando productos en 1688 con la nueva URL...");
    await searchWithTMAPI(aliImageUrl);

  } catch (err) {
    console.error("❌ Error inesperado durante el flujo de la imagen local:", err);
  }

  console.log("\n=== PRUEBAS FINALIZADAS ===");
}

runTests();
