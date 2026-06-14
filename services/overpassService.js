/**
 * Serviço de prospecção geográfica.
 * Usa a Overpass API (OpenStreetMap) para encontrar empresas por categoria
 * dentro de um raio, e o Nominatim para geocodificar endereços.
 * Tudo gratuito e sem chave de API.
 *
 * Diferencial Digital Pluss: marcamos quem NÃO tem website (possui_website=false)
 * — essas são as melhores oportunidades de venda de site.
 */

const UA = 'DigitalPluss-Prospector/1.0 (contato@digitalpluss.com.br)';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// Catálogo de tipos de empresa que podemos prospectar (rótulo PT-BR -> tags OSM)
const CATEGORIAS = [
  { id: 'restaurante',   label: 'Restaurantes',         icon: 'utensils-crossed', filtros: [['amenity', 'restaurant']] },
  { id: 'fast_food',     label: 'Lanchonetes',          icon: 'sandwich',         filtros: [['amenity', 'fast_food']] },
  { id: 'cafe',          label: 'Cafeterias',           icon: 'coffee',           filtros: [['amenity', 'cafe']] },
  { id: 'padaria',       label: 'Padarias',             icon: 'croissant',        filtros: [['shop', 'bakery']] },
  { id: 'bar',           label: 'Bares e Pubs',         icon: 'beer',             filtros: [['amenity', 'bar'], ['amenity', 'pub']] },
  { id: 'dentista',      label: 'Dentistas',            icon: 'tooth',            filtros: [['amenity', 'dentist'], ['healthcare', 'dentist']] },
  { id: 'clinica',       label: 'Clínicas e Médicos',   icon: 'stethoscope',      filtros: [['amenity', 'clinic'], ['amenity', 'doctors']] },
  { id: 'academia',      label: 'Academias',            icon: 'dumbbell',         filtros: [['leisure', 'fitness_centre'], ['leisure', 'sports_centre']] },
  { id: 'beleza',        label: 'Salões e Beleza',      icon: 'scissors',         filtros: [['shop', 'hairdresser'], ['shop', 'beauty']] },
  { id: 'advogado',      label: 'Advogados',            icon: 'scale',            filtros: [['office', 'lawyer']] },
  { id: 'contabilidade', label: 'Contabilidade',        icon: 'calculator',       filtros: [['office', 'accountant']] },
  { id: 'imobiliaria',   label: 'Imobiliárias',         icon: 'home',             filtros: [['office', 'estate_agent']] },
  { id: 'oficina',       label: 'Oficinas Mecânicas',   icon: 'wrench',           filtros: [['shop', 'car_repair']] },
  { id: 'lavagem',       label: 'Lavagens Automotivas', icon: 'droplets',         filtros: [['amenity', 'car_wash'], ['shop', 'car_wash']] },
  { id: 'petshop',       label: 'Pet Shops',            icon: 'paw-print',        filtros: [['shop', 'pet']] },
  { id: 'farmacia',      label: 'Farmácias',            icon: 'pill',             filtros: [['amenity', 'pharmacy']] },
  { id: 'roupas',        label: 'Lojas de Roupa',       icon: 'shirt',            filtros: [['shop', 'clothes']] },
  { id: 'hotel',         label: 'Hotéis e Pousadas',    icon: 'bed-double',       filtros: [['tourism', 'hotel'], ['tourism', 'guest_house']] },
  { id: 'mercado',       label: 'Mercados',             icon: 'shopping-cart',    filtros: [['shop', 'supermarket'], ['shop', 'convenience']] },
];

const CAT_BY_ID = Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));

function listarCategorias() {
  return CATEGORIAS.map(({ id, label, icon }) => ({ id, label, icon }));
}

function montarQuery({ lat, lng, raio, categorias, limite = 250 }) {
  const ao = `(around:${Math.round(raio)},${lat},${lng})`;
  const linhas = [];
  for (const catId of categorias) {
    const cat = CAT_BY_ID[catId];
    if (!cat) continue;
    for (const [k, v] of cat.filtros) {
      linhas.push(`  node["${k}"="${v}"]["name"]${ao};`);
      linhas.push(`  way["${k}"="${v}"]["name"]${ao};`);
    }
  }
  return `[out:json][timeout:25];\n(\n${linhas.join('\n')}\n);\nout center tags ${limite};`;
}

function classificarCategoria(tags) {
  for (const cat of CATEGORIAS) {
    for (const [k, v] of cat.filtros) {
      if (tags[k] === v) return cat.label;
    }
  }
  return 'Empresa';
}

function montarEndereco(tags) {
  const rua = tags['addr:street'];
  const num = tags['addr:housenumber'];
  const bairro = tags['addr:suburb'] || tags['addr:neighbourhood'];
  const partes = [];
  if (rua) partes.push(num ? `${rua}, ${num}` : rua);
  if (bairro) partes.push(bairro);
  return partes.join(' - ');
}

function temWebsite(tags) {
  return Boolean(
    tags.website || tags['contact:website'] || tags.url || tags['contact:url']
  );
}

function extrairTelefone(tags) {
  return tags.phone || tags['contact:phone'] || tags['contact:mobile'] || tags.mobile || '';
}

function extrairRedesSociais(tags) {
  const redes = [];
  if (tags['contact:instagram'] || tags.instagram) redes.push('Instagram');
  if (tags['contact:facebook'] || tags.facebook) redes.push('Facebook');
  if (tags['contact:whatsapp'] || tags.whatsapp) redes.push('WhatsApp');
  return redes;
}

function extrairEmail(tags) {
  return tags.email || tags['contact:email'] || '';
}

