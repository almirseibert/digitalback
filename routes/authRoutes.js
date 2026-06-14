const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verificarToken = require('../middlewares/authMiddleware');

router.post('/login', authController.login);
router.get('/usuarios', verificarToken, authController.listarUsuarios);
router.post('/usuarios', verificarToken, authController.criarUsuario);
router.get('/vendedores', verificarToken, authController.listarVendedores);

module.exports = router;
