/**
 * Serviço de prospecção via Google Places API (New) — places.googleapis.com/v1.
 * Traz dados completos do Google Maps: avaliações, faixa de preço, horários,
 * formas de pagamento, acessibilidade, opções de serviço, resumo editorial etc.
 *
 * Requer a variável de ambiente GOOGLE_MAPS_API_KEY (Places API New habilitada).
 * Mantém o MESMO formato de saída do overpassService para encaixar no fluxo
 * de prospecção/importação já existente. A chave única de dedupe vira
 * `google/<place_id>` (gravada em clientes.osm_ref).
 */

const BASE = 'https://places.googleapis.com/v1';

// Categorias do sistema -> tipos de lugar do Google (Places API New)
const CAT_PARA_TIPOS = {
  restaurante:   ['restaurant'],
  fast_food:     ['fast_food_restaurant', 'meal_takeaway'],
  cafe:          ['cafe', 'coffee_shop'],
  padaria:       ['bakery'],
  bar:           ['bar', 'pub'],
  dentista:      ['dental_clinic', 'dentist'],
  clinica:       ['doctor', 'medical_lab'],
  academia:      ['gym', 'fitness_center'],
  beleza:        ['beauty_salon', 'hair_salon'],
  advogado:      ['lawyer'],
  contabilidade: ['accounting'],
  imobiliaria:   ['real_estate_agency'],
  oficina:       ['car_repair'],
  lavagem:       ['car_wash'],
  petshop:       ['pet_store'],
  farmacia:      ['pharmacy', 'drugstore'],
  roupas:        ['clothing_store'],
  hotel:         ['hotel', 'lodging'],
  mercado:       ['supermarket', 'grocery_store'],
};

const ROTULO_PRECO = {
  PRICE_LEVEL_FREE: 'Grátis',
  PRICE_LEVEL_INEXPENSIVE: 'R$ — econômico',
  PRICE_LEVEL_MODERATE: 'R$$ — moderado',
  PRICE_LEVEL_EXPENSIVE: 'R$$$ — caro',
  PRICE_LEVEL_VERY_EXPENSIVE: 'R$$$$ — muito caro',
};

function disponivel() {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  return Boolean(k && k.trim() && k !== 'inserir_sua_chave_google_places_aqui');
}

function tiposDeCategorias(categorias) {
  const tipos = new Set();
  for (const c of categorias) (CAT_PARA_TIPOS[c] || []).forEach(t => tipos.add(t));
  return [...tipos];
}

function virgula(num) {
  return Number(num).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function temWebsite(p) {
  return Boolean(p.websiteUri);
}

function componente(p, tipo) {
  const c = (p.addressComponents || []).find(a => (a.types || []).includes(tipo));
  return c ? (c.shortText || c.longText || '') : '';
}

/** Monta a lista [{label, valor}] com tudo que o Google conhece do local. */
function extrairDetalhes(p) {
  const out = [];
  const push = (label, v) => { if (v) out.push({ label, valor: String(v) }); };
  const sim = (cond) => (cond === true ? 'Sim' : undefined);

  if (p.rating) {
    push('Avaliação', `${virgula(p.rating)} ★${p.userRatingCount ? ` (${p.userRatingCount} avaliações)` : ''}`);
  }
  push('Faixa de preço', ROTULO_PRECO[p.priceLevel]);
  push('Resumo', p.editorialSummary?.text);
  push('Categoria (Google)', p.primaryTypeDisplayName?.text);
  if (p.regularOpeningHours?.weekdayDescriptions?.length) {
    push('Horários', p.regularOpeningHours.weekdayDescriptions.join(' · '));
  }
  push('Aberto agora', p.regularOpeningHours?.openNow === true ? 'Sim' : (p.regularOpeningHours?.openNow === false ? 'Não' : undefined));
  push('Refeição no local', sim(p.dineIn));
  push('Para viagem', sim(p.takeout));
  push('Entrega (delivery)', sim(p.delivery));
  push('Aceita reservas', sim(p.reservable));
  push('Serve café da manhã', sim(p.servesBreakfast));
  push('Serve almoço', sim(p.servesLunch));
  push('Serve jantar', sim(p.servesDinner));
  push('Opções vegetarianas', sim(p.servesVegetarianFood));
  push('Serve cerveja', sim(p.servesBeer));
  push('Serve vinho', sim(p.servesWine));
  push('Bom p/ crianças', sim(p.goodForChildren));
  push('Acessível p/ cadeirantes', sim(p.accessibilityOptions?.wheelchairAccessibleEntrance));
  push('Estacionamento acessível', sim(p.accessibilityOptions?.wheelchairAccessibleParking));
  if (p.paymentOptions) {
    const pg = [];
    if (p.paymentOptions.acceptsCreditCards) pg.push('crédito');
    if (p.paymentOptions.acceptsDebitCards) pg.push('débito');
    if (p.paymentOptions.acceptsCashOnly) pg.push('só dinheiro');
    if (p.paymentOptions.acceptsNfc) pg.push('aproximação (NFC)');
    if (pg.length) push('Pagamentos', pg.join(', '));
  }
  push('Telefone', p.nationalPhoneNumber);
  push('Website', p.websiteUri);
  push('Ver no Google Maps', p.googleMapsUri);
  return out;
}

function normalizar(p) {
  const possui_website = temWebsite(p);
  return {
    osm_ref: `google/${p.id}`,
    place_id: p.id,
    empresa: p.displayName?.text || 'Empresa',
    categoria: p.primaryTypeDisplayName?.text || 'Empresa',
    telefone: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
    email: '', // Google Places não expõe e-mail
    website_url: p.websiteUri || '',
    possui_website,
    rating: p.rating || null,
    total_avaliacoes: p.userRatingCount || 0,
    redes_sociais: [],
    detalhes: extrairDetalhes(p),
    endereco: p.formattedAddress || '',
    cidade: componente(p, 'administrative_area_level_2') || componente(p, 'locality'),
    estado: componente(p, 'administrative_area_level_1'),
    cep: componente(p, 'postal_code'),
    latitude: p.location?.latitude ?? null,
    longitude: p.location?.longitude ?? null,
  };
}

const FIELD_MASK_BUSCA = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location',
  'places.primaryTypeDisplayName', 'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
  'places.websiteUri', 'places.googleMapsUri', 'places.rating', 'places.userRatingCount',
  'places.priceLevel', 'places.regularOpeningHours', 'places.businessStatus',
  'places.dineIn', 'places.takeout', 'places.delivery', 'places.reservable',
  'places.servesBreakfast', 'places.servesLunch', 'places.servesDinner',
  'places.servesVegetarianFood', 'places.servesBeer', 'places.servesWine',
  'places.goodForChildren', 'places.accessibilityOptions', 'places.paymentOptions',
  'places.editorialSummary', 'places.addressComponents',
].join(',');

