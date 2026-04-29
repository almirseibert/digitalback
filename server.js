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

// 2. Middlewares padrão - CONFIGURAÇÃO DE CORS ROBUSTA
// Como a aplicação usa JWT via header (Bearer Token) e não Cookies, 
// a configuração mais segura e que evita o erro de CORS é permitir o acesso de qualquer origem ('*')
app.use(cors({
    origin: '*', // Permite requisições de qualquer frontend (ideal para APIs com JWT)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], // Garante que o OPTIONS passa
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200 // Algumas versões de navegadores antigos/proxies preferem 200 a 204
}));

// Tratamento explícito para requisições de preflight (OPTIONS) em todas as rotas globais
app.options('*', cors());

// Permite que o Express entenda requisições com corpo em JSON
app.use(express.json());

// 3. Rota de Status (Para testar se o backend está vivo no EasyPanel)
// Pode acessar no navegador: https://sites-digitalplussback.oehpg2.easypanel.host/api/status
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', mensagem: 'API digit@l plus+ rodando sem erros de CORS!' });
});

// ========================================================================
// ROTA TEMPORÁRIA DE SETUP (Para criar o primeiro utilizador administrador)
// Após o deploy, aceda a: https://sites-digitalplussback.oehpg2.easypanel.host/api/setup
// ========================================================================
app.get('/api/setup', async (req, res) => {
    const bcrypt = require('bcrypt');
    const dbPool = require('./config/db');
    try {
        const senhaHash = await bcrypt.hash('123456', 10);
        // Tenta inserir o utilizador, se não existir ignora (INSERT IGNORE)
        const [result] = await dbPool.query(
            'INSERT IGNORE INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', 
            ['Almir Seibert', 'almir.seibert@gmail.com', senhaHash]
        );
        
        if (result.affectedRows > 0) {
            res.send(`
                <h2>✅ Utilizador admin criado com sucesso!</h2>
                <p><strong>E-mail:</strong> almir.seibert@gmail.com</p>
                <p><strong>Senha provisória:</strong> 123456</p>
                <p>Pode voltar ao painel do Frontend e fazer login.</p>
            `);
        } else {
            res.send('⚠️ O utilizador almir.seibert@gmail.com já existe na base de dados.');
        }
    } catch (error) {
        console.error('Erro no setup:', error);
        res.status(500).send(`
            <h2>❌ Erro ao criar utilizador.</h2>
            <p>Certifique-se que executou o script SQL no MySQL para criar as tabelas (como a tabela 'usuarios').</p>
            <p><b>Detalhe do erro:</b> ${error.message}</p>
        `);
    }
});

// 4. Registro das Rotas
// A Rota de autenticação é pública (para fazer login)
app.use('/api/auth', authRoutes);

// As rotas abaixo são Privadas (exigem que o usuário esteja logado com o Token)
app.use('/api/negociacoes', verificarToken, negociacaoRoutes);
app.use('/api/clientes', verificarToken, clienteRoutes);
app.use('/api/financeiro', verificarToken, financeiroRoutes);
app.use('/api/relatorios', verificarToken, relatorioRoutes);

// 5. Catch-all para rotas não encontradas 
// (Evita que retorne HTML de erro do Express e quebre o JSON do Frontend)
app.use((req, res, next) => {
    res.status(404).json({ success: false, error: 'Endpoint da API não encontrado.' });
});

// 6. Middleware de tratamento de erros globais 
// (Evita que o servidor caia (crash) por erros não tratados em alguma rota)
app.use((err, req, res, next) => {
    console.error('Erro global na API:', err.stack);
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
});

// 7. Start do Servidor
// O uso do '0.0.0.0' é fundamental no Docker/EasyPanel para que o container exponha a porta corretamente para a internet.
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Servidor Backend CRM digit@l plus+ rodando na porta ${PORT}`);
    console.log(`✅ CORS configurado para aceitar requisições externas.`);
    console.log(`======================================================\n`);
});