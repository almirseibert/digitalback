const dbPool = require('../config/db');
const { SERVICOS } = require('../config/servicos');

// Estágios do funil de captação (status para cada parte do processo)
const ESTAGIOS = ['Novo', 'Contactado', 'Qualificado', 'Proposta', 'Negociação', 'Ganho', 'Perdido'];

// Campos guardados como JSON (array/objeto) na tabela clientes
const CAMPOS_JSON = ['servicos_oferecidos', 'contatos', 'detalhes_externos'];

// Converte com segurança um campo JSON vindo do banco para objeto/array
function parseJSON(valor, fallback) {
  if (valor == null || valor === '') return fallback;
  if (typeof valor === 'object') return valor;
  try { return JSON.parse(valor); } catch { return fallback; }
}

// Mensagens automáticas (WhatsApp) disparadas ao mover de estágio
const MENSAGENS = {
  Contactado: (l) => `Olá! Aqui é da Studio Mythos. Vi a ${l.empresa} e gostaria de conversar sobre a presença digital de vocês. Tem um minuto? 🚀`,
  Qualificado: (l) => `Que bom falar com a ${l.empresa}! Posso preparar uma proposta sob medida. Qual o melhor horário para alinharmos? ✨`,
  Proposta: (l) => `Enviei a proposta da Studio Mythos para a ${l.empresa}. Qualquer dúvida estou à disposição! 📩`,
  Ganho: (l) => `Parabéns, ${l.empresa}! 🎉 Bem-vindos à Studio Mythos. Vamos começar!`,
};

const enviarWhatsapp = async (telefone, mensagem) => {
  console.log(`\n📱 [WHATSAPP] Para: ${telefone || 's/n'} | Msg: ${mensagem}\n`);
  return new Promise((r) => setTimeout(() => r(true), 300));
};

