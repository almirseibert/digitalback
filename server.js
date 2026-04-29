require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 1. Importa todas as rotas e o middleware de segurança
const authRoutes = require('./routes/authRoutes');
const negociacaoRoutes = require('./routes/negociacaoRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const financeiroRoutes = require('./routes/financeiroRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');
const verificarToken = require('./middlewares/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// 2. Middlewares padrão - CONFIGURAÇÃO DE CORS
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], 
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200 
}));
app.options('*', cors());
app.use(express.json());

app.get('/api/status', (req, res) => {
    res.json({ status: 'online', mensagem: 'API digit@l plus+ rodando!' });
});

// ========================================================================
// ROTA DE SETUP AUTOMÁTICO (Reset completo à prova de falhas)
// ========================================================================
app.get('/api/setup', async (req, res) => {
    const bcrypt = require('bcrypt');
    const dbPool = require('./config/db');
    let conn;
    
    try {
        // Obtemos uma conexão dedicada para garantir que as variáveis de sessão (FOREIGN_KEY_CHECKS) funcionem corretamente
        conn = await dbPool.getConnection();
        
        // DESATIVA A VERIFICAÇÃO DE CHAVES ESTRANGEIRAS TEMPORARIAMENTE
        // Isto impede o erro "Cannot drop table referenced by a foreign key constraint"
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        
        // 1. LIMPEZA E CRIAÇÃO DE TODAS AS TABELAS NECESSÁRIAS
        const sqlQueries = [
            `DROP TABLE IF EXISTS interacoes`,
            `DROP TABLE IF EXISTS lancamentos`,
            `DROP TABLE IF EXISTS financeiro_lancamentos`, // Remove explicitamente a tabela antiga que causou o erro
            `DROP TABLE IF EXISTS negociacoes`,
            `DROP TABLE IF EXISTS clientes`,
            `DROP TABLE IF EXISTS usuarios`,
            
            // Recriar as tabelas com a estrutura EXATA necessária
            `CREATE TABLE usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                senha VARCHAR(255) NOT NULL,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE clientes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                empresa VARCHAR(100),
                email VARCHAR(100),
                telefone VARCHAR(20),
                origem VARCHAR(50) DEFAULT 'Site',
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE negociacoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cliente_id INT,
                titulo VARCHAR(100),
                valor_estimado DECIMAL(10,2) DEFAULT 0.00,
                fase_funil VARCHAR(50) DEFAULT 'Prospecção',
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE lancamentos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                data DATE NOT NULL,
                descricao VARCHAR(255) NOT NULL,
                categoria VARCHAR(50),
                tipo VARCHAR(20) NOT NULL,
                valor DECIMAL(10,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'PENDENTE',
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE interacoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negociacao_id INT,
                tipo VARCHAR(50),
                descricao TEXT,
                mensagem_automatica BOOLEAN DEFAULT FALSE,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (negociacao_id) REFERENCES negociacoes(id) ON DELETE CASCADE
            )`
        ];

        // Executa todas as queries usando a mesma conexão
        for (let query of sqlQueries) {
            await conn.query(query);
        }

        // REATIVA A VERIFICAÇÃO DE CHAVES ESTRANGEIRAS
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');

        // 2. CRIAÇÃO DO ADMINISTRADOR
        const senhaHash = await bcrypt.hash('123456', 10);
        await conn.query('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', ['Almir Seibert', 'almir.seibert@gmail.com', senhaHash]);

        // Liberta a conexão de volta para o pool
        conn.release();

        // Resposta de Sucesso
        res.send(`
            <div style="font-family: sans-serif; padding: 20px;">
                <h2 style="color: #16a34a;">✅ Reset Forçado e Instalação Concluídos com Sucesso!</h2>
                <ul>
                    <li>Bloqueio de chaves estrangeiras contornado.</li>
                    <li>Tabelas antigas removidas.</li>
                    <li>Novas tabelas recriadas perfeitamente.</li>
                    <li>Administrador recriado com sucesso.</li>
                </ul>
                <p><strong>E-mail:</strong> almir.seibert@gmail.com</p>
                <p><strong>Senha:</strong> 123456</p>
                <br/>
                <p>Volte ao Frontend e faça F5. O sistema está agora 100% pronto a usar!</p>
            </div>
        `);

    } catch (error) {
        if (conn) {
            // Em caso de erro, tenta reativar as chaves estrangeiras e liberta a conexão
            try { await conn.query('SET FOREIGN_KEY_CHECKS = 1'); } catch(e) {}
            conn.release();
        }
        
        console.error('Erro na Instalação:', error);
        res.status(500).send(`
            <div style="font-family: sans-serif; padding: 20px;">
                <h2 style="color: #dc2626;">❌ Erro ao configurar o banco de dados.</h2>
                <p><b>Detalhe:</b> ${error.message}</p>
            </div>
        `);
    }
});

// 4. Registro das Rotas
app.use('/api/auth', authRoutes);
app.use('/api/negociacoes', verificarToken, negociacaoRoutes);
app.use('/api/clientes', verificarToken, clienteRoutes);
app.use('/api/financeiro', verificarToken, financeiroRoutes);
app.use('/api/relatorios', verificarToken, relatorioRoutes);

// 5. Catch-all
app.use((req, res, next) => {
    res.status(404).json({ success: false, error: 'Endpoint da API não encontrado.' });
});

// 6. Tratamento de Erros Globais
app.use((err, req, res, next) => {
    console.error('Erro global na API:', err.stack);
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
});

// 7. Start do Servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Servidor Backend CRM digit@l plus+ rodando na porta ${PORT}`);
    console.log(`✅ Preparado para produção!`);
    console.log(`======================================================\n`);
});