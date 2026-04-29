const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ success: false, error: 'Acesso negado. Token não fornecido.' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'super_chave_secreta_digital_plus_crm_2026', (err, decoded) => {
        if (err) {
            return res.status(401).json({ success: false, error: 'Sessão expirada ou token inválido.' });
        }
        req.usuario = decoded; 
        next(); 
    });
};

module.exports = verificarToken;
