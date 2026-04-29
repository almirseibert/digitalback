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

// 2. Middlewares padrão
app.use(cors({
    origin: 'https://sites-digitalplussfront.oehpg2.easypanel.host', // A URL exata do seu Frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // <-- FALTAVA O 'OPTIONS' AQUI!
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200 // <-- FUNDAMENTAL PARA O PREFLIGHT PASSAR
}));
app.use(express.json());

// 3. Rota de Status
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', mensagem: 'API digit@l plus+ rodando com estrutura modular!' });
});

// 4. Registro das Rotas
// A Rota de autenticação é pública (para fazer login)
app.use('/api/auth', authRoutes);

// As rotas abaixo são Privadas (exigem que o usuário esteja logado com o Token)
app.use('/api/negociacoes', verificarToken, negociacaoRoutes);
app.use('/api/clientes', verificarToken, clienteRoutes);
app.use('/api/financeiro', verificarToken, financeiroRoutes);
app.use('/api/relatorios', verificarToken, relatorioRoutes);

// 5. Start do Servidor
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Servidor Backend CRM digit@l plus+ rodando na porta ${PORT}`);
    console.log(`✅ Todas as rotas carregadas e protegidas.`);
    console.log(`======================================================\n`);
});
