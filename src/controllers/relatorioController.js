const dbPool = require('../config/db');

const relatorioController = {
    obterResumoDashboard: async (req, res) => {
        try {
            // Busca estatísticas rápidas
            const [leads] = await dbPool.query('SELECT COUNT(*) as total FROM clientes');
            const [vendas] = await dbPool.query('SELECT COUNT(*) as total FROM negociacoes WHERE fase_funil = "Ganho"');
            const [receita] = await dbPool.query('SELECT SUM(valor_estimado) as total FROM negociacoes WHERE fase_funil = "Ganho"');

            res.json({
                success: true,
                data: {
                    totalLeads: leads[0].total,
                    vendasFechadas: vendas[0].total,
                    receitaPrevista: receita[0].total || 0
                }
            });
        } catch (error) {
            console.error('Erro ao buscar relatórios:', error);
            res.status(500).json({ success: false, error: 'Erro ao gerar relatórios' });
        }
    }
};

module.exports = relatorioController;
