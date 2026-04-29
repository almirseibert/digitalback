const dbPool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const authController = {
    login: async (req, res) => {
        const { email, password } = req.body;
        try {
            const [rows] = await dbPool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
            if (rows.length === 0) return res.status(401).json({ success: false, error: 'E-mail ou palavra-passe incorretos.' });

            const usuario = rows[0];
            const senhaValida = await bcrypt.compare(password, usuario.senha);
            if (!senhaValida) return res.status(401).json({ success: false, error: 'E-mail ou palavra-passe incorretos.' });

            const token = jwt.sign(
                { id: usuario.id, email: usuario.email, nome: usuario.nome },
                process.env.JWT_SECRET || 'super_chave_secreta_digital_plus_crm_2026',
                { expiresIn: '8h' }
            );

            res.json({ success: true, token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: 'Erro interno no servidor.' });
        }
    },
    listarUsuarios: async (req, res) => {
        try {
            const [rows] = await dbPool.query('SELECT id, nome, email, data_criacao FROM usuarios ORDER BY data_criacao DESC');
            res.json({ success: true, data: rows });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Erro ao buscar utilizadores.' });
        }
    },
    criarUsuario: async (req, res) => {
        const { nome, email, senha } = req.body;
        if (req.usuario.email !== 'almir.seibert@gmail.com') return res.status(403).json({ success: false, error: 'Acesso negado.' });
        try {
            const salt = await bcrypt.genSalt(10);
            const senhaHash = await bcrypt.hash(senha, salt);
            await dbPool.query('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', [nome, email, senhaHash]);
            res.status(201).json({ success: true, mensagem: 'Utilizador criado com sucesso!' });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, error: 'E-mail já em uso.' });
            res.status(500).json({ success: false, error: 'Erro ao criar utilizador.' });
        }
    }
};
module.exports = authController;
