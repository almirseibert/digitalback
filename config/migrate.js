const dbPool = require('./db');

/**
 * Migração leve e idempotente: garante que a tabela `clientes` tenha as
 * colunas novas (produto/proposta/serviços/contatos/detalhes) sem precisar
 * rodar o /api/setup destrutivo em produção.
 */
const COLUNAS_CLIENTES = [
  ['produto_oferecido', 'VARCHAR(255)'],
  ['valor_proposta', 'DECIMAL(10,2) DEFAULT 0.00'],
  ['servicos_oferecidos', 'TEXT'],
  ['contatos', 'TEXT'],
  ['detalhes_externos', 'TEXT'],
];

async function garantirColunas() {
  try {
    const [linhas] = await dbPool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clientes'`
    );
    const existentes = new Set(linhas.map(l => (l.COLUMN_NAME || l.column_name).toLowerCase()));
    for (const [coluna, definicao] of COLUNAS_CLIENTES) {
      if (!existentes.has(coluna.toLowerCase())) {
        await dbPool.query(`ALTER TABLE clientes ADD COLUMN ${coluna} ${definicao}`);
        console.log(`🛠️  Migração: coluna clientes.${coluna} adicionada.`);
      }
    }
  } catch (err) {
    // Sem banco acessível em dev a migração apenas é ignorada.
    console.error('⚠️  Migração de schema não aplicada:', err.code || err.message);
  }
}

module.exports = { garantirColunas };
