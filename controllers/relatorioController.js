const dbPool = require('../config/db');

const relatorioController = {
  obterResumoDashboard: async (req, res) => {
    try {
      const [[leads]] = await dbPool.query('SELECT COUNT(*) AS total FROM clientes');
      const [[ganhos]] = await dbPool.query("SELECT COUNT(*) AS total FROM clientes WHERE status = 'Ganho'");
      const [[receita]] = await dbPool.query("SELECT COALESCE(SUM(valor_estimado),0) AS total FROM clientes WHERE status = 'Ganho'");
      const [[pipeline]] = await dbPool.query("SELECT COALESCE(SUM(valor_estimado),0) AS total FROM clientes WHERE status NOT IN ('Ganho','Perdido')");
      const [[semSite]] = await dbPool.query('SELECT COUNT(*) AS total FROM clientes WHERE possui_website = 0');
      const [[prospeccao]] = await dbPool.query("SELECT COUNT(*) AS total FROM clientes WHERE origem = 'Prospecção'");

      // Distribuição por estágio do funil (dados reais)
      const [funilRows] = await dbPool.query(
        "SELECT status, COUNT(*) AS total, COALESCE(SUM(valor_estimado),0) AS valor FROM clientes GROUP BY status"
      );
      const funil = {};
      funilRows.forEach(r => { funil[r.status] = { total: r.total, valor: Number(r.valor) }; });

      // Ranking de vendedores
      const [ranking] = await dbPool.query(
        `SELECT u.id, u.nome,
                COUNT(c.id) AS leads,
                SUM(CASE WHEN c.status = 'Ganho' THEN 1 ELSE 0 END) AS ganhos,
                COALESCE(SUM(CASE WHEN c.status = 'Ganho' THEN c.valor_estimado ELSE 0 END),0) AS receita
         FROM usuarios u
         LEFT JOIN clientes c ON c.vendedor_id = u.id
         WHERE u.ativo = 1
         GROUP BY u.id, u.nome
         ORDER BY receita DESC, ganhos DESC`
      );

      const totalLeads = leads.total;
      const taxaConversao = totalLeads > 0 ? Math.round((ganhos.total / totalLeads) * 100) : 0;

      res.json({
        success: true,
        data: {
          totalLeads,
          vendasFechadas: ganhos.total,
          receitaPrevista: Number(receita.total),
          pipelineAberto: Number(pipeline.total),
          oportunidadesSemSite: semSite.total,
          captadosProspeccao: prospeccao.total,
          taxaConversao,
          funil,
          ranking,
        },
      });
    } catch (error) {
      console.error('Erro dashboard:', error.message);
      res.status(500).json({ success: false, error: 'Erro ao gerar relatórios' });
    }
  },
};

module.exports = relatorioController;
