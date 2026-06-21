// Garante que apenas administradores acessem a rota.
// Deve ser usado SEMPRE depois do verificarToken (que popula req.usuario).
const SUPER_ADMIN = 'almir.seibert@gmail.com';

const exigirAdmin = (req, res, next) => {
    const u = req.usuario;
    if (u && (u.papel === 'admin' || u.email === SUPER_ADMIN)) {
        return next();
    }
    return res.status(403).json({ success: false, error: 'Acesso restrito a administradores.' });
};

module.exports = exigirAdmin;