async function searchNearby({ lat, lng, raio, tipos }) {
  const resp = await fetch(`${BASE}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK_BUSCA,
    },
    body: JSON.stringify({
      includedTypes: tipos,
      maxResultCount: 20,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(raio, 50000) },
      },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Google Places ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const json = await resp.json();
  return json.places || [];
}

/**
 * Busca empresas por categoria via Google Places (uma chamada por categoria,
 * até 20 resultados cada). Saída idêntica à do overpassService.
 */
async function buscarEmpresas({ lat, lng, raio, categorias }) {
  if (!disponivel()) throw new Error('GOOGLE_MAPS_API_KEY não configurada.');
  if (!lat || !lng) throw new Error('Coordenadas inválidas');
  if (!Array.isArray(categorias) || categorias.length === 0) throw new Error('Selecione ao menos uma categoria');
  const raioM = Math.min(Math.max(Number(raio) || 1000, 100), 50000);

  const vistos = new Set();
  const resultados = [];
  for (const cat of categorias) {
    const tipos = tiposDeCategorias([cat]);
    if (!tipos.length) continue;
    let places = [];
    try {
      places = await searchNearby({ lat, lng, raio: raioM, tipos });
    } catch (err) {
      console.error('Google searchNearby falhou:', err.message);
      throw err;
    }
    for (const p of places) {
      if (!p.id || vistos.has(p.id)) continue;
      vistos.add(p.id);
      resultados.push(normalizar(p));
    }
  }

  resultados.sort((a, b) => Number(a.possui_website) - Number(b.possui_website));
  const semSite = resultados.filter(r => !r.possui_website).length;
  return {
    total: resultados.length,
    sem_site: semSite,
    com_site: resultados.length - semSite,
    raio_m: raioM,
    fonte: 'google',
    empresas: resultados,
  };
}

const FIELD_MASK_DETALHE = [
  'id', 'displayName', 'editorialSummary', 'rating', 'userRatingCount',
  'reviews', 'currentOpeningHours', 'websiteUri', 'googleMapsUri', 'nationalPhoneNumber',
].join(',');

/**
 * Detalhes ricos de UM lugar (inclui avaliações/reviews) — usado ao importar
 * para anexar trechos de avaliações ao lead.
 */
async function detalhesEmpresa(placeId) {
  if (!disponivel() || !placeId) return null;
  const id = placeId.replace(/^google\//, '');
  const resp = await fetch(`${BASE}/places/${encodeURIComponent(id)}?languageCode=pt-BR`, {
    headers: {
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK_DETALHE,
    },
  });
  if (!resp.ok) return null;
  const p = await resp.json();
  const extras = [];
  if (Array.isArray(p.reviews)) {
    for (const rev of p.reviews.slice(0, 3)) {
      const texto = rev.text?.text || rev.originalText?.text;
      if (texto) {
        extras.push({
          label: `Avaliação ${rev.rating ? `${rev.rating}★` : ''} — ${rev.authorAttribution?.displayName || 'Cliente'}`.trim(),
          valor: texto.slice(0, 400),
        });
      }
    }
  }
  return extras;
}

module.exports = { disponivel, buscarEmpresas, detalhesEmpresa, CAT_PARA_TIPOS };