const leadController = {
  estagios: (req, res) => res.json({ success: true, data: ESTAGIOS }),

  // Catálogo de serviços que o vendedor pode oferecer ao lead
  catalogoServicos: (req, res) => res.json({ success: true, data: SERVICOS }),

  // Lista todos os leads com vendedor responsável e dias parado (aging)
  listar: async (req, res) => {
    try {
      const { vendedor_id, status, sem_site } = req.query;
      const where = [];
      const params = [];
      if (vendedor_id) { where.push('c.vendedor_id = ?'); params.push(vendedor_id); }
      if (status) { where.push('c.status = ?'); params.push(status); }
      if (sem_site === 'true') { where.push('c.possui_website = 0'); }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const [rows] = await dbPool.query(
        `SELECT c.*, u.nome AS vendedor_nome,
                TIMESTAMPDIFF(DAY, c.atualizado_em, NOW()) AS dias_parado,
                (SELECT COUNT(*) FROM interacoes i WHERE i.cliente_id = c.id) AS total_interacoes
         FROM clientes c
         LEFT JOIN usuarios u ON c.vendedor_id = u.id
         ${clause}
         ORDER BY c.atualizado_em DESC`,
        params
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Erro listar leads:', error.message);
      res.status(500).json({ success: false, error: 'Erro ao buscar leads.' });
    }
  },

  // Detalhe do lead + timeline de interações
  detalhe: async (req, res) => {
    const { id } = req.params;
    try {
      const [[lead]] = await dbPool.query(
        `SELECT c.*, u.nome AS vendedor_nome
         FROM clientes c LEFT JOIN usuarios u ON c.vendedor_id = u.id
         WHERE c.id = ?`, [id]
      );
      if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado.' });
      const [interacoes] = await dbPool.query(
        `SELECT i.*, u.nome AS usuario_nome
         FROM interacoes i LEFT JOIN usuarios u ON i.usuario_id = u.id
         WHERE i.cliente_id = ? ORDER BY i.data_criacao DESC`, [id]
      );
      // Desserializa os campos JSON para o frontend
      lead.servicos_oferecidos = parseJSON(lead.servicos_oferecidos, []);
      lead.contatos = parseJSON(lead.contatos, []);
      lead.detalhes_externos = parseJSON(lead.detalhes_externos, []);
      res.json({ success: true, data: { ...lead, interacoes } });
    } catch (error) {
      console.error('Erro detalhe lead:', error.message);
      res.status(500).json({ success: false, error: 'Erro ao carregar lead.' });
    }
  },

  // Cria um lead manualmente
  criar: async (req, res) => {
    const b = req.body;
    try {
      const [r] = await dbPool.query(
        `INSERT INTO clientes
          (nome, empresa, email, telefone, origem, categoria, endereco, cidade,
           valor_estimado, titulo, status, vendedor_id, possui_website, website_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.nome || '', b.empresa || '', b.email || '', b.telefone || '', b.origem || 'Manual',
         b.categoria || '', b.endereco || '', b.cidade || '', b.valor_estimado || 0,
         b.titulo || `Projeto ${b.empresa || ''}`, b.status || 'Novo', b.vendedor_id || null,
         b.possui_website ? 1 : 0, b.website_url || '']
      );
      await dbPool.query(
        `INSERT INTO interacoes (cliente_id, usuario_id, tipo, descricao) VALUES (?, ?, 'Sistema', 'Lead criado manualmente.')`,
        [r.insertId, req.usuario?.id || null]
      );
      res.status(201).json({ success: true, id: r.insertId });
    } catch (error) {
      console.error('Erro criar lead:', error.message);
      res.status(500).json({ success: false, error: 'Erro ao criar lead.' });
    }
  },

  // Atualiza campos gerais do lead
  atualizar: async (req, res) => {
    const { id } = req.params;
    const permitidos = ['nome', 'empresa', 'email', 'telefone', 'categoria', 'endereco', 'cidade',
      'valor_estimado', 'titulo', 'observacoes', 'website_url',
      'produto_oferecido', 'valor_proposta', 'servicos_oferecidos', 'contatos'];
    const sets = [];
    const params = [];
    for (const campo of permitidos) {
      if (req.body[campo] !== undefined) {
        sets.push(`${campo} = ?`);
        const valor = CAMPOS_JSON.includes(campo) ? JSON.stringify(req.body[campo] ?? []) : req.body[campo];
        params.push(valor);
      }
    }
    if (!sets.length) return res.status(400).json({ success: false, error: 'Nada para atualizar.' });
    params.push(id);
    try {
      await dbPool.query(`UPDATE clientes SET ${sets.join(', ')} WHERE id = ?`, params);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Erro ao atualizar lead.' });
    }
  },

  // Move o lead de estágio (com automação WhatsApp + registro na timeline)
  mudarStatus: async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!ESTAGIOS.includes(status)) return res.status(400).json({ success: false, error: 'Estágio inválido.' });
    try {
      const [[lead]] = await dbPool.query('SELECT * FROM clientes WHERE id = ?', [id]);
      if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado.' });

      await dbPool.query('UPDATE clientes SET status = ? WHERE id = ?', [status, id]);
      await dbPool.query(
        `INSERT INTO interacoes (cliente_id, usuario_id, tipo, descricao, status_para)
         VALUES (?, ?, 'Status', ?, ?)`,
        [id, req.usuario?.id || null, `Movido de "${lead.status}" para "${status}".`, status]
      );

      let automacao = false;
      const gerar = MENSAGENS[status];
      if (gerar) {
        const msg = gerar(lead);
        await enviarWhatsapp(lead.telefone, msg);
        await dbPool.query(
          `INSERT INTO interacoes (cliente_id, usuario_id, tipo, descricao, mensagem_automatica)
           VALUES (?, ?, 'WhatsApp', ?, 1)`,
          [id, req.usuario?.id || null, msg]
        );
        automacao = true;
      }
      res.json({ success: true, automacao_disparada: automacao });
    } catch (error) {
      console.error('Erro mudar status:', error.message);
      res.status(500).json({ success: false, error: 'Erro ao mover lead.' });
    }
  },

  // Atribui o lead a um vendedor (coloca em linha com o vendedor)
  atribuir: async (req, res) => {
    const { id } = req.params;
    const { vendedor_id } = req.body;
    try {
      const [[vend]] = await dbPool.query('SELECT nome FROM usuarios WHERE id = ?', [vendedor_id]);
      await dbPool.query('UPDATE clientes SET vendedor_id = ? WHERE id = ?', [vendedor_id || null, id]);
      await dbPool.query(
        `INSERT INTO interacoes (cliente_id, usuario_id, tipo, descricao)
         VALUES (?, ?, 'Atribuição', ?)`,
        [id, req.usuario?.id || null, vend ? `Lead atribuído ao vendedor ${vend.nome}.` : 'Atribuição removida.']
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Erro ao atribuir lead.' });
    }
  },

  // Registra um passo da negociação (interação manual do vendedor)
  registrarInteracao: async (req, res) => {
    const { id } = req.params;
    const { tipo, descricao } = req.body;
    if (!descricao || !descricao.trim()) return res.status(400).json({ success: false, error: 'Descreva o passo da negociação.' });
    try {
      await dbPool.query(
        `INSERT INTO interacoes (cliente_id, usuario_id, tipo, descricao) VALUES (?, ?, ?, ?)`,
        [id, req.usuario?.id || null, tipo || 'Nota', descricao.trim()]
      );
      // toca o atualizado_em do lead (reseta o aging)
      await dbPool.query('UPDATE clientes SET atualizado_em = NOW() WHERE id = ?', [id]);
      res.status(201).json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Erro ao registrar interação.' });
    }
  },
};

module.exports = leadController;
