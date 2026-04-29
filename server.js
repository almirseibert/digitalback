require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 1. Importa todas as rotas criadas
const negociacaoRoutes = require('./routes/negociacaoRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const financeiroRoutes = require('./routes/financeiroRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');
const authRoutes = require('./routes/authRoutes');
const verificarToken = require('./middlewares/authMiddleware'); // Importa o bloqueio de segurança


const app = express();
const PORT = process.env.PORT || 3000;

// 2. Middlewares padrão (Permitem leitura de JSON e comunicação com React)
app.use(cors());
app.use(express.json());

// 3. Rota Básica de Status (Para você testar se o servidor está online)
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', mensagem: 'API digit@l plus+ rodando 100% com estrutura modular completa!' });
});

// 4. Registro das Rotas (Endpoints)
// Ex: O React chama /api/clientes e cai no clienteRoutes.js
app.use('/api/negociacoes', negociacaoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/relatorios', relatorioRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/negociacoes', verificarToken, negociacaoRoutes);
app.use('/api/clientes', verificarToken, clienteRoutes);
app.use('/api/financeiro', verificarToken, financeiroRoutes);
app.use('/api/relatorios', verificarToken, relatorioRoutes);

// 5. Start do Servidor
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Servidor Backend CRM digit@l plus+ rodando na porta ${PORT}`);
    console.log(`✅ Rotas Carregadas:`);
    console.log(`   - /api/negociacoes`);
    console.log(`   - /api/clientes`);
    console.log(`   - /api/financeiro`);
    console.log(`   - /api/relatorios`);
    console.log(`======================================================\n`);
});
