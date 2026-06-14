const dbPool = require('../config/db');
const overpass = require('../services/overpassService');

const prospeccaoController = {
  // Lista os tipos de empresa disponíveis para varredura
  categorias: (req, res) => {
    res.json({ success: true, data: overpass.listarCategorias() });
  },

  // Geocodifica um texto para centralizar o mapa
  geocode: async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Informe um local para buscar.' });
    }
    try {
      const lugares = await overpass.geocodificar(q.trim());
      res.json({ success: true, data: lugares });
    } catch (error) {
      console.error('Erro geocode:', error.message);
      res.status(502).json({ success: false, error: 'Falha ao localizar o endereço. Tente novamente.' });
    }
  },

  // Varredura: encontra empresas por categoria dentro do raio
  buscar: async (req, res) => {
    const { latitude, longitude, raio, categorias } = req.body;
    try {
      const resultado = await overpass.buscarEmpresas({
        lat: Number(latitude),
        lng: Number(longitude),
        raio: Number(raio),
        categorias,
      });
      res.json({ success: true, data: resultado });
    } catch (error) {
      console.error('Erro varredura:', error.message);
      const code = /coordenadas|categoria/i.test(error.message) ? 400 : 502;
      res.status(code).json({ success: false, error: error.message || 'Falha na varredura do mapa.' });
    }
  },

  // Importa empresas selecionadas como leads no funil, atribuídas a um vendedor
  importar: async (req, res) => {
    const { empresas, vendedor_id } = req.body;
    if (!Array.isArray(empresas) || empresas.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhuma empresa selecionada.' });
    }
    const conn = await dbPool.getConnection();
    try {
      // De-duplicação por osm_ref (já capturados antes)
      const refs = empresas.map(e => e.osm_ref).filter(Boolean);
      let existentes = new Set();
      if (refs.length) {
        const [rows] = await conn.query(
          `SELECT osm_ref FROM clientes WHERE osm_ref IN (${refs.map(() => '?').join(',')})`,
          refs
        );
        existentes = new Set(rows.map(r => r.osm_ref));
      }

      let inseridos = 0;
      let duplicados = 0;
      for (const e of empresas) {
        if (e.osm_ref && existentes.has(e.osm_ref)) { duplicados++; continue; }
        const [r] = await conn.query(
          `INSERT INTO clientes
            (nome, empresa, telefone, email, origem, categoria, endereco, cidade, estado,
             latitude, longitude, possui_website, website_url, osm_ref, status, vendedor_id, titulo)
           VALUES (?, ?, ?, ?, 'Prospecção', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Novo', ?, ?)`,
          [
            e.empresa || 'Contato', e.empresa || '', e.telefone || '', '',
            e.categoria || '', e.endereco || '', e.cidade || '', e.estado || '',
            e.latitude || null, e.longitude || null,
            e.possui_website ? 1 : 0, e.website_url || '', e.osm_ref || null,
            vendedor_id || null, `Website para ${e.empresa || 'novo cliente'}`,
          ]
        );
        await conn.query(
          `INSERT INTO interacoes (cliente_id, usuario_id, tipo, descricao)
           VALUES (?, ?, 'Sistema', ?)`,
          [r.insertId, req.usuario?.id || null,
           `Lead captado via prospecção no mapa${e.possui_website ? '' : ' · oportunidade SEM SITE'}.`]
        );
        inseridos++;
      }

      res.status(201).json({ success: true, inseridos, duplicados });
    } catch (error) {
      console.error('Erro ao importar:', error.message);
      res.status(500).json({ success: false, error: 'Erro ao importar empresas.' });
    } finally {
      conn.release();
    }
  },
};

module.exports = prospeccaoController;
