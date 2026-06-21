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

// Tabelas novas (currículos/candidaturas e orçamentos). Criadas de forma
// idempotente para que produção ganhe as tabelas sem rodar o /api/setup destrutivo.
const CRIAR_CURRICULOS = `CREATE TABLE IF NOT EXISTS curriculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  telefone VARCHAR(40),
  data_nascimento DATE NULL,
  cpf VARCHAR(20),
  rg VARCHAR(20),
  sexo VARCHAR(20),
  estado_civil VARCHAR(30),
  nacionalidade VARCHAR(60),
  endereco VARCHAR(255),
  cidade VARCHAR(120),
  estado VARCHAR(60),
  cep VARCHAR(15),
  vaga_desejada VARCHAR(150),
  pretensao_salarial VARCHAR(60),
  disponibilidade VARCHAR(80),
  escolaridade VARCHAR(80),
  cnh VARCHAR(20),
  possui_veiculo TINYINT DEFAULT 0,
  linkedin VARCHAR(255),
  portfolio VARCHAR(255),
  experiencias TEXT,
  formacoes TEXT,
  cursos TEXT,
  habilidades TEXT,
  sobre TEXT,
  origem VARCHAR(40) DEFAULT 'Site',
  status ENUM('Novo','Em análise','Entrevista','Aprovado','Reprovado') DEFAULT 'Novo',
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;

const CRIAR_ORCAMENTOS = `CREATE TABLE IF NOT EXISTS orcamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  telefone VARCHAR(40),
  tipo VARCHAR(80) DEFAULT 'Orçamento',
  descricao TEXT,
  dados TEXT,
  valor_estimado DECIMAL(10,2) DEFAULT 0.00,
  origem VARCHAR(40) DEFAULT 'Site',
  status ENUM('Novo','Em contato','Fechado','Cancelado') DEFAULT 'Novo',
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;

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

    // Tabelas novas (não destrutivo)
    await dbPool.query(CRIAR_CURRICULOS);
    await dbPool.query(CRIAR_ORCAMENTOS);
    console.log('🛠️  Migração: tabelas curriculos e orcamentos garantidas.');
  } catch (err) {
    // Sem banco acessível em dev a migração apenas é ignorada.
    console.error('⚠️  Migração de schema não aplicada:', err.code || err.message);
  }
}

module.exports = { garantirColunas };
