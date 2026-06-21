// Rotas PÚBLICAS (sem token): recebem envios do site (currículos e orçamentos).
const express = require('express');
const router = express.Router();
const curriculoController = require('../controllers/curriculoController');
const orcamentoController = require('../controllers/orcamentoController');

router.post('/curriculos', curriculoController.criar);
router.post('/orcamentos', orcamentoController.criar);

module.exports = router;
