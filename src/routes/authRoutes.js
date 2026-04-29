const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verificarToken = require('../middlewares/authMiddleware');

// Rotas Públicas
router.post('/login', authController.login);

// Rotas Privadas (Gestão de Administradores)
router.get('/usuarios', verificarToken, authController.listarUsuarios);
router.post('/usuarios', verificarToken, authController.criarUsuario);

module.exports = router;
