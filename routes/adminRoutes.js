// Rotas de ADMINISTRAÇÃO (montadas atrás de verificarToken + exigirAdmin no server.js).
const express = require('express');
const router = express.Router();
const curriculoController = require('../controllers/curriculoController');
const orcamentoController = require('../controllers/orcamentoController');

// Currículos / candidaturas
router.get('/curriculos', curriculoController.listar);
router.get('/curriculos/:id', curriculoController.detalhe);
router.put('/curriculos/:id/status', curriculoController.atualizarStatus);

// Solicitações de orçamento (inclui capacetes personalizados)
router.get('/orcamentos', orcamentoController.listar);
router.get('/orcamentos/:id', orcamentoController.detalhe);
router.put('/orcamentos/:id/status', orcamentoController.atualizarStatus);

module.exports = router;
