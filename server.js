require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 1. Rotas e middleware de segurança
const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/leadRoutes');
const prospeccaoRoutes = require('./routes/prospeccaoRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const financeiroRoutes = require('./routes/financeiroRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');
const verificarToken = require('./middlewares/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Rede de segurança: um erro assíncrono (ex.: queda momentânea do MySQL)
// não deve derrubar o servidor inteiro.
process.on('unhandledRejection', (reason) => {
    console.error('⚠️  Unhandled Rejection:', reason && reason.message ? reason.message : reason);
});

// 2. CORS + JSON
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200,
}));
app.options('*', cors());
app.use(express.json());

app.get('/api/status', (req, res) => {
    res.json({ status: 'online', mensagem: 'API Studio Mythos rodando!' });
});

// ========================================================================
// SETUP AUTOMÁTICO — cria/recria todo o schema e dados de arranque
// ========================================================================
app.get('/api/setup', async (req, res) => {
    const bcrypt = require('bcrypt');
    const dbPool = require('./config/db');
    let conn;

    try {
        conn = await dbPool.getConnection();
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');

        const drops = [
            'DROP TABLE IF EXISTS interacoes',
            'DROP TABLE IF EXISTS lancamentos',
            'DROP TABLE IF EXISTS financeiro_lancamentos',
            'DROP TABLE IF EXISTS negociacoes',
            'DROP TABLE IF EXISTS clientes',
            'DROP TABLE IF EXISTS usuarios',
        ];
        for (const q of drops) await conn.query(q);

        await conn.query(`CREATE TABLE usuarios (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            senha VARCHAR(255) NOT NULL,
            papel ENUM('admin','vendedor') DEFAULT 'vendedor',
            ativo TINYINT DEFAULT 1,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await conn.query(`CREATE TABLE clientes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(120),
            empresa VARCHAR(150),
            email VARCHAR(120),
            telefone VARCHAR(30),
            origem VARCHAR(40) DEFAULT 'Site',
            categoria VARCHAR(80),
            endereco VARCHAR(255),
            cidade VARCHAR(120),
            estado VARCHAR(80),
            latitude DECIMAL(10,7),
            longitude DECIMAL(10,7),
            possui_website TINYINT DEFAULT NULL,
            website_url VARCHAR(255),
            osm_ref VARCHAR(60) UNIQUE,
            status VARCHAR(40) DEFAULT 'Novo',
            vendedor_id INT NULL,
            valor_estimado DECIMAL(10,2) DEFAULT 0.00,
            titulo VARCHAR(150),
            observacoes TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE SET NULL
        )`);

        await conn.query(`CREATE TABLE interacoes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            cliente_id INT,
            usuario_id INT NULL,
            tipo VARCHAR(40),
            descricao TEXT,
            status_para VARCHAR(40) NULL,
            mensagem_automatica TINYINT DEFAULT 0,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
        )`);

        await conn.query(`CREATE TABLE lancamentos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            data DATE NOT NULL,
            descricao VARCHAR(255) NOT NULL,
            categoria VARCHAR(50),
            tipo VARCHAR(20) NOT NULL,
            valor DECIMAL(10,2) NOT NULL,
            status VARCHAR(20) DEFAULT 'PENDENTE',
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await conn.query('SET FOREIGN_KEY_CHECKS = 1');

        // ----- Utilizadores (senha padrão: 123456) -----
        const senhaHash = await bcrypt.hash('123456', 10);
        const [admin] = await conn.query(
            "INSERT INTO usuarios (nome, email, senha, papel) VALUES (?, ?, ?, 'admin')",
            ['Almir Seibert', 'almir.seibert@gmail.com', senhaHash]
        );
        const [v1] = await conn.query(
            "INSERT INTO usuarios (nome, email, senha, papel) VALUES (?, ?, ?, 'vendedor')",
            ['Mariana Alves', 'mariana@digitalpluss.com', senhaHash]
        );
        const [v2] = await conn.query(
            "INSERT INTO usuarios (nome, email, senha, papel) VALUES (?, ?, ?, 'vendedor')",
            ['Rafael Costa', 'rafael@digitalpluss.com', senhaHash]
        );
        const vendA = v1.insertId;
        const vendB = v2.insertId;

        // ----- Leads de exemplo (Curitiba) -----
        const leads = [
            ['Padaria Pão Quente', 'padaria', 'Rua das Flores, 120 - Centro', -25.4290, -49.2710, 0, '', 'Novo', vendA, 1500, '+55 41 99999-0001'],
            ['Clínica Sorriso', 'dentista', 'Av. Sete de Setembro, 800', -25.4360, -49.2700, 1, 'https://clinicasorriso.com', 'Contactado', vendA, 2200, '+55 41 99999-0002'],
            ['Academia PowerFit', 'academia', 'Rua XV de Novembro, 450', -25.4305, -49.2680, 0, '', 'Qualificado', vendB, 1800, '+55 41 99999-0003'],
            ['Advocacia Lima & Associados', 'advogado', 'Rua Marechal Deodoro, 200', -25.4330, -49.2750, 0, '', 'Proposta', vendB, 4500, '+55 41 99999-0004'],
            ['Restaurante Sabor da Terra', 'restaurante', 'Av. Cândido de Abreu, 90', -25.4180, -49.2660, 0, '', 'Negociação', vendA, 3000, '+55 41 99999-0005'],
            ['Pet Mundo', 'petshop', 'Rua Brigadeiro Franco, 310', -25.4400, -49.2720, 1, 'https://petmundo.com.br', 'Ganho', vendB, 2500, '+55 41 99999-0006'],
        ];
        for (const [empresa, cat, end, lat, lng, site, url, status, vend, valor, tel] of leads) {
            const [r] = await conn.query(
                `INSERT INTO clientes (nome, empresa, telefone, origem, categoria, endereco, cidade, estado,
                    latitude, longitude, possui_website, website_url, status, vendedor_id, valor_estimado, titulo)
                 VALUES (?, ?, ?, 'Prospecção', ?, ?, 'Curitiba', 'PR', ?, ?, ?, ?, ?, ?, ?, ?)`,
                [empresa, empresa, tel, cat, end, lat, lng, site, url, status, vend, valor, `Website para ${empresa}`]
            );
            await conn.query(
                "INSERT INTO interacoes (cliente_id, usuario_id, tipo, descricao) VALUES (?, ?, 'Sistema', ?)",
                [r.insertId, admin.insertId, `Lead captado via prospecção no mapa${site ? '' : ' · oportunidade SEM SITE'}.`]
            );
        }

        conn.release();

        res.send(`
            <div style="font-family: sans-serif; padding: 24px; max-width: 640px; margin: 0 auto;">
                <h2 style="color: #16a34a;">✅ Studio Mythos instalado com sucesso!</h2>
                <p>Schema recriado: usuarios, clientes (leads), interacoes, lancamentos.</p>
                <ul>
                    <li>1 administrador + 2 vendedores criados</li>
                    <li>6 leads de exemplo no funil (Curitiba)</li>
                </ul>
                <p><strong>Admin:</strong> almir.seibert@gmail.com &nbsp; | &nbsp; <strong>Senha:</strong> 123456</p>
                <p><strong>Vendedores:</strong> mariana@digitalpluss.com · rafael@digitalpluss.com (senha 123456)</p>
                <p>Volte ao sistema e faça login. Tudo pronto! 🚀</p>
            </div>
        `);
    } catch (error) {
        if (conn) {
            try { await conn.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (e) {}
            conn.release();
        }
        console.error('Erro na Instalação:', error);
        res.status(500).send(`<div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #dc2626;">❌ Erro ao configurar o banco de dados.</h2>
            <p><b>Detalhe:</b> ${error.message}</p></div>`);
    }
});

// 4. Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/leads', verificarToken, leadRoutes);
app.use('/api/prospeccao', verificarToken, prospeccaoRoutes);
app.use('/api/clientes', verificarToken, clienteRoutes);
app.use('/api/financeiro', verificarToken, financeiroRoutes);
app.use('/api/relatorios', verificarToken, relatorioRoutes);

// 5. 404
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint da API não encontrado.' });
});

// 6. Erros globais
app.use((err, req, res, next) => {
    console.error('Erro global na API:', err.stack);
    res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
});

// 7. Start
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Backend Studio Mythos rodando na porta ${PORT}`);
    console.log(`✅ Prospecção por mapa (Overpass/OSM) ativa`);
    console.log(`======================================================\n`);
});
