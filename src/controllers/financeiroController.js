const dbPool = require('../config/db');

const financeiroController = {
    listarLancamentos: async (req, res) => {
        try {
            const [rows] = await dbPool.query('SELECT * FROM lancamentos ORDER BY data DESC');
            res.json({ success: true, data: rows });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Erro ao buscar financeiro' });
        }
    },
    criarLancamento: async (req, res) => {
        const { data, descricao, categoria, tipo, valor, status } = req.body;
        try {
            await dbPool.query('INSERT INTO lancamentos (data, descricao, categoria, tipo, valor, status) VALUES (?, ?, ?, ?, ?, ?)', [data, descricao, categoria, tipo, valor, status]);
            res.status(201).json({ success: true, mensagem: 'Lançamento registrado!' });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Erro ao registrar' });
        }
    }
};
module.exports = financeiroController;
