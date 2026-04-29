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
// ROTA DE SETUP AUTOMÁTICO (Cria as Tabelas e o Utilizador Administrador)
// ========================================================================
app.get('/api/setup', async (req, res) => {
    const bcrypt = require('bcrypt');
    const dbPool = require('./config/db');
    
    try {
        // 1. CRIAÇÃO DE TODAS AS TABELAS NECESSÁRIAS
        const sqlQueries = [
            `CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                senha VARCHAR(255) NOT NULL,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS clientes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                empresa VARCHAR(100),
                email VARCHAR(100),
                telefone VARCHAR(20),
                origem VARCHAR(50) DEFAULT 'Site',
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS negociacoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cliente_id INT,
                titulo VARCHAR(100),
                valor_estimado DECIMAL(10,2) DEFAULT 0.00,
                fase_funil VARCHAR(50) DEFAULT 'Prospecção',
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS lancamentos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                data DATE NOT NULL,
                descricao VARCHAR(255) NOT NULL,
                categoria VARCHAR(50),
                tipo VARCHAR(20) NOT NULL,
                valor DECIMAL(10,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'PENDENTE',
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS interacoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                negociacao_id INT,
                tipo VARCHAR(50),
                descricao TEXT,
                mensagem_automatica BOOLEAN DEFAULT FALSE,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (negociacao_id) REFERENCES negociacoes(id) ON DELETE CASCADE
            )`
        ];

        // Executa todas as queries de criação
        for (let query of sqlQueries) {
            await dbPool.query(query);
        }

        // 2. CRIAÇÃO OU REDEFINIÇÃO DO ADMINISTRADOR
        const senhaHash = await bcrypt.hash('123456', 10);
        const [rows] = await dbPool.query('SELECT * FROM usuarios WHERE email = ?', ['almir.seibert@gmail.com']);
        
        let msgAdmin = '';
        if (rows.length > 0) {
            await dbPool.query('UPDATE usuarios SET senha = ? WHERE email = ?', [senhaHash, 'almir.seibert@gmail.com']);
            msgAdmin = 'A palavra-passe do administrador foi redefinida.';
        } else {
            await dbPool.query('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', ['Almir Seibert', 'almir.seibert@gmail.com', senhaHash]);
            msgAdmin = 'O administrador foi criado com sucesso.';
        }

        // Resposta de Sucesso
        res.send(`
            <div style="font-family: sans-serif; padding: 20px;">
                <h2 style="color: #16a34a;">✅ Instalação do Sistema Concluída!</h2>
                <ul>
                    <li>Tabelas (Clientes, Negociações, Financeiro) criadas no MySQL.</li>
                    <li>${msgAdmin}</li>
                </ul>
                <p><strong>E-mail:</strong> almir.seibert@gmail.com</p>
                <p><strong>Senha:</strong> 123456</p>
                <br/>
                <p>Volte ao Frontend e o Erro 500 terá desaparecido. Pode começar a adicionar clientes!</p>
            </div>
        `);

    } catch (error) {
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