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