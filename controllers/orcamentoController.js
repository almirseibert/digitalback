const dbPool = require('../config/db');

const STATUS_VALIDOS = ['Novo', 'Em contato', 'Fechado', 'Cancelado'];

function serializar(valor) {
    if (valor === undefined || valor === null) return null;
    if (typeof valor === 'string') return valor;
    try { return JSON.stringify(valor); } catch { return null; }
}

function parseJsonSeguro(texto) {
    if (!texto) return null;
    try { return JSON.parse(texto); } catch { return null; }
}

const orcamentoController = {
    // POST /api/publico/orcamentos  (público, sem token)
    // Recebe tanto pedidos de orçamento de serviço quanto a config de um capacete personalizado.
    criar: async (req, res) => {
        const b = req.body || {};
        if (!b.nome || (!b.email && !b.telefone)) {
            return res.status(400).json({ success: false, error: 'Informe nome e ao menos um contato (e-mail ou telefone).' });
        }
        try {
            const [r] = await dbPool.query(
                `INSERT INTO orcamentos
                 (nome, email, telefone, tipo, descricao, dados, valor_estimado, origem)
                 VALUES (?,?,?,?,?,?,?,?)`,
                [
                    b.nome, b.email || null, b.telefone || null,
                    b.tipo || 'Orçamento',
                    b.descricao || null,
                    serializar(b.dados),
                    b.valor_estimado != null ? b.valor_estimado : 0,
                    b.origem || 'Site',
                ]
            );
            res.status(201).json({ success: true, id: r.insertId, mensagem: 'Solicitação enviada com sucesso!' });
        } catch (error) {
            console.error('Erro ao salvar orçamento:', error);
            res.status(500).json({ success: false, error: 'Erro ao salvar a solicitação.' });
        }
    },

    // GET /api/admin/orcamentos
    listar: async (req, res) => {
        try {
            const [rows] = await dbPool.query(
                `SELECT id, nome, email, telefone, tipo, valor_estimado, status, data_criacao
                 FROM orcamentos ORDER BY data_criacao DESC`
            );
            res.json({ success: true, data: rows });
        } catch (error) {
            console.error('Erro ao listar orçamentos:', error);
            res.status(500).json({ success: false, error: 'Erro ao buscar orçamentos.' });
        }
    },

    // GET /api/admin/orcamentos/:id
    detalhe: async (req, res) => {
        try {
            const [rows] = await dbPool.query('SELECT * FROM orcamentos WHERE id = ?', [req.params.id]);
            if (rows.length === 0) return res.status(404).json({ success: false, error: 'Orçamento não encontrado.' });
            const dado = { ...rows[0], dados: parseJsonSeguro(rows[0].dados) };
            res.json({ success: true, data: dado });
        } catch (error) {
            console.error('Erro ao buscar orçamento:', error);
            res.status(500).json({ success: false, error: 'Erro ao buscar o orçamento.' });
        }
    },

    // PUT /api/admin/orcamentos/:id/status
    atualizarStatus: async (req, res) => {
        const { status } = req.body || {};
        if (!STATUS_VALIDOS.includes(status)) {
            return res.status(400).json({ success: false, error: 'Status inválido.' });
        }
        try {
            await dbPool.query('UPDATE orcamentos SET status = ? WHERE id = ?', [status, req.params.id]);
            res.json({ success: true, mensagem: 'Status atualizado.' });
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            res.status(500).json({ success: false, error: 'Erro ao atualizar o status.' });
        }
    },
};

module.exports = orcamentoController;
