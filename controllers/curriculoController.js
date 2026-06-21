const dbPool = require('../config/db');

// Colunas JSON guardadas como TEXT (mesmo padrão de clientes.servicos_oferecidos)
const CAMPOS_JSON = ['experiencias', 'formacoes', 'cursos'];
const STATUS_VALIDOS = ['Novo', 'Em análise', 'Entrevista', 'Aprovado', 'Reprovado'];

function serializar(valor) {
    if (valor === undefined || valor === null) return null;
    if (typeof valor === 'string') return valor; // já veio serializado
    try { return JSON.stringify(valor); } catch { return null; }
}

function parseJsonSeguro(texto) {
    if (!texto) return [];
    try {
        const v = JSON.parse(texto);
        return Array.isArray(v) ? v : (v ? [v] : []);
    } catch {
        return [];
    }
}

function hidratar(linha) {
    const out = { ...linha };
    for (const campo of CAMPOS_JSON) {
        out[campo] = parseJsonSeguro(linha[campo]);
    }
    return out;
}

const curriculoController = {
    // POST /api/publico/curriculos  (público, sem token)
    criar: async (req, res) => {
        const b = req.body || {};
        if (!b.nome || !b.email) {
            return res.status(400).json({ success: false, error: 'Nome e e-mail são obrigatórios.' });
        }
        try {
            const [r] = await dbPool.query(
                `INSERT INTO curriculos
                 (nome, email, telefone, data_nascimento, cpf, rg, sexo, estado_civil, nacionalidade,
                  endereco, cidade, estado, cep, vaga_desejada, pretensao_salarial, disponibilidade,
                  escolaridade, cnh, possui_veiculo, linkedin, portfolio,
                  experiencias, formacoes, cursos, habilidades, sobre, origem)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    b.nome, b.email, b.telefone || null,
                    b.data_nascimento || null, b.cpf || null, b.rg || null,
                    b.sexo || null, b.estado_civil || null, b.nacionalidade || null,
                    b.endereco || null, b.cidade || null, b.estado || null, b.cep || null,
                    b.vaga_desejada || null, b.pretensao_salarial || null, b.disponibilidade || null,
                    b.escolaridade || null, b.cnh || null,
                    b.possui_veiculo ? 1 : 0,
                    b.linkedin || null, b.portfolio || null,
                    serializar(b.experiencias), serializar(b.formacoes), serializar(b.cursos),
                    b.habilidades || null, b.sobre || null,
                    b.origem || 'Site',
                ]
            );
            res.status(201).json({ success: true, id: r.insertId, mensagem: 'Currículo enviado com sucesso!' });
        } catch (error) {
            console.error('Erro ao salvar currículo:', error);
            res.status(500).json({ success: false, error: 'Erro ao salvar o currículo.' });
        }
    },

    // GET /api/admin/curriculos
    listar: async (req, res) => {
        try {
            const [rows] = await dbPool.query(
                `SELECT id, nome, email, telefone, vaga_desejada, cidade, estado, status, data_criacao
                 FROM curriculos ORDER BY data_criacao DESC`
            );
            res.json({ success: true, data: rows });
        } catch (error) {
            console.error('Erro ao listar currículos:', error);
            res.status(500).json({ success: false, error: 'Erro ao buscar currículos.' });
        }
    },

    // GET /api/admin/curriculos/:id
    detalhe: async (req, res) => {
        try {
            const [rows] = await dbPool.query('SELECT * FROM curriculos WHERE id = ?', [req.params.id]);
            if (rows.length === 0) return res.status(404).json({ success: false, error: 'Currículo não encontrado.' });
            res.json({ success: true, data: hidratar(rows[0]) });
        } catch (error) {
            console.error('Erro ao buscar currículo:', error);
            res.status(500).json({ success: false, error: 'Erro ao buscar o currículo.' });
        }
    },

    // PUT /api/admin/curriculos/:id/status
    atualizarStatus: async (req, res) => {
        const { status } = req.body || {};
        if (!STATUS_VALIDOS.includes(status)) {
            return res.status(400).json({ success: false, error: 'Status inválido.' });
        }
        try {
            await dbPool.query('UPDATE curriculos SET status = ? WHERE id = ?', [status, req.params.id]);
            res.json({ success: true, mensagem: 'Status atualizado.' });
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            res.status(500).json({ success: false, error: 'Erro ao atualizar o status.' });
        }
    },
};

module.exports = curriculoController;
