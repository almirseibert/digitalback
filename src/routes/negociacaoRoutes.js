const express = require('express');
const router = express.Router();
const negociacaoController = require('../controllers/negociacaoController');

router.get('/', negociacaoController.listarNegociacoes);
router.post('/', negociacaoController.criarNegociacao);
router.put('/:id/fase', negociacaoController.atualizarFase);

module.exports = router;