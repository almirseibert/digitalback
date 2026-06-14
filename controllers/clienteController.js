const dbPool = require('../config/db');

// Mantido por compatibilidade — a tabela "clientes" agora representa os leads.
const clienteController = {
  listarClientes: async (req, res) => {
    try {
      const [rows] = await dbPool.query(
        `SELECT c.*, u.nome AS vendedor_nome
         FROM clientes c LEFT JOIN usuarios u ON c.vendedor_id = u.id
         ORDER BY c.data_criacao DESC`
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Erro ao buscar clientes' });
    }
  },
  criarCliente: async (req, res) => {
    const { nome, empresa, email, telefone, origem, categoria, cidade, vendedor_id } = req.body;
    try {
      const [result] = await dbPool.query(
        `INSERT INTO clientes (nome, empresa, email, telefone, origem, categoria, cidade, vendedor_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Novo')`,
        [nome, empresa, email, telefone, origem || 'Site', categoria || '', cidade || '', vendedor_id || null]
      );
      res.status(201).json({ success: true, id: result.insertId });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Erro ao criar cliente' });
    }
  },
};
module.exports = clienteController;
