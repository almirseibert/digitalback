const dbPool = require('../config/db');

const clienteController = {
    listarClientes: async (req, res) => {
        try {
            const [rows] = await dbPool.query('SELECT * FROM clientes ORDER BY data_criacao DESC');
            res.json({ success: true, data: rows });
        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
            res.status(500).json({ success: false, error: 'Erro ao buscar clientes' });
        }
    },
    
    criarCliente: async (req, res) => {
        const { nome, empresa, email, telefone, origem } = req.body;
        try {
            const [result] = await dbPool.query(
                'INSERT INTO clientes (nome, empresa, email, telefone, origem) VALUES (?, ?, ?, ?, ?)',
                [nome, empresa, email, telefone, origem || 'Site']
            );
            res.status(201).json({ success: true, id: result.insertId });
        } catch (error) {
            console.error('Erro ao criar cliente:', error);
            res.status(500).json({ success: false, error: 'Erro ao criar cliente' });
        }
    }
};

module.exports = clienteController;