const express = require('express');
const router = express.Router();
const financeiroController = require('../controllers/financeiroController');

router.get('/', financeiroController.listarLancamentos);
router.post('/', financeiroController.criarLancamento);

module.exports = router;