/**
 * Extrai tudo que o OpenStreetMap conhece sobre o local — análogo às
 * informações que aparecem no Google Maps (horários, cardápio, formas de
 * pagamento, acessibilidade, redes, etc.). Retorna uma lista [{label, valor}].
 */
function extrairDetalhes(tags) {
  const out = [];
  const push = (label, v) => { if (v) out.push({ label, valor: String(v) }); };
  const sim = (cond) => (cond ? 'Sim' : undefined);
  const limpar = (v) => (v ? String(v).replace(/_/g, ' ').replace(/;/g, ', ') : undefined);

  push('Horário de funcionamento', tags.opening_hours);
  push('Tipo de cozinha', limpar(tags.cuisine));
  push('Faixa de preço', tags.price_range || tags.price);
  push('Refeição no local', sim(tags['dine_in'] === 'yes'));
  push('Para viagem', sim(tags.takeaway === 'yes' || tags.takeaway === 'only'));
  push('Entrega (delivery)', sim(tags.delivery === 'yes'));
  push('Aceita reservas', sim(tags.reservation === 'yes' || tags.reservation === 'required'));
  push('Opções vegetarianas', sim(tags['diet:vegetarian'] === 'yes'));
  push('Opções veganas', sim(tags['diet:vegan'] === 'yes'));
  push('Servem álcool', sim(tags['drink:alcohol'] === 'yes' || tags.alcohol === 'yes'));
  push('Wi-Fi', sim(tags.internet_access === 'wlan' || tags.wifi === 'yes' || tags['internet_access:fee'] === 'no'));
  push('Aceita cartão', sim(tags['payment:credit_cards'] === 'yes' || tags['payment:cards'] === 'yes' || tags['payment:debit_cards'] === 'yes'));
  push('Pagamento por aproximação', sim(tags['payment:contactless'] === 'yes'));
  push('Vale-refeição', sim(tags['payment:meal_voucher'] === 'yes' || tags['payment:alelo'] === 'yes'));
  push('Acessível p/ cadeirantes', sim(tags.wheelchair === 'yes'));
  push('Estacionamento', sim(tags.parking === 'yes' || tags['amenity'] === 'parking'));
  push('Ambiente p/ crianças', sim(tags.kids_area === 'yes' || tags['child_friendly'] === 'yes'));
  push('Ar-condicionado', sim(tags.air_conditioning === 'yes'));
  push('Fumódromo', sim(tags.smoking === 'yes' || tags.smoking === 'outside'));
  push('Email', extrairEmail(tags));
  push('Instagram', tags['contact:instagram'] || tags.instagram);
  push('Facebook', tags['contact:facebook'] || tags.facebook);
  push('Website', tags.website || tags['contact:website'] || tags.url);
  return out;
}

async function chamarOverpass(query) {
  let ultimoErro;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': UA,
        },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) { ultimoErro = new Error(`Overpass ${resp.status}`); continue; }
      const json = await resp.json();
      return json;
    } catch (err) {
      clearTimeout(timeout);
      ultimoErro = err;
    }
  }
  throw ultimoErro || new Error('Overpass indisponível');
}

/**
 * Busca empresas por categoria dentro de um raio.
 * Retorna lista normalizada, com os SEM site primeiro.
 */
async function buscarEmpresas({ lat, lng, raio, categorias }) {
  if (!lat || !lng) throw new Error('Coordenadas inválidas');
  if (!Array.isArray(categorias) || categorias.length === 0) throw new Error('Selecione ao menos uma categoria');
  const raioM = Math.min(Math.max(Number(raio) || 1000, 100), 15000); // 100m a 15km

  const query = montarQuery({ lat, lng, raio: raioM, categorias });
  const json = await chamarOverpass(query);
  const elementos = json.elements || [];

  const vistos = new Set();
  const resultados = [];
  for (const el of elementos) {
    const tags = el.tags || {};
    if (!tags.name) continue;
    const elat = el.lat ?? el.center?.lat;
    const elng = el.lon ?? el.center?.lon;
    if (elat == null || elng == null) continue;

    const osm_ref = `${el.type}/${el.id}`;
    if (vistos.has(osm_ref)) continue;
    vistos.add(osm_ref);

    const possui_website = temWebsite(tags);
    resultados.push({
      osm_ref,
      empresa: tags.name,
      categoria: classificarCategoria(tags),
      telefone: extrairTelefone(tags),
      email: extrairEmail(tags),
      website_url: tags.website || tags['contact:website'] || tags.url || '',
      possui_website,
      redes_sociais: extrairRedesSociais(tags),
      detalhes: extrairDetalhes(tags),
      endereco: montarEndereco(tags),
      cidade: tags['addr:city'] || '',
      estado: tags['addr:state'] || '',
      cep: tags['addr:postcode'] || '',
      latitude: Number(elat),
      longitude: Number(elng),
    });
  }

  // Oportunidades (sem site) primeiro; depois com site.
  resultados.sort((a, b) => Number(a.possui_website) - Number(b.possui_website));

  const semSite = resultados.filter(r => !r.possui_website).length;
  return {
    total: resultados.length,
    sem_site: semSite,
    com_site: resultados.length - semSite,
    raio_m: raioM,
    empresas: resultados,
  };
}

/** Geocodifica um texto (cidade, endereço) via Nominatim. */
async function geocodificar(texto) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(texto)}&format=json&limit=5&addressdetails=1&accept-language=pt-BR`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': UA } });
    clearTimeout(timeout);
    if (!resp.ok) throw new Error(`Nominatim ${resp.status}`);
    const json = await resp.json();
    return json.map(r => ({
      nome: r.display_name,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      tipo: r.type,
    }));
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

module.exports = { listarCategorias, buscarEmpresas, geocodificar, CATEGORIAS };
